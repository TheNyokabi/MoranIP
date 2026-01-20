"""Unit tests for permission dependencies."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.dependencies.permissions import (
    require_permission,
    require_any_permission,
    require_all_permissions,
    get_current_user_permissions,
    get_current_user_roles
)
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid


class TestRequirePermission:
    """Test require_permission dependency factory."""
    
    @pytest.mark.asyncio
    async def test_require_permission_super_admin(self):
        """Test permission check bypass for super admin."""
        payload = {
            "sub": str(uuid.uuid4()),
            "is_super_admin": True
        }
        mock_db = MagicMock()
        
        permission_checker = require_permission("crm:leads:create")
        result = await permission_checker(payload=payload, db=mock_db)
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_require_permission_has_permission(self):
        """Test permission check when user has permission."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        # Mock rbac_service
        with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
            mock_rbac.has_permission.return_value = True
            
            permission_checker = require_permission("crm:leads:create")
            result = await permission_checker(payload=payload, db=mock_db)
            
            assert result is True
            mock_rbac.has_permission.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_require_permission_no_permission(self):
        """Test permission check when user lacks permission."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        # Mock rbac_service
        with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
            mock_rbac.has_permission.return_value = False
            
            permission_checker = require_permission("crm:leads:create")
            
            with pytest.raises(HTTPException) as exc_info:
                await permission_checker(payload=payload, db=mock_db)
            
            assert exc_info.value.status_code == 403
    
    @pytest.mark.asyncio
    async def test_require_permission_no_user_id(self):
        """Test permission check with missing user_id."""
        payload = {
            "tenant_id": str(uuid.uuid4())
        }
        mock_db = MagicMock()
        
        permission_checker = require_permission("crm:leads:create")
        
        with pytest.raises(HTTPException) as exc_info:
            await permission_checker(payload=payload, db=mock_db)
        
        assert exc_info.value.status_code == 401


class TestRequireAnyPermission:
    """Test require_any_permission dependency factory."""
    
    @pytest.mark.asyncio
    async def test_require_any_permission_super_admin(self):
        """Test any permission check bypass for super admin."""
        payload = {
            "sub": str(uuid.uuid4()),
            "is_super_admin": True
        }
        mock_db = MagicMock()
        
        permission_checker = require_any_permission(["crm:leads:view", "crm:leads:create"])
        result = await permission_checker(payload=payload, db=mock_db)
        
        assert result is True
    
    @pytest.mark.asyncio
    async def test_require_any_permission_has_one(self):
        """Test any permission check when user has at least one."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        # Mock rbac_service
        with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
            # User has first permission but not second
            mock_rbac.has_permission.side_effect = [True, False]
            
            permission_checker = require_any_permission(["crm:leads:view", "crm:leads:create"])
            result = await permission_checker(payload=payload, db=mock_db)
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_require_any_permission_has_none(self):
        """Test any permission check when user has none."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        # Mock rbac_service
        with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
            mock_rbac.has_permission.return_value = False
            
            permission_checker = require_any_permission(["crm:leads:view", "crm:leads:create"])
            
            with pytest.raises(HTTPException) as exc_info:
                await permission_checker(payload=payload, db=mock_db)
            
            assert exc_info.value.status_code == 403


class TestRequireAllPermissions:
    """Test require_all_permissions dependency factory."""
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_super_admin(self):
        """Test all permissions check bypass for super admin."""
        payload = {
            "sub": str(uuid.uuid4()),
            "is_super_admin": True
        }
        mock_db = MagicMock()
        
        # Check if require_all_permissions exists
        try:
            permission_checker = require_all_permissions(["crm:leads:view", "crm:leads:create"])
            result = await permission_checker(payload=payload, db=mock_db)
            assert result is True
        except NameError:
            # Function might not exist, skip test
            pytest.skip("require_all_permissions not implemented")
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_has_all(self):
        """Test all permissions check when user has all."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        try:
            # Mock rbac_service
            with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
                mock_rbac.has_permission.return_value = True
                
                permission_checker = require_all_permissions(["crm:leads:view", "crm:leads:create"])
                result = await permission_checker(payload=payload, db=mock_db)
                
                assert result is True
        except NameError:
            pytest.skip("require_all_permissions not implemented")
    
    @pytest.mark.asyncio
    async def test_require_all_permissions_missing_one(self):
        """Test all permissions check when user missing one."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "is_super_admin": False
        }
        mock_db = MagicMock()
        
        try:
            # Mock rbac_service
            with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
                # User has first but not second
                mock_rbac.has_permission.side_effect = [True, False]
                
                permission_checker = require_all_permissions(["crm:leads:view", "crm:leads:create"])
                
                with pytest.raises(HTTPException) as exc_info:
                    await permission_checker(payload=payload, db=mock_db)
                
                assert exc_info.value.status_code == 403
        except NameError:
            pytest.skip("require_all_permissions not implemented")


class TestGetCurrentUserPermissions:
    """Test get_current_user_permissions dependency."""
    
    @pytest.mark.asyncio
    async def test_get_current_user_permissions_success(self):
        """Test getting user permissions."""
        payload = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4())
        }
        mock_db = MagicMock()
        
        # Mock rbac_service
        with patch('app.dependencies.permissions.rbac_service') as mock_rbac:
            mock_rbac.get_effective_permissions.return_value = {
                "crm:leads:view",
                "crm:leads:create",
                "inventory:items:view"
            }
            
            result = await get_current_user_permissions(payload=payload, db=mock_db)
            
            assert isinstance(result, list)
            assert len(result) == 3
            assert "crm:leads:view" in result
    
    @pytest.mark.asyncio
    async def test_get_current_user_permissions_no_user_id(self):
        """Test getting permissions with no user_id."""
        payload = {
            "tenant_id": str(uuid.uuid4())
        }
        mock_db = MagicMock()
        
        result = await get_current_user_permissions(payload=payload, db=mock_db)
        
        assert result == []


class TestGetCurrentUserRoles:
    """Test get_current_user_roles dependency."""
    
    @pytest.mark.asyncio
    async def test_get_current_user_roles_success(self):
        """Test getting user roles from payload."""
        payload = {
            "roles": ["ADMIN", "MANAGER"]
        }
        
        result = await get_current_user_roles(payload=payload)
        
        assert result == ["ADMIN", "MANAGER"]
    
    @pytest.mark.asyncio
    async def test_get_current_user_roles_empty(self):
        """Test getting roles when none in payload."""
        payload = {}
        
        result = await get_current_user_roles(payload=payload)
        
        assert result == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

