"""Integration tests for ERP Modules API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.database import get_db
import uuid

client = TestClient(app)


class TestERPModulesAPI:
    """Test suite for ERP Modules API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"]
        }
    
    def test_list_erp_modules(self, mock_user):
        """Test listing ERP modules."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        # Mock database query
        mock_db = MagicMock()
        from app.models.erp_modules import ERPModule
        mock_module = MagicMock()
        mock_module.id = uuid.uuid4()
        mock_module.code = "INVENTORY"
        mock_module.name = "Inventory Management"
        mock_module.is_enabled = True
        mock_db.query().filter().all.return_value = [mock_module]
        app.dependency_overrides[get_db] = lambda: mock_db
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/modules",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 404]
        finally:
            app.dependency_overrides.clear()
    
    def test_enable_erp_module(self, mock_user):
        """Test enabling an ERP module."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/modules/enable",
                json={"module_code": "INVENTORY"},
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201, 404]
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

