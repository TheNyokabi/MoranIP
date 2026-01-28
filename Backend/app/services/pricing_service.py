"""
Pricing Service

Comprehensive pricing engine that handles:
- Buying price tracking from purchases
- Batch-aware cost calculation (FIFO, weighted average, percentile)
- Selling price suggestions based on margins
- Multi-tier pricing
- Price validation and rounding

Author: MoranERP Team
"""

from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal, ROUND_HALF_UP, ROUND_UP, ROUND_DOWN
from datetime import datetime
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models.pricing import (
    PricingTier, ItemPrice, BatchPricing, 
    PricingSettings, PriceChangeLog
)

import logging

logger = logging.getLogger(__name__)


@dataclass
class SuggestedPrice:
    """Result of price calculation"""
    item_code: str
    base_cost: Decimal
    suggested_price: Decimal
    margin_percentage: Decimal
    margin_amount: Decimal
    batch_count: int
    lowest_batch_price: Decimal
    highest_batch_price: Decimal
    calculation_method: str
    breakdown: Dict[str, Any]


@dataclass
class PriceValidation:
    """Result of price validation"""
    is_valid: bool
    selling_price: Decimal
    buying_price: Decimal
    margin_percentage: Decimal
    is_below_cost: bool
    requires_approval: bool
    validation_messages: List[str]


