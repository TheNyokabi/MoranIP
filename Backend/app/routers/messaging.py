"""
Messaging API Router

Endpoints for WhatsApp and SMS messaging:
- Send receipts
- Send reminders
- Send alerts
- Webhook handling
- Message status
"""

import logging
from datetime import datetime
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_user, require_tenant_access
from ..services.messaging import (
    create_whatsapp_service,
    create_sms_service,
    SMSProvider
)
from ..services.ai import RecommendationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/messaging", tags=["Messaging"])


# ==================== Pydantic Models ====================

class SendReceiptRequest(BaseModel):
    phone: str = Field(..., description="Recipient phone number")
    customer_name: str
    invoice_number: str
    total: str
    items_summary: Optional[str] = ""
    currency: str = "KES"
    channel: str = Field("whatsapp", description="Delivery channel: whatsapp, sms, or both")


class SendReminderRequest(BaseModel):
    phone: str
    customer_name: str
    invoice_number: str
    amount_due: str
    due_date: str
    currency: str = "KES"
    channel: str = "sms"


class SendOTPRequest(BaseModel):
    phone: str
    otp: Optional[str] = None
    expiry_minutes: int = 5


class SendBulkSMSRequest(BaseModel):
    phones: List[str]
    message: str


class SendAlertRequest(BaseModel):
    phone: str
    item_name: str
    current_stock: int
    reorder_level: int
    warehouse: Optional[str] = "Main Warehouse"
    channel: str = "whatsapp"


class MessageResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    phone: str
    channel: str
    error: Optional[str] = None


class UpsellRequest(BaseModel):
    cart_items: List[str]
    limit: int = 5


class CustomerRecommendationRequest(BaseModel):
    customer_id: str
    limit: int = 10


class PricingSuggestionRequest(BaseModel):
    item_code: str
    current_price: Optional[float] = None


# ==================== Messaging Endpoints ====================

