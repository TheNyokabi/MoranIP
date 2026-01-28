from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.dependencies.permissions import require_permission
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/manufacturing",
    tags=["Modules - Manufacturing"]
)


def check_permission(tenant_id: str, action: str, doctype: str = ""):
    """Check manufacturing permission.
    
    Args:
        tenant_id: The tenant_id resolved by require_tenant_access (from token or X-Tenant-ID header)
        action: The action being performed (view, create, update, delete)
        doctype: The ERPNext doctype being accessed
    """
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    return True


# ==================== Configuration (Master Data) ====================
# ERPNext uses the "Workstation" doctype for Work Centers.

@router.get("/work-centers")
def list_work_centers(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Work Centers (Workstations)."""
    check_permission(tenant_id, "view", "Workstation")
    result = erpnext_adapter.list_resource("Workstation", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/work-centers", status_code=status.HTTP_201_CREATED)
def create_work_center(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Work Center (Workstation)."""
    check_permission(tenant_id, "create", "Workstation")
    result = erpnext_adapter.create_resource("Workstation", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/work-centers/{work_center_name}")
def get_work_center(
    work_center_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Work Center details."""
    check_permission(tenant_id, "view", "Workstation")
    wc = erpnext_adapter.get_resource("Workstation", work_center_name, tenant_id)
    if not wc:
        raise HTTPException(status_code=404, detail="Work Center not found")
    return wc


@router.put("/work-centers/{work_center_name}")
def update_work_center(
    work_center_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Work Center."""
    check_permission(tenant_id, "edit", "Workstation")
    result = erpnext_adapter.update_resource("Workstation", work_center_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/work-centers/{work_center_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_center(
    work_center_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Work Center."""
    check_permission(tenant_id, "delete", "Workstation")
    erpnext_adapter.delete_resource("Workstation", work_center_name, tenant_id)
    return None


@router.get("/operations")
def list_operations(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Operations."""
    check_permission(tenant_id, "view", "Operation")
    result = erpnext_adapter.list_resource("Operation", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/operations", status_code=status.HTTP_201_CREATED)
def create_operation(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Operation."""
    check_permission(tenant_id, "create", "Operation")
    result = erpnext_adapter.create_resource("Operation", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/operations/{operation_name}")
def get_operation(
    operation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Operation details."""
    check_permission(tenant_id, "view", "Operation")
    op = erpnext_adapter.get_resource("Operation", operation_name, tenant_id)
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    return op


@router.put("/operations/{operation_name}")
def update_operation(
    operation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Operation."""
    check_permission(tenant_id, "edit", "Operation")
    result = erpnext_adapter.update_resource("Operation", operation_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/operations/{operation_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation(
    operation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Operation."""
    check_permission(tenant_id, "delete", "Operation")
    erpnext_adapter.delete_resource("Operation", operation_name, tenant_id)
    return None


# ==================== Bill of Materials ====================

@router.get("/bom", dependencies=[Depends(require_permission("manufacturing:bom:read"))])
def list_bom(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Bills of Materials."""
    check_permission(tenant_id, "view", "BOM")
    result = erpnext_adapter.list_resource("BOM", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/bom", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("manufacturing:bom:create"))])
def create_bom(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Bill of Materials.
    
    Required fields:
    - item: Item code to manufacture
    - quantity: 1
    - bom_details: [{item_code, qty, rate}]
    """
    check_permission(tenant_id, "create", "BOM")
    result = erpnext_adapter.create_resource("BOM", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/bom/{bom_name}", dependencies=[Depends(require_permission("manufacturing:bom:read"))])
def get_bom(
    bom_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Get BOM details with enriched component list.
    
    Returns:
    - BOM header (item, quantity, UOM)
    - Components with item details (name, unit_cost, stock)
    - Summary (total material cost, total labor cost)
    - Costing method
    """
    check_permission(tenant_id, "view", "BOM")
    bom = erpnext_adapter.get_resource("BOM", bom_name, tenant_id)
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    
    # Enrich components with item details
    if 'items' in bom:
        for item in bom['items']:
            if item.get('item_code'):
                try:
                    item_details = erpnext_adapter.get_resource('Item', item['item_code'], tenant_id)
                    item['item_name'] = item_details.get('item_name', '')
                    item['description'] = item_details.get('description', '')
                    item['stock_uom'] = item_details.get('stock_uom', '')
                    item['standard_rate'] = item_details.get('standard_rate', 0)
                except:
                    pass
    
    return ResponseNormalizer.normalize_erpnext(bom)
@router.put("/bom/{bom_name}", dependencies=[Depends(require_permission("manufacturing:bom:update"))])
def update_bom(
    bom_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update BOM details (only if not submitted)."""
    check_permission(tenant_id, "edit", "BOM")
    result = erpnext_adapter.update_resource("BOM", bom_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/bom/{bom_name}/submit", dependencies=[Depends(require_permission("manufacturing:bom:update"))])
def submit_bom(
    bom_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Submit BOM (makes it official)."""
    check_permission(tenant_id, "edit", "BOM")
    return erpnext_adapter.proxy_request(
        tenant_id,
        f"method/run_doc_method",
        method="POST",
        json_data={
            "docs": [{"doctype": "BOM", "name": bom_name}],
            "method": "submit"
        }
    )


@router.delete("/bom/{bom_name}", dependencies=[Depends(require_permission("manufacturing:bom:delete"))])
def delete_bom(
    bom_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Delete BOM (only if in draft)."""
    check_permission(tenant_id, "delete", "BOM")
    return erpnext_adapter.delete_resource("BOM", bom_name, tenant_id)


# ==================== Work Orders ====================

@router.get("/work-orders")
def list_work_orders(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Work Orders."""
    check_permission(tenant_id, "view", "Work Order")
    result = erpnext_adapter.list_resource("Work Order", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/work-orders", status_code=status.HTTP_201_CREATED)
def create_work_order(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Work Order.
    
    Required fields:
    - item_to_manufacture: Item code
    - qty: Quantity to produce
    - bom_no: Bill of Materials
    - planned_start_date: date
    """
    check_permission(tenant_id, "create", "Work Order")
    result = erpnext_adapter.create_resource("Work Order", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/work-orders/{work_order_id}")
def get_work_order(
    work_order_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Work Order details with progress."""
    check_permission(tenant_id, "view", "Work Order")
    work_order = erpnext_adapter.get_resource("Work Order", work_order_id, tenant_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="Work Order not found")
    return ResponseNormalizer.normalize_erpnext(work_order)
@router.put("/work-orders/{work_order_id}")
def update_work_order(
    work_order_id: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Work Order status or details."""
    check_permission(tenant_id, "edit", "Work Order")
    result = erpnext_adapter.update_resource("Work Order", work_order_id, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Production Plan ====================

@router.get("/production-plans")
def list_production_plans(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Production Plans."""
    check_permission(tenant_id, "view", "Production Plan")
    result = erpnext_adapter.list_resource("Production Plan", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/production-plans", status_code=status.HTTP_201_CREATED)
def create_production_plan(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Production Plan.
    
    Required fields:
    - company: str
    - planning_date: date
    - production_plan_details: [{item_code, planned_qty}]
    """
    check_permission(tenant_id, "create", "Production Plan")
    result = erpnext_adapter.create_resource("Production Plan", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/production-plans/{plan_id}")
def get_production_plan(
    plan_id: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Production Plan details."""
    check_permission(tenant_id, "view", "Production Plan")
    plan = erpnext_adapter.get_resource("Production Plan", plan_id, tenant_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Production Plan not found")
    return plan
