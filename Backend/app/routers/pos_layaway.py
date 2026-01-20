"""
Layaway/Installment Router for PoS
Partial payments, installment tracking, payment schedules
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.dependencies.auth import get_current_user, require_tenant_access
from app.services.erpnext_client import erpnext_adapter
from app.services.pos.layaway_service import LayawayService

router = APIRouter(
    prefix="/pos/layaway",
    tags=["PoS Layaway/Installments"]
)


class CreateLayawayRequest(BaseModel):
    """Request to create layaway plan"""
    customer: str
    items: List[Dict[str, Any]] = Field(..., description="Items to hold")
    total_amount: float = Field(..., gt=0)
    down_payment: float = Field(..., gt=0)
    installment_periods: int = Field(3, ge=1, le=12, description="Number of installments")
    payment_schedule: str = Field("monthly", pattern="^(weekly|bi_weekly|monthly)$")


class RecordPaymentRequest(BaseModel):
    """Request to record layaway payment"""
    layaway_id: str
    amount: float = Field(..., gt=0)
    payment_date: Optional[str] = None


class CancelLayawayRequest(BaseModel):
    """Request to cancel layaway"""
    layaway_id: str
    refund_policy: str = Field("partial", pattern="^(full|partial|none)$")


@router.post("/create")
async def create_layaway(
    request: CreateLayawayRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Create a new layaway/installment plan"""
    service = LayawayService(erpnext_adapter, tenant_id)
    
    try:
        layaway = await service.create_layaway(
            request.customer,
            request.items,
            request.total_amount,
            request.down_payment,
            request.installment_periods,
            request.payment_schedule
        )
        return layaway
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{layaway_id}")
async def get_layaway_status(
    layaway_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get layaway plan status and payment history"""
    service = LayawayService(erpnext_adapter, tenant_id)
    status = await service.get_layaway_status(layaway_id)
    return status


@router.post("/payment")
async def record_payment(
    request: RecordPaymentRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Record a payment against layaway plan"""
    service = LayawayService(erpnext_adapter, tenant_id)
    
    payment_info = await service.record_payment(
        request.layaway_id,
        request.amount,
        request.payment_date
    )
    return payment_info


@router.post("/{layaway_id}/complete")
async def complete_layaway(
    layaway_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Mark layaway as completed and release items"""
    service = LayawayService(erpnext_adapter, tenant_id)
    completion = await service.complete_layaway(layaway_id)
    return completion


@router.post("/{layaway_id}/cancel")
async def cancel_layaway(
    layaway_id: str,
    request: CancelLayawayRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Cancel layaway plan"""
    service = LayawayService(erpnext_adapter, tenant_id)
    
    cancellation = await service.cancel_layaway(
        layaway_id,
        request.refund_policy
    )
    return cancellation
