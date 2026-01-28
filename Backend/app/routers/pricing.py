"""
Pricing Router

API endpoints for the comprehensive pricing engine.

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session

from ..dependencies.auth import get_current_user, require_tenant_access
from ..database import get_db
from ..services.pricing_service import PricingService
from ..models.pricing import (
    PricingTier, ItemPrice, BatchPricing, 
    PricingSettings, PriceChangeLog
)

router = APIRouter(prefix="/pricing", tags=["Pricing"])


# ==================== Request/Response Models ====================

class PricingTierCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    discount_percentage: float = 0
    markup_percentage: float = 0
    priority: int = 100
    is_default: bool = False


class PricingTierUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_percentage: Optional[float] = None
    markup_percentage: Optional[float] = None
    priority: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class ItemPriceUpdate(BaseModel):
    selling_price: Optional[float] = None
    min_selling_price: Optional[float] = None
    margin_type: Optional[str] = None
    margin_value: Optional[float] = None
    reason: Optional[str] = None


class PricingSettingsUpdate(BaseModel):
    default_margin_type: Optional[str] = None
    default_margin_value: Optional[float] = None
    selling_price_calculation: Optional[str] = None
    selling_price_percentile: Optional[int] = None
    round_prices: Optional[bool] = None
    rounding_method: Optional[str] = None
    rounding_precision: Optional[int] = None
    rounding_to: Optional[int] = None
    allow_below_cost_sale: Optional[bool] = None
    below_cost_approval_required: Optional[bool] = None
    show_buying_price_in_pos: Optional[bool] = None
    show_margin_in_pos: Optional[bool] = None


class BulkPriceUpdate(BaseModel):
    item_codes: Optional[List[str]] = None
    margin_percentage: float = Field(30, ge=0, le=500)
    pricing_tier_id: Optional[str] = None


class PriceValidationRequest(BaseModel):
    item_code: str
    proposed_price: float
    pricing_tier_id: Optional[str] = None


# ==================== Pricing Tier Endpoints ====================

@router.get("/tiers")
async def list_pricing_tiers(
    include_inactive: bool = False,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all pricing tiers for the tenant"""
    query = db.query(PricingTier).filter(PricingTier.tenant_id == tenant_id)
    
    if not include_inactive:
        query = query.filter(PricingTier.is_active == True)
    
    tiers = query.order_by(PricingTier.priority.desc()).all()
    
    return {
        "tiers": [
            {
                "id": str(t.id),
                "code": t.code,
                "name": t.name,
                "description": t.description,
                "discount_percentage": float(t.discount_percentage or 0),
                "markup_percentage": float(t.markup_percentage or 0),
                "priority": t.priority,
                "is_default": t.is_default,
                "is_active": t.is_active,
            }
            for t in tiers
        ],
        "total": len(tiers)
    }


