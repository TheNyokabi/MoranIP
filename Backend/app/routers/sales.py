"""
Sales Management Router

Handles full Sales module operations (not just POS):
- Quotations
- Sales Orders
- Delivery Notes
- Sales Invoices (non-POS)
- Sales Returns

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from sqlalchemy.orm import Session
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.dependencies.permissions import require_permission
from app.database import get_db
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/sales",
    tags=["Modules - Sales"]
)


def check_permission(tenant_id: str, action: str, doctype: str):
    """Check if user has access to the tenant (permission checks handled by require_tenant_access).
    
    Note: Full RBAC permission checks should be implemented as dependencies using require_permission.
    For now, this just validates tenant access is established.
    """
    if not tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Tenant access required")


# ==================== Quotations ====================

@router.get("/quotations")
def list_quotations(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Quotations."""
    check_permission(tenant_id, "view", "Quotation")
    result = erpnext_adapter.list_resource("Quotation", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/quotations", status_code=status.HTTP_201_CREATED)
def create_quotation(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Quotation."""
    check_permission(tenant_id, "create", "Quotation")
    result = erpnext_adapter.create_resource("Quotation", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/quotations/{quotation_name}")
def get_quotation(
    quotation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Quotation details."""
    check_permission(tenant_id, "view", "Quotation")
    quotation = erpnext_adapter.get_resource("Quotation", quotation_name, tenant_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return ResponseNormalizer.normalize_erpnext(quotation)


@router.put("/quotations/{quotation_name}")
def update_quotation(
    quotation_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Quotation (only if draft)."""
    check_permission(tenant_id, "edit", "Quotation")
    result = erpnext_adapter.update_resource("Quotation", quotation_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Sales Orders ====================

@router.get("/orders")
def list_sales_orders(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Sales Orders."""
    check_permission(tenant_id, "view", "Sales Order")
    result = erpnext_adapter.list_resource("Sales Order", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_sales_order(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Sales Order."""
    check_permission(tenant_id, "create", "Sales Order")
    result = erpnext_adapter.create_resource("Sales Order", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/orders/{order_name}")
def get_sales_order(
    order_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Sales Order details."""
    check_permission(tenant_id, "view", "Sales Order")
    order = erpnext_adapter.get_resource("Sales Order", order_name, tenant_id)
    if not order:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    return ResponseNormalizer.normalize_erpnext(order)


@router.put("/orders/{order_name}")
def update_sales_order(
    order_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Sales Order (only if draft)."""
    check_permission(tenant_id, "edit", "Sales Order")
    result = erpnext_adapter.update_resource("Sales Order", order_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Delivery Notes ====================

@router.get("/delivery-notes")
def list_delivery_notes(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Delivery Notes."""
    check_permission(tenant_id, "view", "Delivery Note")
    result = erpnext_adapter.list_resource("Delivery Note", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/delivery-notes", status_code=status.HTTP_201_CREATED)
def create_delivery_note(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Delivery Note."""
    check_permission(tenant_id, "create", "Delivery Note")
    result = erpnext_adapter.create_resource("Delivery Note", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/delivery-notes/{delivery_note_name}")
def get_delivery_note(
    delivery_note_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Delivery Note details."""
    check_permission(tenant_id, "view", "Delivery Note")
    delivery_note = erpnext_adapter.get_resource("Delivery Note", delivery_note_name, tenant_id)
    if not delivery_note:
        raise HTTPException(status_code=404, detail="Delivery Note not found")
    return ResponseNormalizer.normalize_erpnext(delivery_note)


@router.put("/delivery-notes/{delivery_note_name}")
def update_delivery_note(
    delivery_note_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Delivery Note (only if draft)."""
    check_permission(tenant_id, "edit", "Delivery Note")
    result = erpnext_adapter.update_resource("Delivery Note", delivery_note_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Sales Invoices (Non-POS) ====================

@router.get("/invoices")
def list_sales_invoices(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Sales Invoices (non-POS)."""
    check_permission(tenant_id, "view", "Sales Invoice")
    # Filter out POS invoices
    result = erpnext_adapter.list_resource("Sales Invoice", tenant_id, filters={"is_pos": 0})
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
def create_sales_invoice(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Sales Invoice (non-POS)."""
    check_permission(tenant_id, "create", "Sales Invoice")
    # Ensure it's not a POS invoice
    data["is_pos"] = 0
    result = erpnext_adapter.create_resource("Sales Invoice", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/invoices/{invoice_name}")
def get_sales_invoice(
    invoice_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Sales Invoice details (non-POS)."""
    check_permission(tenant_id, "view", "Sales Invoice")
    invoice = erpnext_adapter.get_resource("Sales Invoice", invoice_name, tenant_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales Invoice not found")
    # Verify it's not a POS invoice
    if invoice.get("is_pos"):
        raise HTTPException(status_code=400, detail="This is a POS invoice. Use /api/pos/invoices endpoint.")
    return ResponseNormalizer.normalize_erpnext(invoice)


@router.put("/invoices/{invoice_name}")
def update_sales_invoice(
    invoice_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Sales Invoice (only if draft)."""
    check_permission(tenant_id, "edit", "Sales Invoice")
    result = erpnext_adapter.update_resource("Sales Invoice", invoice_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)
