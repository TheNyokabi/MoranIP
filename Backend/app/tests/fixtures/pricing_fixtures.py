"""
Pricing Test Fixtures

Provides test data and fixtures for pricing-related tests.

Author: MoranERP Team
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from uuid import uuid4

from ...models.pricing import (
    PricingTier, ItemPrice, BatchPricing, 
    PricingSettings, PriceChangeLog
)


@pytest.fixture
def sample_pricing_settings():
    """Generate sample pricing settings"""
    return {
        "default_margin_type": "percentage",
        "default_margin_value": Decimal("30"),
        "selling_price_calculation": "percentile",
        "selling_price_percentile": 90,
        "round_prices": True,
        "rounding_method": "nearest",
        "rounding_precision": 0,
        "rounding_to": 5,
        "allow_below_cost_sale": False,
        "below_cost_approval_required": True,
        "tolerance_amount": Decimal("10"),
    }


@pytest.fixture
def sample_pricing_tiers():
    """Generate sample pricing tiers"""
    return [
        {
            "code": "RETAIL",
            "name": "Retail Price",
            "description": "Standard retail pricing",
            "discount_percentage": Decimal("0"),
            "priority": 100,
            "is_default": True,
        },
        {
            "code": "WHOLESALE",
            "name": "Wholesale Price",
            "description": "Discounted pricing for bulk buyers",
            "discount_percentage": Decimal("15"),
            "priority": 90,
            "is_default": False,
        },
        {
            "code": "VIP",
            "name": "VIP Customer Price",
            "description": "Special pricing for VIP customers",
            "discount_percentage": Decimal("20"),
            "priority": 80,
            "is_default": False,
        },
        {
            "code": "STAFF",
            "name": "Staff Price",
            "description": "Employee discount pricing",
            "discount_percentage": Decimal("25"),
            "priority": 70,
            "is_default": False,
        },
    ]


@pytest.fixture
def sample_item_prices():
    """Generate sample item prices"""
    return [
        {
            "item_code": "ITEM-001",
            "buying_price": Decimal("100"),
            "avg_buying_price": Decimal("95"),
            "last_buying_price": Decimal("100"),
            "min_buying_price": Decimal("90"),
            "max_buying_price": Decimal("110"),
            "selling_price": Decimal("150"),
            "min_selling_price": Decimal("120"),
            "margin_type": "percentage",
            "margin_value": Decimal("50"),
        },
        {
            "item_code": "ITEM-002",
            "buying_price": Decimal("500"),
            "avg_buying_price": Decimal("480"),
            "last_buying_price": Decimal("500"),
            "selling_price": Decimal("700"),
            "margin_type": "percentage",
            "margin_value": Decimal("40"),
        },
        {
            "item_code": "ITEM-003",
            "buying_price": Decimal("1000"),
            "selling_price": Decimal("1500"),
            "margin_type": "fixed",
            "margin_value": Decimal("500"),
        },
    ]


@pytest.fixture
def sample_batch_pricing():
    """Generate sample batch pricing data"""
    return [
        {
            "item_code": "ITEM-001",
            "batch_no": "BATCH-001",
            "buying_price": Decimal("90"),
            "original_qty": Decimal("100"),
            "remaining_qty": Decimal("75"),
            "received_date": datetime.utcnow() - timedelta(days=30),
        },
        {
            "item_code": "ITEM-001",
            "batch_no": "BATCH-002",
            "buying_price": Decimal("95"),
            "original_qty": Decimal("50"),
            "remaining_qty": Decimal("50"),
            "received_date": datetime.utcnow() - timedelta(days=15),
        },
        {
            "item_code": "ITEM-001",
            "batch_no": "BATCH-003",
            "buying_price": Decimal("100"),
            "original_qty": Decimal("80"),
            "remaining_qty": Decimal("80"),
            "received_date": datetime.utcnow() - timedelta(days=5),
        },
    ]


class PricingTestHelper:
    """Helper class for pricing tests"""
    
    @staticmethod
    def create_pricing_tier(db, tenant_id, tier_data):
        """Create a pricing tier in the database"""
        tier = PricingTier(
            id=uuid4(),
            tenant_id=tenant_id,
            **tier_data
        )
        db.add(tier)
        db.commit()
        db.refresh(tier)
        return tier
    
    @staticmethod
    def create_item_price(db, tenant_id, price_data, pricing_tier_id=None):
        """Create an item price record"""
        price = ItemPrice(
            id=uuid4(),
            tenant_id=tenant_id,
            pricing_tier_id=pricing_tier_id,
            **price_data
        )
        db.add(price)
        db.commit()
        db.refresh(price)
        return price
    
    @staticmethod
    def create_batch(db, tenant_id, batch_data):
        """Create a batch pricing record"""
        batch = BatchPricing(
            id=uuid4(),
            tenant_id=tenant_id,
            **batch_data
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch
    
    @staticmethod
    def create_settings(db, tenant_id, settings_data):
        """Create pricing settings"""
        settings = PricingSettings(
            tenant_id=tenant_id,
            **settings_data
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        return settings
    
    @staticmethod
    def assert_price_within_range(price, expected, tolerance=Decimal("1")):
        """Assert that a price is within an acceptable range"""
        assert abs(price - expected) <= tolerance, \
            f"Price {price} not within {tolerance} of expected {expected}"


@pytest.fixture
def pricing_test_helper():
    """Provide the pricing test helper"""
    return PricingTestHelper()


# Test data generators
def generate_random_batches(item_code: str, count: int = 5) -> list:
    """Generate random batch data for testing"""
    import random
    
    batches = []
    base_price = random.uniform(100, 1000)
    
    for i in range(count):
        price_variation = random.uniform(-0.1, 0.1)  # ±10%
        qty = random.randint(10, 100)
        remaining = random.randint(0, qty)
        
        batches.append({
            "item_code": item_code,
            "batch_no": f"BATCH-{i+1:03d}",
            "buying_price": Decimal(str(round(base_price * (1 + price_variation), 2))),
            "original_qty": Decimal(str(qty)),
            "remaining_qty": Decimal(str(remaining)),
            "received_date": datetime.utcnow() - timedelta(days=count - i),
            "is_active": remaining > 0,
            "is_depleted": remaining == 0,
        })
    
    return batches


def generate_price_history(item_code: str, days: int = 30) -> list:
    """Generate price history for testing"""
    import random
    
    history = []
    current_price = random.uniform(100, 500)
    
    for i in range(days):
        change = random.uniform(-0.05, 0.05)  # ±5% daily change
        current_price = current_price * (1 + change)
        
        history.append({
            "date": (datetime.utcnow() - timedelta(days=days - i)).isoformat(),
            "price": round(current_price, 2),
            "type": "selling_price",
        })
    
    return history
