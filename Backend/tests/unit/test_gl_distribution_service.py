"""
Unit tests for GL Distribution Service
"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from app.services.pos.gl_distribution_service import GLDistributionService


class TestGLDistributionService:
    """Test cases for GL entry distribution service"""

    @pytest.fixture
    def gl_service(self):
        """Create GL distribution service instance"""
        vat_service = MagicMock()
        return GLDistributionService(vat_service)

    def test_build_gl_entries_cash_payment(self, gl_service):
        """Test GL entries for cash payment"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 1160.00,  # 1000 + 160 VAT
            'total_taxes_and_charges': 160.00,
            'net_total': 1000.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 1160.00,
                    'account': 'Cash Account - Main'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST001',
                    'income_account': 'Sales - Test',
                    'amount': 1000.00
                }
            ],
            'taxes': [
                {
                    'account_head': 'VAT Output - Test Company',
                    'tax_amount': 160.00
                }
            ]
        }

        result = gl_service.build_gl_entries(invoice_data)

        # Should have entries for:
        # 1. Customer debit (total amount)
        # 2. Cash credit (payment amount)
        # 3. Sales revenue credit (net amount)
        # 4. VAT liability credit (tax amount)

        assert len(result) == 4

        # Check customer entry (debit)
        customer_entry = next(e for e in result if e.get('party_type') == 'Customer')
        assert customer_entry['debit'] == 1160.00
        assert customer_entry['credit'] == 0.00

        # Check cash entry (credit)
        cash_entry = next(e for e in result if 'Cash' in e.get('account', ''))
        assert cash_entry['credit'] == 1160.00
        assert cash_entry['debit'] == 0.00

        # Check sales entry (credit)
        sales_entry = next(e for e in result if 'Sales' in e.get('account', ''))
        assert sales_entry['credit'] == 1000.00
        assert sales_entry['debit'] == 0.00

        # Check VAT entry (credit)
        vat_entry = next(e for e in result if 'VAT' in e.get('account', ''))
        assert vat_entry['credit'] == 160.00
        assert vat_entry['debit'] == 0.00

    def test_build_gl_entries_mpesa_payment(self, gl_service):
        """Test GL entries for M-Pesa payment"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 1160.00,
            'total_taxes_and_charges': 160.00,
            'net_total': 1000.00,
            'payments': [
                {
                    'mode_of_payment': 'M-Pesa',
                    'amount': 1160.00,
                    'account': 'M-Pesa Account - Till 12345'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST001',
                    'income_account': 'Sales - Test',
                    'amount': 1000.00
                }
            ],
            'taxes': [
                {
                    'account_head': 'VAT Output - Test Company',
                    'tax_amount': 160.00
                }
            ]
        }

        result = gl_service.build_gl_entries(invoice_data)

        assert len(result) == 4

        # Check bank entry for M-Pesa (credit)
        bank_entry = next(e for e in result if 'M-Pesa' in e.get('account', ''))
        assert bank_entry['credit'] == 1160.00
        assert bank_entry['debit'] == 0.00
        assert bank_entry['account_type'] == 'Bank'

    def test_build_gl_entries_multiple_payments(self, gl_service):
        """Test GL entries for multiple payment methods"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 2000.00,
            'total_taxes_and_charges': 320.00,
            'net_total': 1680.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 1000.00,
                    'account': 'Cash Account - Main'
                },
                {
                    'mode_of_payment': 'M-Pesa',
                    'amount': 1000.00,
                    'account': 'M-Pesa Account - Till 12345'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST001',
                    'income_account': 'Sales - Test',
                    'amount': 1680.00
                }
            ],
            'taxes': [
                {
                    'account_head': 'VAT Output - Test Company',
                    'tax_amount': 320.00
                }
            ]
        }

        result = gl_service.build_gl_entries(invoice_data)

        assert len(result) == 5  # Customer + 2 payments + Sales + VAT

        # Check total debits equal total credits
        total_debits = sum(e.get('debit', 0) for e in result)
        total_credits = sum(e.get('credit', 0) for e in result)

        assert total_debits == total_credits == 2000.00

    def test_build_gl_entries_multiple_items(self, gl_service):
        """Test GL entries for multiple items with different accounts"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 2320.00,  # 2000 + 320 VAT
            'total_taxes_and_charges': 320.00,
            'net_total': 2000.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 2320.00,
                    'account': 'Cash Account - Main'
                }
            ],
            'items': [
                {
                    'item_code': 'PHONE001',
                    'income_account': 'Sales - Electronics',
                    'amount': 1200.00
                },
                {
                    'item_code': 'ACCESSORY001',
                    'income_account': 'Sales - Accessories',
                    'amount': 800.00
                }
            ],
            'taxes': [
                {
                    'account_head': 'VAT Output - Test Company',
                    'tax_amount': 320.00
                }
            ]
        }

        result = gl_service.build_gl_entries(invoice_data)

        assert len(result) == 5  # Customer + Cash + 2 Sales accounts + VAT

        # Check electronics sales entry
        electronics_entry = next(e for e in result if 'Electronics' in e.get('account', ''))
        assert electronics_entry['credit'] == 1200.00

        # Check accessories sales entry
        accessories_entry = next(e for e in result if 'Accessories' in e.get('account', ''))
        assert accessories_entry['credit'] == 800.00

    def test_build_gl_entries_no_taxes(self, gl_service):
        """Test GL entries for invoice with no taxes"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 1000.00,
            'total_taxes_and_charges': 0.00,
            'net_total': 1000.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 1000.00,
                    'account': 'Cash Account - Main'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST001',
                    'income_account': 'Sales - Test',
                    'amount': 1000.00
                }
            ],
            'taxes': []
        }

        result = gl_service.build_gl_entries(invoice_data)

        assert len(result) == 3  # Customer + Cash + Sales (no VAT entry)

        # Check no VAT entries
        vat_entries = [e for e in result if 'VAT' in e.get('account', '')]
        assert len(vat_entries) == 0

    def test_validate_gl_entries_balanced(self, gl_service):
        """Test GL entries validation for balanced entries"""
        entries = [
            {'account': 'Customer', 'debit': Decimal('1000.00'), 'credit': Decimal('0.00')},
            {'account': 'Cash', 'debit': Decimal('0.00'), 'credit': Decimal('500.00')},
            {'account': 'M-Pesa', 'debit': Decimal('0.00'), 'credit': Decimal('500.00')}
        ]

        # Validating with expected total 1000.00
        result = gl_service.validate_gl_entries(entries, Decimal('1000.00'))

        assert result is True

    def test_validate_gl_entries_unbalanced(self, gl_service):
        """Test GL entries validation for unbalanced entries"""
        entries = [
            {'account': 'Customer', 'debit': Decimal('1000.00'), 'credit': Decimal('0.00')},
            {'account': 'Cash', 'debit': Decimal('0.00'), 'credit': Decimal('400.00')}  # Short by 600
        ]

        # Unbalanced within entries (credits != debits)
        with pytest.raises(ValueError, match="GL entries do not balance"):
            gl_service.validate_gl_entries(entries, Decimal('1000.00'))

    def test_validate_gl_entries_empty(self, gl_service):
        """Test GL entries validation for empty entries"""
        # Empty entries should match 0 total
        result = gl_service.validate_gl_entries([], Decimal('0.00'))
        assert result is True



    def test_rounding_precision_gl_entries(self, gl_service):
        """Test GL entries handle decimal precision correctly"""
        invoice_data = {
            'customer': 'CUST001',
            'grand_total': 1160.01,  # Slightly odd amount
            'total_taxes_and_charges': 160.01,
            'net_total': 1000.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 1160.01,
                    'account': 'Cash Account - Main'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST001',
                    'income_account': 'Sales - Test',
                    'amount': 1000.00
                }
            ],
            'taxes': [
                {
                    'account_head': 'VAT Output - Test Company',
                    'tax_amount': 160.01
                }
            ]
        }

        result = gl_service.build_gl_entries(invoice_data)

        # Verify all entries have proper decimal precision
        for entry in result:
            assert isinstance(entry.get('debit', 0), (int, float, Decimal))
            assert isinstance(entry.get('credit', 0), (int, float, Decimal))

        # Verify entries are balanced
        # Expected total is 1160.01
        validation = gl_service.validate_gl_entries(result, Decimal('1160.01'))
        assert validation is True