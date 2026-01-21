"""
Point of Sale (PoS) Router for ERPNext-backed tenants.
Provides high-level PoS operations abstracted from the underlying engine.

This router is designed for:
- Paint Shop Ltd case study (retail paint business)
- Multiple customer types with commission structures
- Cash/Mpesa/Bank payment modes
- Inventory management

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import date, datetime, timezone
import json
import csv
import io
import logging
import uuid
import hashlib

logger = logging.getLogger(__name__)
from app.services.erpnext_client import erpnext_adapter
from app.config import settings
from app.dependencies.auth import get_current_user, require_tenant_access
from app.middleware.response_normalizer import ResponseNormalizer
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.services.pos.vat_service import VATService
from app.services.pos.gl_distribution_service import GLDistributionService
from app.services.pos.accounting_integration import AccountingIntegrationService
from app.services.pos.inventory_integration import InventoryIntegrationService
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.rbac import Role
from app.models.pos_warehouse_access import WarehouseAccessRole, WarehouseAccessUser
from app.models.iam import Tenant

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover
    Redis = None  # type: ignore

_redis_client = None


def _get_redis_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if Redis is None:
        return None
    try:
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception:
        _redis_client = None
        return None

router = APIRouter(
    tags=["Point of Sale"]
)


# ==================== Request/Response Models ====================

class POSItem(BaseModel):
    item_code: str
    qty: float
    rate: Optional[float] = None  # Will use standard_rate if not provided
    warehouse: Optional[str] = None  # Will use default from POS Profile if not provided
    is_vatable: bool = True  # Whether item is VATable


class POSPayment(BaseModel):
    mode_of_payment: str  # Cash, Mpesa, Pesalink
    amount: float


class POSInvoiceRequest(BaseModel):
    customer: Optional[str] = Field("Walk-in Customer", description="Customer name - defaults to 'Walk-in Customer' if not specified")
    customer_type: str = Field(..., description="Direct, Fundi, Sales Team, or Wholesaler")
    referral_code: Optional[str] = Field(None, description="Sales person code e.g., FND-001")
    pos_profile_id: str = Field(..., description="POS Profile ID - required for warehouse and payment account mapping")
    items: List[POSItem]
    payments: List[POSPayment]
    is_vatable: bool = Field(True, description="Whether this invoice is subject to VAT")
    notes: Optional[str] = None


class POSBulkStockRequest(BaseModel):
    pos_profile_id: Optional[str] = Field(None, description="POS Profile ID (preferred). Used to resolve warehouse server-side")
    warehouse: Optional[str] = Field(None, description="Warehouse override (optional). If provided, takes precedence")
    item_codes: List[str] = Field(..., min_length=1, description="Item codes to fetch stock for")


class POSBulkStockEntry(BaseModel):
    item_code: str
    qty: float


class POSBulkStockResponse(BaseModel):
    warehouse: str
    pos_profile_id: Optional[str] = None
    as_of: str
    stocks: List[POSBulkStockEntry]
    missing_item_codes: List[str] = Field(default_factory=list)


class CustomerCreate(BaseModel):
    customer_name: str
    customer_type: str = "Individual"  # Individual or Company
    customer_group: str = "Direct"  # Direct, Fundi, Sales Team, Wholesaler
    phone: Optional[str] = None
    email: Optional[str] = None


class SalesPersonCreate(BaseModel):
    sales_person_name: str
    person_type: str  # Fundi, Sales Team, Wholesaler
    commission_rate: float
    phone: Optional[str] = None
    referral_prefix: Optional[str] = None  # FND-, SLS-, WHL-


# ==================== Catalog Endpoints ====================

@router.get("/items")
async def list_items(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all available items for sale.
    Returns item code, name, price, and stock availability.
    """
    import json
    
    items = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Item",
        method="GET",
        params={
            "fields": json.dumps([
                "name",
                "item_code",
                "item_name",
                "standard_rate",
                "stock_uom",
                "is_stock_item",
                "description",
                "image"
            ]),
            "limit_page_length": 500
        }
    )
    if isinstance(items, dict):
        items = items.get("data", [])
    normalized_items = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        item_code = item.get("item_code") or item.get("name")
        normalized_items.append({
            "item_code": item_code,
            "item_name": item.get("item_name") or item_code,
            "standard_rate": item.get("standard_rate") or 0,
            "stock_uom": item.get("stock_uom") or "Nos",
            "is_stock_item": bool(item.get("is_stock_item")) if item.get("is_stock_item") is not None else None,
            "description": item.get("description"),
            "image": item.get("image")
        })
    return {"items": normalized_items}


