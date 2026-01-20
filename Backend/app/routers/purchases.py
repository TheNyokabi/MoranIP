"""
Purchase Management Router

Platform-agnostic purchase management endpoints.
Works with any ERP backend (ERPNext, Odoo, SAP, etc.) via service layer.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date

from ..services.purchase_service_factory import get_purchase_service
from ..dependencies.auth import get_current_user, require_tenant_access
from ..dependencies.tenant import get_tenant_engine

router = APIRouter(
    prefix="/purchases",
    tags=["Purchase Management"]
)


# ==================== Request/Response Models (Platform-Agnostic) ====================

class SupplierCreate(BaseModel):
    name: str
    supplier_group: Optional[str] = "All Supplier Groups"
    country: Optional[str] = None
    tax_id: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    currency: str = "KES"


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    supplier_group: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    payment_terms: Optional[str] = None


class PurchaseOrderItem(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    qty: float
    rate: float
    uom: str = "Nos"
    warehouse: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    order_date: str
    delivery_date: Optional[str] = None
    currency: str = "KES"
    items: List[PurchaseOrderItem]
    taxes: Optional[List[dict]] = []
    payment_terms: Optional[str] = None
    notes: Optional[str] = None


class PurchaseReceiptItem(BaseModel):
    item_code: str
    qty: float
    rate: float
    warehouse: str
    quality_inspection: Optional[str] = None


class PurchaseReceiptCreate(BaseModel):
    supplier_id: str
    purchase_order_id: Optional[str] = None
    posting_date: str
    items: List[PurchaseReceiptItem]
    notes: Optional[str] = None


class PurchaseInvoiceItem(BaseModel):
    item_code: str
    qty: float
    rate: float
    amount: float


class PurchaseInvoiceCreate(BaseModel):
    supplier_id: str
    purchase_order_id: Optional[str] = None
    purchase_receipt_id: Optional[str] = None
    bill_no: str
    bill_date: str
    due_date: str
    items: List[PurchaseInvoiceItem]
    taxes: Optional[List[dict]] = []


# ==================== Supplier Endpoints ====================

@router.get("/suppliers")
async def list_suppliers(
    supplier_group: Optional[str] = None,
    country: Optional[str] = None,
    disabled: Optional[int] = 0,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """List all suppliers - platform agnostic"""
    service = get_purchase_service(engine)
    
    filters = {}
    if supplier_group:
        filters["supplier_group"] = supplier_group
    if country:
        filters["country"] = country
    if disabled is not None:
        filters["disabled"] = disabled
    
    result = await service.list_suppliers(tenant_id, filters, limit)
    return result


@router.post("/suppliers")
async def create_supplier(
    supplier: SupplierCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Create new supplier - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.create_supplier(tenant_id, supplier.model_dump())
    return result


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Get supplier details - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.get_supplier(tenant_id, supplier_id)
    return result


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    updates: SupplierUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Update supplier - platform agnostic"""
    service = get_purchase_service(engine)
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    result = await service.update_supplier(tenant_id, supplier_id, update_data)
    return result


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Delete/disable supplier - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.delete_supplier(tenant_id, supplier_id)
    return result


# ==================== Purchase Order Endpoints ====================

@router.get("/orders")
async def list_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """List purchase orders - platform agnostic"""
    service = get_purchase_service(engine)
    
    filters = {}
    if status:
        filters["status"] = status
    if supplier_id:
        filters["supplier_id"] = supplier_id
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    
    result = await service.list_purchase_orders(tenant_id, filters, limit)
    return result


@router.post("/orders")
async def create_purchase_order(
    order: PurchaseOrderCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Create purchase order - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.create_purchase_order(tenant_id, order.model_dump())
    return result


@router.get("/orders/{order_id}")
async def get_purchase_order(
    order_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Get purchase order details - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.get_purchase_order(tenant_id, order_id)
    return result


@router.put("/orders/{order_id}")
async def update_purchase_order(
    order_id: str,
    order: PurchaseOrderCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Update purchase order - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.update_purchase_order(tenant_id, order_id, order.model_dump())
    return result


@router.post("/orders/{order_id}/submit")
async def submit_purchase_order(
    order_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Submit purchase order for approval - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.submit_purchase_order(tenant_id, order_id)
    return result


@router.post("/orders/{order_id}/cancel")
async def cancel_purchase_order(
    order_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Cancel purchase order - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.cancel_purchase_order(tenant_id, order_id)
    return result


# ==================== Purchase Receipt Endpoints ====================

@router.post("/receipts")
async def create_purchase_receipt(
    receipt: PurchaseReceiptCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Record goods received - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.create_purchase_receipt(tenant_id, receipt.model_dump())
    return result


@router.get("/receipts")
async def list_purchase_receipts(
    supplier_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """List purchase receipts - platform agnostic"""
    service = get_purchase_service(engine)
    
    filters = {}
    if supplier_id:
        filters["supplier_id"] = supplier_id
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    
    result = await service.list_purchase_receipts(tenant_id, filters, limit)
    return result


@router.get("/receipts/{receipt_id}")
async def get_purchase_receipt(
    receipt_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Get purchase receipt details - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.get_purchase_receipt(tenant_id, receipt_id)
    return result


# ==================== Purchase Invoice Endpoints ====================

@router.post("/invoices")
async def create_purchase_invoice(
    invoice: PurchaseInvoiceCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Record supplier invoice - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.create_purchase_invoice(tenant_id, invoice.model_dump())
    return result


@router.get("/invoices")
async def list_purchase_invoices(
    supplier_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """List purchase invoices - platform agnostic"""
    service = get_purchase_service(engine)
    
    filters = {}
    if supplier_id:
        filters["supplier_id"] = supplier_id
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    
    result = await service.list_purchase_invoices(tenant_id, filters, limit)
    return result


@router.get("/invoices/{invoice_id}")
async def get_purchase_invoice(
    invoice_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    engine: str = Depends(get_tenant_engine)
):
    """Get purchase invoice details - platform agnostic"""
    service = get_purchase_service(engine)
    
    result = await service.get_purchase_invoice(tenant_id, invoice_id)
    return result
