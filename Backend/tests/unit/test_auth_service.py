"""Unit tests for auth service."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select
import uuid

from app.services.auth_service import AuthService, auth_service
from app.models.iam import User, Tenant, Membership


class TestAuthService:
    """Test suite for AuthService."""
    
    @pytest.fixture
    def service(self):
        """Create service instance."""
        return AuthService()
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return Mock(spec=Session)
    
    def test_verify_password_success(self, service):
        """Test successful password verification."""
        password = "test_password_123"
        hashed = service.get_password_hash(password)
        assert service.verify_password(password, hashed) is True
    
    def test_verify_password_failure(self, service):
        """Test failed password verification."""
        password = "test_password_123"
        wrong_password = "wrong_password"
        hashed = service.get_password_hash(password)
        assert service.verify_password(wrong_password, hashed) is False
    
    def test_get_password_hash(self, service):
        """Test password hashing."""
        password = "test_password_123"
        hashed = service.get_password_hash(password)
        assert hashed != password
        assert len(hashed) > 0
    
    def test_create_access_token_default_expiry(self, service):
        """Test creating access token with default expiry."""
        data = {"sub": "user123", "email": "test@example.com"}
        token = service.create_access_token(data)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_access_token_custom_expiry(self, service):
        """Test creating access token with custom expiry."""
        data = {"sub": "user123"}
        expires_delta = timedelta(minutes=30)
        token = service.create_access_token(data, expires_delta=expires_delta)
        assert token is not None
    
    def test_authenticate_user_success(self, service, mock_db):
        """Test successful user authentication."""
        user = Mock(spec=User)
        user.email = "test@example.com"
        user.password_hash = service.get_password_hash("password123")
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_db.execute.return_value = mock_result
        
        result = service.authenticate_user(mock_db, "test@example.com", "password123")
        assert result == user
    
    def test_authenticate_user_not_found(self, service, mock_db):
        """Test authentication with non-existent user."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        result = service.authenticate_user(mock_db, "nonexistent@example.com", "password123")
        assert result is None
    
    def test_authenticate_user_wrong_password(self, service, mock_db):
        """Test authentication with wrong password."""
        user = Mock(spec=User)
        user.email = "test@example.com"
        user.password_hash = service.get_password_hash("correct_password")
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user
        mock_db.execute.return_value = mock_result
        
        result = service.authenticate_user(mock_db, "test@example.com", "wrong_password")
        assert result is None
    
    def test_get_user_tenants_regular_user(self, service, mock_db):
        """Test getting tenants for regular user."""
        user_id = uuid.uuid4()
        tenant1 = Mock(spec=Tenant)
        tenant1.id = uuid.uuid4()
        tenant2 = Mock(spec=Tenant)
        tenant2.id = uuid.uuid4()
        
        # Mock SUPER_ADMIN check returns None
        mock_db.query().filter().first.return_value = None
        
        # Mock membership query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [tenant1, tenant2]
        mock_db.execute.return_value = mock_result
        
        result = service.get_user_tenants(mock_db, user_id)
        assert len(result) == 2
        assert tenant1 in result
        assert tenant2 in result
    
    def test_get_user_tenants_super_admin(self, service, mock_db):
        """Test getting tenants for super admin user."""
        user_id = uuid.uuid4()
        tenant1 = Mock(spec=Tenant)
        tenant2 = Mock(spec=Tenant)
        
        # Mock SUPER_ADMIN role exists
        super_admin_role = Mock()
        super_admin_role.id = uuid.uuid4()
        mock_db.query().filter().first.return_value = super_admin_role
        
        # Mock UserRole check - user has SUPER_ADMIN
        mock_user_role = Mock()
        mock_user_role.is_expired = False
        mock_db.query().filter().filter().filter().filter().first.return_value = mock_user_role
        
        # Mock all tenants query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [tenant1, tenant2]
        mock_db.execute.return_value = mock_result
        
        result = service.get_user_tenants(mock_db, user_id)
        assert len(result) == 2
    
    def test_get_tenant_membership_found(self, service, mock_db):
        """Test getting tenant membership when found."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        membership = Mock(spec=Membership)
        membership.user_id = user_id
        membership.tenant_id = tenant_id
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = membership
        mock_db.execute.return_value = mock_result
        
        result = service.get_tenant_membership(mock_db, user_id, tenant_id)
        assert result == membership
    
    def test_get_tenant_membership_not_found(self, service, mock_db):
        """Test getting tenant membership when not found."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        result = service.get_tenant_membership(mock_db, user_id, tenant_id)
        assert result is None
    
    @patch('app.services.rbac_service.rbac_service')
    def test_create_tenant_token_with_roles(self, mock_rbac, service, mock_db):
        """Test creating tenant token with roles."""
        user = Mock(spec=User)
        user.id = uuid.uuid4()
        user.user_code = "USER001"
        user.kyc_tier = "TIER_1"
        
        tenant = Mock(spec=Tenant)
        tenant.id = uuid.uuid4()
        tenant.tenant_code = "TENANT001"
        
        membership = Mock(spec=Membership)
        
        # Mock role
        role = Mock()
        role.code = "ADMIN"
        mock_rbac.get_user_roles.return_value = [role]
        
        token = service.create_tenant_token(user, tenant, membership, db=mock_db)
        assert token is not None
        assert isinstance(token, str)
        mock_rbac.get_user_roles.assert_called_once()
    
    def test_create_tenant_token_without_db(self, service):
        """Test creating tenant token without database session."""
        user = Mock(spec=User)
        user.id = uuid.uuid4()
        user.user_code = "USER001"
        user.kyc_tier = "TIER_1"
        
        tenant = Mock(spec=Tenant)
        tenant.id = uuid.uuid4()
        tenant.tenant_code = "TENANT001"
        
        membership = Mock(spec=Membership)
        
        token = service.create_tenant_token(user, tenant, membership, db=None)
        assert token is not None
        assert isinstance(token, str)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