@router.post("/send-receipt", response_model=MessageResponse)
async def send_receipt(
    request: SendReceiptRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Send a receipt via WhatsApp or SMS"""
    results = []
    
    if request.channel in ["whatsapp", "both"]:
        whatsapp = create_whatsapp_service()
        if whatsapp:
            result = await whatsapp.send_receipt(
                phone=request.phone,
                customer_name=request.customer_name,
                invoice_number=request.invoice_number,
                total=request.total,
                items_summary=request.items_summary or "",
                currency=request.currency
            )
            results.append({"channel": "whatsapp", **result})
    
    if request.channel in ["sms", "both"]:
        sms = create_sms_service()
        if sms:
            result = await sms.send_receipt(
                phone=request.phone,
                customer_name=request.customer_name,
                invoice_number=request.invoice_number,
                total=f"{request.currency} {request.total}",
                business_name="MoranERP"
            )
            results.append({"channel": "sms", **result})
    
    if not results:
        raise HTTPException(status_code=503, detail="No messaging services available")
    
    # Return first successful result
    success_result = next((r for r in results if r.get("success")), results[0])
    
    return MessageResponse(
        success=success_result.get("success", False),
        message_id=success_result.get("message_id"),
        phone=request.phone,
        channel=success_result.get("channel", request.channel),
        error=success_result.get("error")
    )


@router.post("/send-reminder", response_model=MessageResponse)
async def send_payment_reminder(
    request: SendReminderRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Send a payment reminder via WhatsApp or SMS"""
    
    if request.channel == "whatsapp":
        whatsapp = create_whatsapp_service()
        if not whatsapp:
            raise HTTPException(status_code=503, detail="WhatsApp service not available")
        
        result = await whatsapp.send_payment_reminder(
            phone=request.phone,
            customer_name=request.customer_name,
            invoice_number=request.invoice_number,
            amount_due=request.amount_due,
            due_date=request.due_date,
            currency=request.currency
        )
    else:
        sms = create_sms_service()
        if not sms:
            raise HTTPException(status_code=503, detail="SMS service not available")
        
        result = await sms.send_payment_reminder(
            phone=request.phone,
            customer_name=request.customer_name,
            invoice_number=request.invoice_number,
            amount_due=f"{request.currency} {request.amount_due}",
            due_date=request.due_date
        )
    
    return MessageResponse(
        success=result.get("success", False),
        message_id=result.get("message_id"),
        phone=request.phone,
        channel=request.channel,
        error=result.get("error")
    )


@router.post("/send-otp")
async def send_otp(
    request: SendOTPRequest,
    tenant_id: str = Depends(require_tenant_access)
):
    """Send OTP for verification"""
    sms = create_sms_service()
    if not sms:
        raise HTTPException(status_code=503, detail="SMS service not available")
    
    result = await sms.send_otp(
        phone=request.phone,
        otp=request.otp,
        expiry_minutes=request.expiry_minutes
    )
    
    # Don't expose OTP in response for security
    return {
        "success": result.get("success", False),
        "phone": request.phone,
        "message_id": result.get("message_id"),
        "expiry_minutes": request.expiry_minutes,
        "error": result.get("error")
    }


@router.post("/send-bulk-sms")
async def send_bulk_sms(
    request: SendBulkSMSRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Send SMS to multiple recipients"""
    sms = create_sms_service()
    if not sms:
        raise HTTPException(status_code=503, detail="SMS service not available")
    
    result = await sms.send_bulk_sms(
        phones=request.phones,
        message=request.message
    )
    
    return result


@router.post("/send-stock-alert", response_model=MessageResponse)
async def send_stock_alert(
    request: SendAlertRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user)
):
    """Send low stock alert to manager"""
    
    if request.channel == "whatsapp":
        whatsapp = create_whatsapp_service()
        if not whatsapp:
            raise HTTPException(status_code=503, detail="WhatsApp service not available")
        
        result = await whatsapp.send_stock_alert(
            phone=request.phone,
            item_name=request.item_name,
            current_stock=request.current_stock,
            reorder_level=request.reorder_level,
            warehouse=request.warehouse or "Main Warehouse"
        )
    else:
        sms = create_sms_service()
        if not sms:
            raise HTTPException(status_code=503, detail="SMS service not available")
        
        result = await sms.send_stock_alert(
            phone=request.phone,
            item_name=request.item_name,
            current_stock=request.current_stock,
            reorder_level=request.reorder_level
        )
    
    return MessageResponse(
        success=result.get("success", False),
        message_id=result.get("message_id"),
        phone=request.phone,
        channel=request.channel,
        error=result.get("error")
    )


# ==================== WhatsApp Webhook ====================

@router.get("/whatsapp/webhook")
async def verify_whatsapp_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge")
):
    """Verify WhatsApp webhook subscription"""
    whatsapp = create_whatsapp_service()
    if not whatsapp:
        raise HTTPException(status_code=503, detail="WhatsApp service not configured")
    
    result = whatsapp.verify_webhook(mode, token, challenge)
    if result:
        return Response(content=result, media_type="text/plain")
    
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp/webhook")
async def handle_whatsapp_webhook(
    request: Request
):
    """Handle incoming WhatsApp webhook events"""
    whatsapp = create_whatsapp_service()
    if not whatsapp:
        return {"status": "ok"}  # Always return 200 to avoid retry
    
    # Verify signature
    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()
    
    if not whatsapp.verify_signature(body, signature):
        logger.warning("Invalid WhatsApp webhook signature")
        return {"status": "ok"}
    
    # Parse payload
    try:
        payload = await request.json()
        messages = whatsapp.parse_webhook_payload(payload)
        
        for msg in messages:
            if msg["type"] == "status":
                logger.info(f"WhatsApp status update: {msg['message_id']} -> {msg['status']}")
                # TODO: Update message status in database
            elif msg["type"] == "message":
                logger.info(f"Incoming WhatsApp message from {msg['from']}: {msg.get('text', msg.get('button', 'media'))}")
                # TODO: Handle incoming messages (e.g., auto-reply)
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing WhatsApp webhook: {e}")
        return {"status": "ok"}


# ==================== AI Recommendations Endpoints ====================

@router.post("/recommendations/upsell")
async def get_upsell_suggestions(
    request: UpsellRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get upsell/cross-sell suggestions for cart items"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    suggestions = await service.get_upsell_suggestions(
        cart_items=request.cart_items,
        limit=request.limit
    )
    
    return {"suggestions": suggestions}


@router.post("/recommendations/customer")
async def get_customer_recommendations(
    request: CustomerRecommendationRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get personalized recommendations for a customer"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    recommendations = await service.get_customer_recommendations(
        customer_id=request.customer_id,
        limit=request.limit
    )
    
    return {"recommendations": recommendations}


@router.get("/recommendations/trending")
async def get_trending_items(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=50),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get trending items based on recent sales"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    trending = await service.get_trending_items(days=days, limit=limit)
    return {"trending": trending}


@router.post("/recommendations/pricing")
async def get_pricing_suggestion(
    request: PricingSuggestionRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get AI-powered pricing suggestion for an item"""
    from ..services.engine_adapter import get_erpnext_adapter
    from decimal import Decimal
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    current_price = Decimal(str(request.current_price)) if request.current_price else None
    suggestion = await service.get_pricing_suggestion(
        item_code=request.item_code,
        current_price=current_price
    )
    
    return suggestion


@router.get("/recommendations/reorder")
async def get_reorder_suggestions(
    limit: int = Query(20, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Get items that need to be reordered"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    suggestions = await service.get_reorder_suggestions(limit=limit)
    return {"suggestions": suggestions}


@router.get("/recommendations/slow-moving")
async def get_slow_moving_items(
    days: int = Query(30, ge=7, le=365),
    limit: int = Query(20, ge=1, le=100),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
):
    """Identify slow-moving inventory"""
    from ..services.engine_adapter import get_erpnext_adapter
    
    adapter = get_erpnext_adapter()
    service = RecommendationService(
        db=db,
        tenant_id=tenant_id,
        erpnext_adapter=adapter
    )
    
    slow_movers = await service.detect_slow_moving_items(
        days_threshold=days,
        limit=limit
    )
    
    return {"slow_moving_items": slow_movers}


# ==================== Service Status ====================

@router.get("/status")
async def get_messaging_status():
    """Check status of messaging services"""
    status = {
        "whatsapp": {
            "configured": False,
            "available": False
        },
        "sms": {
            "configured": False,
            "available": False,
            "provider": None
        }
    }
    
    whatsapp = create_whatsapp_service()
    if whatsapp:
        status["whatsapp"]["configured"] = True
        status["whatsapp"]["available"] = True
    
    sms = create_sms_service()
    if sms:
        status["sms"]["configured"] = True
        status["sms"]["available"] = True
        status["sms"]["provider"] = sms.provider_name.value
    
    return status
