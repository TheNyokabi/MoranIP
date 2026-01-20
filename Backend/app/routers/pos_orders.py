"""
PoS Order Management Router
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.pos_session import (
    PosOrder,
    PosOrderCreate,
    PosOrderUpdate,
    PaymentRequest,
    Receipt
)
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.dependencies.auth import get_current_token_payload
from app.dependencies.permissions import require_permission

router = APIRouter(prefix="/pos/orders", tags=["PoS Orders"])


@router.post("", response_model=dict, dependencies=[Depends(require_permission("pos:orders:create"))])
async def create_pos_order(
    order: PosOrderCreate,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Create a new PoS Order
    
    Creates a draft order with line items. Order must be paid before completion.
    """
    try:
        result = await pos_service.create_order(
            session_id=order.session_id,
            items=[item.dict() for item in order.items],
            customer=order.customer
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=dict)
async def list_pos_orders(
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    List PoS Orders
    
    Filter by session, status, or get all orders.
    """
    try:
        # TODO: Implement list_orders in service
        return {"orders": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{order_id}", response_model=dict)
async def get_pos_order(
    order_id: str,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get PoS Order details
    
    Returns complete order information including line items.
    """
    try:
        order = await pos_service.get_order(order_id)
        return {"data": order}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Order not found: {str(e)}")


@router.put("/{order_id}", response_model=dict)
async def update_pos_order(
    order_id: str,
    order: PosOrderUpdate,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Update PoS Order
    
    Modify order items before payment. Cannot update paid orders.
    """
    try:
        result = await pos_service.update_order(
            order_id=order_id,
            items=[item.dict() for item in order.items]
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{order_id}/payment", response_model=dict)
async def process_order_payment(
    order_id: str,
    payment: PaymentRequest,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Process Payment for Order
    
    Completes the order by processing payment. Updates inventory based on profile settings.
    """
    try:
        result = await pos_service.process_payment(
            order_id=order_id,
            payment_method=payment.payment_method,
            amount=payment.amount
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{order_id}", response_model=dict)
async def cancel_pos_order(
    order_id: str,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Cancel PoS Order
    
    Cancels a draft order. Cannot cancel paid orders.
    """
    try:
        success = await pos_service.cancel_order(order_id)
        return {"success": success, "message": "Order cancelled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{order_id}/receipt", response_model=dict)
async def generate_receipt(
    order_id: str,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Generate Receipt
    
    Creates a printable receipt for a paid order.
    """
    try:
        order = await pos_service.get_order(order_id)
        
        # TODO: Get profile settings for receipt customization
        receipt = {
            "order_id": order_id,
            "receipt_number": order.get("name", order_id),
            "customer": order.get("customer"),
            "items": order.get("items", []),
            "subtotal": order.get("net_total", 0),
            "tax": order.get("total_taxes_and_charges", 0),
            "discount": order.get("discount_amount", 0),
            "total": order.get("grand_total", 0),
            "payment_method": order.get("payments", [{}])[0].get("mode_of_payment", ""),
            "amount_paid": order.get("paid_amount", 0),
            "change": order.get("change_amount", 0),
            "timestamp": order.get("posting_date"),
            "footer_text": "Thank you for your business!"
        }
        
        return {"receipt": receipt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
