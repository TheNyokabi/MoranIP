"""Integration tests for CRM API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid

client = TestClient(app)


class TestCRMAPI:
    """Test suite for CRM API endpoints."""
    
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
    
    @patch('app.routers.crm.check_permission')
    @patch('app.routers.crm.erpnext_adapter')
    def test_list_contacts(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing contacts."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "CONT-001", "first_name": "John", "last_name": "Doe"},
                {"name": "CONT-002", "first_name": "Jane", "last_name": "Smith"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/crm/contacts",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.crm.check_permission')
    @patch('app.routers.crm.erpnext_adapter')
    def test_list_customers(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing customers."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "CUST-001", "customer_name": "Acme Corp"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/crm/customers",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.crm.check_permission')
    @patch('app.routers.crm.erpnext_adapter')
    def test_create_lead(self, mock_adapter, mock_check_permission, mock_user):
        """Test creating a lead."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.proxy_request.return_value = {
            "data": {
                "name": "LEAD-001",
                "lead_name": "New Lead",
                "status": "Open"
            }
        }
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/crm/leads",
                json={
                    "lead_name": "New Lead",
                    "status": "Open",
                    "email": "lead@example.com"
                },
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

