"""
Inventory Management Router

Provides high-level inventory operations abstracted from ERPNext.
Handles items, warehouses, stock entries, and stock reconciliation.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import date, datetime
from sqlalchemy.orm import Session
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_user, require_tenant_access
from app.database import get_db
from app.models.iam import Tenant, TenantSettings
from app.middleware.response_normalizer import ResponseNormalizer

router = APIRouter(
    prefix="/inventory",
    tags=["Modules - Inventory"]
)


# ==================== Request/Response Models ====================

class ItemCreate(BaseModel):
    item_code: str
    item_name: str
    item_group: str = "Products"
    stock_uom: str = "Nos"
    standard_rate: Optional[float] = 0
    valuation_rate: Optional[float] = 0
    description: Optional[str] = None
    is_stock_item: int = 1
    include_item_in_manufacturing: int = 0


class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    item_group: Optional[str] = None
    standard_rate: Optional[float] = None
    valuation_rate: Optional[float] = None
    description: Optional[str] = None
    disabled: Optional[int] = None


class WarehouseCreate(BaseModel):
    warehouse_name: str = Field(..., min_length=1, description="Unique name for the warehouse")
    warehouse_code: Optional[str] = None
    company: Optional[str] = None
    is_group: int = 0
    parent_warehouse: Optional[str] = None
    warehouse_type: Optional[str] = None
    account: Optional[str] = None
    disabled: Optional[int] = None
    address_line_1: Optional[str] = None
    email_id: Optional[str] = None


class WarehouseUpdate(BaseModel):
    warehouse_name: Optional[str] = None
    disabled: Optional[int] = None
    warehouse_type: Optional[str] = None
    account: Optional[str] = None
    parent_warehouse: Optional[str] = None


class StockEntryItem(BaseModel):
    item_code: str
    qty: float
    s_warehouse: Optional[str] = None  # Source warehouse
    t_warehouse: Optional[str] = None  # Target warehouse
    basic_rate: Optional[float] = None


class StockEntryCreate(BaseModel):
    stock_entry_type: str  # Material Receipt, Material Issue, Material Transfer
    company: str = "Paint Shop Ltd"
    posting_date: Optional[str] = None
    items: List[StockEntryItem]
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None


class StockReconciliationItem(BaseModel):
    item_code: str
    warehouse: str
    qty: float
    valuation_rate: Optional[float] = None


class StockReconciliationCreate(BaseModel):
    company: str = "Paint Shop Ltd"
    posting_date: Optional[str] = None
    purpose: str = "Stock Reconciliation"
    items: List[StockReconciliationItem]


# ==================== Item Endpoints ====================

@router.get("/items")
async def list_items(
    item_group: Optional[str] = None,
    is_stock_item: Optional[int] = None,
    disabled: Optional[int] = 0,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List all items with optional filters."""
    import json
    params = {"limit_page_length": limit}
    
    filters = []
    if item_group:
        filters.append(["item_group", "=", item_group])
    if is_stock_item is not None:
        filters.append(["is_stock_item", "=", is_stock_item])
    if disabled is not None:
        filters.append(["disabled", "=", disabled])
    
    if filters:
        params["filters"] = json.dumps(filters)
    
    items = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Item",
        method="GET",
        params=params
    )
    # Frontend expects {"items": [...]} format
    items_list = items.get("data", []) if isinstance(items, dict) else (items or [])
    return {"items": items_list}


