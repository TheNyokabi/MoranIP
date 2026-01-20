"""
Unit tests for VAT Service
"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from app.services.pos.vat_service import VATService


class TestVATService:
    """Test cases for VAT calculation service"""

    @pytest.fixture
    def vat_service(self):
        """Create VAT service instance"""
        return VATService()

    def test_calculate_vat_vatable_item(self, vat_service):
        """Test VAT calculation for vatable items"""
        amount = Decimal('1000.00')
        vat_rate = Decimal('16.0')
        is_vatable = True

        result = vat_service.calculate_vat(amount, vat_rate, is_vatable)

        expected_vat = amount * (vat_rate / 100)
        expected_total = amount + expected_vat

        assert result['base_amount'] == amount
        assert result['vat_amount'] == expected_vat
        assert result['total_amount'] == expected_total
        assert result['is_vatable'] == True
        assert result['vat_rate'] == vat_rate

    def test_calculate_vat_non_vatable_item(self, vat_service):
        """Test VAT calculation for non-vatable items"""
        amount = Decimal('1000.00')
        vat_rate = Decimal('16.0')
        is_vatable = False

        result = vat_service.calculate_vat(amount, vat_rate, is_vatable)

        assert result['base_amount'] == amount
        assert result['vat_amount'] == Decimal('0.00')
        assert result['total_amount'] == amount
        assert result['is_vatable'] == False
        assert result['vat_rate'] == Decimal('0.0')

    def test_calculate_vat_for_items_mixed(self, vat_service):
        """Test VAT calculation for mixed vatable/non-vatable items"""
        items = [
            {'amount': Decimal('1000.00'), 'vat_rate': Decimal('16.0'), 'is_vatable': True},
            {'amount': Decimal('500.00'), 'vat_rate': Decimal('16.0'), 'is_vatable': False},
            {'amount': Decimal('2000.00'), 'vat_rate': Decimal('8.0'), 'is_vatable': True}
        ]

        result = vat_service.calculate_vat_for_items(items)

        # First item: 1000 + 160 = 1160
        # Second item: 500 + 0 = 500
        # Third item: 2000 + 160 = 2160
        # Total: 1160 + 500 + 2160 = 3820

        expected_total_base = Decimal('3500.00')  # 1000 + 500 + 2000
        expected_total_vat = Decimal('320.00')    # 160 + 0 + 160
        expected_total_amount = Decimal('3820.00') # 3500 + 320

        assert result['total_base_amount'] == expected_total_base
        assert result['total_vat_amount'] == expected_total_vat
        assert result['total_amount'] == expected_total_amount
        assert len(result['item_breakdown']) == 3

    def test_calculate_vat_for_items_empty(self, vat_service):
        """Test VAT calculation for empty items list"""
        result = vat_service.calculate_vat_for_items([])

        assert result['total_base_amount'] == Decimal('0.00')
        assert result['total_vat_amount'] == Decimal('0.00')
        assert result['total_amount'] == Decimal('0.00')
        assert result['item_breakdown'] == []

    def test_calculate_vat_for_items_none_values(self, vat_service):
        """Test VAT calculation handling None values"""
        items = [
            {'amount': Decimal('1000.00'), 'vat_rate': None, 'is_vatable': True}
        ]

        # Should use default VAT rate for None values
        result = vat_service.calculate_vat_for_items(items)

        expected_vat = Decimal('1000.00') * (vat_service.default_vat_rate / 100)
        expected_total = Decimal('1000.00') + expected_vat

        assert result['total_base_amount'] == Decimal('1000.00')
        assert result['total_vat_amount'] == expected_vat
        assert result['total_amount'] == expected_total

    def test_get_vat_account_with_type(self, vat_service):
        """Test VAT account resolution with specific type"""
        # Mock ERPNext adapter
        vat_service.erpnext_adapter = AsyncMock()
        vat_service.erpnext_adapter.proxy_request.return_value = {
            'data': [{'name': 'VAT Output - Test Company'}]
        }

        result = vat_service.get_vat_account('Test Company', 'output')

        assert result == 'VAT Output - Test Company'

    def test_get_vat_account_default(self, vat_service):
        """Test VAT account resolution with default type"""
        # Mock ERPNext adapter
        vat_service.erpnext_adapter = AsyncMock()
        vat_service.erpnext_adapter.proxy_request.return_value = {
            'data': [{'name': 'VAT Output - Test Company'}]
        }

        result = vat_service.get_vat_account('Test Company')

        assert result == 'VAT Output - Test Company'

    def test_get_vat_account_not_found(self, vat_service):
        """Test VAT account resolution when account not found"""
        # Mock ERPNext adapter returning no data
        vat_service.erpnext_adapter = AsyncMock()
        vat_service.erpnext_adapter.proxy_request.return_value = {'data': []}

        result = vat_service.get_vat_account('Test Company', 'output')

        assert result == f'VAT Output - Test Company'  # Fallback format

    def test_rounding_precision(self, vat_service):
        """Test VAT calculation rounding precision"""
        amount = Decimal('123.456')
        vat_rate = Decimal('16.00')

        result = vat_service.calculate_vat(amount, vat_rate, True)

        # VAT should be calculated with proper precision
        expected_vat = (amount * vat_rate / 100).quantize(Decimal('0.01'))
        expected_total = (amount + expected_vat).quantize(Decimal('0.01'))

        assert result['vat_amount'] == expected_vat
        assert result['total_amount'] == expected_total

    def test_zero_amount_handling(self, vat_service):
        """Test VAT calculation with zero amounts"""
        result = vat_service.calculate_vat(Decimal('0.00'), Decimal('16.0'), True)

        assert result['base_amount'] == Decimal('0.00')
        assert result['vat_amount'] == Decimal('0.00')
        assert result['total_amount'] == Decimal('0.00')

    def test_negative_amount_handling(self, vat_service):
        """Test VAT calculation with negative amounts (edge case)"""
        result = vat_service.calculate_vat(Decimal('-100.00'), Decimal('16.0'), True)

        # Should handle negative amounts gracefully
        expected_vat = Decimal('-16.00')  # -100 * 16%
        expected_total = Decimal('-116.00')

        assert result['vat_amount'] == expected_vat
        assert result['total_amount'] == expected_total