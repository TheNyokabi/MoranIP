"""Expanded unit tests for RBAC service - additional methods."""
import pytest
from unittest.mock import Mock, patch, MagicMock, PropertyMock
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.services.rbac_service import rbac_service
from app.models.rbac import Role, Permission, UserRole, PermissionOverride, RolePermission
import uuid


class TestRBACServiceExpanded:
    """Additional tests for RBAC service methods not yet covered."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return Mock(spec=Session)
    
    def test_assign_role_success(self, mock_db):
        """Test successfully assigning a role to a user."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        assigned_by = uuid.uuid4()
        
        # Mock no existing assignment
        mock_db.query().filter().filter().filter().filter().first.return_value = None
        
        # Mock audit_log
        with patch.object(rbac_service, 'audit_log') as mock_audit:
            # Mock commit and refresh
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            # Create mock user role
            mock_user_role = Mock(spec=UserRole)
            mock_user_role.user_id = user_id
            mock_user_role.tenant_id = tenant_id
            mock_user_role.role_id = role_id
            mock_user_role.is_active = True
            
            # Mock db.add to return the mock
            def add_side_effect(obj):
                return mock_user_role
            mock_db.add.side_effect = add_side_effect
            
            # Need to patch UserRole constructor
            with patch('app.services.rbac_service.UserRole') as mock_user_role_class:
                mock_user_role_class.return_value = mock_user_role
                result = rbac_service.assign_role(
                    mock_db, user_id, tenant_id, role_id, assigned_by
                )
                assert result == mock_user_role
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called_once()
    
    def test_assign_role_already_assigned(self, mock_db):
        """Test assigning a role that's already assigned."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        assigned_by = uuid.uuid4()
        
        # Mock existing assignment - must have is_active=True and is_expired=False
        mock_existing = Mock(spec=UserRole)
        mock_existing.is_active = True
        # Use PropertyMock for is_expired property
        type(mock_existing).is_expired = PropertyMock(return_value=False)
        
        # Setup query chain - assign_role uses filter() with multiple conditions
        # The query is: db.query(UserRole).filter(condition1, condition2, condition3, condition4).first()
        # SQLAlchemy filter() can take multiple conditions, so we need to chain them
        query_mock = MagicMock()
        # All filter() calls return the same query object
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_existing
        mock_db.query.return_value = query_mock
        
        with pytest.raises(ValueError, match="Role already assigned"):
            rbac_service.assign_role(mock_db, user_id, tenant_id, role_id, assigned_by)
    
    def test_revoke_role_success(self, mock_db):
        """Test successfully revoking a role from a user."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        revoked_by = uuid.uuid4()
        
        # Mock existing assignment - need to set is_active as a mutable attribute
        mock_user_role = Mock(spec=UserRole)
        # Use a mutable object for is_active
        mock_user_role.is_active = True
        
        # Setup query chain
        query_mock = MagicMock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = mock_user_role
        mock_db.query.return_value = query_mock
        
        # Mock audit_log
        with patch.object(rbac_service, 'audit_log') as mock_audit:
            result = rbac_service.revoke_role(mock_db, user_id, tenant_id, role_id, revoked_by)
            assert result is True
            # Verify is_active was set to False
            assert mock_user_role.is_active is False
            mock_db.commit.assert_called_once()
    
    def test_revoke_role_not_found(self, mock_db):
        """Test revoking a role that doesn't exist."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        revoked_by = uuid.uuid4()
        
        # Mock no existing assignment
        query_mock = MagicMock()
        query_mock.filter.return_value = query_mock
        query_mock.first.return_value = None
        mock_db.query.return_value = query_mock
        
        result = rbac_service.revoke_role(mock_db, user_id, tenant_id, role_id, revoked_by)
        assert result is False
    
    def test_grant_permission_override(self, mock_db):
        """Test granting a permission override."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        permission = "crm:leads:create"
        granted_by = uuid.uuid4()
        
        # Mock no existing override
        mock_db.query().filter().filter().filter().filter().first.return_value = None
        
        # Mock commit
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        # Mock PermissionOverride constructor
        mock_override = Mock(spec=PermissionOverride)
        with patch('app.services.rbac_service.PermissionOverride') as mock_override_class:
            mock_override_class.return_value = mock_override
            with patch.object(rbac_service, 'audit_log'):
                result = rbac_service.grant_permission_override(
                    mock_db, user_id, tenant_id, permission, granted_by
                )
                assert result == mock_override
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called_once()
    
    def test_revoke_permission_override(self, mock_db):
        """Test revoking a permission override."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        permission_id = uuid.uuid4()
        revoked_by = uuid.uuid4()
        
        # Mock existing override - revoke_permission_override creates a new REVOKE override
        mock_db.query().filter().filter().filter().filter().first.return_value = None
        
        # Mock PermissionOverride constructor
        mock_override = Mock(spec=PermissionOverride)
        with patch('app.services.rbac_service.PermissionOverride') as mock_override_class:
            mock_override_class.return_value = mock_override
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            with patch.object(rbac_service, 'audit_log'):
                result = rbac_service.revoke_permission_override(
                    mock_db, user_id, tenant_id, permission_id, revoked_by
                )
                # Returns PermissionOverride object, not boolean
                assert result == mock_override
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called_once()
    
    def test_revoke_permission_override_not_found(self, mock_db):
        """Test revoking a permission override - always creates new override."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        permission_id = uuid.uuid4()
        revoked_by = uuid.uuid4()
        
        # Mock no existing override
        mock_db.query().filter().filter().filter().filter().first.return_value = None
        
        # Method always creates a new REVOKE override, doesn't return False
        mock_override = Mock(spec=PermissionOverride)
        with patch('app.services.rbac_service.PermissionOverride') as mock_override_class:
            mock_override_class.return_value = mock_override
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            with patch.object(rbac_service, 'audit_log'):
                result = rbac_service.revoke_permission_override(
                    mock_db, user_id, tenant_id, permission_id, revoked_by
                )
                # Returns PermissionOverride object
                assert result == mock_override
    
    def test_audit_log(self, mock_db):
        """Test audit logging."""
        from app.models.rbac import RoleAuditLog
        
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        action = "ROLE_ASSIGNED"
        
        # Mock RoleAuditLog constructor
        mock_audit_log = Mock(spec=RoleAuditLog)
        with patch('app.services.rbac_service.RoleAuditLog') as mock_audit_class:
            mock_audit_class.return_value = mock_audit_log
            mock_db.commit.return_value = None
            mock_db.refresh.return_value = None
            
            result = rbac_service.audit_log(
                db=mock_db,
                action=action,
                user_id=user_id,
                tenant_id=tenant_id,
                metadata={"test": "data"}
            )
            
            assert result == mock_audit_log
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
    
    def test_get_user_roles_with_tenant(self, mock_db):
        """Test getting user roles in tenant context."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        # Mock roles
        role1 = Mock(spec=Role)
        role1.id = uuid.uuid4()
        role1.code = "ADMIN"
        role2 = Mock(spec=Role)
        role2.id = uuid.uuid4()
        role2.code = "USER"
        
        # Mock query chain - get_user_roles uses join with Role
        mock_user_roles = [Mock(spec=UserRole), Mock(spec=UserRole)]
        mock_user_roles[0].role = role1
        mock_user_roles[1].role = role2
        
        # Mock is_expired property
        for ur in mock_user_roles:
            type(ur).is_expired = PropertyMock(return_value=False)
        
        # Setup query chain properly - need to mock _is_user_role_expired calls
        query_mock = MagicMock()
        query_mock.join.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.all.return_value = [role1, role2]  # Returns roles directly
        
        # Mock _is_user_role_expired to return False for both roles
        with patch.object(rbac_service, '_is_user_role_expired', return_value=False):
            mock_db.query.return_value = query_mock
            result = rbac_service.get_user_roles(mock_db, user_id, tenant_id)
            assert len(result) == 2
            assert role1 in result
            assert role2 in result
    
    def test_get_user_roles_system_wide(self, mock_db):
        """Test getting user roles for system-wide (no tenant)."""
        user_id = uuid.uuid4()
        
        # Mock roles
        role1 = Mock(spec=Role)
        role1.id = uuid.uuid4()
        role1.code = "SUPER_ADMIN"
        
        # Setup query chain
        query_mock = MagicMock()
        query_mock.join.return_value = query_mock
        query_mock.filter.return_value = query_mock
        query_mock.all.return_value = [role1]  # Returns roles directly
        
        # Mock _is_user_role_expired to return False
        with patch.object(rbac_service, '_is_user_role_expired', return_value=False):
            mock_db.query.return_value = query_mock
            result = rbac_service.get_user_roles(mock_db, user_id, None)
            assert len(result) == 1
            assert role1 in result
    
    def test_get_effective_permissions_with_overrides(self, mock_db):
        """Test getting effective permissions including overrides."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        # Mock roles and permissions
        role = Mock(spec=Role)
        role.id = uuid.uuid4()
        
        perm1 = Mock(spec=Permission)
        perm1.code = "crm:leads:view"
        perm2 = Mock(spec=Permission)
        perm2.code = "crm:leads:create"
        
        # Mock role permissions
        mock_role_perms = [Mock(spec=RolePermission), Mock(spec=RolePermission)]
        mock_role_perms[0].permission = perm1
        mock_role_perms[1].permission = perm2
        
        # Mock permission overrides
        override = Mock(spec=PermissionOverride)
        override.permission = perm2
        override.grant_type = "GRANT"
        type(override).is_expired = PropertyMock(return_value=False)
        
        # Mock get_user_roles to return roles
        with patch.object(rbac_service, 'get_user_roles', return_value=[role]):
            # Mock get_user_permissions to return permission codes
            with patch.object(rbac_service, 'get_user_permissions', return_value=["crm:leads:view", "crm:leads:create"]):
                # Setup query mocks for permission overrides
                query_mock = MagicMock()
                filter_mock = MagicMock()
                filter_mock.filter.return_value = filter_mock
                filter_mock.all.return_value = [override]
                query_mock.filter.return_value = filter_mock
                mock_db.query.return_value = query_mock
                
                result = rbac_service.get_effective_permissions(mock_db, user_id, tenant_id)
                assert isinstance(result, set)
                assert "crm:leads:view" in result
                assert "crm:leads:create" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

