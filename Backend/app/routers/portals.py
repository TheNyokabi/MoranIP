"""
Customer & Supplier Portal API Router

Endpoints for:
- Portal authentication
- Customer self-service (orders, invoices, quotes)
- Supplier self-service (PO confirmation, invoices, catalog)
"""

import logging
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.portals import CustomerPortalService, SupplierPortalService
from ..models.portals import (
    PortalUser, PortalQuoteRequest, PortalOrder,
    SupplierCatalog, SupplierOrderConfirmation, SupplierInvoice,
    PortalNotification
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portals", tags=["Portals"])


# ==================== Pydantic Models ====================

class PortalLoginRequest(BaseModel):
    email: str
    password: str
    portal_type: str = "customer"  # customer, supplier


class PortalLoginResponse(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str]
    session_token: str
    expires_at: datetime
    portal_type: str


class CreatePortalUserRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    password: str
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    company_name: Optional[str] = None


class PlaceOrderRequest(BaseModel):
    items: List[Dict[str, Any]]
    shipping_address: Optional[Dict] = None
    delivery_date: Optional[str] = None
    notes: Optional[str] = None


class QuoteRequestCreate(BaseModel):
    items: List[Dict[str, Any]]
    title: Optional[str] = None
    description: Optional[str] = None
    required_by: Optional[datetime] = None
    delivery_address: Optional[str] = None


class ConfirmOrderRequest(BaseModel):
    expected_delivery_date: datetime
    item_confirmations: List[Dict[str, Any]]
    delivery_notes: Optional[str] = None


class RejectOrderRequest(BaseModel):
    rejection_reason: str


class SubmitInvoiceRequest(BaseModel):
    purchase_order_id: str
    invoice_number: str
    invoice_date: datetime
    items: List[Dict[str, Any]]
    subtotal: float
    tax_amount: float
    grand_total: float
    attachment_url: Optional[str] = None
    currency: str = "KES"


class CatalogItemRequest(BaseModel):
    supplier_item_code: str
    supplier_item_name: str
    unit_price: float
    description: Optional[str] = None
    category: Optional[str] = None
    min_order_qty: int = 1
    lead_time_days: int = 0
    image_url: Optional[str] = None
    specifications: Optional[Dict] = None


class PortalUserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    company_name: Optional[str]
    portal_type: str
    is_verified: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    message: Optional[str]
    reference_type: Optional[str]
    reference_id: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Authentication Endpoints ====================

@router.post("/auth/login", response_model=PortalLoginResponse)
async def portal_login(
    request: PortalLoginRequest,
    req: Request,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Login to customer or supplier portal"""
    ip_address = req.client.host if req.client else None
    
    if request.portal_type == "customer":
        service = CustomerPortalService(db, tenant_id)
    else:
        service = SupplierPortalService(db, tenant_id)
    
    result = service.authenticate(
        email=request.email,
        password=request.password,
        ip_address=ip_address
    )
    
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if "error" in result:
        raise HTTPException(status_code=423, detail=result["error"])
    
    return PortalLoginResponse(
        user_id=result["user_id"],
        email=result["email"],
        full_name=result.get("full_name"),
        session_token=result["session_token"],
        expires_at=result["expires_at"],
        portal_type=request.portal_type
    )


@router.post("/auth/register/customer", response_model=PortalUserResponse)
async def register_customer_portal_user(
    request: CreatePortalUserRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Register a new customer portal user"""
    if not request.customer_id:
        raise HTTPException(status_code=400, detail="customer_id is required")
    
    service = CustomerPortalService(db, tenant_id)
    user = service.create_portal_user(
        email=request.email,
        customer_id=request.customer_id,
        full_name=request.full_name,
        phone=request.phone,
        password=request.password
    )
    
    return PortalUserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        portal_type=user.portal_type,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at
    )


@router.post("/auth/register/supplier", response_model=PortalUserResponse)
async def register_supplier_portal_user(
    request: CreatePortalUserRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Register a new supplier portal user"""
    if not request.supplier_id:
        raise HTTPException(status_code=400, detail="supplier_id is required")
    
    service = SupplierPortalService(db, tenant_id)
    user = service.create_portal_user(
        email=request.email,
        supplier_id=request.supplier_id,
        full_name=request.full_name,
        company_name=request.company_name,
        phone=request.phone,
        password=request.password
    )
    
    return PortalUserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        portal_type=user.portal_type,
        is_verified=user.is_verified,
        is_active=user.is_active,
        created_at=user.created_at
    )


# ==================== Customer Portal Endpoints ====================

@router.get("/customer/orders")
async def get_customer_orders(
    portal_user_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get customer's order history"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = CustomerPortalService(db, tenant_id, get_erpnext_adapter())
    orders = await service.get_order_history(
        portal_user_id=portal_user_id,
        limit=limit,
        offset=offset,
        status=status
    )
    return {"orders": orders}


@router.get("/customer/orders/{order_id}")
async def get_customer_order_details(
    order_id: str,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get order details"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = CustomerPortalService(db, tenant_id, get_erpnext_adapter())
    order = await service.get_order_details(portal_user_id, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order


@router.post("/customer/orders")
async def place_customer_order(
    request: PlaceOrderRequest,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Place a new order"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = CustomerPortalService(db, tenant_id, get_erpnext_adapter())
    order = await service.place_order(
        portal_user_id=portal_user_id,
        items=request.items,
        shipping_address=request.shipping_address,
        delivery_date=request.delivery_date,
        notes=request.notes
    )
    
    if not order:
        raise HTTPException(status_code=400, detail="Failed to place order")
    
    return {"message": "Order placed successfully", "order": order}


@router.get("/customer/invoices")
async def get_customer_invoices(
    portal_user_id: str,
    is_paid: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get customer's invoices"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = CustomerPortalService(db, tenant_id, get_erpnext_adapter())
    invoices = await service.get_invoices(
        portal_user_id=portal_user_id,
        limit=limit,
        is_paid=is_paid
    )
    return {"invoices": invoices}


@router.post("/customer/quotes/request")
async def request_quote(
    request: QuoteRequestCreate,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Submit a quote request"""
    service = CustomerPortalService(db, tenant_id)
    quote_request = service.request_quote(
        portal_user_id=portal_user_id,
        items=request.items,
        title=request.title,
        description=request.description,
        required_by=request.required_by,
        delivery_address=request.delivery_address
    )
    
    if not quote_request:
        raise HTTPException(status_code=400, detail="Failed to create quote request")
    
    return {
        "message": "Quote request submitted",
        "request_number": quote_request.request_number,
        "id": str(quote_request.id)
    }


@router.get("/customer/quotes")
async def get_quote_requests(
    portal_user_id: str,
    status: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get customer's quote requests"""
    service = CustomerPortalService(db, tenant_id)
    requests = service.get_quote_requests(portal_user_id, status)
    
    return {
        "requests": [
            {
                "id": str(r.id),
                "request_number": r.request_number,
                "title": r.title,
                "items_count": len(r.items),
                "status": r.status,
                "created_at": r.created_at,
                "quoted_total": float(r.quoted_total) if r.quoted_total else None
            }
            for r in requests
        ]
    }


@router.get("/customer/statement")
async def get_account_statement(
    portal_user_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get customer account statement"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = CustomerPortalService(db, tenant_id, get_erpnext_adapter())
    statement = await service.get_account_statement(
        portal_user_id=portal_user_id,
        from_date=from_date,
        to_date=to_date
    )
    return statement


# ==================== Supplier Portal Endpoints ====================

@router.get("/supplier/purchase-orders")
async def get_supplier_purchase_orders(
    portal_user_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get purchase orders for supplier"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = SupplierPortalService(db, tenant_id, get_erpnext_adapter())
    orders = await service.get_purchase_orders(
        portal_user_id=portal_user_id,
        limit=limit,
        status=status
    )
    return {"orders": orders}


@router.get("/supplier/purchase-orders/{order_id}")
async def get_supplier_po_details(
    order_id: str,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get purchase order details"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    service = SupplierPortalService(db, tenant_id, get_erpnext_adapter())
    order = await service.get_purchase_order_details(portal_user_id, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order


@router.post("/supplier/purchase-orders/{order_id}/confirm")
async def confirm_purchase_order(
    order_id: str,
    request: ConfirmOrderRequest,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Confirm a purchase order"""
    service = SupplierPortalService(db, tenant_id)
    confirmation = service.confirm_purchase_order(
        portal_user_id=portal_user_id,
        order_id=order_id,
        expected_delivery_date=request.expected_delivery_date,
        item_confirmations=request.item_confirmations,
        delivery_notes=request.delivery_notes
    )
    
    if not confirmation:
        raise HTTPException(status_code=400, detail="Failed to confirm order")
    
    return {
        "message": "Order confirmed",
        "confirmation_id": str(confirmation.id),
        "expected_delivery_date": confirmation.expected_delivery_date
    }


@router.post("/supplier/purchase-orders/{order_id}/reject")
async def reject_purchase_order(
    order_id: str,
    request: RejectOrderRequest,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Reject a purchase order"""
    service = SupplierPortalService(db, tenant_id)
    confirmation = service.reject_purchase_order(
        portal_user_id=portal_user_id,
        order_id=order_id,
        rejection_reason=request.rejection_reason
    )
    
    if not confirmation:
        raise HTTPException(status_code=400, detail="Failed to reject order")
    
    return {"message": "Order rejected", "confirmation_id": str(confirmation.id)}


@router.post("/supplier/invoices")
async def submit_supplier_invoice(
    request: SubmitInvoiceRequest,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Submit an invoice"""
    from decimal import Decimal
    
    service = SupplierPortalService(db, tenant_id)
    invoice = service.submit_invoice(
        portal_user_id=portal_user_id,
        purchase_order_id=request.purchase_order_id,
        invoice_number=request.invoice_number,
        invoice_date=request.invoice_date,
        items=request.items,
        subtotal=Decimal(str(request.subtotal)),
        tax_amount=Decimal(str(request.tax_amount)),
        grand_total=Decimal(str(request.grand_total)),
        attachment_url=request.attachment_url,
        currency=request.currency
    )
    
    if not invoice:
        raise HTTPException(status_code=400, detail="Failed to submit invoice")
    
    return {
        "message": "Invoice submitted",
        "invoice_id": str(invoice.id),
        "status": invoice.status
    }


@router.get("/supplier/invoices")
async def get_supplier_invoices(
    portal_user_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get supplier's submitted invoices"""
    service = SupplierPortalService(db, tenant_id)
    invoices = service.get_invoices(portal_user_id, status, limit)
    
    return {
        "invoices": [
            {
                "id": str(i.id),
                "invoice_number": i.supplier_invoice_number,
                "invoice_date": i.supplier_invoice_date,
                "grand_total": float(i.grand_total),
                "currency": i.currency,
                "status": i.status,
                "payment_status": i.payment_status,
                "created_at": i.created_at
            }
            for i in invoices
        ]
    }


@router.get("/supplier/payment-status")
async def get_supplier_payment_status(
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get payment status summary"""
    service = SupplierPortalService(db, tenant_id)
    status = await service.get_payment_status(portal_user_id)
    return status


# ==================== Catalog Endpoints ====================

@router.get("/supplier/catalog")
async def get_supplier_catalog(
    portal_user_id: str,
    category: Optional[str] = None,
    is_available: Optional[bool] = None,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get supplier's product catalog"""
    service = SupplierPortalService(db, tenant_id)
    items = service.get_catalog(portal_user_id, category, is_available)
    
    return {
        "items": [
            {
                "id": str(i.id),
                "supplier_item_code": i.supplier_item_code,
                "supplier_item_name": i.supplier_item_name,
                "unit_price": float(i.unit_price),
                "currency": i.currency,
                "category": i.category,
                "min_order_qty": i.min_order_qty,
                "lead_time_days": i.lead_time_days,
                "is_available": i.is_available,
                "stock_qty": i.stock_qty,
                "image_url": i.image_url
            }
            for i in items
        ]
    }


@router.post("/supplier/catalog")
async def add_catalog_item(
    request: CatalogItemRequest,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Add item to supplier catalog"""
    from decimal import Decimal
    
    service = SupplierPortalService(db, tenant_id)
    item = service.add_catalog_item(
        portal_user_id=portal_user_id,
        supplier_item_code=request.supplier_item_code,
        supplier_item_name=request.supplier_item_name,
        unit_price=Decimal(str(request.unit_price)),
        description=request.description,
        category=request.category,
        min_order_qty=request.min_order_qty,
        lead_time_days=request.lead_time_days,
        image_url=request.image_url,
        specifications=request.specifications
    )
    
    if not item:
        raise HTTPException(status_code=400, detail="Failed to add catalog item")
    
    return {
        "message": "Catalog item added",
        "item_id": str(item.id)
    }


@router.delete("/supplier/catalog/{item_id}")
async def delete_catalog_item(
    item_id: str,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Delete catalog item"""
    service = SupplierPortalService(db, tenant_id)
    success = service.delete_catalog_item(portal_user_id, item_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted"}


# ==================== Notifications Endpoints ====================

@router.get("/notifications", response_model=List[NotificationResponse])
async def get_portal_notifications(
    portal_user_id: str,
    unread_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    portal_type: str = "customer",
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get notifications for portal user"""
    if portal_type == "customer":
        service = CustomerPortalService(db, tenant_id)
    else:
        service = SupplierPortalService(db, tenant_id)
    
    notifications = service.get_notifications(portal_user_id, unread_only, limit)
    
    return [
        NotificationResponse(
            id=str(n.id),
            notification_type=n.notification_type,
            title=n.title,
            message=n.message,
            reference_type=n.reference_type,
            reference_id=n.reference_id,
            is_read=n.is_read,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    portal_user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Mark notification as read"""
    service = CustomerPortalService(db, tenant_id)
    success = service.mark_notification_read(portal_user_id, notification_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}
