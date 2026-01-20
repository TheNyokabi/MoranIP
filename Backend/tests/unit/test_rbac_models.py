"""Unit tests for RBAC models."""
import pytest
from datetime import datetime, timedelta
from app.models.rbac import Role, Permission, UserRole, RolePermission, PermissionOverride, RoleAuditLog
import uuid


class TestRoleModel:
    """Test Role model."""
    
    def test_role_creation(self):
        """Test creating a Role instance."""
        role = Role(
            id=uuid.uuid4(),
            code="ADMIN",
            name="Administrator",
            description="Admin role",
            level="TENANT",
            scope="TENANT",
            is_system=True
        )
        assert role.code == "ADMIN"
        assert role.name == "Administrator"
        assert role.level == "TENANT"
        assert role.is_system is True
    
    def test_role_levels(self):
        """Test role level values."""
        role = Role()
        role.level = "SYSTEM"
        assert role.level == "SYSTEM"
        
        role.level = "TENANT"
        assert role.level == "TENANT"


class TestPermissionModel:
    """Test Permission model."""
    
    def test_permission_creation(self):
        """Test creating a Permission instance."""
        permission = Permission(
            id=uuid.uuid4(),
            code="crm:leads:view",
            module="crm",
            resource="leads",
            action="view",
            description="View leads",
            risk_level="LOW"
        )
        assert permission.code == "crm:leads:view"
        assert permission.module == "crm"
        assert permission.resource == "leads"
        assert permission.action == "view"
        assert permission.risk_level == "LOW"
    
    def test_permission_code_format(self):
        """Test permission code format."""
        permission = Permission()
        permission.code = "inventory:items:create"
        assert permission.code == "inventory:items:create"
        
        parts = permission.code.split(":")
        assert len(parts) == 3
        assert parts[0] == "inventory"
        assert parts[1] == "items"
        assert parts[2] == "create"


class TestUserRoleModel:
    """Test UserRole model."""
    
    def test_user_role_creation(self):
        """Test creating a UserRole instance."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        role_id = uuid.uuid4()
        assigned_by = uuid.uuid4()
        
        user_role = UserRole(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            assigned_by=assigned_by,
            is_active=True
        )
        assert user_role.user_id == user_id
        assert user_role.tenant_id == tenant_id
        assert user_role.role_id == role_id
        assert user_role.is_active is True
    
    def test_user_role_expired(self):
        """Test UserRole is_expired property."""
        user_role = UserRole()
        user_role.expires_at = datetime.now() - timedelta(days=1)
        assert user_role.is_expired is True
        
        user_role.expires_at = datetime.now() + timedelta(days=1)
        assert user_role.is_expired is False
        
        user_role.expires_at = None
        assert user_role.is_expired is False
    
    def test_user_role_active_status(self):
        """Test user role active status."""
        user_role = UserRole()
        user_role.is_active = True
        assert user_role.is_active is True
        
        user_role.is_active = False
        assert user_role.is_active is False


class TestRolePermissionModel:
    """Test RolePermission model."""
    
    def test_role_permission_creation(self):
        """Test creating a RolePermission instance."""
        role_id = uuid.uuid4()
        permission_id = uuid.uuid4()
        
        role_permission = RolePermission(
            role_id=role_id,
            permission_id=permission_id
        )
        assert role_permission.role_id == role_id
        assert role_permission.permission_id == permission_id


class TestPermissionOverrideModel:
    """Test PermissionOverride model."""
    
    def test_permission_override_creation(self):
        """Test creating a PermissionOverride instance."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        permission_id = uuid.uuid4()
        granted_by = uuid.uuid4()
        
        override = PermissionOverride(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_id=permission_id,
            grant_type="GRANT",
            granted_by=granted_by
        )
        assert override.user_id == user_id
        assert override.tenant_id == tenant_id
        assert override.permission_id == permission_id
        assert override.grant_type == "GRANT"
    
    def test_permission_override_expired(self):
        """Test PermissionOverride is_expired property."""
        override = PermissionOverride()
        override.expires_at = datetime.now() - timedelta(days=1)
        assert override.is_expired is True
        
        override.expires_at = datetime.now() + timedelta(days=1)
        assert override.is_expired is False
        
        override.expires_at = None
        assert override.is_expired is False
    
    def test_permission_override_grant_types(self):
        """Test permission override grant types."""
        override = PermissionOverride()
        override.grant_type = "GRANT"
        assert override.grant_type == "GRANT"
        
        override.grant_type = "REVOKE"
        assert override.grant_type == "REVOKE"


class TestRoleAuditLogModel:
    """Test RoleAuditLog model."""
    
    def test_audit_log_creation(self):
        """Test creating a RoleAuditLog instance."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        log = RoleAuditLog(
            user_id=user_id,
            tenant_id=tenant_id,
            action="ROLE_ASSIGNED",
            target_user_id=user_id,
            extra_data={"test": "data"}
        )
        assert log.user_id == user_id
        assert log.tenant_id == tenant_id
        assert log.action == "ROLE_ASSIGNED"
        assert log.extra_data == {"test": "data"}
    
    def test_audit_log_actions(self):
        """Test audit log action types."""
        log = RoleAuditLog()
        log.action = "ROLE_ASSIGNED"
        assert log.action == "ROLE_ASSIGNED"
        
        log.action = "ROLE_REVOKED"
        assert log.action == "ROLE_REVOKED"
        
        log.action = "PERMISSION_GRANTED"
        assert log.action == "PERMISSION_GRANTED"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

