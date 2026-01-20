"""
Integration tests for POS Invoice Creation Flow
"""
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.services.pos.vat_service import VATService
from app.services.pos.gl_distribution_service import GLDistributionService


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_erpnext_adapter():
    """Mock ERPNext adapter for testing"""
    mock_adapter = AsyncMock()

    # Mock POS profile response
    mock_adapter.proxy_request.side_effect = lambda tenant_id, path, **kwargs: {
        # POS Profile request
        'data': {
            'name': 'TEST_POS',
            'warehouse': 'Test Warehouse',
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'account': 'Cash Account - Test'
                }
            ]
        }
    } if 'POS Profile' in path else {
        # Item request
        'data': [{
            'name': 'TEST_ITEM',
            'item_name': 'Test Item',
            'standard_rate': 1000.00,
            'item_group': 'Test Group'
        }]
    } if 'Item' in path else {
        # Customer request
        'data': [{
            'name': 'TEST_CUSTOMER',
            'customer_name': 'Test Customer'
        }]
    } if 'Customer' in path else {
        # Sales Invoice creation
        'data': {
            'name': 'SINV-TEST-00001',
            'status': 'Paid',
            'grand_total': 1160.00,
            'total_taxes_and_charges': 160.00,
            'net_total': 1000.00
        }
    }

    return mock_adapter