class PricingService:
    """
    Central pricing engine for MoranERP.
    
    Handles all pricing calculations, validations, and updates.
    """
    
    def __init__(self, db: Session, tenant_id: str, current_user_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.current_user_id = current_user_id
        self._settings: Optional[PricingSettings] = None
    
    @property
    def settings(self) -> PricingSettings:
        """Get or create pricing settings for tenant"""
        if self._settings is None:
            self._settings = self.db.query(PricingSettings).filter(
                PricingSettings.tenant_id == self.tenant_id
            ).first()
            
            if not self._settings:
                # Create default settings
                self._settings = PricingSettings(tenant_id=self.tenant_id)
                self.db.add(self._settings)
                self.db.commit()
                self.db.refresh(self._settings)
        
        return self._settings
    
    # ==================== BUYING PRICE MANAGEMENT ====================
    
    def record_purchase_price(
        self,
        item_code: str,
        quantity: Decimal,
        buying_price: Decimal,
        purchase_receipt_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        supplier_id: Optional[str] = None,
        batch_no: Optional[str] = None,
        expiry_date: Optional[datetime] = None,
        freight_cost: Decimal = Decimal(0),
        import_duty: Decimal = Decimal(0),
        other_costs: Decimal = Decimal(0),
    ) -> BatchPricing:
        """
        Record buying price from a purchase receipt.
        
        Creates a batch record for FIFO/LIFO costing and updates
        the item's average buying price.
        """
        # Calculate effective cost (unit cost + allocated additional costs)
        total_additional = freight_cost + import_duty + other_costs
        effective_cost = buying_price + (total_additional / quantity if quantity > 0 else Decimal(0))
        
        # Create batch record
        batch = BatchPricing(
            tenant_id=self.tenant_id,
            item_code=item_code,
            batch_no=batch_no,
            purchase_receipt_id=purchase_receipt_id,
            purchase_order_id=purchase_order_id,
            supplier_id=supplier_id,
            original_qty=quantity,
            remaining_qty=quantity,
            buying_price=buying_price,
            total_cost=buying_price * quantity + total_additional,
            freight_cost=freight_cost,
            import_duty=import_duty,
            other_costs=other_costs,
            effective_cost=effective_cost,
            received_date=datetime.utcnow(),
            expiry_date=expiry_date
        )
        self.db.add(batch)
        
        # Update item's pricing record
        self._update_item_buying_prices(item_code)
        
        self.db.commit()
        self.db.refresh(batch)
        
        logger.info(f"Recorded purchase price for {item_code}: {buying_price} (batch: {batch.id})")
        
        return batch
    
    def _update_item_buying_prices(self, item_code: str):
        """Update item's buying price summary from batch data"""
        
        # Get all active batches for this item
        batches = self.db.query(BatchPricing).filter(
            BatchPricing.tenant_id == self.tenant_id,
            BatchPricing.item_code == item_code,
            BatchPricing.is_active == True,
            BatchPricing.remaining_qty > 0
        ).all()
        
        if not batches:
            return
        
        # Calculate statistics
        prices = [b.effective_cost or b.buying_price for b in batches]
        quantities = [b.remaining_qty for b in batches]
        
        # Weighted average
        total_value = sum(p * q for p, q in zip(prices, quantities))
        total_qty = sum(quantities)
        avg_price = total_value / total_qty if total_qty > 0 else Decimal(0)
        
        # Min/Max
        min_price = min(prices)
        max_price = max(prices)
        
        # Latest price (most recent batch)
        latest_batch = max(batches, key=lambda b: b.received_date)
        latest_price = latest_batch.effective_cost or latest_batch.buying_price
        
        # Get or create item price record
        item_price = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.item_code == item_code,
            ItemPrice.pricing_tier_id == None  # Base price
        ).first()
        
        if not item_price:
            item_price = ItemPrice(
                tenant_id=self.tenant_id,
                item_code=item_code
            )
            self.db.add(item_price)
        
        # Store previous price for history
        old_buying_price = item_price.buying_price
        
        # Update prices
        item_price.last_buying_price = item_price.buying_price
        item_price.buying_price = latest_price
        item_price.avg_buying_price = avg_price
        item_price.min_buying_price = min_price
        item_price.max_buying_price = max_price
        item_price.updated_at = datetime.utcnow()
        
        # Add to history
        if old_buying_price and old_buying_price != latest_price:
            history = item_price.price_history or []
            history.append({
                "date": datetime.utcnow().isoformat(),
                "old_price": float(old_buying_price),
                "new_price": float(latest_price),
                "type": "buying_price"
            })
            item_price.price_history = history[-50:]  # Keep last 50 entries
    
    def consume_batch_stock(
        self,
        item_code: str,
        quantity: Decimal,
        method: str = "fifo"
    ) -> List[Tuple[str, Decimal, Decimal]]:
        """
        Consume stock from batches using specified method.
        
        Returns list of (batch_id, qty_consumed, unit_cost) tuples.
        Used for cost of goods sold calculation.
        """
        remaining = quantity
        consumed = []
        
        # Get active batches ordered by method
        query = self.db.query(BatchPricing).filter(
            BatchPricing.tenant_id == self.tenant_id,
            BatchPricing.item_code == item_code,
            BatchPricing.is_active == True,
            BatchPricing.remaining_qty > 0
        )
        
        if method == "fifo":
            batches = query.order_by(BatchPricing.received_date.asc()).all()
        elif method == "lifo":
            batches = query.order_by(BatchPricing.received_date.desc()).all()
        else:
            batches = query.order_by(BatchPricing.received_date.asc()).all()
        
        for batch in batches:
            if remaining <= 0:
                break
            
            available = batch.remaining_qty - batch.reserved_qty
            consume_qty = min(available, remaining)
            
            if consume_qty > 0:
                batch.remaining_qty -= consume_qty
                if batch.remaining_qty <= 0:
                    batch.is_depleted = True
                
                consumed.append((
                    str(batch.id),
                    consume_qty,
                    batch.effective_cost or batch.buying_price
                ))
                remaining -= consume_qty
        
        self.db.commit()
        
        return consumed
    
    # ==================== SELLING PRICE CALCULATION ====================
    
    def calculate_suggested_selling_price(
        self,
        item_code: str,
        pricing_tier_id: Optional[str] = None,
        override_margin: Optional[Decimal] = None,
        override_method: Optional[str] = None
    ) -> Optional[SuggestedPrice]:
        """
        Calculate suggested selling price based on buying prices and settings.
        
        Takes into account:
        - Batch-wise buying prices
        - Configured calculation method (percentile, average, etc.)
        - Margin settings
        - Tier-specific adjustments
        """
        # Get all active batches for this item
        batches = self.db.query(BatchPricing).filter(
            BatchPricing.tenant_id == self.tenant_id,
            BatchPricing.item_code == item_code,
            BatchPricing.is_active == True,
            BatchPricing.remaining_qty > 0
        ).order_by(BatchPricing.effective_cost).all()
        
        if not batches:
            return None
        
        # Get settings
        method = override_method or self.settings.selling_price_calculation
        percentile = self.settings.selling_price_percentile
        
        # Calculate base cost based on method
        prices_with_qty = [(b.effective_cost or b.buying_price, b.remaining_qty) for b in batches]
        
        if method == "percentile":
            base_cost = self._calculate_percentile_price(prices_with_qty, percentile)
        elif method == "average":
            base_cost = self._calculate_weighted_average(prices_with_qty)
        elif method == "latest":
            latest = max(batches, key=lambda b: b.received_date)
            base_cost = latest.effective_cost or latest.buying_price
        elif method == "highest":
            base_cost = max(p for p, _ in prices_with_qty)
        elif method == "lowest":
            base_cost = min(p for p, _ in prices_with_qty)
        else:
            base_cost = self._calculate_weighted_average(prices_with_qty)
        
        # Get margin
        margin_type = self.settings.default_margin_type
        margin_value = override_margin or Decimal(str(self.settings.default_margin_value))
        
        # Apply tier adjustments if specified
        tier_adjustment = Decimal(0)
        if pricing_tier_id:
            tier = self.db.query(PricingTier).filter(
                PricingTier.id == pricing_tier_id,
                PricingTier.tenant_id == self.tenant_id
            ).first()
            if tier:
                tier_adjustment = tier.discount_percentage or Decimal(0)
        
        # Calculate suggested price
        if margin_type == "percentage":
            margin_multiplier = 1 + (margin_value / 100)
            suggested_price = base_cost * margin_multiplier
            margin_amount = suggested_price - base_cost
        else:
            suggested_price = base_cost + margin_value
            margin_amount = margin_value
        
        # Apply tier discount
        if tier_adjustment > 0:
            suggested_price = suggested_price * (1 - tier_adjustment / 100)
        
        # Round price
        suggested_price = self._round_price(suggested_price)
        
        # Calculate actual margin percentage
        margin_percentage = ((suggested_price - base_cost) / base_cost * 100) if base_cost > 0 else Decimal(0)
        
        return SuggestedPrice(
            item_code=item_code,
            base_cost=base_cost,
            suggested_price=suggested_price,
            margin_percentage=margin_percentage,
            margin_amount=suggested_price - base_cost,
            batch_count=len(batches),
            lowest_batch_price=min(p for p, _ in prices_with_qty),
            highest_batch_price=max(p for p, _ in prices_with_qty),
            calculation_method=method,
            breakdown={
                "base_cost_method": method,
                "percentile": percentile if method == "percentile" else None,
                "margin_type": margin_type,
                "margin_value": float(margin_value),
                "tier_discount": float(tier_adjustment),
                "rounding_applied": self.settings.round_prices,
            }
        )
    
    def _calculate_percentile_price(
        self,
        prices_with_qty: List[Tuple[Decimal, Decimal]],
        percentile: int
    ) -> Decimal:
        """Calculate the nth percentile price weighted by quantity"""
        if not prices_with_qty:
            return Decimal(0)
        
        # Sort by price
        sorted_items = sorted(prices_with_qty, key=lambda x: x[0])
        total_qty = sum(qty for _, qty in sorted_items)
        target_qty = total_qty * Decimal(percentile) / 100
        
        cumulative = Decimal(0)
        for price, qty in sorted_items:
            cumulative += qty
            if cumulative >= target_qty:
                return price
        
        return sorted_items[-1][0]
    
    def _calculate_weighted_average(
        self,
        prices_with_qty: List[Tuple[Decimal, Decimal]]
    ) -> Decimal:
        """Calculate weighted average price"""
        if not prices_with_qty:
            return Decimal(0)
        
        total_value = sum(price * qty for price, qty in prices_with_qty)
        total_qty = sum(qty for _, qty in prices_with_qty)
        
        return total_value / total_qty if total_qty > 0 else Decimal(0)
    
    def _round_price(self, price: Decimal) -> Decimal:
        """Round price according to settings"""
        if not self.settings.round_prices:
            return price
        
        rounding_to = Decimal(self.settings.rounding_to or 1)
        precision = self.settings.rounding_precision
        method = self.settings.rounding_method
        
        # First round to precision
        if precision >= 0:
            quantize_str = '0.' + '0' * precision if precision > 0 else '1'
            price = price.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)
        
        # Then round to nearest value
        if rounding_to > 1:
            if method == "up":
                price = (price / rounding_to).quantize(Decimal('1'), rounding=ROUND_UP) * rounding_to
            elif method == "down":
                price = (price / rounding_to).quantize(Decimal('1'), rounding=ROUND_DOWN) * rounding_to
            else:  # nearest
                price = (price / rounding_to).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * rounding_to
        
        return price
    
    # ==================== PRICE VALIDATION ====================
    
    def validate_selling_price(
        self,
        item_code: str,
        proposed_price: Decimal,
        pricing_tier_id: Optional[str] = None
    ) -> PriceValidation:
        """
        Validate a proposed selling price.
        
        Checks for below-cost sales and applies business rules.
        """
        messages = []
        
        # Get item's buying price
        item_price = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.item_code == item_code,
            ItemPrice.pricing_tier_id == None
        ).first()
        
        if not item_price or not item_price.buying_price:
            # No buying price recorded, can't validate
            return PriceValidation(
                is_valid=True,
                selling_price=proposed_price,
                buying_price=Decimal(0),
                margin_percentage=Decimal(100),
                is_below_cost=False,
                requires_approval=False,
                validation_messages=["No buying price recorded for this item"]
            )
        
        buying_price = item_price.avg_buying_price or item_price.buying_price
        
        # Calculate margin
        margin_amount = proposed_price - buying_price
        margin_percentage = (margin_amount / buying_price * 100) if buying_price > 0 else Decimal(100)
        
        is_below_cost = proposed_price < buying_price
        requires_approval = False
        is_valid = True
        
        # Check below-cost sale
        if is_below_cost:
            if not self.settings.allow_below_cost_sale:
                is_valid = False
                messages.append(f"Price {proposed_price} is below cost {buying_price}. Below-cost sales are not allowed.")
            elif self.settings.below_cost_approval_required:
                requires_approval = True
                messages.append(f"Price {proposed_price} is below cost {buying_price}. Approval required.")
        
        # Check minimum selling price
        if item_price.min_selling_price and proposed_price < item_price.min_selling_price:
            is_valid = False
            messages.append(f"Price {proposed_price} is below minimum selling price {item_price.min_selling_price}")
        
        return PriceValidation(
            is_valid=is_valid,
            selling_price=proposed_price,
            buying_price=buying_price,
            margin_percentage=margin_percentage,
            is_below_cost=is_below_cost,
            requires_approval=requires_approval,
            validation_messages=messages
        )
    
    # ==================== PRICE UPDATES ====================
    
    def update_selling_price(
        self,
        item_code: str,
        new_price: Decimal,
        pricing_tier_id: Optional[str] = None,
        reason: Optional[str] = None
    ) -> ItemPrice:
        """Update selling price with audit logging"""
        
        # Get or create item price record
        item_price = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.item_code == item_code,
            ItemPrice.pricing_tier_id == pricing_tier_id
        ).first()
        
        if not item_price:
            item_price = ItemPrice(
                tenant_id=self.tenant_id,
                item_code=item_code,
                pricing_tier_id=pricing_tier_id
            )
            self.db.add(item_price)
        
        old_price = item_price.selling_price
        
        # Validate
        validation = self.validate_selling_price(item_code, new_price, pricing_tier_id)
        
        # Log the change
        if old_price != new_price:
            log = PriceChangeLog(
                tenant_id=self.tenant_id,
                item_code=item_code,
                pricing_tier_id=pricing_tier_id,
                field_changed="selling_price",
                old_value=old_price,
                new_value=new_price,
                changed_by=self.current_user_id,
                reason=reason,
                requires_approval=validation.requires_approval,
                approval_status="pending" if validation.requires_approval else "approved"
            )
            self.db.add(log)
        
        # Update price
        item_price.selling_price = new_price
        item_price.last_updated_by = self.current_user_id
        item_price.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(item_price)
        
        return item_price
    
    # ==================== BULK OPERATIONS ====================
    
    def bulk_update_prices_by_margin(
        self,
        item_codes: Optional[List[str]] = None,
        margin_percentage: Decimal = Decimal(30),
        pricing_tier_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Bulk update selling prices based on a margin percentage.
        
        If item_codes is None, updates all items.
        """
        results = {"updated": 0, "skipped": 0, "errors": []}
        
        # Get items to update
        query = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.pricing_tier_id == pricing_tier_id
        )
        
        if item_codes:
            query = query.filter(ItemPrice.item_code.in_(item_codes))
        
        items = query.all()
        
        for item in items:
            try:
                if not item.buying_price and not item.avg_buying_price:
                    results["skipped"] += 1
                    continue
                
                base_cost = item.avg_buying_price or item.buying_price
                new_price = base_cost * (1 + margin_percentage / 100)
                new_price = self._round_price(new_price)
                
                item.selling_price = new_price
                item.margin_type = "percentage"
                item.margin_value = margin_percentage
                item.updated_at = datetime.utcnow()
                
                results["updated"] += 1
                
            except Exception as e:
                results["errors"].append(f"{item.item_code}: {str(e)}")
        
        self.db.commit()
        
        return results
    
    # ==================== REPORTING ====================
    
    def get_pricing_summary(self, item_code: str) -> Dict[str, Any]:
        """Get comprehensive pricing summary for an item"""
        
        item_price = self.db.query(ItemPrice).filter(
            ItemPrice.tenant_id == self.tenant_id,
            ItemPrice.item_code == item_code,
            ItemPrice.pricing_tier_id == None
        ).first()
        
        batches = self.db.query(BatchPricing).filter(
            BatchPricing.tenant_id == self.tenant_id,
            BatchPricing.item_code == item_code,
            BatchPricing.is_active == True
        ).all()
        
        active_batches = [b for b in batches if b.remaining_qty > 0]
        
        suggested = self.calculate_suggested_selling_price(item_code)
        
        return {
            "item_code": item_code,
            "buying_prices": {
                "current": float(item_price.buying_price) if item_price and item_price.buying_price else None,
                "average": float(item_price.avg_buying_price) if item_price and item_price.avg_buying_price else None,
                "last": float(item_price.last_buying_price) if item_price and item_price.last_buying_price else None,
                "min": float(item_price.min_buying_price) if item_price and item_price.min_buying_price else None,
                "max": float(item_price.max_buying_price) if item_price and item_price.max_buying_price else None,
            },
            "selling_prices": {
                "current": float(item_price.selling_price) if item_price and item_price.selling_price else None,
                "minimum": float(item_price.min_selling_price) if item_price and item_price.min_selling_price else None,
                "recommended": float(suggested.suggested_price) if suggested else None,
            },
            "margin": {
                "type": item_price.margin_type if item_price else None,
                "value": float(item_price.margin_value) if item_price and item_price.margin_value else None,
                "current_percentage": float(
                    ((item_price.selling_price - item_price.buying_price) / item_price.buying_price * 100)
                ) if item_price and item_price.selling_price and item_price.buying_price else None,
            },
            "batches": {
                "total_count": len(batches),
                "active_count": len(active_batches),
                "total_qty": float(sum(b.remaining_qty for b in active_batches)),
            },
            "suggested_price": {
                "price": float(suggested.suggested_price) if suggested else None,
                "method": suggested.calculation_method if suggested else None,
                "breakdown": suggested.breakdown if suggested else None,
            } if suggested else None
        }
