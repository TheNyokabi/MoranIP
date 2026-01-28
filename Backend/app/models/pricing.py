"""
Pricing Models

Comprehensive pricing system for managing:
- Pricing tiers (Retail, Wholesale, VIP, etc.)
- Item-specific pricing with margins
- Batch-aware buying prices (for FIFO/LIFO costing)
- Tenant-level pricing settings

Author: MoranERP Team
"""

from sqlalchemy import (
    Column, String, Text, Numeric, Boolean, Integer,
    DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text
from datetime import datetime
import uuid

from ..database import Base


def generate_uuid():
    return uuid.uuid4()


class PricingTier(Base):
    """
    Defines pricing tiers for different customer segments.
    
    Examples: Retail, Wholesale, VIP, Staff, Distributor
    """
    __tablename__ = "pricing_tiers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Tier identification
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Pricing rules
    discount_percentage = Column(Numeric(5, 2), default=0)  # e.g., 10.00 for 10%
    markup_percentage = Column(Numeric(5, 2), default=0)  # Alternative to discount
    
    # Priority (higher = applies first when multiple tiers match)
    priority = Column(Integer, default=100)
    
    # Status
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    item_prices = relationship("ItemPrice", back_populates="pricing_tier", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_pricing_tier_code_per_tenant'),
    )


class ItemPrice(Base):
    """
    Item-specific pricing configuration.
    
    Tracks both buying (cost) and selling prices for each item,
    with support for tier-based pricing.
    """
    __tablename__ = "item_prices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    item_code = Column(String(100), nullable=False)
    
    # Optional tier association (null = base price)
    pricing_tier_id = Column(UUID(as_uuid=True), ForeignKey("pricing_tiers.id"), nullable=True)
    
    # === BUYING PRICES (Cost) ===
    buying_price = Column(Numeric(15, 2), nullable=True)  # Current/standard buying price
    avg_buying_price = Column(Numeric(15, 2), nullable=True)  # Weighted average across batches
    last_buying_price = Column(Numeric(15, 2), nullable=True)  # From most recent purchase
    min_buying_price = Column(Numeric(15, 2), nullable=True)  # Lowest historical price
    max_buying_price = Column(Numeric(15, 2), nullable=True)  # Highest historical price
    
    # === SELLING PRICES ===
    selling_price = Column(Numeric(15, 2), nullable=True)  # Current selling price
    min_selling_price = Column(Numeric(15, 2), nullable=True)  # Floor price (no sales below this)
    recommended_price = Column(Numeric(15, 2), nullable=True)  # System-suggested price
    
    # === MARGIN SETTINGS ===
    margin_type = Column(String(20), default="percentage")  # "percentage" or "fixed"
    margin_value = Column(Numeric(10, 2), nullable=True)  # e.g., 30 for 30% or 500 for KES 500
    
    # === VALIDITY ===
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    
    # === METADATA ===
    last_updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    price_history = Column(JSONB, default=list)  # Historical prices for reference
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pricing_tier = relationship("PricingTier", back_populates="item_prices")
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'item_code', 'pricing_tier_id', name='unique_item_price_per_tier'),
    )


class BatchPricing(Base):
    """
    Track buying price per batch for FIFO/LIFO costing.
    
    Each purchase receipt creates a batch record with its specific
    buying price, enabling accurate cost tracking and margin calculation.
    """
    __tablename__ = "batch_pricing"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Item & Batch identification
    item_code = Column(String(100), nullable=False)
    batch_no = Column(String(100), nullable=True)  # Optional batch number
    
    # Source document
    purchase_receipt_id = Column(String(100), nullable=True)
    purchase_order_id = Column(String(100), nullable=True)
    supplier_id = Column(String(100), nullable=True)
    
    # Quantity tracking
    original_qty = Column(Numeric(15, 3), nullable=False)  # Original received quantity
    remaining_qty = Column(Numeric(15, 3), nullable=False)  # Current available quantity
    reserved_qty = Column(Numeric(15, 3), default=0)  # Reserved but not yet sold
    
    # Pricing
    buying_price = Column(Numeric(15, 2), nullable=False)  # Unit price at which batch was bought
    total_cost = Column(Numeric(15, 2), nullable=True)  # Total cost of batch
    currency = Column(String(3), default="KES")
    
    # Additional costs (can affect effective buying price)
    freight_cost = Column(Numeric(15, 2), default=0)
    import_duty = Column(Numeric(15, 2), default=0)
    other_costs = Column(Numeric(15, 2), default=0)
    
    # Effective price (buying_price + allocated costs per unit)
    effective_cost = Column(Numeric(15, 2), nullable=True)
    
    # Dates
    received_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_depleted = Column(Boolean, default=False)  # True when remaining_qty = 0
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        # Index for efficient FIFO queries
        # Index('idx_batch_pricing_fifo', 'tenant_id', 'item_code', 'received_date', 'is_active'),
    )


class PricingSettings(Base):
    """
    Tenant-level pricing configuration.
    
    Controls how prices are calculated, rounded, and validated.
    """
    __tablename__ = "pricing_settings"
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    
    # === CURRENCY ===
    default_currency = Column(String(3), default="KES")
    
    # === MARGIN DEFAULTS ===
    default_margin_type = Column(String(20), default="percentage")  # "percentage" or "fixed"
    default_margin_value = Column(Numeric(10, 2), default=30)  # 30% default margin
    
    # === SELLING PRICE CALCULATION ===
    # How to calculate selling price when item has multiple batch prices
    selling_price_calculation = Column(String(20), default="percentile")
    # Options: "average" - weighted average, "percentile" - nth percentile,
    #          "latest" - most recent, "highest" - max price, "lowest" - min price
    
    selling_price_percentile = Column(Integer, default=90)  # 90th percentile
    
    # === PRICE ROUNDING ===
    round_prices = Column(Boolean, default=True)
    rounding_method = Column(String(20), default="nearest")  # "up", "down", "nearest"
    rounding_precision = Column(Integer, default=0)  # Decimal places (0 = whole numbers)
    rounding_to = Column(Integer, default=5)  # Round to nearest 5, 10, 50, etc.
    
    # === BELOW-COST SALES ===
    allow_below_cost_sale = Column(Boolean, default=False)
    below_cost_approval_required = Column(Boolean, default=True)
    below_cost_approvers = Column(JSONB, default=list)  # List of user IDs who can approve
    
    # === PRICE CHANGE CONTROLS ===
    require_price_change_reason = Column(Boolean, default=False)
    max_discount_without_approval = Column(Numeric(5, 2), default=10)  # 10% max discount
    
    # === DISPLAY ===
    show_buying_price_in_pos = Column(Boolean, default=False)
    show_margin_in_pos = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceChangeLog(Base):
    """
    Audit log for all price changes.
    
    Tracks who changed what price, when, and why.
    """
    __tablename__ = "price_change_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # What changed
    item_code = Column(String(100), nullable=False)
    pricing_tier_id = Column(UUID(as_uuid=True), nullable=True)
    field_changed = Column(String(50), nullable=False)  # "selling_price", "buying_price", etc.
    
    # Old and new values
    old_value = Column(Numeric(15, 2), nullable=True)
    new_value = Column(Numeric(15, 2), nullable=True)
    
    # Who and why
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    
    # Approval (if required)
    requires_approval = Column(Boolean, default=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_status = Column(String(20), default="pending")  # "pending", "approved", "rejected"
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