@router.post("/items")
async def create_item(
    item: ItemCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Create a new item."""
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Item",
        method="POST",
        json_data=item.model_dump()
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/items/{item_code}")
async def get_item(
    item_code: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific item."""
    item = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Item/{item_code}",
        method="GET"
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return ResponseNormalizer.normalize_erpnext(item)


@router.put("/items/{item_code}")
async def update_item(
    item_code: str,
    updates: ItemUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing item."""
    # Filter out None values
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Item/{item_code}",
        method="PUT",
        json_data=update_data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/items/{item_code}")
async def delete_item(
    item_code: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Delete an item (mark as disabled)."""
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Item/{item_code}",
        method="PUT",
        json_data={"disabled": 1}
    )
    return {"message": "Item disabled successfully"}


# ==================== Warehouse Endpoints ====================

@router.get("/warehouses")
async def list_warehouses(
    is_group: Optional[int] = None,
    company: Optional[str] = None,
    disabled: Optional[int] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all warehouses with optional filters."""
    import json
    
    params = {"limit_page_length": 200}
    
    # Resolve company from tenant context to avoid cross-tenant leakage
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    company_name = None
    if tenant:
        if tenant.tenant_settings and tenant.tenant_settings.company_name:
            company_name = tenant.tenant_settings.company_name
        else:
            company_name = tenant.name
    
    # If company name is missing or invalid, try to resolve to a single ERPNext company
    if not company_name:
        try:
            companies_response = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Company",
                method="GET",
                params={"limit_page_length": 5}
            )
            companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
            if len(companies) == 1:
                company_name = companies[0].get("name")
        except Exception:
            company_name = None
    
    filters = []
    if is_group is not None:
        filters.append(["is_group", "=", is_group])
    if company_name:
        filters.append(["company", "=", company_name])
    if disabled is not None:
        filters.append(["disabled", "=", disabled])
    
    if not company_name:
        # Without a resolved company, return empty to avoid cross-tenant leakage
        return {"warehouses": []}
    
    # ERPNext expects filters as JSON string
    if filters:
        params["filters"] = json.dumps(filters)
    
    warehouses = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse",
        method="GET",
        params=params
    )
    
    # Handle both list and dict response formats
    if isinstance(warehouses, dict):
        warehouses = warehouses.get("data", warehouses.get("warehouses", []))
    elif not isinstance(warehouses, list):
        warehouses = []
    
    # Frontend expects {"warehouses": [...]} format
    return {"warehouses": warehouses or []}


@router.post("/warehouses")
async def create_warehouse(
    warehouse: WarehouseCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new warehouse. Company is auto-resolved from tenant settings or tenant name."""
    # Fetch tenant from database
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get company from tenant settings (priority) or fallback to tenant name
    company_name = None
    if tenant.tenant_settings and tenant.tenant_settings.company_name:
        company_name = tenant.tenant_settings.company_name
    else:
        company_name = tenant.name
    
    # Verify company exists in ERPNext (safety check)
    # Note: Company should already exist if tenant was created with engine="erpnext"
    company_abbr = None
    enable_perpetual_inventory = False
    try:
        companies_response = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Company",
            method="GET",
            params={"limit_page_length": 100}
        )
        companies = companies_response.get("data", []) if isinstance(companies_response, dict) else []
        company_names = [c.get("name") for c in companies if isinstance(c, dict) and c.get("name")]
        
        # Check if resolved company exists
        if company_name not in company_names:
            # Company doesn't exist - use first available company or raise error
            if company_names:
                # Use first available company as fallback
                company_name = company_names[0]
            else:
                # No companies exist - need to create one first
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "company_not_found",
                        "message": f"Company '{company_name}' does not exist in ERPNext. Companies are automatically created when tenants are created with engine='erpnext'. Please create a company first or set company_name in tenant settings.",
                        "available_companies": company_names,
                        "suggestion": "Create a company using POST /api/accounting/companies or set company_name in tenant settings"
                    }
                )
        # Resolve company abbreviation for default parent warehouse
        if company_name:
            for c in companies:
                if isinstance(c, dict) and c.get("name") == company_name:
                    company_abbr = c.get("abbr") or c.get("abbreviation")
                    break
    except HTTPException:
        raise
    except Exception as e:
        # If we can't verify, proceed anyway (might be a connection issue)
        # But log the warning
        print(f"Warning: Could not verify company existence: {e}")
    
    # Prepare warehouse data with verified company
    warehouse_data = warehouse.model_dump(exclude={'company'})
    warehouse_data['company'] = company_name
    
    # Ensure non-group warehouses are placed under the company's root warehouse
    if not warehouse_data.get("parent_warehouse") and company_abbr and warehouse_data.get("is_group", 0) == 0:
        root_warehouse = f"All Warehouses - {company_abbr}"
        try:
            from urllib.parse import quote
            erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Warehouse/{quote(root_warehouse)}",
                method="GET"
            )
            warehouse_data["parent_warehouse"] = root_warehouse
        except Exception:
            # If root warehouse doesn't exist, proceed without parent_warehouse
            pass
    
    # Validate provided parent warehouse exists (if specified)
    if warehouse_data.get("parent_warehouse"):
        try:
            from urllib.parse import quote
            erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Warehouse/{quote(warehouse_data['parent_warehouse'])}",
                method="GET"
            )
        except Exception:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "parent_warehouse_not_found",
                    "message": f"Parent warehouse '{warehouse_data['parent_warehouse']}' does not exist."
                }
            )

    # Validate warehouse type (if provided)
    if warehouse_data.get("warehouse_type"):
        try:
            from urllib.parse import quote
            erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Warehouse Type/{quote(warehouse_data['warehouse_type'])}",
                method="GET"
            )
        except Exception:
            # Provide available types to guide the user
            types_response = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Warehouse Type",
                method="GET",
                params={"limit_page_length": 100, "fields": '["name"]'}
            )
            types = types_response.get("data", []) if isinstance(types_response, dict) else []
            type_names = [t.get("name") for t in types if isinstance(t, dict) and t.get("name")]
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "warehouse_type_not_found",
                    "message": f"Warehouse Type '{warehouse_data['warehouse_type']}' does not exist.",
                    "available_types": type_names
                }
            )
    
    # Validate chart of accounts exists for company
    accounts_response = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Account",
        method="GET",
        params={
            "filters": f'[["company", "=", "{company_name}"]]',
            "limit_page_length": 1,
            "fields": '["name","account_type","account_name"]'
        }
    )
    accounts = accounts_response.get("data", []) if isinstance(accounts_response, dict) else []
    if not accounts:
        raise HTTPException(
            status_code=400,
            detail={
                "type": "chart_of_accounts_missing",
                "message": f"Chart of Accounts not found for company '{company_name}'. Please import chart of accounts first."
            }
        )
    
    # Determine if perpetual inventory is enabled
    try:
        company_doc = erpnext_adapter.proxy_request(
            tenant_id=tenant_id,
            path=f"resource/Company/{company_name}",
            method="GET"
        )
        company_data = company_doc.get("data", {}) if isinstance(company_doc, dict) else {}
        enable_perpetual_inventory = bool(company_data.get("enable_perpetual_inventory"))
    except Exception:
        enable_perpetual_inventory = False
    
    # Validate/resolve warehouse account (if required)
    if warehouse_data.get("is_group", 0) == 0:
        if warehouse_data.get("account"):
            try:
                from urllib.parse import quote
                erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path=f"resource/Account/{quote(warehouse_data['account'])}",
                    method="GET"
                )
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "account_not_found",
                        "message": f"Account '{warehouse_data['account']}' does not exist for company '{company_name}'."
                    }
                )
        elif enable_perpetual_inventory:
            # Try to resolve a Stock Asset account
            stock_account = None
            account_filters = [
                f'[["company", "=", "{company_name}"], ["account_type", "=", "Stock"], ["is_group", "=", 0]]',
                f'[["company", "=", "{company_name}"], ["account_name", "like", "%Stock In Hand%"], ["is_group", "=", 0]]',
                f'[["company", "=", "{company_name}"], ["account_name", "like", "%Inventory%"], ["is_group", "=", 0]]'
            ]
            for account_filter in account_filters:
                resp = erpnext_adapter.proxy_request(
                    tenant_id=tenant_id,
                    path="resource/Account",
                    method="GET",
                    params={
                        "filters": account_filter,
                        "limit_page_length": 1,
                        "fields": '["name","account_name","account_type"]'
                    }
                )
                data = resp.get("data", []) if isinstance(resp, dict) else []
                if data:
                    stock_account = data[0].get("name")
                    break
            if not stock_account:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "type": "stock_account_missing",
                        "message": "Stock Asset account not found. Provide an account or create a Stock account in Chart of Accounts."
                    }
                )
            warehouse_data["account"] = stock_account
    else:
        # Group warehouses should not have account
        warehouse_data.pop("account", None)
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse",
        method="POST",
        json_data=warehouse_data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/stock-asset-account")
