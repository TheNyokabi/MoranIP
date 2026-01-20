"""
PoS Session Management Router - RBAC-protected
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.models.pos_session import (
    PosSession,
    PosSessionCreate,
    PosSessionClose
)
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.dependencies.auth import get_current_token_payload
from app.dependencies.permissions import require_permission

router = APIRouter(prefix="/pos/sessions", tags=["PoS Sessions"])


@router.post("", response_model=dict, dependencies=[Depends(require_permission("pos:sessions:create"))])
async def open_pos_session(
    session: PosSessionCreate,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Open a new PoS Session
    
    Creates a new session tied to a PoS profile and user.
    Optionally records opening cash amount.
    """
    try:
        user_email = token_payload.get('sub', 'unknown')
        
        result = await pos_service.open_session(
            profile_id=session.profile_id,
            user=user_email,
            opening_cash=session.opening_cash
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=dict, dependencies=[Depends(require_permission("pos:sessions:read"))])
async def list_pos_sessions(
    profile_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    List PoS Sessions
    
    Filter by profile, status (Open/Closed), or get all sessions.
    """
    try:
        sessions = await pos_service.list_sessions(
            profile_id=profile_id,
            status=status,
            limit=limit
        )
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}", response_model=dict, dependencies=[Depends(require_permission("pos:sessions:read"))])
async def get_pos_session(
    session_id: str,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get PoS Session details
    
    Returns session information including sales summary.
    """
    try:
        session = await pos_service.get_session(session_id)
        return {"data": session}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Session not found: {str(e)}")


@router.put("/{session_id}/close", response_model=dict, dependencies=[Depends(require_permission("pos:sessions:close"))])
async def close_pos_session(
    session_id: str,
    close_data: PosSessionClose,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Close PoS Session
    
    Closes the session and creates a closing entry with reconciliation.
    """
    try:
        result = await pos_service.close_session(
            session_id=session_id,
            closing_cash=close_data.closing_cash
        )
        return {"data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/summary", response_model=dict, dependencies=[Depends(require_permission("pos:sessions:read"))])
async def get_session_summary(
    session_id: str,
    token_payload: dict = Depends(get_current_token_payload),
    pos_service: PosServiceBase = Depends(get_pos_service)
):
    """
    Get Session Sales Summary
    
    Returns detailed sales breakdown for the session including:
    - Total sales amount
    - Total quantity sold
    - Payment method breakdown
    - Tax summary
    - Discounts applied
    - Number of transactions
    """
    try:
        from app.services.erpnext_client import erpnext_adapter
        
        tenant_id = token_payload.get("tenant_id", "moran.localhost")
        
        # Get session details
        session = await pos_service.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        # Query POS Orders for this session
        orders_response = erpnext_adapter.list_resource(
            "POS Invoice",
            tenant_id,
            filters=[
                ["pos_profile", "=", session.get("pos_profile")],
                ["docstatus", "=", 1],  # Submitted documents only
                ["posting_date", ">=", session.get("session_date")],
                ["posting_date", "<=", session.get("session_date")]  # Same day
            ]
        )
        
        orders = orders_response.get("data", [])
        
        # Calculate summary from orders
        total_sales = 0
        total_qty = 0
        total_tax = 0
        total_discount = 0
        payment_methods = {}
        item_sales = {}
        
        for order in orders:
            # Accumulate sales totals
            invoice_total = float(order.get("total", 0))
            total_sales += invoice_total
            total_tax += float(order.get("total_taxes_and_charges", 0))
            total_discount += float(order.get("discount_amount", 0))
            
            # Count items
            items = order.get("items", [])
            for item in items:
                qty = float(item.get("qty", 0))
                total_qty += qty
                item_code = item.get("item_code")
                if item_code not in item_sales:
                    item_sales[item_code] = {"qty": 0, "total": 0}
                item_sales[item_code]["qty"] += qty
                item_sales[item_code]["total"] += float(item.get("amount", 0))
            
            # Track payment methods
            payment_method = order.get("payment_mode", "Cash")
            if payment_method not in payment_methods:
                payment_methods[payment_method] = 0
            payment_methods[payment_method] += invoice_total
        
        # Calculate net sales (after tax and discounts)
        net_sales = total_sales - total_tax - total_discount
        
        summary = {
            "session_id": session_id,
            "pos_profile": session.get("pos_profile"),
            "user": session.get("user"),
            "status": session.get("status"),
            "session_date": session.get("session_date"),
            "opening_cash": float(session.get("opening_cash", 0)),
            "closing_cash": float(session.get("closing_cash", 0)),
            "transactions": {
                "count": len(orders),
                "total_quantity": total_qty,
                "gross_sales": round(total_sales, 2),
                "total_tax": round(total_tax, 2),
                "total_discount": round(total_discount, 2),
                "net_sales": round(net_sales, 2)
            },
            "payment_breakdown": {
                method: round(amount, 2) 
                for method, amount in payment_methods.items()
            },
            "top_items": sorted(
                [
                    {
                        "item_code": code,
                        "qty_sold": data["qty"],
                        "sales_amount": round(data["total"], 2)
                    }
                    for code, data in item_sales.items()
                ],
                key=lambda x: x["qty_sold"],
                reverse=True
            )[:10],  # Top 10 items
            "cash_variance": round(
                float(session.get("closing_cash", 0)) - 
                float(session.get("opening_cash", 0)) - 
                total_sales,
                2
            )
        }
        
        return {"summary": summary}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating summary: {str(e)}")
