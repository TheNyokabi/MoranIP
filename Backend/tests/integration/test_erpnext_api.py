"""Integration tests for ERPNext API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid

client = TestClient(app)


class TestERPNextAPI:
    """Test suite for ERPNext API endpoints."""
    
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
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_list_resource(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing ERPNext resources."""
        # Override dependencies
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        # Mock permission check (no exception means permission granted)
        mock_check_permission.return_value = True
        
        # Mock adapter response
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "ITEM-001", "item_name": "Test Item 1"},
                {"name": "ITEM-002", "item_name": "Test Item 2"}
            ]
        }
        
        try:
            response = client.get(
                "/erpnext/resource/Item",
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert isinstance(data["data"], list)
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_get_resource(self, mock_adapter, mock_check_permission, mock_user):
        """Test getting single ERPNext resource."""
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        
        mock_adapter.proxy_request.return_value = {
            "data": {
                "name": "ITEM-001",
                "item_name": "Test Item",
                "stock_uom": "Nos"
            }
        }
        
        try:
            response = client.get(
                "/erpnext/resource/Item/ITEM-001",
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert data["data"]["name"] == "ITEM-001"
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_create_resource(self, mock_adapter, mock_check_permission, mock_user):
        """Test creating ERPNext resource."""
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        
        mock_adapter.proxy_request.return_value = {
            "data": {
                "name": "ITEM-001",
                "item_name": "New Item"
            }
        }
        
        try:
            response = client.post(
                "/erpnext/resource/Item",
                json={
                    "doctype": "Item",
                    "item_code": "ITEM-001",
                    "item_name": "New Item"
                },
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
            data = response.json()
            assert "data" in data
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_update_resource(self, mock_adapter, mock_check_permission, mock_user):
        """Test updating ERPNext resource."""
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        
        mock_adapter.proxy_request.return_value = {
            "data": {
                "name": "ITEM-001",
                "item_name": "Updated Item"
            }
        }
        
        try:
            response = client.put(
                "/erpnext/resource/Item/ITEM-001",
                json={"item_name": "Updated Item"},
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_delete_resource(self, mock_adapter, mock_check_permission, mock_user):
        """Test deleting ERPNext resource."""
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        
        mock_adapter.proxy_request.return_value = {
            "status": "deleted",
            "doctype": "Item",
            "name": "ITEM-001"
        }
        
        try:
            response = client.delete(
                "/erpnext/resource/Item/ITEM-001",
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 204]
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.erpnext.check_erpnext_permission')
    @patch('app.routers.erpnext.erpnext_adapter')
    def test_execute_method(self, mock_adapter, mock_check_permission, mock_user):
        """Test executing ERPNext method."""
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        
        mock_adapter.proxy_request.return_value = {
            "data": {"result": 100.0}
        }
        
        try:
            response = client.post(
                "/erpnext/method/Stock/get_stock_balance",
                json={"item_code": "ITEM-001", "warehouse": "Main Warehouse"},
                headers={"X-Tenant-ID": mock_user['tenant_id'], "Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
