"""Integration tests for Accounting API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid

client = TestClient(app)


class TestAccountingAPI:
    """Test suite for Accounting API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"],
            "user_code": "USER001"
        }
    
    @patch('app.routers.accounting.check_permission')
    @patch('app.routers.accounting.erpnext_adapter')
    def test_list_gl_entries(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing GL entries."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "GL-001", "account": "Cash", "debit": 1000},
                {"name": "GL-002", "account": "Revenue", "credit": 1000}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/accounting/gl-entries",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.accounting.check_permission')
    @patch('app.routers.accounting.erpnext_adapter')
    def test_list_journals(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing journal entries."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "JNL-001", "voucher_type": "Journal Entry"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/accounting/journals",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.accounting.check_permission')
    @patch('app.routers.accounting.erpnext_adapter')
    def test_list_accounts(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing accounts."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "Cash", "account_type": "Asset"},
                {"name": "Revenue", "account_type": "Income"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/accounting/accounts",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.accounting.check_permission')
    @patch('app.routers.accounting.erpnext_adapter')
    def test_create_journal_entry(self, mock_adapter, mock_check_permission, mock_user):
        """Test creating journal entry."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": {
                "name": "JNL-001",
                "voucher_type": "Journal Entry"
            }
        }
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/accounting/journals",
                json={
                    "voucher_type": "Journal Entry",
                    "posting_date": "2026-01-09",
                    "accounts": [
                        {"account": "Cash", "debit": 1000},
                        {"account": "Revenue", "credit": 1000}
                    ]
                },
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

