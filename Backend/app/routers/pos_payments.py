"""
Enhanced Payment Endpoints for PoS
Handles M-Pesa, mobile money, loyalty, and layaway payments
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.database import get_db
from app.dependencies.auth import require_tenant_access, get_current_user
from app.services.pos.pos_service_factory import get_pos_service
from app.services.pos.pos_service_base import PosServiceBase
from app.services.payments.mpesa_service import MpesaService, MpesaConfig
from app.services.payments.mobile_money_service import MobileMoneyService, AirtelMoneyProvider, TKashProvider
from app.services.pos.loyalty_service import LoyaltyService
from app.services.pos.layaway_service import LayawayService
from app.models.payment_reference import PaymentReference

router = APIRouter(
    prefix="/pos/payments",
    tags=["POS Payments"],
)


class MpesaSTKPushRequest(BaseModel):
    phone_number: str
    amount: float
    account_reference: str
    transaction_desc: str = "Payment"


class MobileMoneyPaymentRequest(BaseModel):
    provider: str  # mpesa, airtel_money, t_kash
    phone_number: str
    amount: float
    account_reference: str
    transaction_desc: str = "Payment"


class LoyaltyPointsRequest(BaseModel):
    customer: str
    purchase_amount: float
    is_birthday: bool = False


class LoyaltyRedemptionRequest(BaseModel):
    customer: str
    points_to_redeem: int
    invoice_id: str


class LayawayCreateRequest(BaseModel):
    customer: str
    items: list[Dict[str, Any]]
    deposit_amount: float
    total_amount: float
    installments: int = 3
    frequency: str = "monthly"


class LayawayPaymentRequest(BaseModel):
    layaway_id: str
    payment_amount: float


# Global service instances (would be configured per tenant in production)
mpesa_service = None
mobile_money_service = MobileMoneyService()
loyalty_service = LoyaltyService()
layaway_service = LayawayService()


def get_mpesa_service(tenant_id: str) -> MpesaService:
    """Get configured M-Pesa service for tenant"""
    # In production, this would load configuration from database per tenant
    config = MpesaConfig(
        consumer_key="demo_key",  # Would be loaded from secure config
        consumer_secret="demo_secret",
        shortcode="123456",
        passkey="demo_passkey",
        callback_url=f"https://api.example.com/payments/mpesa/callback/{tenant_id}",
        environment="sandbox"
    )
    return MpesaService(config)


@router.post("/mpesa/stk-push")
async def initiate_mpesa_stk_push(
    request: MpesaSTKPushRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate M-Pesa STK Push payment

    Returns payment initiation details
    """
    try:
        mpesa_svc = get_mpesa_service(tenant_id)

        # Validate and format phone number
        formatted_phone = mpesa_svc.validate_phone_number(request.phone_number)

        # Generate transaction reference
        transaction_id = mpesa_svc.generate_transaction_reference()

        # Create payment reference record
        payment_ref = PaymentReference(
            tenant_id=tenant_id,
            transaction_id=transaction_id,
            provider="mpesa",
            amount=request.amount,
            phone_number=formatted_phone,
            account_reference=request.account_reference,
            transaction_desc=request.transaction_desc,
            status="pending"
        )
        db.add(payment_ref)
        db.commit()

        # Initiate STK Push
        stk_response = await mpesa_svc.initiate_stk_push(
            phone_number=formatted_phone,
            amount=request.amount,
            account_reference=request.account_reference,
            transaction_desc=request.transaction_desc
        )

        # Update payment reference with response
        payment_ref.checkout_request_id = stk_response.checkout_request_id
        payment_ref.merchant_request_id = stk_response.merchant_request_id
        db.commit()

        return {
            "success": True,
            "transaction_id": transaction_id,
            "checkout_request_id": stk_response.checkout_request_id,
            "merchant_request_id": stk_response.merchant_request_id,
            "customer_message": stk_response.customer_message,
            "message": "STK Push initiated successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "mpesa_error",
                "message": "Failed to initiate M-Pesa payment",
                "error": str(e)
            }
        )