class TestPOSInvoiceIntegration:
    """Integration tests for complete POS invoice creation flow"""

    @pytest.mark.asyncio
    async def test_complete_invoice_creation_flow(self, client, mock_erpnext_adapter):
        """Test complete invoice creation flow from request to GL entries"""

        # Mock the ERPNext adapter in the services
        with patch('app.services.pos.pos_service_base.ERPNextAdapter', return_value=mock_erpnext_adapter), \
             patch('app.services.pos.vat_service.VATService.erpnext_adapter', mock_erpnext_adapter), \
             patch('app.services.pos.gl_distribution_service.GLDistributionService.erpnext_adapter', mock_erpnext_adapter):

            # Test data
            invoice_request = {
                "customer": "TEST_CUSTOMER",
                "items": [
                    {
                        "item_code": "TEST_ITEM",
                        "qty": 1,
                        "rate": 1000.00,
                        "warehouse": "Test Warehouse"
                    }
                ],
                "payments": [
                    {
                        "mode_of_payment": "Cash",
                        "amount": 1160.00
                    }
                ],
                "pos_profile_id": "TEST_POS",
                "is_vatable": True
            }

            # Make request to POS invoice endpoint
            response = client.post(
                "/api/pos/invoice",
                json=invoice_request,
                headers={"X-Tenant-ID": "test-tenant"}
            )

            # Assert successful response
            assert response.status_code == 200
            response_data = response.json()

            # Verify invoice creation response
            assert "invoice_id" in response_data
            assert response_data["invoice_id"] == "SINV-TEST-00001"
            assert response_data["status"] == "Paid"
            assert response_data["total_amount"] == 1160.00
            assert response_data["vat_amount"] == 160.00
            assert response_data["net_amount"] == 1000.00

    @pytest.mark.asyncio
    async def test_vat_calculation_integration(self, mock_erpnext_adapter):
        """Test VAT calculation integration"""
        vat_service = VATService()
        vat_service.erpnext_adapter = mock_erpnext_adapter

        # Test VAT calculation
        result = vat_service.calculate_vat_for_items([
            {
                'amount': Decimal('1000.00'),
                'vat_rate': Decimal('16.0'),
                'is_vatable': True
            }
        ])

        assert result['total_base_amount'] == Decimal('1000.00')
        assert result['total_vat_amount'] == Decimal('160.00')
        assert result['total_amount'] == Decimal('1160.00')

    @pytest.mark.asyncio
    async def test_gl_distribution_integration(self, mock_erpnext_adapter):
        """Test GL distribution integration"""
        gl_service = GLDistributionService()
        gl_service.erpnext_adapter = mock_erpnext_adapter

        invoice_data = {
            'customer': 'TEST_CUSTOMER',
            'grand_total': 1160.00,
            'total_taxes_and_charges': 160.00,
            'net_total': 1000.00,
            'payments': [
                {
                    'mode_of_payment': 'Cash',
                    'amount': 1160.00,
                    'account': 'Cash Account - Test'
                }
            ],
            'items': [
                {
                    'item_code': 'TEST_ITEM',
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

        gl_entries = gl_service.build_gl_entries(invoice_data)

        # Validate GL entries
        validation = gl_service.validate_gl_entries(gl_entries)

        assert validation['is_balanced'] == True
        assert validation['total_debits'] == 1160.00
        assert validation['total_credits'] == 1160.00

        # Verify entry count (Customer + Cash + Sales + VAT)
        assert len(gl_entries) == 4

    def test_pos_profile_validation(self, client):
        """Test POS profile validation in invoice creation"""
        # Test missing pos_profile_id
        invoice_request = {
            "customer": "TEST_CUSTOMER",
            "items": [{"item_code": "TEST_ITEM", "qty": 1, "rate": 1000.00}],
            "payments": [{"mode_of_payment": "Cash", "amount": 1160.00}]
            # Missing pos_profile_id
        }

        response = client.post(
            "/api/pos/invoice",
            json=invoice_request,
            headers={"X-Tenant-ID": "test-tenant"}
        )

        # Should fail with validation error
        assert response.status_code == 422  # Validation error

    def test_payment_amount_validation(self, client):
        """Test payment amount validation"""
        invoice_request = {
            "customer": "TEST_CUSTOMER",
            "items": [{"item_code": "TEST_ITEM", "qty": 1, "rate": 1000.00}],
            "payments": [
                {"mode_of_payment": "Cash", "amount": 500.00}  # Insufficient payment
            ],
            "pos_profile_id": "TEST_POS"
        }

        response = client.post(
            "/api/pos/invoice",
            json=invoice_request,
            headers={"X-Tenant-ID": "test-tenant"}
        )

        # Should fail with payment validation error
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_offline_transaction_queue(self, mock_erpnext_adapter):
        """Test offline transaction queuing"""
        from app.services.pos.offline_service import OfflineService

        offline_service = OfflineService()
        offline_service.erpnext_adapter = mock_erpnext_adapter

        # Queue a transaction
        transaction_id = await offline_service.queue_transaction(
            tenant_id="test-tenant",
            transaction_type="invoice",
            data={"test": "data"},
            priority=2
        )

        assert transaction_id is not None

        # Retrieve pending transactions
        pending = await offline_service.get_pending_transactions("test-tenant")

        assert len(pending) >= 1
        assert any(tx.id == transaction_id for tx in pending)

    def test_api_response_format(self, client):
        """Test API response format consistency"""
        # Test successful response structure
        response = client.get("/api/pos/items", headers={"X-Tenant-ID": "test-tenant"})

        # Should return proper JSON structure even if empty
        assert response.status_code in [200, 404]  # OK or Not Found for empty data

        if response.status_code == 200:
            response_data = response.json()
            # Should have consistent structure
            assert isinstance(response_data, (list, dict))

    def test_error_response_format(self, client):
        """Test error response format consistency"""
        # Make invalid request
        response = client.post(
            "/api/pos/invoice",
            json={"invalid": "data"},
            headers={"X-Tenant-ID": "test-tenant"}
        )

        # Should return structured error
        assert response.status_code >= 400
        error_data = response.json()

        # Should have consistent error structure
        assert "detail" in error_data or "message" in error_data

    @pytest.mark.asyncio
    async def test_plugin_system_integration(self):
        """Test plugin system integration"""
        from app.services.pos.plugin_registry import plugin_registry

        # Plugin registry should be available
        hooks = plugin_registry.get_available_hooks()
        assert len(hooks) > 0
        assert "before_invoice_create" in hooks
        assert "after_invoice_create" in hooks

        # Should be able to execute hooks without errors
        results = await plugin_registry.execute_hook("before_invoice_create", {})
        assert isinstance(results, list)  # Should return list even with no plugins

    def test_tenant_isolation(self, client):
        """Test tenant data isolation"""
        # Test that different tenants get isolated data
        headers1 = {"X-Tenant-ID": "tenant-1"}
        headers2 = {"X-Tenant-ID": "tenant-2"}

        # Both should work independently
        response1 = client.get("/api/pos/items", headers=headers1)
        response2 = client.get("/api/pos/items", headers=headers2)

        # Both should return same status (both succeed or both fail)
        assert response1.status_code == response2.status_code