@router.get("/items/{item_code}")
async def get_item(
    item_code: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific item including current stock."""
    item = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Item/{item_code}",
        method="GET"
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return ResponseNormalizer.normalize_erpnext(item)


@router.get("/items/{item_code}/stock")
async def get_item_stock(
    item_code: str,
    warehouse: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get stock balance for an item, optionally filtered by warehouse."""
    import json
    
    try:
        # Try using the ERPNext method first
        params = {"item_code": item_code}
        if warehouse:
            params["warehouse"] = warehouse

        stock = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="method/erpnext.stock.utils.get_stock_balance",
            method="GET",
            params=params
        )
        
        # Handle different response formats
        if isinstance(stock, dict):
            if "message" in stock:
                message = stock.get("message")
                if isinstance(message, dict):
                    qty = message.get("qty", message.get("stock_qty", message.get("actual_qty", 0)))
                else:
                    qty = message
            else:
                qty = stock.get("qty", stock.get("stock_qty", stock.get("actual_qty", 0)))
        elif isinstance(stock, (int, float)):
            qty = float(stock)
        else:
            qty = 0
        
        # If method returns 0, try stock ledger as a fallback for accuracy
        if qty == 0:
            raise ValueError("Stock balance returned 0; attempting ledger fallback")
        
        return {"item_code": item_code, "warehouse": warehouse, "qty": qty}
    
    except Exception as e:
        # Fallback: Query Stock Ledger Entry to get latest balance
        try:
            filters = [["item_code", "=", item_code]]
            if warehouse:
                filters.append(["warehouse", "=", warehouse])
            
            # Get latest entry sorted by posting date/time
            params = {
                "filters": json.dumps(filters),
                "limit_page_length": 1,
                "fields": json.dumps(["qty_after_transaction", "warehouse"]),
                "order_by": "posting_date desc, posting_time desc, creation desc"
            }
            
            ledger_entries = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Stock Ledger Entry",
                method="GET",
                params=params
            )
            
            # Get the latest entry's qty_after_transaction
            if isinstance(ledger_entries, dict):
                entries = ledger_entries.get("data", [])
            elif isinstance(ledger_entries, list):
                entries = ledger_entries
            else:
                entries = []
            
            if entries and len(entries) > 0:
                latest_entry = entries[0]
                qty = float(latest_entry.get("qty_after_transaction", 0))
            else:
                # No ledger entries means 0 stock
                qty = 0
            
            return {"item_code": item_code, "warehouse": warehouse, "qty": qty}
        
        except Exception as fallback_error:
            # If both methods fail, return 0 stock with a warning
            print(f"Warning: Could not get stock for {item_code}: {str(e)}, fallback also failed: {str(fallback_error)}")
            return {"item_code": item_code, "warehouse": warehouse, "qty": 0}


@router.post("/stock/bulk", response_model=POSBulkStockResponse)
async def get_bulk_item_stock(
    request: POSBulkStockRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
):
    """Bulk stock lookup for multiple items in a warehouse.

    Designed for POS grid rendering: fetches quantities in one ERPNext call.
    Uses Bin.projected_qty when available, falling back to Bin.actual_qty.

    Caches results briefly (default 15s) to reduce load while keeping stock reasonably fresh.
    """

    warehouse = (request.warehouse or "").strip() or None
    pos_profile_id = (request.pos_profile_id or "").strip() or None
    item_codes_raw = request.item_codes or []

    # De-dupe item codes while preserving input order
    seen = set()
    item_codes: List[str] = []
    for code in item_codes_raw:
        if not code:
            continue
        if code in seen:
            continue
        seen.add(code)
        item_codes.append(code)

    if not item_codes:
        raise HTTPException(status_code=422, detail="item_codes must not be empty")

    if warehouse is None and pos_profile_id is None:
        raise HTTPException(status_code=422, detail="Provide either pos_profile_id or warehouse")

    if warehouse is None and pos_profile_id is not None:
        profile = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/POS Profile/{pos_profile_id}",
            method="GET",
        )
        profile_data = profile.get("data") if isinstance(profile, dict) else profile
        if not isinstance(profile_data, dict):
            raise HTTPException(status_code=404, detail="POS Profile not found")
        warehouse = (profile_data.get("warehouse") or "").strip() or None

    if not warehouse:
        raise HTTPException(status_code=400, detail="Could not resolve warehouse")

    # Short-lived cache (freshness > hit rate)
    redis_client = _get_redis_client()
    cache_ttl_seconds = 15
    cache_key = None
    if redis_client is not None:
        try:
            item_codes_key = ",".join(sorted(item_codes))
            digest = hashlib.sha1(item_codes_key.encode("utf-8")).hexdigest()
            cache_key = f"pos:stockbulk:{tenant_id}:{warehouse}:{digest}"
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            cache_key = None

    # Query ERPNext Bin (reservation-aware via projected_qty)
    filters = [["warehouse", "=", warehouse], ["item_code", "in", item_codes]]
    bin_result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Bin",
        method="GET",
        params={
            "fields": json.dumps(["item_code", "projected_qty", "actual_qty"]),
            "filters": json.dumps(filters),
            "limit_page_length": max(len(item_codes), 1),
        },
    )

    bin_rows = []
    if isinstance(bin_result, dict):
        bin_rows = bin_result.get("data", []) or []
    elif isinstance(bin_result, list):
        bin_rows = bin_result

    qty_by_item: Dict[str, float] = {}
    for row in bin_rows:
        if not isinstance(row, dict):
            continue
        code = row.get("item_code")
        if not code:
            continue
        projected = row.get("projected_qty")
        actual = row.get("actual_qty")
        value = projected if projected is not None else actual
        try:
            qty_by_item[str(code)] = float(value or 0)
        except Exception:
            qty_by_item[str(code)] = 0.0

    missing_item_codes = [code for code in item_codes if code not in qty_by_item]
    stocks = [{"item_code": code, "qty": float(qty_by_item.get(code, 0.0))} for code in item_codes]

    response = {
        "warehouse": warehouse,
        "pos_profile_id": pos_profile_id,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "stocks": stocks,
        "missing_item_codes": missing_item_codes,
    }

    if redis_client is not None and cache_key is not None:
        try:
            await redis_client.setex(cache_key, cache_ttl_seconds, json.dumps(response))
        except Exception:
            pass

    return response


# ==================== Warehouse Endpoints ====================

