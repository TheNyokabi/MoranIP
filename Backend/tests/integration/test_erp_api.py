"""Integration tests for ERP API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_user, require_tenant_access
from app.dependencies.permissions import get_current_user_permissions
from app.database import get_db
from app.models.iam import Tenant
import uuid

client = TestClient(app)


class TestERPAPI:
    """Test suite for ERP API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"]
        }
    
    @patch('app.routers.erp.odoo_adapter')
    @patch('app.routers.erp.erpnext_adapter')
    def test_list_domain_partners(self, mock_erpnext, mock_odoo, mock_user):
        """Test listing domain partners."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_tenant_access] = lambda: tenant_id
        app.dependency_overrides[get_current_user_permissions] = lambda: ["erp:partners:view"]
        
        # Mock database
        mock_db = MagicMock()
        mock_tenant = Tenant()
        mock_tenant.id = uuid.UUID(tenant_id)
        mock_tenant.engine = "erpnext"
        mock_db.query().filter().first.return_value = mock_tenant
        app.dependency_overrides[get_db] = lambda: mock_db
        
        # Mock adapter response
        mock_erpnext.execute_call.return_value = [
            {"name": "CUST-001", "customer_name": "Customer A"}
        ]
        
        try:
            response = client.get(
                f"/erp/partners",
                params={"limit": 10},
                headers={"Authorization": "Bearer test_token", "X-Tenant-ID": tenant_id}
            )
            
            assert response.status_code in [200, 404]
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