async def get_stock_asset_account(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Resolve recommended stock asset account for the tenant company."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    company_name = None
    if tenant:
        if tenant.tenant_settings and tenant.tenant_settings.company_name:
            company_name = tenant.tenant_settings.company_name
        else:
            company_name = tenant.name
    
    if not company_name:
        return {"account": None, "company": None}
    
    account_filters = [
        f'[["company", "=", "{company_name}"], ["account_type", "=", "Stock"], ["is_group", "=", 0]]',
        f'[["company", "=", "{company_name}"], ["account_name", "like", "%Stock In Hand%"], ["is_group", "=", 0]]',
        f'[["company", "=", "{company_name}"], ["account_name", "like", "%Inventory%"], ["is_group", "=", 0]]'
    ]
    for account_filter in account_filters:
        try:
            resp = erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path="resource/Account",
                method="GET",
                params={
                    "filters": account_filter,
                    "limit_page_length": 1,
                    "fields": '["name","account_name","account_type"]'
                }
            )
            data = resp.get("data", []) if isinstance(resp, dict) else []
            if data:
                return {"account": data[0].get("name"), "company": company_name}
        except Exception:
            continue
    
    return {"account": None, "company": company_name}


@router.get("/warehouse-types")
async def list_warehouse_types(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List available warehouse types in ERPNext."""
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Warehouse Type",
        method="GET",
        params={"limit_page_length": 200, "fields": '["name"]'}
    )
    types = result.get("data", []) if isinstance(result, dict) else []
    type_names = [t.get("name") for t in types if isinstance(t, dict) and t.get("name")]
    return {"warehouse_types": type_names}


@router.get("/warehouses/{warehouse_name}")
async def get_warehouse(
    warehouse_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific warehouse."""
    warehouse = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Warehouse/{warehouse_name}",
        method="GET"
    )
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return ResponseNormalizer.normalize_erpnext(warehouse)


