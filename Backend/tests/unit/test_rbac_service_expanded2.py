"""Additional expanded unit tests for rbac_service to increase coverage."""
import pytest
from unittest.mock import Mock, MagicMock, patch, PropertyMock
from app.services.rbac_service import rbac_service
from app.models.rbac import Role, Permission, UserRole, RolePermission, PermissionOverride, RoleAuditLog
import uuid
from datetime import datetime, timedelta


class TestRBACServiceAdditional:
    """Additional tests for RBAC service to increase coverage."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return MagicMock()
    
    @pytest.fixture
    def mock_user_id(self):
        """Create mock user ID."""
        return uuid.uuid4()
    
    @pytest.fixture
    def mock_tenant_id(self):
        """Create mock tenant ID."""
        return uuid.uuid4()
    
    def test_grant_permission_override_success(self, mock_db, mock_user_id, mock_tenant_id):
        """Test granting permission override."""
        permission_code = "crm:leads:delete"
        expires_at = datetime.now() + timedelta(days=30)
        
        # Mock existing override check
        mock_db.query().filter().filter().filter().first.return_value = None
        
        # Mock permission lookup
        mock_permission = Permission()
        mock_permission.id = uuid.uuid4()
        mock_permission.code = permission_code
        mock_db.query().filter().first.return_value = mock_permission
        
        # Mock user role lookup
        mock_user_role = UserRole()
        mock_user_role.role_id = uuid.uuid4()
        mock_db.query().filter().filter().filter().first.return_value = mock_user_role
        
        result = rbac_service.grant_permission_override(
            mock_db, mock_user_id, mock_tenant_id, permission_code, expires_at
        )
        
        assert result is not None
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    def test_grant_permission_override_existing(self, mock_db, mock_user_id, mock_tenant_id):
        """Test granting permission override when one already exists."""
        permission_code = "crm:leads:delete"
        expires_at = datetime.now() + timedelta(days=30)
        
        # Mock existing override
        mock_override = PermissionOverride()
        mock_override.id = uuid.uuid4()
        mock_override.is_expired = PropertyMock(return_value=False)
        mock_db.query().filter().filter().filter().first.return_value = mock_override
        
        result = rbac_service.grant_permission_override(
            mock_db, mock_user_id, mock_tenant_id, permission_code, expires_at
        )
        
        assert result is not None
        mock_db.commit.assert_called_once()
    
    def test_revoke_permission_override_success(self, mock_db, mock_user_id, mock_tenant_id):
        """Test revoking permission override."""
        permission_code = "crm:leads:delete"
        
        # Mock existing override
        mock_override = PermissionOverride()
        mock_override.id = uuid.uuid4()
        mock_db.query().filter().filter().filter().first.return_value = mock_override
        
        result = rbac_service.revoke_permission_override(
            mock_db, mock_user_id, mock_tenant_id, permission_code
        )
        
        assert result is True
        mock_db.delete.assert_called_once()
        mock_db.commit.assert_called_once()
    
    def test_revoke_permission_override_not_found(self, mock_db, mock_user_id, mock_tenant_id):
        """Test revoking permission override when not found."""
        permission_code = "crm:leads:delete"
        
        # Mock no existing override
        mock_db.query().filter().filter().filter().first.return_value = None
        
        result = rbac_service.revoke_permission_override(
            mock_db, mock_user_id, mock_tenant_id, permission_code
        )
        
        assert result is False
    
    def test_audit_log_success(self, mock_db, mock_user_id, mock_tenant_id):
        """Test audit logging."""
        action = "assign_role"
        details = {"role_code": "MANAGER"}
        
        result = rbac_service.audit_log(
            mock_db, mock_user_id, mock_tenant_id, action, details
        )
        
        assert result is not None
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    def test_get_user_roles_system_wide(self, mock_db, mock_user_id):
        """Test getting user roles system-wide (no tenant)."""
        # Mock user roles
        mock_role1 = Role()
        mock_role1.code = "ADMIN"
        mock_role1.id = uuid.uuid4()
        
        mock_role2 = Role()
        mock_role2.code = "MANAGER"
        mock_role2.id = uuid.uuid4()
        
        mock_user_role1 = UserRole()
        mock_user_role1.role = mock_role1
        mock_user_role1.is_active = True
        mock_user_role1.is_expired = PropertyMock(return_value=False)
        
        mock_user_role2 = UserRole()
        mock_user_role2.role = mock_role2
        mock_user_role2.is_active = True
        mock_user_role2.is_expired = PropertyMock(return_value=False)
        
        mock_db.query().join().filter().filter().all.return_value = [
            mock_user_role1, mock_user_role2
        ]
        
        result = rbac_service.get_user_roles(mock_db, mock_user_id, None)
        
        assert len(result) == 2
        assert result[0].code == "ADMIN"
        assert result[1].code == "MANAGER"
    
    def test_get_effective_permissions_with_wildcards(self, mock_db, mock_user_id, mock_tenant_id):
        """Test getting effective permissions with wildcard matching."""
        # Mock role permissions
        mock_permission1 = Permission()
        mock_permission1.code = "crm:*:view"
        mock_permission1.id = uuid.uuid4()
        
        mock_permission2 = Permission()
        mock_permission2.code = "inventory:items:create"
        mock_permission2.id = uuid.uuid4()
        
        mock_role_perm1 = RolePermission()
        mock_role_perm1.permission = mock_permission1
        
        mock_role_perm2 = RolePermission()
        mock_role_perm2.permission = mock_permission2
        
        # Mock user roles
        mock_role = Role()
        mock_role.id = uuid.uuid4()
        mock_user_role = UserRole()
        mock_user_role.role = mock_role
        mock_user_role.is_active = True
        mock_user_role.is_expired = PropertyMock(return_value=False)
        
        mock_db.query().join().filter().filter().all.return_value = [mock_user_role]
        mock_db.query().join().filter().all.return_value = [mock_role_perm1, mock_role_perm2]
        
        result = rbac_service.get_effective_permissions(mock_db, mock_user_id, mock_tenant_id)
        
        assert isinstance(result, set)
        assert len(result) >= 2
    
    def test_has_permission_with_override(self, mock_db, mock_user_id, mock_tenant_id):
        """Test permission check with active override."""
        permission_code = "crm:leads:delete"
        
        # Mock override
        mock_override = PermissionOverride()
        mock_override.granted = True
        mock_override.is_expired = PropertyMock(return_value=False)
        mock_db.query().join().filter().filter().filter().first.return_value = mock_override
        
        result = rbac_service.has_permission(mock_db, mock_user_id, mock_tenant_id, permission_code)
        
        assert result is True
    
    def test_has_permission_with_override_denied(self, mock_db, mock_user_id, mock_tenant_id):
        """Test permission check with override that denies permission."""
        permission_code = "crm:leads:delete"
        
        # Mock override that denies
        mock_override = PermissionOverride()
        mock_override.granted = False
        mock_override.is_expired = PropertyMock(return_value=False)
        mock_db.query().join().filter().filter().filter().first.return_value = mock_override
        
        # Mock no role permissions
        mock_db.query().join().filter().filter().all.return_value = []
        mock_db.query().join().filter().all.return_value = []
        
        result = rbac_service.has_permission(mock_db, mock_user_id, mock_tenant_id, permission_code)
        
        assert result is False
    
    def test_assign_role_with_expiry(self, mock_db, mock_user_id, mock_tenant_id):
        """Test assigning role with expiry date."""
        role_code = "MANAGER"
        expires_at = datetime.now() + timedelta(days=30)
        
        # Mock role lookup
        mock_role = Role()
        mock_role.id = uuid.uuid4()
        mock_role.code = role_code
        mock_db.query().filter().first.return_value = mock_role
        
        # Mock no existing assignment
        mock_db.query().filter().filter().filter().first.return_value = None
        
        result = rbac_service.assign_role(mock_db, mock_user_id, mock_tenant_id, role_code, expires_at)
        
        assert result is not None
        assert result.expires_at == expires_at
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