@router.post("/mpesa/query")
async def query_mpesa_payment(
    checkout_request_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Query M-Pesa payment status

    Returns current payment status
    """
    try:
        mpesa_svc = get_mpesa_service(tenant_id)

        # Find payment reference
        payment_ref = db.query(PaymentReference).filter(
            PaymentReference.checkout_request_id == checkout_request_id,
            PaymentReference.tenant_id == tenant_id
        ).first()

        if not payment_ref:
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "payment_not_found",
                    "message": "Payment reference not found"
                }
            )

        # Query M-Pesa
        query_response = await mpesa_svc.query_stk_push_status(checkout_request_id)

        # Update payment reference
        if query_response.result_code == "0":
            payment_ref.status = "completed"
            payment_ref.result_code = query_response.result_code
            payment_ref.result_desc = query_response.result_desc
        else:
            payment_ref.status = "failed"
            payment_ref.result_code = query_response.result_code
            payment_ref.result_desc = query_response.result_desc

        db.commit()

        return {
            "transaction_id": payment_ref.transaction_id,
            "status": payment_ref.status,
            "result_code": payment_ref.result_code,
            "result_desc": payment_ref.result_desc
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "mpesa_query_error",
                "message": "Failed to query payment status",
                "error": str(e)
            }
        )


@router.post("/mobile-money/initiate")
async def initiate_mobile_money_payment(
    request: MobileMoneyPaymentRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate mobile money payment (Airtel Money, T-Kash)

    Returns payment initiation details
    """
    try:
        # Configure providers if not already done
        if not mobile_money_service.get_provider("airtel_money"):
            airtel_config = {
                "client_id": "demo_client",
                "client_secret": "demo_secret",
                "base_url": "https://api.airtel.africa",
                "country": "KE",
                "currency": "KES"
            }
            mobile_money_service.register_provider("airtel_money", AirtelMoneyProvider, airtel_config)

        if not mobile_money_service.get_provider("t_kash"):
            tkash_config = {
                "consumer_key": "demo_key",
                "consumer_secret": "demo_secret",
                "base_url": "https://api.safaricom.co.ke",
                "shortcode": "654321"
            }
            mobile_money_service.register_provider("t_kash", TKashProvider, tkash_config)

        # Initiate payment
        result = await mobile_money_service.initiate_payment(
            provider_name=request.provider,
            phone_number=request.phone_number,
            amount=request.amount,
            reference=request.account_reference,
            description=request.transaction_desc
        )

        if result["success"]:
            # Create payment reference record
            payment_ref = PaymentReference(
                tenant_id=tenant_id,
                transaction_id=result.get("transaction_id", "unknown"),
                provider=request.provider,
                amount=request.amount,
                phone_number=request.phone_number,
                account_reference=request.account_reference,
                transaction_desc=request.transaction_desc,
                status="pending"
            )
            db.add(payment_ref)
            db.commit()

        return result

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "mobile_money_error",
                "message": "Failed to initiate mobile money payment",
                "error": str(e)
            }
        )


@router.post("/loyalty/calculate")
async def calculate_loyalty_points(
    request: LoyaltyPointsRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate loyalty points for a purchase

    Returns points calculation details
    """
    try:
        from decimal import Decimal
        loyalty_svc = LoyaltyService(tenant_id=tenant_id)

        result = await loyalty_svc.calculate_points(
            purchase_amount=Decimal(str(request.purchase_amount)),
            customer=request.customer,
            is_birthday=request.is_birthday
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "loyalty_calculation_error",
                "message": "Failed to calculate loyalty points",
                "error": str(e)
            }
        )


@router.post("/loyalty/award")
async def award_loyalty_points(
    customer: str,
    points: int,
    reason: str,
    invoice_id: str = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Award loyalty points to customer

    Returns award status
    """
    try:
        loyalty_svc = LoyaltyService(tenant_id=tenant_id)

        success = await loyalty_svc.award_points(
            customer=customer,
            points=points,
            reason=reason,
            invoice_id=invoice_id
        )

        return {
            "success": success,
            "customer": customer,
            "points_awarded": points,
            "reason": reason
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "loyalty_award_error",
                "message": "Failed to award loyalty points",
                "error": str(e)
            }
        )