@router.put("/warehouses/{warehouse_name}")
async def update_warehouse(
    warehouse_name: str,
    updates: WarehouseUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing warehouse."""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # Validate parent warehouse (if provided)
    if update_data.get("parent_warehouse"):
        try:
            from urllib.parse import quote
            erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Warehouse/{quote(update_data['parent_warehouse'])}",
                method="GET"
            )
        except Exception:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "parent_warehouse_not_found",
                    "message": f"Parent warehouse '{update_data['parent_warehouse']}' does not exist."
                }
            )
    
    # Validate account (if provided)
    if update_data.get("account"):
        try:
            from urllib.parse import quote
            erpnext_adapter.proxy_request(
                tenant_id=tenant_id,
                path=f"resource/Account/{quote(update_data['account'])}",
                method="GET"
            )
        except Exception:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "account_not_found",
                    "message": f"Account '{update_data['account']}' does not exist."
                }
            )
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Warehouse/{warehouse_name}",
        method="PUT",
        json_data=update_data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/warehouses/{warehouse_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(
    warehouse_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Delete a warehouse."""
    erpnext_adapter.delete_resource("Warehouse", warehouse_name, tenant_id)
    return None


# ==================== Stock Entry Endpoints ====================

@router.post("/stock-entries")
async def create_stock_entry(
    entry: StockEntryCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a stock entry (Material Receipt, Issue, or Transfer).
    
    - Material Receipt: Receive stock into warehouse (set t_warehouse for each item)
    - Material Issue: Issue stock from warehouse (set s_warehouse for each item)
    - Material Transfer: Transfer between warehouses (set both s_warehouse and t_warehouse)
    """
    # Prepare items
    items_data = []
    for item in entry.items:
        item_dict = item.model_dump()
        # Set warehouse based on entry type if not specified
        if entry.stock_entry_type == "Material Receipt" and not item_dict.get("t_warehouse"):
            item_dict["t_warehouse"] = entry.to_warehouse
        elif entry.stock_entry_type == "Material Issue" and not item_dict.get("s_warehouse"):
            item_dict["s_warehouse"] = entry.from_warehouse
        elif entry.stock_entry_type == "Material Transfer":
            if not item_dict.get("s_warehouse"):
                item_dict["s_warehouse"] = entry.from_warehouse
            if not item_dict.get("t_warehouse"):
                item_dict["t_warehouse"] = entry.to_warehouse
        
        # ERPNext compatibility: ensure target/source aliases exist if expected
        if item_dict.get("t_warehouse") and not item_dict.get("target_warehouse"):
            item_dict["target_warehouse"] = item_dict["t_warehouse"]
        if item_dict.get("s_warehouse") and not item_dict.get("source_warehouse"):
            item_dict["source_warehouse"] = item_dict["s_warehouse"]
        
        items_data.append(item_dict)
    
    # Ensure parent-level warehouses are set when items include them (ERPNext compatibility)
    from_warehouse = entry.from_warehouse
    to_warehouse = entry.to_warehouse
    if entry.stock_entry_type == "Material Receipt" and not to_warehouse:
        for item in items_data:
            if item.get("t_warehouse"):
                to_warehouse = item.get("t_warehouse")
                break
    if entry.stock_entry_type == "Material Issue" and not from_warehouse:
        for item in items_data:
            if item.get("s_warehouse"):
                from_warehouse = item.get("s_warehouse")
                break
    
    payload = {
        "stock_entry_type": entry.stock_entry_type,
        "purpose": entry.stock_entry_type,
        "company": entry.company,
        "posting_date": entry.posting_date or datetime.now().strftime("%Y-%m-%d"),
        "items": items_data
    }
    
    if from_warehouse:
        payload["from_warehouse"] = from_warehouse
    if to_warehouse:
        payload["to_warehouse"] = to_warehouse
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Stock Entry",
        method="POST",
        json_data=payload
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/stock-entries")
async def list_stock_entries(
    stock_entry_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """List stock entries with optional filters."""
    import json
    params = {"limit_page_length": limit}
    
    filters = []
    if stock_entry_type:
        filters.append(["stock_entry_type", "=", stock_entry_type])
    if from_date:
        filters.append(["posting_date", ">=", from_date])
    if to_date:
        filters.append(["posting_date", "<=", to_date])
    
    if filters:
        params["filters"] = json.dumps(filters)
    
    entries = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Stock Entry",
        method="GET",
        params=params
    )
    return {"data": entries.get("data", []) if isinstance(entries, dict) else (entries or [])}


@router.get("/stock-entries/{entry_name}")
async def get_stock_entry(
    entry_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific stock entry."""
    entry = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="GET"
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Stock Entry not found")
    return ResponseNormalizer.normalize_erpnext(entry)


@router.put("/stock-entries/{entry_name}")
async def update_stock_entry(
    entry_name: str,
    data: Dict[str, Any] = Body(...),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Update a stock entry (only in Draft status)."""
    # Verify entry exists and is in draft status
    entry = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="GET"
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Stock Entry not found")
    
    entry_data = entry.get("data") if isinstance(entry, dict) and "data" in entry else entry
    if entry_data.get("docstatus") != 0:  # 0 = Draft, 1 = Submitted, 2 = Cancelled
        raise HTTPException(status_code=403, detail="Can only edit Draft stock entries")
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="PUT",
        json_data=data
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/stock-entries/{entry_name}/submit")
async def submit_stock_entry(
    entry_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Submit a stock entry (moves from Draft to Submitted)."""
    entry = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="GET"
    )
    entry_data = entry.get("data") if isinstance(entry, dict) and "data" in entry else entry
    if not entry_data:
        raise HTTPException(status_code=404, detail="Stock Entry not found")
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="method/frappe.client.submit",
        method="POST",
        json_data={
            "doc": {
                **entry_data
            }
        }
    )
    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/stock-entries/{entry_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_entry(
    entry_name: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Delete a stock entry (only if Draft)."""
    # Verify entry exists and is in draft status
    entry = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="GET"
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Stock Entry not found")
    
    entry_data = entry.get("data") if isinstance(entry, dict) and "data" in entry else entry
    if entry_data.get("docstatus") != 0:
        raise HTTPException(status_code=403, detail="Can only delete Draft stock entries")
    
    erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path=f"resource/Stock Entry/{entry_name}",
        method="DELETE"
    )
    return None


# ==================== Stock Reconciliation Endpoints ====================

@router.post("/stock-reconciliations")
async def create_stock_reconciliation(
    reconciliation: StockReconciliationCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a stock reconciliation to adjust stock levels.
    Used for physical stock verification and corrections.
    """
    payload = {
        "company": reconciliation.company,
        "posting_date": reconciliation.posting_date or datetime.now().strftime("%Y-%m-%d"),
        "purpose": reconciliation.purpose,
        "items": [item.model_dump() for item in reconciliation.items]
    }
    
    result = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="resource/Stock Reconciliation",
        method="POST",
        json_data=payload
    )
    return result


@router.get("/stock-balance")
async def get_stock_balance(
    item_code: Optional[str] = None,
    warehouse: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """
    Get current stock balance.
    Can filter by item_code and/or warehouse.
    """
    params = {}
    if item_code:
        params["item_code"] = item_code
    if warehouse:
        params["warehouse"] = warehouse
    
    balance = erpnext_adapter.proxy_request(
        tenant_id=tenant_id,
        path="method/erpnext.stock.utils.get_stock_balance",
        method="GET",
        params=params
    )
    
    return {"item_code": item_code, "warehouse": warehouse, "balance": balance}
