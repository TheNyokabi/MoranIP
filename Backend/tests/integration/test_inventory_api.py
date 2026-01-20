"""Integration tests for Inventory API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_user, require_tenant_access
from app.database import get_db
import uuid

client = TestClient(app)


class TestInventoryAPI:
    """Test suite for Inventory API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"]
        }
    
    @patch('app.routers.inventory.erpnext_adapter')
    def test_list_items(self, mock_adapter, mock_user):
        """Test listing inventory items."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        # Mock adapter response - inventory router uses proxy_request which returns normalized response
        # The endpoint returns {"items": items or []}, and proxy_request returns {"data": [...]}
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"item_code": "ITEM-001", "item_name": "Test Item 1"},
                {"item_code": "ITEM-002", "item_name": "Test Item 2"}
            ]
        }
        
        try:
            # The endpoint path is /api/tenants/{tenant_id}/erp/inventory/items
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/inventory/items",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
            data = response.json()
            # Endpoint returns {"items": ...} structure
            assert "items" in data
            assert isinstance(data["items"], (list, dict))
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.inventory.erpnext_adapter')
    def test_create_item(self, mock_adapter, mock_user):
        """Test creating inventory item."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_adapter.proxy_request.return_value = {
            "data": {
                "item_code": "ITEM-001",
                "item_name": "New Item"
            }
        }
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/inventory/items",
                json={
                    "item_code": "ITEM-001",
                    "item_name": "New Item",
                    "stock_uom": "Nos"
                },
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.inventory.erpnext_adapter')
    def test_get_item(self, mock_adapter, mock_user):
        """Test getting inventory item."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_adapter.proxy_request.return_value = {
            "data": {
                "item_code": "ITEM-001",
                "item_name": "Test Item",
                "stock_uom": "Nos"
            }
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/inventory/items/ITEM-001",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.inventory.erpnext_adapter')
    def test_list_warehouses(self, mock_adapter, mock_user):
        """Test listing warehouses."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_adapter.proxy_request.return_value = {
            "data": [
                {"name": "Main Warehouse", "warehouse_name": "Main Warehouse"},
                {"name": "Branch Warehouse", "warehouse_name": "Branch Warehouse"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/inventory/warehouses",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.inventory.erpnext_adapter')
    def test_get_stock_balance(self, mock_adapter, mock_user):
        """Test getting stock balance."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_adapter.proxy_request.return_value = {"data": 100.0}
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/inventory/stock-balance",
                params={"item_code": "ITEM-001", "warehouse": "Main Warehouse"},
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
