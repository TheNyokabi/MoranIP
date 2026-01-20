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
from datetime import date
import json
import csv
import io
import logging

logger = logging.getLogger(__name__)
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_user, require_tenant_access
from app.middleware.response_normalizer import ResponseNormalizer
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.services.pos.vat_service import VATService
from app.services.pos.gl_distribution_service import GLDistributionService
from app.services.pos.accounting_integration import AccountingIntegrationService
from app.services.pos.inventory_integration import InventoryIntegrationService

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


# ==================== Warehouse Endpoints ====================

@router.get("/warehouses")
async def list_warehouses(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get warehouses filtered by active POS Profiles.
    Returns only warehouses with active profiles, including profile_id.
    """
    # Get all POS Profiles
    try:
        profiles = await pos_service.list_profiles(limit=1000)
    except Exception:
        profiles = []
    
    # Get all warehouses
    warehouses = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse",
        method="GET"
    )
    
    if not warehouses:
        warehouses = []
    
    # Create mapping of warehouse to profile_id
    warehouse_to_profile = {}
    for profile in profiles:
        warehouse_name = profile.get("warehouse")
        if warehouse_name:
            profile_id = profile.get("name") or profile.get("id")
            if profile_id:
                warehouse_to_profile[warehouse_name] = profile_id
    
    # Filter warehouses to only those with active profiles
    # and add profile_id to each warehouse
    filtered_warehouses = []
    for warehouse in warehouses:
        warehouse_name = warehouse.get("name") or warehouse.get("warehouse_name")
        if warehouse_name in warehouse_to_profile:
            warehouse["profile_id"] = warehouse_to_profile[warehouse_name]
            filtered_warehouses.append(warehouse)
    
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

    # Override company if profile has a valid company
    profile_company = profile.get('company')
    if profile_company and (not company_names or profile_company in company_names):
        company = profile_company
        logger.info(f"Using company from POS profile: {company}")

    # Validate customer exists
    try:
        customer_result = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Customer/{invoice.customer}",
            method="GET"
        )
        logger.info(f"Customer {invoice.customer} validated for tenant {tenant_id}")
    except HTTPException as e:
        if e.status_code == 404:
            logger.error(f"Customer {invoice.customer} not found for tenant {tenant_id}")
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "customer_not_found",
                    "message": f"Customer {invoice.customer} not found",
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
                [{"item_code": item.item_code, "qty": item.qty} for item in invoice.items],
                profile_warehouse
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
        item_data = {
            "item_code": item.item_code,
            "qty": item.qty,
            "warehouse": warehouse,
            "rate": rate
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
    
    # Prepare payments
    payments_data = [
        {"mode_of_payment": p.mode_of_payment, "amount": p.amount}
        for p in invoice.payments
    ]
    
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
    invoices = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Sales Invoice",
        method="GET",
        params={"limit_page_length": limit}
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
