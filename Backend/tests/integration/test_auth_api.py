"""Integration tests for authentication API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
import uuid

client = TestClient(app)


class TestAuthAPI:
    """Test suite for authentication API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        user = MagicMock()
        user.id = uuid.uuid4()
        user.email = "test@example.com"
        user.user_code = "USER001"
        user.kyc_tier = "TIER_1"
        user.password_hash = "$argon2id$v=19$m=65536,t=3,p=4$test_hash"
        return user
    
    @pytest.fixture
    def mock_tenant(self):
        """Create mock tenant."""
        tenant = MagicMock()
        tenant.id = uuid.uuid4()
        tenant.tenant_code = "TENANT001"
        tenant.status = "ACTIVE"
        return tenant
    
    @pytest.fixture
    def mock_membership(self):
        """Create mock membership."""
        membership = MagicMock()
        membership.status = "ACTIVE"
        return membership
    
    @patch('app.routers.auth.auth_service')
    @patch('app.routers.auth.get_db')
    def test_login_success(self, mock_get_db, mock_auth_service, mock_user, mock_tenant):
        """Test successful login."""
        # Mock database session
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # Mock authentication
        mock_auth_service.authenticate_user.return_value = mock_user
        mock_auth_service.get_user_tenants.return_value = [mock_tenant]
        
        # Set tenant attributes
        mock_tenant.name = "Test Tenant"
        mock_tenant.tenant_code = "TENANT001"
        mock_tenant.engine = "erpnext"
        
        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "password123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        # Login endpoint returns user info and tenants list, not access_token
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "test@example.com"
        assert "tenants" in data
        assert len(data["tenants"]) == 1
    
    @patch('app.routers.auth.auth_service')
    @patch('app.routers.auth.get_db')
    def test_login_invalid_credentials(self, mock_get_db, mock_auth_service):
        """Test login with invalid credentials."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # Mock authentication failure
        mock_auth_service.authenticate_user.return_value = None
        
        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "wrong_password"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    @patch('app.routers.auth.auth_service')
    @patch('app.routers.auth.get_db')
    def test_login_with_tenant_success(
        self, mock_get_db, mock_auth_service, mock_user, mock_tenant, mock_membership
    ):
        """Test successful login with tenant selection."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # Mock authentication and tenant lookup
        mock_auth_service.authenticate_user.return_value = mock_user
        mock_auth_service.get_user_tenants.return_value = [mock_tenant]
        mock_auth_service.get_tenant_membership.return_value = mock_membership
        mock_auth_service.create_tenant_token.return_value = "tenant_token_123"
        
        response = client.post(
            "/auth/v1/login-with-tenant",
            json={
                "email": "test@example.com",
                "password": "password123",
                "tenant_id": str(mock_tenant.id)
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["access_token"] == "tenant_token_123"
    
    @patch('app.routers.auth.auth_service')
    @patch('app.routers.auth.get_db')
    def test_login_with_tenant_no_membership(
        self, mock_get_db, mock_auth_service, mock_user, mock_tenant
    ):
        """Test login with tenant when user has no membership."""
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        mock_auth_service.authenticate_user.return_value = mock_user
        mock_auth_service.get_user_tenants.return_value = []  # No tenants
        mock_auth_service.get_tenant_membership.return_value = None
        
        response = client.post(
            "/auth/v1/login-with-tenant",
            json={
                "email": "test@example.com",
                "password": "password123",
                "tenant_id": str(mock_tenant.id)
            }
        )
        
        # Endpoint returns 200 with require_tenant_selection if no membership
        assert response.status_code == 200
        data = response.json()
        assert "require_tenant_selection" in data or "detail" in data
    
    def test_get_user_memberships(self, mock_user, mock_tenant):
        """Test getting user memberships."""
        from app.dependencies.auth import get_current_user
        from app.database import get_db
        
        mock_db = MagicMock()
        
        # Override dependencies
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(mock_user.id),
            "email": mock_user.email
        }
        app.dependency_overrides[get_db] = lambda: mock_db
        
        # Mock membership and tenant query result
        mock_membership = MagicMock()
        mock_membership.status = "ACTIVE"
        mock_membership.role = "ADMIN"
        
        mock_tenant.id = uuid.uuid4()
        mock_tenant.name = "Test Tenant"
        mock_tenant.tenant_code = "TENANT001"
        mock_tenant.engine = "erpnext"
        
        # Mock database query result - need to mock select().join().where().where().all()
        from sqlalchemy import select
        from app.models.iam import Membership, Tenant
        
        mock_result = MagicMock()
        mock_result.all.return_value = [(mock_membership, mock_tenant)]
        mock_db.execute.return_value = mock_result
        
        try:
            response = client.get("/auth/me/memberships")
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["code"] == "TENANT001"
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