@router.get("/warehouses")
async def list_warehouses(
    include_all: bool = Query(False, description="Admin-only: include all warehouses for this tenant (company-scoped), not just those with active POS profiles"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    pos_service: PosServiceBase = Depends(get_pos_service),
    db: Session = Depends(get_db)
):
    """
    Get warehouses filtered by active POS Profiles.
    Returns only warehouses with active profiles, including profile_id.
    """
    roles = current_user.get("roles", [])
    is_pos_admin = bool(current_user.get("is_super_admin")) or any(r in roles for r in ("SUPER_ADMIN", "OWNER", "ADMIN", "MANAGER"))

    # Resolve tenant company name (for tenant/workspace scoping)
    tenant_company = None
    try:
        tenant_uuid = uuid.UUID(tenant_id)
        tenant_obj = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
        tenant_company = tenant_obj.name if tenant_obj else None
    except ValueError:
        tenant_company = None

    if include_all and not is_pos_admin:
        raise HTTPException(status_code=403, detail="Only admin users can request include_all warehouses")

    # Get all POS Profiles
    try:
        profiles = await pos_service.list_profiles(limit=1000)
    except Exception:
        profiles = []
    
    # Get all warehouses
    # Get all warehouses (scoped to tenant's company when possible)
    warehouse_params = None
    if tenant_company:
        warehouse_params = {
            "filters": json.dumps([["company", "=", tenant_company]]),
            "limit_page_length": 1000,
        }

    warehouses = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse",
        method="GET",
        params=warehouse_params,
    )

    # Normalize ERPNext list response
    if isinstance(warehouses, dict):
        warehouses = warehouses.get("data", [])
    elif not isinstance(warehouses, list):
        warehouses = []
    
    # Create mapping of warehouse to profile_id
    warehouse_to_profile = {}
    profile_to_warehouse = {}
    for profile in profiles:
        warehouse_name = profile.get("warehouse")
        if warehouse_name:
            profile_id = profile.get("name") or profile.get("id")
            if profile_id:
                warehouse_to_profile[warehouse_name] = profile_id
                profile_to_warehouse[profile_id] = warehouse_name
    
    # Filter warehouses
    # Default: only warehouses with active POS profiles (keeps POS UI expectations)
    # Admin include_all: return all company-scoped warehouses, and attach profile_id when available
    filtered_warehouses = []
    for warehouse in warehouses:
        warehouse_name = warehouse.get("name") or warehouse.get("warehouse_name")
        if not warehouse_name:
            continue

        if include_all and is_pos_admin:
            if warehouse_name in warehouse_to_profile:
                warehouse["profile_id"] = warehouse_to_profile[warehouse_name]
            filtered_warehouses.append(warehouse)
            continue

        if warehouse_name in warehouse_to_profile:
            warehouse["profile_id"] = warehouse_to_profile[warehouse_name]
            filtered_warehouses.append(warehouse)

    # Apply warehouse access rules for cashiers
    allowed_warehouses = None

    if "CASHIER" in roles and not is_pos_admin:
        try:
            tenant_uuid = uuid.UUID(tenant_id)
        except ValueError:
            tenant_uuid = None

        role = db.query(Role).filter(Role.code == "CASHIER").first()
        if role and tenant_uuid:
            role_entries = db.query(WarehouseAccessRole).filter(
                WarehouseAccessRole.tenant_id == tenant_uuid,
                WarehouseAccessRole.role_id == role.id
            ).all()
            if role_entries:
                allowed_warehouses = {entry.warehouse_name for entry in role_entries}

        user_id = current_user.get("user_id")
        if user_id and tenant_uuid:
            try:
                user_uuid = uuid.UUID(user_id)
            except ValueError:
                user_uuid = None

            if user_uuid:
                user_entries = db.query(WarehouseAccessUser).filter(
                    WarehouseAccessUser.tenant_id == tenant_uuid,
                    WarehouseAccessUser.user_id == user_uuid
                ).all()
                if user_entries:
                    # User overrides take precedence over role mappings when present
                    allowed_warehouses = {entry.warehouse_name for entry in user_entries}

    if allowed_warehouses is not None:
        filtered_warehouses = [
            warehouse for warehouse in filtered_warehouses
            if (warehouse.get("name") or warehouse.get("warehouse_name")) in allowed_warehouses
        ]

    # Enforce one open session per warehouse for cashiers
    if "CASHIER" in roles and not is_pos_admin:
        try:
            open_sessions = await pos_service.list_sessions(status="Open", limit=1000)
        except Exception:
            open_sessions = []

        if open_sessions:
            open_warehouses = set()
            for session in open_sessions:
                profile_id = session.get("pos_profile")
                if profile_id in profile_to_warehouse:
                    open_warehouses.add(profile_to_warehouse[profile_id])

            if open_warehouses:
                filtered_warehouses = [
                    warehouse for warehouse in filtered_warehouses
                    if (warehouse.get("name") or warehouse.get("warehouse_name")) not in open_warehouses
                ]
    
    return {"warehouses": filtered_warehouses}


# ==================== Payment Modes ====================

@router.get("/payment-modes")
async def list_payment_modes(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get all available payment modes (Cash, Mpesa, etc.)."""
    modes = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Mode of Payment",
        method="GET"
    )
    return {"payment_modes": modes or []}


# ==================== Customer Management ====================

@router.get("/customers")
async def list_customers(
    customer_group: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List all customers, optionally filtered by group."""
    customers = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Customer",
        method="GET"
    )
    
    # Filter by group if specified
    if customer_group and customers:
        if isinstance(customers, dict):
            customers = customers.get("data", [])
        customers = [c for c in customers if c.get("customer_group") == customer_group]
    
    # Standardize response format
    if isinstance(customers, dict):
        customers = customers.get("data", [])
    return {"data": customers or []}


