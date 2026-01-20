"""
Loyalty Program Router for PoS
Points earning, redemption, tiers, referral rewards
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.dependencies.auth import get_current_user, require_tenant_access
from app.services.erpnext_client import erpnext_adapter
from app.services.pos.loyalty_service import LoyaltyService

router = APIRouter(
    prefix="/pos/loyalty",
    tags=["PoS Loyalty Program"]
)


class PointsRedemptionRequest(BaseModel):
    """Request to redeem loyalty points"""
    customer: str
    points_to_redeem: float = Field(..., gt=0, description="Points to redeem")
    invoice_amount: float = Field(..., gt=0, description="Invoice amount before discount")


class ReferralRequest(BaseModel):
    """Request to award referral points"""
    referrer_customer: str
    referred_customer: str
    first_purchase_amount: float = Field(..., gt=0)


class CalculatePointsRequest(BaseModel):
    """Request to calculate loyalty points for a purchase"""
    purchase_amount: float = Field(..., gt=0, description="Purchase amount")
    customer: str
    is_birthday: bool = False


@router.get("/customer/{customer}/points")
async def get_customer_points(
    customer: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get customer's current points balance and tier"""
    service = LoyaltyService(erpnext_adapter, tenant_id)
    points_info = await service.get_customer_points(customer)
    return points_info


@router.get("/customer/{customer}/tier")
async def get_customer_tier(
    customer: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Get customer's loyalty tier"""
    service = LoyaltyService(erpnext_adapter, tenant_id)
    tier = await service.get_customer_tier(customer)
    return {"customer": customer, "tier": tier}


@router.post("/calculate-points")
async def calculate_points_earned(
    request: CalculatePointsRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Calculate points that would be earned from purchase"""
    service = LoyaltyService(erpnext_adapter, tenant_id)

    purchase_amount = request.purchase_amount
    customer = request.customer
    is_birthday = request.is_birthday
    
    # Check if birthday month
    if not is_birthday:
        is_birthday = await service.check_birthday_month(customer)
    
    points_info = await service.calculate_points_earned(
        purchase_amount, customer, is_birthday
    )
    return points_info


@router.post("/redeem")
async def redeem_points(
    request: PointsRedemptionRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Redeem loyalty points for discount"""
    service = LoyaltyService(erpnext_adapter, tenant_id)
    
    try:
        redemption_info = await service.redeem_points(
            request.customer,
            request.points_to_redeem,
            request.invoice_amount
        )
        return redemption_info
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/referral")
async def award_referral_points(
    request: ReferralRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Award referral points when referred customer makes first purchase"""
    service = LoyaltyService(erpnext_adapter, tenant_id)
    
    referral_info = await service.award_referral_points(
        request.referrer_customer,
        request.referred_customer,
        request.first_purchase_amount
    )
    return referral_info