@router.post("/loyalty/redeem")
async def redeem_loyalty_points(
    request: LoyaltyRedemptionRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Redeem customer loyalty points

    Returns redemption details
    """
    try:
        loyalty_svc = LoyaltyService(tenant_id=tenant_id)

        result = await loyalty_svc.redeem_points(
            customer=request.customer,
            points_to_redeem=request.points_to_redeem,
            invoice_id=request.invoice_id
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "loyalty_redemption_error",
                "message": "Failed to redeem loyalty points",
                "error": str(e)
            }
        )


@router.get("/loyalty/customer/{customer}/points")
async def get_customer_loyalty_points(
    customer: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get customer's current loyalty points balance

    Returns points balance
    """
    try:
        loyalty_svc = LoyaltyService(tenant_id=tenant_id)

        points = await loyalty_svc.get_customer_points(customer)
        tier = await loyalty_svc.get_customer_tier(customer)
        benefits = await loyalty_svc.get_tier_benefits(tier)

        return {
            "customer": customer,
            "points_balance": points,
            "tier": tier,
            "tier_benefits": benefits
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "loyalty_balance_error",
                "message": "Failed to get loyalty points balance",
                "error": str(e)
            }
        )


@router.post("/layaway/create")
async def create_layaway_plan(
    request: LayawayCreateRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new layaway plan

    Returns layaway plan details
    """
    try:
        from decimal import Decimal
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.create_layaway(
            customer=request.customer,
            items=request.items,
            deposit_amount=Decimal(str(request.deposit_amount)),
            total_amount=Decimal(str(request.total_amount)),
            installments=request.installments,
            frequency=request.frequency
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "layaway_creation_error",
                "message": "Failed to create layaway plan",
                "error": str(e)
            }
        )


@router.post("/layaway/payment")
async def record_layaway_payment(
    request: LayawayPaymentRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Record a payment towards layaway plan

    Returns payment recording result
    """
    try:
        from decimal import Decimal
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.record_layaway_payment(
            layaway_id=request.layaway_id,
            payment_amount=Decimal(str(request.payment_amount))
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "layaway_payment_error",
                "message": "Failed to record layaway payment",
                "error": str(e)
            }
        )


@router.get("/layaway/{layaway_id}")
async def get_layaway_status(
    layaway_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current status of layaway plan

    Returns layaway plan details
    """
    try:
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.get_layaway_status(layaway_id)

        if not result:
            raise HTTPException(
                status_code=404,
                detail={
                    "type": "layaway_not_found",
                    "message": "Layaway plan not found"
                }
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "layaway_status_error",
                "message": "Failed to get layaway status",
                "error": str(e)
            }
        )


@router.post("/layaway/{layaway_id}/complete")
async def complete_layaway(
    layaway_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark layaway as completed (early payoff)

    Returns completion result
    """
    try:
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.complete_layaway(layaway_id)

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "layaway_completion_error",
                "message": "Failed to complete layaway",
                "error": str(e)
            }
        )


@router.post("/layaway/{layaway_id}/cancel")
async def cancel_layaway(
    layaway_id: str,
    refund_policy: str = Query("partial", description="Refund policy: full, partial, none"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel layaway plan

    Returns cancellation result
    """
    try:
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.cancel_layaway(
            layaway_id=layaway_id,
            refund_policy=refund_policy
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "layaway_cancellation_error",
                "message": "Failed to cancel layaway",
                "error": str(e)
            }
        )


@router.get("/layaway/customer/{customer}")
async def get_customer_layaways(
    customer: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all layaway plans for a customer

    Returns list of customer's layaway plans
    """
    try:
        layaway_svc = LayawayService(tenant_id=tenant_id)

        result = await layaway_svc.get_customer_layaways(customer)

        return {
            "customer": customer,
            "layaway_plans": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "type": "customer_layaways_error",
                "message": "Failed to get customer layaways",
                "error": str(e)
            }
        )