@router.post("/customers")
async def create_customer(
    customer: CustomerCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Create a new customer."""
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Customer",
        method="POST",
        json_data=customer.model_dump()
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/customers/{customer_name}")
async def get_customer(
    customer_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific customer."""
    customer = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Customer/{customer_name}",
        method="GET"
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer.get("data") if isinstance(customer, dict) and "data" in customer else customer


@router.put("/customers/{customer_name}")
async def update_customer(
    customer_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing customer."""
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Customer/{customer_name}",
        method="PUT",
        json_data=data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/customers/{customer_name}", status_code=204)
async def delete_customer(
    customer_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Delete a customer."""
    erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Customer/{customer_name}",
        method="DELETE"
    )
    return None


# ==================== Sales Persons ====================

@router.get("/sales-persons")
async def list_sales_persons(
    person_type: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List all sales persons (Fundis, Sales Team, Wholesalers)."""
    persons = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Sales Person",
        method="GET"
    )
    
    # Filter by type if specified
    if person_type and persons:
        if isinstance(persons, dict):
            persons = persons.get("data", [])
        persons = [p for p in persons if p.get("person_type") == person_type]
    
    # Standardize response format
    if isinstance(persons, dict):
        persons = persons.get("data", [])
    return {"data": persons or []}


@router.post("/sales-persons")
async def create_sales_person(
    person: SalesPersonCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Register a new sales person (Fundi, Sales Team member, Wholesaler)."""
    # Auto-generate referral prefix if not provided
    prefix_map = {"Fundi": "FND-", "Sales Team": "SLS-", "Wholesaler": "WHL-"}
    if not person.referral_prefix:
        person.referral_prefix = prefix_map.get(person.person_type, "REF-")
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Sales Person",
        method="POST",
        json_data=person.model_dump()
    )
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Invoice (PoS Transaction) ====================

@router.post("/invoice")
async def create_invoice(
    invoice: POSInvoiceRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a PoS Sales Invoice.
    """
    logger.info(f"POS invoice creation started for tenant {tenant_id}, customer {invoice.customer}, profile {invoice.pos_profile_id}")
    
    """
    This is the main transaction endpoint. It will:
    1. Fetch and validate POS Profile
    2. Extract warehouse and payment accounts from profile
    3. Validate all accounts exist
    4. Validate stock availability
    5. Calculate commissions based on customer_type and referral_code
    6. Process payments
    7. Update inventory
    8. Return the completed invoice with commission details
    """
    
    # Determine company from tenant
    from app.database import get_db
    from app.models.iam import Tenant
    from sqlalchemy.orm import Session

    db: Session = next(get_db())
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail={
                "type": "tenant_not_found",
                "message": "Tenant not found"
            }
        )
    # Resolve company from tenant settings or ERPNext
    company = tenant.name
    if tenant.tenant_settings and tenant.tenant_settings.company_name:
        company = tenant.tenant_settings.company_name
    company_names = []
    try:
        companies_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Company",
            method="GET",
            params={"limit_page_length": 100}
        )
        company_names = [c.get("name") for c in (companies_response.get("data", []) if isinstance(companies_response, dict) else []) if isinstance(c, dict) and c.get("name")]
        if company not in company_names and company_names:
            company = company_names[0]
    except Exception:
        # Proceed with resolved company even if ERPNext lookup fails
        pass
    logger.info(f"Using company '{company}' for tenant {tenant_id}")

    # Fetch POS Profile and extract details (REQUIRED for POS Profile Integration)
    try:
        profile = await pos_service.get_pos_profile_details(invoice.pos_profile_id)
        logger.info(f"POS Profile {invoice.pos_profile_id} fetched for tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Failed to fetch required POS Profile {invoice.pos_profile_id}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "type": "pos_profile_not_found",
                "message": f"POS Profile {invoice.pos_profile_id} not found or inaccessible",
                "pos_profile_id": invoice.pos_profile_id
            }
        )

    # Extract warehouse from profile (REQUIRED)
    profile_warehouse = profile.get('warehouse')
    if not profile_warehouse:
        logger.error(f"POS Profile {invoice.pos_profile_id} does not have a warehouse configured")
        raise HTTPException(
            status_code=400,
            detail={
                "type": "pos_profile_invalid",
                "message": f"POS Profile {invoice.pos_profile_id} must have a warehouse configured",
                "pos_profile_id": invoice.pos_profile_id
            }
        )
    logger.info(f"Using warehouse from POS profile: {profile_warehouse}")

    # Ensure warehouse is not a group node
    try:
        wh_doc = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Warehouse/{profile_warehouse}",
            method="GET"
        )
        wh_data = wh_doc.get("data") if isinstance(wh_doc, dict) else wh_doc
        if isinstance(wh_data, dict) and wh_data.get("is_group") == 1:
            logger.warning(f"Warehouse {profile_warehouse} is a group; resolving a child warehouse")
            child_response = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Warehouse",
                method="GET",
                params={
                    "filters": json.dumps([
                        ["parent_warehouse", "=", profile_warehouse],
                        ["is_group", "=", 0]
                    ]),
                    "fields": '["name"]',
                    "limit_page_length": 1
                }
            )
            child_list = child_response.get("data", []) if isinstance(child_response, dict) else []
            if child_list:
                profile_warehouse = child_list[0].get("name")
                logger.info(f"Using child warehouse: {profile_warehouse}")
            else:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "warehouse_group_not_allowed",
                        "message": f"Warehouse {profile_warehouse} is a group and has no child warehouses for transactions"
                    }
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Failed to validate warehouse group status: {e}")

    # Override company if profile has a valid company
    profile_company = profile.get('company')
    if profile_company and (not company_names or profile_company in company_names):
        company = profile_company
        logger.info(f"Using company from POS profile: {company}")

    # Validate customer exists (auto-create for new customers)
    try:
        customer_result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Customer/{invoice.customer}",
            method="GET"
        )
        logger.info(f"Customer {invoice.customer} validated for tenant {tenant_id}")
    except HTTPException as e:
        if e.status_code == 404:
            logger.warning(f"Customer {invoice.customer} not found; creating new customer")
            customer_group = invoice.customer_type if invoice.customer_type in ["Direct", "Fundi", "Sales Team", "Wholesaler"] else "Direct"
            try:
                erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path="resource/Customer",
                    method="POST",
                    json_data={
                        "customer_name": invoice.customer,
                        "customer_group": customer_group,
                        "customer_type": "Individual"
                    }
                )
                logger.info(f"Customer {invoice.customer} created for tenant {tenant_id}")
            except Exception as create_error:
                logger.error(f"Failed to create customer {invoice.customer}: {create_error}")
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "customer_not_found",
                        "message": f"Customer {invoice.customer} not found and could not be created",
                        "customer": invoice.customer
                    }
                )
        else:
            raise

    # If no warehouse from profile, try to find a default warehouse
    if not profile_warehouse:
        try:
            warehouses_result = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Warehouse",
                method="GET",
                params={
                    "filters": f'[["company", "=", "{company}"]]',
                    "limit_page_length": 10
                }
            )

            if isinstance(warehouses_result, dict):
                warehouses = warehouses_result.get("data", [])
                if warehouses:
                    # Prefer stores over other warehouse types
                    for wh in warehouses:
                        if 'store' in wh.get('name', '').lower():
                            profile_warehouse = wh.get('name')
                            break
                    if not profile_warehouse:
                        profile_warehouse = warehouses[0].get('name')

                    logger.info(f"Using fallback warehouse: {profile_warehouse}")
        except Exception as e:
            logger.error(f"Failed to find fallback warehouse: {e}")

    if not profile_warehouse:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "no_warehouse_available",
                "message": "No warehouse available for invoice creation"
            }
        )
    
    # Extract payment accounts from profile (REQUIRED for account mapping)
    payment_accounts = profile.get('payment_accounts', {})
    if not payment_accounts:
        logger.warning(f"POS Profile {invoice.pos_profile_id} has no payment accounts configured")
        # Continue with empty dict - validation will catch missing accounts
    
    # Initialize services
    vat_service = VATService()
    accounting_service = AccountingIntegrationService(pos_service)
    inventory_service = InventoryIntegrationService(erpnext_adapter, tenant_id)
    
    # Validate payment accounts exist
    payment_modes = [p.mode_of_payment for p in invoice.payments]
    accounts_to_validate = [payment_accounts.get(mode) for mode in payment_modes if payment_accounts.get(mode)]
    accounts_to_validate = [acc for acc in accounts_to_validate if acc]  # Remove None values
    
    # Validate payment accounts (skip in demo mode)
    import os
    if accounts_to_validate and not os.getenv("SKIP_POS_STOCK_VALIDATION", "false").lower() == "true":
        try:
            await accounting_service.validate_payment_accounts(payment_accounts, company)
            logger.info(f"Payment accounts validated for tenant {tenant_id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Payment account validation failed: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "payment_account_validation_failed",
                    "message": "Payment account validation failed",
                    "payment_accounts": payment_accounts,
                    "error": str(e)
                }
            )
    elif accounts_to_validate:
        logger.info(f"Skipping payment account validation in demo mode for tenant {tenant_id}")
    
    # Validate stock availability before processing (skip in development/demo mode)
    import os
    skip_stock_validation = os.getenv("SKIP_POS_STOCK_VALIDATION", "false").lower() == "true"

    if not skip_stock_validation:
        try:
            await inventory_service.validate_stock_availability(
                [
                    {
                        "item_code": item.item_code,
                        "qty": item.qty,
                        "warehouse": item.warehouse or profile_warehouse,
                    }
                    for item in invoice.items
                ],
                profile_warehouse,
            )
            logger.info(f"Stock availability validated for {len(invoice.items)} items")
        except HTTPException as e:
            logger.warning(f"Stock validation failed: {e.detail}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during stock validation: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail={
                    "type": "stock_validation_error",
                    "message": "Stock validation failed",
                    "error": str(e)
                }
            )
    else:
        logger.info(f"Skipping stock validation for {len(invoice.items)} items (development mode)")
    
    # Fetch accounts once for fallback mapping
    account_names = set()
    account_types = {}
    account_is_group = {}
    try:
        accounts_result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Account",
            method="GET",
            params={
                "filters": f'[[\"company\", \"=\", \"{company}\"]]',
                "fields": '["name","account_type","is_group"]',
                "limit_page_length": 1000
            }
        )
        for acc in accounts_result.get("data", []) if isinstance(accounts_result, dict) else []:
            name = acc.get("name")
            if name:
                account_names.add(name)
                account_types[name] = acc.get("account_type")
                account_is_group[name] = acc.get("is_group")
    except Exception as e:
        logger.warning(f"Failed to load account list for fallback mapping: {e}")

    def pick_account_by_type(type_candidates, name_hint=None) -> Optional[str]:
        if name_hint:
            for name in account_names:
                if account_is_group.get(name) == 0 and name_hint.lower() in name.lower():
                    return name
        for name, acc_type in account_types.items():
            if acc_type in type_candidates and account_is_group.get(name) == 0:
                return name
        return None

    fallback_income_account = (
        pick_account_by_type(["Income"], "sales") or
        pick_account_by_type(["Income"])
    )
    fallback_expense_account = (
        pick_account_by_type(["Expense", "Cost of Goods Sold"], "cost of goods") or
        pick_account_by_type(["Expense", "Cost of Goods Sold"])
    )
    fallback_cash_account = (
        pick_account_by_type(["Cash"], "cash") or
        pick_account_by_type(["Cash"])
    )
    fallback_bank_account = (
        pick_account_by_type(["Bank"], "bank") or
        pick_account_by_type(["Bank"])
    )

    # Prepare items with warehouse from profile and fetch item details
    items_data = []
    items_for_vat = []
    
    for item in invoice.items:
        # Use item warehouse if provided, otherwise use profile warehouse
        warehouse = item.warehouse or profile_warehouse
        
        # Fetch item details for rate and accounts
        try:
            item_detail = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Item/{item.item_code}",
                method="GET"
            )
        except HTTPException as e:
            if e.status_code == 404:
                logger.error(f"Item {item.item_code} not found for tenant {tenant_id}")
                raise HTTPException(
                    status_code=404,
                    detail={
                        "type": "item_not_found",
                        "message": f"Item {item.item_code} not found",
                        "item_code": item.item_code
                    }
                )
            else:
                raise

        if not item_detail:
            logger.error(f"Item {item.item_code} not found for tenant {tenant_id}")
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "item_not_found",
                    "message": f"Item {item.item_code} not found",
                    "item_code": item.item_code
                }
            )
        
        # Get rate
        rate = item.rate or item_detail.get("standard_rate", 0)
        amount = rate * item.qty
        
        # Prepare item data for invoice
        income_account = (
            item_detail.get("income_account")
            or item_detail.get("default_income_account")
            or f"Sales - {company}"
        )
        if income_account not in account_names and fallback_income_account:
            income_account = fallback_income_account

        expense_account = (
            item_detail.get("expense_account")
            or item_detail.get("default_expense_account")
            or f"Cost of Goods Sold - {company}"
        )
        if expense_account not in account_names and fallback_expense_account:
            expense_account = fallback_expense_account
        item_data = {
            "item_code": item.item_code,
            "qty": item.qty,
            "warehouse": warehouse,
            "rate": rate,
            "income_account": income_account,
            "expense_account": expense_account
        }
        items_data.append(item_data)
        
        # Prepare item data for VAT calculation
        items_for_vat.append({
            "amount": amount,
            "is_vatable": item.is_vatable,
            "vat_rate": item_detail.get("taxes", [{}])[0].get("tax_rate") if item_detail.get("taxes") else None,
            "income_account": item_detail.get("income_account"),
            "default_income_account": item_detail.get("default_income_account"),
            "expense_account": item_detail.get("expense_account"),
            "default_expense_account": item_detail.get("default_expense_account"),
            "valuation_rate": item_detail.get("valuation_rate", 0)
        })
    
    # Calculate VAT for all items (respect invoice-level VAT setting)
    vat_result = vat_service.calculate_vat_for_items(items_for_vat, invoice.is_vatable)
    
    # Get VAT account
    vat_account = vat_service.get_vat_account(company)
    
    # Validate VAT account with fallback to existing VAT accounts
    try:
        await accounting_service.validate_vat_account(vat_account, company)
    except HTTPException:
        # Try to find any VAT account for this company and fallback
        try:
            accounts_result = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Account",
                method="GET",
                params={
                    "filters": f'[[\"company\", \"=\", \"{company}\"]]',
                    "fields": '["name"]',
                    "limit_page_length": 500
                }
            )
            vat_candidates = [
                acc.get("name")
                for acc in accounts_result.get("data", [])
                if isinstance(acc, dict) and acc.get("name") and "VAT" in acc.get("name", "").upper()
            ]
            if vat_candidates:
                vat_account = vat_candidates[0]
                logger.info(f"Using fallback VAT account '{vat_account}' for company {company}")
            else:
                raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"VAT account validation failed: {str(e)}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"VAT account validation failed: {str(e)}"
        )
    
    # Validate income and expense accounts (skip in demo mode)
    import os
    if not os.getenv("SKIP_POS_STOCK_VALIDATION", "false").lower() == "true":
        try:
            await accounting_service.validate_income_accounts(items_for_vat, company)
            await accounting_service.validate_expense_accounts(items_for_vat, company)
        except HTTPException:
            raise
    else:
        logger.info("Skipping account validation in demo mode")
    
    # Prepare taxes array for ERPNext
    taxes_data = []
    if vat_result["total_vat"] > 0:
        taxes_data.append({
            "charge_type": "On Net Total",
            "account_head": vat_account,
            "rate": vat_service.default_vat_rate,
            "tax_amount": vat_result["total_vat"],
            "total": vat_result["total_amount"],
            # ERPNext requires description for Sales Taxes and Charges rows
            "description": f"VAT {vat_service.default_vat_rate}%"
        })
    
    # Prepare payments with account mapping
    def resolve_payment_account(mode: str) -> Optional[str]:
        if not payment_accounts:
            return None
        if mode in payment_accounts:
            account = payment_accounts.get(mode)
            if account and account not in account_names and "demo account" not in account.lower():
                return account
            if account and account_is_group.get(account) == 0:
                return account
        # Case-insensitive match
        for key, value in payment_accounts.items():
            if isinstance(key, str) and key.lower() == mode.lower():
                if value and value not in account_names and "demo account" not in value.lower():
                    return value
                if value and account_is_group.get(value) == 0:
                    return value
        # Fallback to default or first available account
        if isinstance(payment_accounts, dict):
            if payment_accounts.get("default"):
                account = payment_accounts.get("default")
                if account and account not in account_names and "demo account" not in account.lower():
                    return account
                if account and account_is_group.get(account) == 0:
                    return account
            for value in payment_accounts.values():
                if value and value not in account_names and "demo account" not in value.lower():
                    return value
                if value and account_is_group.get(value) == 0:
                    return value
        # Final fallback to company cash/bank accounts
        if "mpesa" in mode.lower() or "bank" in mode.lower():
            return fallback_bank_account or fallback_cash_account
        return fallback_cash_account
        return None

    payments_data = []
    for p in invoice.payments:
        account = resolve_payment_account(p.mode_of_payment)
        if not account:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "payment_account_missing",
                    "message": f"No account configured for payment mode '{p.mode_of_payment}'",
                    "payment_mode": p.mode_of_payment,
                    "payment_accounts": payment_accounts
                }
            )
        payments_data.append(
            {
                "mode_of_payment": p.mode_of_payment,
                "amount": p.amount,
                "account": account
            }
        )
    
    # Validate payment amounts sum to grand total
    total_payments = sum(p.amount for p in invoice.payments)
    grand_total = vat_result["total_amount"]
    
    # Allow small rounding differences (0.01)
    if abs(total_payments - grand_total) > 0.01:
        logger.error(
            f"Payment mismatch: total_payments={total_payments}, "
            f"grand_total={grand_total} for tenant {tenant_id}"
        )
        raise HTTPException(
            status_code=400,
            detail={
                "type": "payment_amount_mismatch",
                "message": "Payment amounts do not match grand total",
                "total_payments": total_payments,
                "grand_total": grand_total,
                "difference": abs(total_payments - grand_total)
            }
        )
    
    # Create invoice payload with VAT
    payload = {
        "customer": invoice.customer,
        "customer_type": invoice.customer_type,
        "referral_code": invoice.referral_code,
        "items": items_data,
        "payments": payments_data,
        "taxes": taxes_data,
        "is_pos": 1,
        "update_stock": 1,
        "docstatus": 1,
        "company": company,
        "set_warehouse": profile_warehouse,  # Set warehouse for all items
        # Ensure currency matches company to avoid exchange rate errors
        "selling_price_list": "Standard Selling",
        "price_list_currency": "KES",
        "currency": "KES",
        "conversion_rate": 1
    }

    # Only include pos_profile if it was provided and found
    if invoice.pos_profile_id and profile:
        payload["pos_profile"] = invoice.pos_profile_id
    
    # Build GL entries for validation (before sending to ERPNext)
    gl_service = GLDistributionService(vat_service)
    invoice_data_for_gl = {
        "items": [
            {
                **item,
                **vat_item
            }
            for item, vat_item in zip(items_data, vat_result["items"])
        ],
        "payments": payments_data,
        "grand_total": grand_total,
        "total_vat": vat_result["total_vat"],
        "cost_center": profile.get("cost_center") if profile else None
    }
    
    try:
        gl_entries = gl_service.build_gl_entries(
            invoice_data_for_gl,
            payment_accounts,
            vat_account,
            company,
            invoice.customer
        )
        
        # Validate GL entries balance
        from decimal import Decimal
        gl_service.validate_gl_entries(gl_entries, Decimal(str(grand_total)))
        logger.info(f"GL entries validated: {len(gl_entries)} entries")
    except ValueError as e:
        logger.error(f"GL entry validation failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "type": "gl_entry_validation_failed",
                "message": "GL entry validation failed",
                "error": str(e),
                "gl_entries_count": len(gl_entries)
            }
        )
    
    # Send to ERPNext
    try:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="POST",
            json_data=payload
        )
        logger.info(f"Invoice created successfully for tenant {tenant_id}, customer {invoice.customer}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create invoice in ERPNext: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "type": "erpnext_invoice_creation_failed",
                "message": "Failed to create invoice in ERPNext",
                "error": str(e)
            }
        )
    
    # Add calculated VAT info to response
    if result and isinstance(result, dict):
        result["vat_calculation"] = {
            "total_base": vat_result["total_base"],
            "total_vat": vat_result["total_vat"],
            "total_amount": vat_result["total_amount"],
            "vat_breakdown": vat_result["vat_breakdown"]
        }
        result["gl_entries_preview"] = gl_entries
    
    return result


@router.get("/invoices")
async def list_invoices(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    customer_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List PoS invoices with optional filters."""
    filters = [["is_pos", "=", 1]]
    if customer_type:
        filters.append(["customer_type", "=", customer_type])
    if from_date:
        filters.append(["posting_date", ">=", from_date])
    if to_date:
        filters.append(["posting_date", "<=", to_date])

    invoices = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Sales Invoice",
        method="GET",
        params={
            "limit_page_length": limit,
            "order_by": "creation desc",
            "filters": json.dumps(filters),
            "fields": '["name","customer","posting_date","grand_total","status","is_pos"]'
        }
    )
    # Standardize response format
    if isinstance(invoices, dict):
        invoices = invoices.get("data", [])
    return {"data": invoices or []}


@router.get("/invoices/{invoice_name}")
async def get_invoice(
    invoice_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific invoice."""
    invoice = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Sales Invoice/{invoice_name}",
        method="GET"
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return ResponseNormalizer.normalize_erpnext(invoice)
@router.put("/invoices/{invoice_name}")
async def update_invoice(
    invoice_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Update POS Sales Invoice (only in Draft status)."""
    # Verify invoice exists and is in draft status
    invoice = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Sales Invoice/{invoice_name}",
        method="GET"
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("docstatus") != 0:  # 0 = Draft, 1 = Submitted, 2 = Cancelled
        raise HTTPException(status_code=403, detail="Can only edit Draft invoices")
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Sales Invoice/{invoice_name}",
        method="PUT",
        json_data=data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/invoices/{invoice_name}", status_code=204)
async def delete_invoice(
    invoice_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Delete POS Sales Invoice (only if Draft)."""
    # Verify invoice exists and is in draft status
    invoice = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Sales Invoice/{invoice_name}",
        method="GET"
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only delete Draft invoices")
    
    erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Sales Invoice/{invoice_name}",
        method="DELETE"
    )
    return None


# ==================== Reports ====================

@router.get("/reports/cash-summary")
async def get_cash_summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Get cash summary for reconciliation.
    Returns totals by payment mode (Cash, Mpesa, Bank).
    """
    params = {}
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date
    
    try:
        result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="method/paint_shop_custom.get_cash_summary",
            method="GET",
            params=params
        )
        return ResponseNormalizer.normalize_erpnext(result)
    except Exception:
        # Fallback when custom method is unavailable
        return {
            "cash": 0,
            "mpesa": 0,
            "bank": 0,
            "total": 0
        }


@router.get("/reports/commissions")
async def get_commission_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sales_person: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Get commission report.
    Shows all commissions earned by sales persons (Fundis, Sales Team, Wholesalers).
    """
    params = {}
    if from_date:
        params["from_date"] = from_date
    if to_date:
        params["to_date"] = to_date
    if sales_person:
        params["sales_person"] = sales_person
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="method/paint_shop_custom.get_commission_report",
        method="GET",
        params=params
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/reports/daily-summary")
async def get_daily_summary(
    date: str = Query(None, description="Date in YYYY-MM-DD format"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Get daily sales summary.
    Includes total sales, number of transactions, top items, and payment breakdown.
    """
    filters = []
    if date:
        filters.append(["posting_date", "=", date])
    filters.append(["docstatus", "=", 1])
    # Get sales invoices - use basic fields only to avoid ERPNext field issues
    invoice_fields = ["name", "grand_total", "customer", "posting_date"]
    try:
        invoices = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Sales Invoice",
            method="GET",
            params={
                "limit_page_length": 500,
                "fields": json.dumps(invoice_fields),
                "filters": json.dumps(filters)
            }
        )
    except Exception as e:
        logger.error(f"Failed to fetch sales invoices: {e}")
        # Return empty data instead of failing completely
        invoices = {"data": []}
    if isinstance(invoices, dict):
        invoices = invoices.get("data", [])
    if not isinstance(invoices, list):
        invoices = []
    
    # Get payment method breakdown from Sales Invoices (simplified approach)
    cash_summary = {"cash": 0, "mpesa": 0, "bank": 0, "total": 0}
    # Skip payment breakdown for now to avoid ERPNext issues
    # TODO: Implement proper payment mode tracking in POS invoices
    
    # Calculate summary
    total_sales = sum(inv.get("grand_total", 0) for inv in invoices)
    total_transactions = len(invoices)
    total_commission = 0
    
    # Count by customer (simplified - just track individual customers)
    by_customer_type = {"Walk-in": {"count": 0, "total": 0}, "Registered": {"count": 0, "total": 0}}
    for inv in invoices:
        customer = inv.get("customer", "")
        amount = inv.get("grand_total", 0)

        # Simple classification: if customer name contains "walk" or is empty, consider walk-in
        if not customer or "walk" in customer.lower():
            by_customer_type["Walk-in"]["count"] += 1
            by_customer_type["Walk-in"]["total"] += amount
        else:
            by_customer_type["Registered"]["count"] += 1
            by_customer_type["Registered"]["total"] += amount
    
    return {
        "date": date or "all",
        "total_sales": total_sales,
        "total_transactions": total_transactions,
        "total_commission": total_commission,
        "by_customer_type": by_customer_type,
        "by_payment_mode": cash_summary
    }

@router.post("/import/inventory")
async def import_inventory(
    file: UploadFile = File(...),
    tenant: dict = Depends(require_tenant_access)
):
    """
    Bulk import inventory items from CSV.
    Expected columns: item_code, item_name, item_group, standard_rate
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    results = {
        "success": True,
        "imported_count": 0,
        "errors": []
    }
    
    row_num = 1
    for row in reader:
        row_num += 1
        try:
            # Basic validation
            if not row.get("item_code") or not row.get("item_name"):
                results["errors"].append(f"Row {row_num}: Missing item_code or item_name")
                continue
                
            # Prepare Item Data
            item_data = {
                "item_code": row["item_code"],
                "item_name": row["item_name"],
                "item_group": row.get("item_group", "Products"),
                "stock_uom": row.get("stock_uom", "Nos"),
                "standard_rate": float(row.get("standard_rate", 0)),
                "valuation_rate": float(row.get("valuation_rate", 0)),
                "description": row.get("description", ""),
                "default_warehouse": "Main Paint Store - MPS" # Default for now
            }
            
            # Create in ERPNext
            # Note: erpnext_adapter.create_resource converts standard_rate/valuation_rate if needed
            erpnext_adapter.create_resource("Item", item_data)
            results["imported_count"] += 1
            
        except Exception as e:
            results["errors"].append(f"Row {row_num} ({row.get('item_code', 'Unknown')}): {str(e)}")
            
    return results