@router.post("/tiers")
async def create_pricing_tier(
    data: PricingTierCreate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new pricing tier"""
    # Check for duplicate code
    existing = db.query(PricingTier).filter(
        PricingTier.tenant_id == tenant_id,
        PricingTier.code == data.code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Pricing tier with code '{data.code}' already exists")
    
    # If this is default, unset other defaults
    if data.is_default:
        db.query(PricingTier).filter(
            PricingTier.tenant_id == tenant_id,
            PricingTier.is_default == True
        ).update({"is_default": False})
    
    tier = PricingTier(
        tenant_id=tenant_id,
        code=data.code,
        name=data.name,
        description=data.description,
        discount_percentage=Decimal(str(data.discount_percentage)),
        markup_percentage=Decimal(str(data.markup_percentage)),
        priority=data.priority,
        is_default=data.is_default,
    )
    
    db.add(tier)
    db.commit()
    db.refresh(tier)
    
    return {"message": "Pricing tier created", "tier_id": str(tier.id)}


@router.put("/tiers/{tier_id}")
async def update_pricing_tier(
    tier_id: str,
    data: PricingTierUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a pricing tier"""
    tier = db.query(PricingTier).filter(
        PricingTier.id == tier_id,
        PricingTier.tenant_id == tenant_id
    ).first()
    
    if not tier:
        raise HTTPException(status_code=404, detail="Pricing tier not found")
    
    # If setting as default, unset others
    if data.is_default:
        db.query(PricingTier).filter(
            PricingTier.tenant_id == tenant_id,
            PricingTier.is_default == True,
            PricingTier.id != tier_id
        ).update({"is_default": False})
    
    # Update fields
    for field, value in data.model_dump(exclude_unset=True).items():
        if field in ["discount_percentage", "markup_percentage"]:
            value = Decimal(str(value)) if value is not None else None
        setattr(tier, field, value)
    
    tier.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Pricing tier updated"}


@router.delete("/tiers/{tier_id}")
async def delete_pricing_tier(
    tier_id: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a pricing tier (soft delete - sets inactive)"""
    tier = db.query(PricingTier).filter(
        PricingTier.id == tier_id,
        PricingTier.tenant_id == tenant_id
    ).first()
    
    if not tier:
        raise HTTPException(status_code=404, detail="Pricing tier not found")
    
    tier.is_active = False
    tier.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Pricing tier deleted"}


# ==================== Item Pricing Endpoints ====================

@router.get("/items/{item_code}")
async def get_item_pricing(
    item_code: str,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive pricing information for an item"""
    service = PricingService(db, tenant_id)
    
    summary = service.get_pricing_summary(item_code)
    
    return summary


@router.get("/items/{item_code}/suggested")
async def get_suggested_price(
    item_code: str,
    pricing_tier_id: Optional[str] = None,
    override_margin: Optional[float] = None,
    override_method: Optional[str] = None,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate suggested selling price for an item"""
    service = PricingService(db, tenant_id)
    
    suggested = service.calculate_suggested_selling_price(
        item_code=item_code,
        pricing_tier_id=pricing_tier_id,
        override_margin=Decimal(str(override_margin)) if override_margin else None,
        override_method=override_method
    )
    
    if not suggested:
        raise HTTPException(status_code=404, detail="No pricing data available for this item")
    
    return {
        "item_code": suggested.item_code,
        "suggested_price": float(suggested.suggested_price),
        "base_cost": float(suggested.base_cost),
        "margin_percentage": float(suggested.margin_percentage),
        "margin_amount": float(suggested.margin_amount),
        "batch_count": suggested.batch_count,
        "price_range": {
            "lowest": float(suggested.lowest_batch_price),
            "highest": float(suggested.highest_batch_price),
        },
        "calculation_method": suggested.calculation_method,
        "breakdown": suggested.breakdown
    }


@router.put("/items/{item_code}")
async def update_item_price(
    item_code: str,
    data: ItemPriceUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update selling price for an item"""
    user_id = current_user.get("user_id")
    service = PricingService(db, tenant_id, user_id)
    
    if data.selling_price is not None:
        item_price = service.update_selling_price(
            item_code=item_code,
            new_price=Decimal(str(data.selling_price)),
            reason=data.reason
        )
        
        return {
            "message": "Price updated",
            "item_code": item_code,
            "new_price": float(item_price.selling_price) if item_price.selling_price else None
        }
    
    raise HTTPException(status_code=400, detail="No price update provided")


@router.post("/items/validate")
async def validate_price(
    data: PriceValidationRequest,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate a proposed selling price"""
    service = PricingService(db, tenant_id)
    
    validation = service.validate_selling_price(
        item_code=data.item_code,
        proposed_price=Decimal(str(data.proposed_price)),
        pricing_tier_id=data.pricing_tier_id
    )
    
    return {
        "is_valid": validation.is_valid,
        "selling_price": float(validation.selling_price),
        "buying_price": float(validation.buying_price),
        "margin_percentage": float(validation.margin_percentage),
        "is_below_cost": validation.is_below_cost,
        "requires_approval": validation.requires_approval,
        "messages": validation.validation_messages
    }


@router.post("/items/bulk-update")
async def bulk_update_prices(
    data: BulkPriceUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bulk update selling prices based on margin percentage"""
    service = PricingService(db, tenant_id)
    
    results = service.bulk_update_prices_by_margin(
        item_codes=data.item_codes,
        margin_percentage=Decimal(str(data.margin_percentage)),
        pricing_tier_id=data.pricing_tier_id
    )
    
    return {
        "message": "Bulk update completed",
        "updated": results["updated"],
        "skipped": results["skipped"],
        "errors": results["errors"]
    }


# ==================== Batch Pricing Endpoints ====================

@router.get("/batches")
async def list_batches(
    item_code: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List batch pricing records"""
    query = db.query(BatchPricing).filter(BatchPricing.tenant_id == tenant_id)
    
    if item_code:
        query = query.filter(BatchPricing.item_code == item_code)
    
    if active_only:
        query = query.filter(
            BatchPricing.is_active == True,
            BatchPricing.remaining_qty > 0
        )
    
    batches = query.order_by(BatchPricing.received_date.desc()).limit(limit).all()
    
    return {
        "batches": [
            {
                "id": str(b.id),
                "item_code": b.item_code,
                "batch_no": b.batch_no,
                "buying_price": float(b.buying_price),
                "effective_cost": float(b.effective_cost) if b.effective_cost else None,
                "original_qty": float(b.original_qty),
                "remaining_qty": float(b.remaining_qty),
                "supplier_id": b.supplier_id,
                "purchase_receipt_id": b.purchase_receipt_id,
                "received_date": b.received_date.isoformat() if b.received_date else None,
                "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
                "is_depleted": b.is_depleted,
            }
            for b in batches
        ],
        "total": len(batches)
    }


@router.get("/batches/{item_code}/cost")
async def calculate_batch_cost(
    item_code: str,
    quantity: float = Query(..., gt=0),
    method: str = Query("fifo", pattern="^(fifo|lifo|average)$"),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate cost for a quantity using specified costing method (preview only)"""
    service = PricingService(db, tenant_id)
    
    # Get batches without consuming
    batches = db.query(BatchPricing).filter(
        BatchPricing.tenant_id == tenant_id,
        BatchPricing.item_code == item_code,
        BatchPricing.is_active == True,
        BatchPricing.remaining_qty > 0
    )
    
    if method == "fifo":
        batches = batches.order_by(BatchPricing.received_date.asc()).all()
    elif method == "lifo":
        batches = batches.order_by(BatchPricing.received_date.desc()).all()
    else:
        batches = batches.all()
    
    remaining = Decimal(str(quantity))
    total_cost = Decimal(0)
    breakdown = []
    
    for batch in batches:
        if remaining <= 0:
            break
        
        available = batch.remaining_qty
        use_qty = min(available, remaining)
        unit_cost = batch.effective_cost or batch.buying_price
        
        breakdown.append({
            "batch_id": str(batch.id),
            "batch_no": batch.batch_no,
            "quantity": float(use_qty),
            "unit_cost": float(unit_cost),
            "subtotal": float(use_qty * unit_cost),
            "received_date": batch.received_date.isoformat() if batch.received_date else None,
        })
        
        total_cost += use_qty * unit_cost
        remaining -= use_qty
    
    average_cost = total_cost / Decimal(str(quantity)) if quantity > 0 else Decimal(0)
    
    return {
        "item_code": item_code,
        "quantity": quantity,
        "method": method,
        "total_cost": float(total_cost),
        "average_unit_cost": float(average_cost),
        "unfulfilled_qty": float(remaining) if remaining > 0 else 0,
        "breakdown": breakdown
    }


# ==================== Pricing Settings Endpoints ====================

@router.get("/settings")
async def get_pricing_settings(
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pricing settings for the tenant"""
    service = PricingService(db, tenant_id)
    settings = service.settings
    
    return {
        "default_currency": settings.default_currency,
        "default_margin_type": settings.default_margin_type,
        "default_margin_value": float(settings.default_margin_value) if settings.default_margin_value else 30,
        "selling_price_calculation": settings.selling_price_calculation,
        "selling_price_percentile": settings.selling_price_percentile,
        "round_prices": settings.round_prices,
        "rounding_method": settings.rounding_method,
        "rounding_precision": settings.rounding_precision,
        "rounding_to": settings.rounding_to,
        "allow_below_cost_sale": settings.allow_below_cost_sale,
        "below_cost_approval_required": settings.below_cost_approval_required,
        "show_buying_price_in_pos": settings.show_buying_price_in_pos,
        "show_margin_in_pos": settings.show_margin_in_pos,
    }


@router.put("/settings")
async def update_pricing_settings(
    data: PricingSettingsUpdate,
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update pricing settings for the tenant"""
    settings = db.query(PricingSettings).filter(
        PricingSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        settings = PricingSettings(tenant_id=tenant_id)
        db.add(settings)
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "default_margin_value" and value is not None:
            value = Decimal(str(value))
        setattr(settings, field, value)
    
    settings.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Settings updated"}


# ==================== Price Change History ====================

@router.get("/history")
async def get_price_history(
    item_code: Optional[str] = None,
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(require_tenant_access),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get price change history"""
    query = db.query(PriceChangeLog).filter(PriceChangeLog.tenant_id == tenant_id)
    
    if item_code:
        query = query.filter(PriceChangeLog.item_code == item_code)
    
    logs = query.order_by(PriceChangeLog.created_at.desc()).limit(limit).all()
    
    return {
        "history": [
            {
                "id": str(log.id),
                "item_code": log.item_code,
                "field_changed": log.field_changed,
                "old_value": float(log.old_value) if log.old_value else None,
                "new_value": float(log.new_value) if log.new_value else None,
                "changed_by": str(log.changed_by) if log.changed_by else None,
                "reason": log.reason,
                "requires_approval": log.requires_approval,
                "approval_status": log.approval_status,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": len(logs)
    }
