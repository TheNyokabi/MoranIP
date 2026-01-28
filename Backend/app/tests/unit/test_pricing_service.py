"""
Unit Tests for Pricing Service

Tests the pricing calculation engine including:
- Batch-aware cost calculation
- Margin application
- Price rounding
- Selling price suggestions

Author: MoranERP Team
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from ...services.pricing_service import PricingService, SuggestedPrice


class TestPricingCalculations:
    """Test pricing calculation methods"""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        db = Mock()
        db.query = Mock(return_value=Mock())
        db.add = Mock()
        db.commit = Mock()
        db.refresh = Mock()
        return db
    
    @pytest.fixture
    def mock_settings(self):
        """Create mock pricing settings"""
        settings = Mock()
        settings.default_margin_type = "percentage"
        settings.default_margin_value = Decimal("30")
        settings.selling_price_calculation = "percentile"
        settings.selling_price_percentile = 90
        settings.round_prices = True
        settings.rounding_method = "nearest"
        settings.rounding_precision = 0
        settings.rounding_to = 5
        settings.allow_below_cost_sale = False
        settings.below_cost_approval_required = True
        settings.tolerance_amount = Decimal("10")
        return settings
    
    @pytest.fixture
    def pricing_service(self, mock_db, mock_settings):
        """Create pricing service instance"""
        service = PricingService(mock_db, str(uuid4()))
        service._settings = mock_settings
        return service
    
    def test_round_price_nearest(self, pricing_service):
        """Test price rounding to nearest value"""
        # Test rounding to nearest 5
        assert pricing_service._round_price(Decimal("123")) == Decimal("125")
        assert pricing_service._round_price(Decimal("121")) == Decimal("120")
        assert pricing_service._round_price(Decimal("127")) == Decimal("125")
        assert pricing_service._round_price(Decimal("128")) == Decimal("130")
    
    def test_round_price_up(self, pricing_service):
        """Test price rounding up"""
        pricing_service._settings.rounding_method = "up"
        
        assert pricing_service._round_price(Decimal("121")) == Decimal("125")
        assert pricing_service._round_price(Decimal("126")) == Decimal("130")
    
    def test_round_price_down(self, pricing_service):
        """Test price rounding down"""
        pricing_service._settings.rounding_method = "down"
        
        assert pricing_service._round_price(Decimal("124")) == Decimal("120")
        assert pricing_service._round_price(Decimal("129")) == Decimal("125")
    
    def test_round_price_disabled(self, pricing_service):
        """Test with rounding disabled"""
        pricing_service._settings.round_prices = False
        
        assert pricing_service._round_price(Decimal("123.456")) == Decimal("123.456")
    
    def test_percentile_price_calculation(self, pricing_service):
        """Test percentile-based price calculation"""
        prices_with_qty = [
            (Decimal("100"), Decimal("50")),  # 50 units at 100
            (Decimal("110"), Decimal("30")),  # 30 units at 110
            (Decimal("120"), Decimal("20")),  # 20 units at 120
        ]
        
        # 90th percentile with 100 total units
        # 90 units = 50 + 30 + 10 -> should be at 120
        result = pricing_service._calculate_percentile_price(prices_with_qty, 90)
        assert result == Decimal("120")
        
        # 50th percentile -> should be at 100
        result = pricing_service._calculate_percentile_price(prices_with_qty, 50)
        assert result == Decimal("100")
    
    def test_weighted_average_calculation(self, pricing_service):
        """Test weighted average price calculation"""
        prices_with_qty = [
            (Decimal("100"), Decimal("50")),
            (Decimal("200"), Decimal("50")),
        ]
        
        # Average should be (100*50 + 200*50) / 100 = 150
        result = pricing_service._calculate_weighted_average(prices_with_qty)
        assert result == Decimal("150")
    
    def test_weighted_average_unequal_quantities(self, pricing_service):
        """Test weighted average with unequal quantities"""
        prices_with_qty = [
            (Decimal("100"), Decimal("75")),
            (Decimal("200"), Decimal("25")),
        ]
        
        # Average should be (100*75 + 200*25) / 100 = 125
        result = pricing_service._calculate_weighted_average(prices_with_qty)
        assert result == Decimal("125")


class TestPriceValidation:
    """Test price validation logic"""
    
    @pytest.fixture
    def mock_db(self):
        db = Mock()
        return db
    
    @pytest.fixture
    def mock_settings(self):
        settings = Mock()
        settings.allow_below_cost_sale = False
        settings.below_cost_approval_required = True
        settings.tolerance_amount = Decimal("10")
        return settings
    
    @pytest.fixture
    def pricing_service(self, mock_db, mock_settings):
        service = PricingService(mock_db, str(uuid4()))
        service._settings = mock_settings
        return service
    
    def test_validate_price_above_cost(self, pricing_service, mock_db):
        """Test validation passes for price above cost"""
        # Mock item price query
        mock_item_price = Mock()
        mock_item_price.buying_price = Decimal("100")
        mock_item_price.avg_buying_price = Decimal("100")
        mock_item_price.min_selling_price = Decimal("80")
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item_price
        
        result = pricing_service.validate_selling_price("ITEM-001", Decimal("150"))
        
        assert result.is_valid is True
        assert result.is_below_cost is False
        assert result.margin_percentage == Decimal("50")
    
    def test_validate_price_below_cost_not_allowed(self, pricing_service, mock_db):
        """Test validation fails for below-cost when not allowed"""
        mock_item_price = Mock()
        mock_item_price.buying_price = Decimal("100")
        mock_item_price.avg_buying_price = Decimal("100")
        mock_item_price.min_selling_price = None
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item_price
        
        result = pricing_service.validate_selling_price("ITEM-001", Decimal("80"))
        
        assert result.is_valid is False
        assert result.is_below_cost is True
        assert len(result.validation_messages) > 0
    
    def test_validate_price_below_cost_requires_approval(self, pricing_service, mock_db):
        """Test validation requires approval for below-cost when allowed"""
        pricing_service._settings.allow_below_cost_sale = True
        
        mock_item_price = Mock()
        mock_item_price.buying_price = Decimal("100")
        mock_item_price.avg_buying_price = Decimal("100")
        mock_item_price.min_selling_price = None
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item_price
        
        result = pricing_service.validate_selling_price("ITEM-001", Decimal("80"))
        
        assert result.is_below_cost is True
        assert result.requires_approval is True
    
    def test_validate_price_below_minimum(self, pricing_service, mock_db):
        """Test validation fails when below minimum selling price"""
        mock_item_price = Mock()
        mock_item_price.buying_price = Decimal("100")
        mock_item_price.avg_buying_price = Decimal("100")
        mock_item_price.min_selling_price = Decimal("120")
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_item_price
        
        result = pricing_service.validate_selling_price("ITEM-001", Decimal("110"))
        
        assert result.is_valid is False
        assert "minimum selling price" in result.validation_messages[0].lower()


class TestSuggestedPriceCalculation:
    """Test suggested price calculation"""
    
    @pytest.fixture
    def mock_db(self):
        return Mock()
    
    @pytest.fixture
    def mock_batches(self):
        """Create mock batches for testing"""
        batches = []
        for i, (price, qty) in enumerate([
            (Decimal("90"), Decimal("50")),
            (Decimal("95"), Decimal("30")),
            (Decimal("100"), Decimal("20")),
        ]):
            batch = Mock()
            batch.id = str(uuid4())
            batch.effective_cost = price
            batch.buying_price = price
            batch.remaining_qty = qty
            batch.received_date = datetime.utcnow() - timedelta(days=10-i)
            batches.append(batch)
        return batches
    
    @pytest.fixture
    def mock_settings(self):
        settings = Mock()
        settings.default_margin_type = "percentage"
        settings.default_margin_value = Decimal("30")
        settings.selling_price_calculation = "percentile"
        settings.selling_price_percentile = 90
        settings.round_prices = True
        settings.rounding_method = "nearest"
        settings.rounding_precision = 0
        settings.rounding_to = 5
        return settings
    
    def test_calculate_suggested_price_percentile(
        self, mock_db, mock_batches, mock_settings
    ):
        """Test suggested price with percentile method"""
        # Setup
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_batches
        
        service = PricingService(mock_db, str(uuid4()))
        service._settings = mock_settings
        
        result = service.calculate_suggested_selling_price("ITEM-001")
        
        assert result is not None
        assert result.item_code == "ITEM-001"
        assert result.batch_count == 3
        assert result.calculation_method == "percentile"
        # Base cost at 90th percentile should be around 100
        # With 30% margin: 100 * 1.3 = 130
        assert result.suggested_price >= Decimal("100")
    
    def test_calculate_suggested_price_average(
        self, mock_db, mock_batches, mock_settings
    ):
        """Test suggested price with average method"""
        mock_settings.selling_price_calculation = "average"
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_batches
        
        service = PricingService(mock_db, str(uuid4()))
        service._settings = mock_settings
        
        result = service.calculate_suggested_selling_price("ITEM-001")
        
        assert result is not None
        assert result.calculation_method == "average"
    
    def test_calculate_suggested_price_no_batches(self, mock_db, mock_settings):
        """Test suggested price returns None when no batches"""
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        
        service = PricingService(mock_db, str(uuid4()))
        service._settings = mock_settings
        
        result = service.calculate_suggested_selling_price("ITEM-001")
        
        assert result is None
