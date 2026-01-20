"""Unit tests for authentication dependencies."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from jose import jwt
from app.dependencies.auth import (
    get_current_token_payload,
    get_current_user,
    require_tenant_access,
    verify_tenant_access
)
from app.config import settings
from app.services.auth_service import ALGORITHM
import uuid


class TestGetCurrentTokenPayload:
    """Test get_current_token_payload dependency."""
    
    @pytest.mark.asyncio
    async def test_get_token_payload_success(self):
        """Test successful token payload extraction."""
        # Create a valid token
        payload_data = {
            "sub": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "user_code": "USER001",
            "roles": ["ADMIN"]
        }
        token = jwt.encode(payload_data, settings.SECRET_KEY, algorithm=ALGORITHM)
        
        # Mock oauth2_scheme to return token
        with patch('app.dependencies.auth.oauth2_scheme', return_value=token):
            result = await get_current_token_payload(token=token)
            
            assert result["sub"] == payload_data["sub"]
            assert result["tenant_id"] == payload_data["tenant_id"]
            assert result["user_code"] == payload_data["user_code"]
    
    @pytest.mark.asyncio
    async def test_get_token_payload_no_token(self):
        """Test token payload extraction with no token."""
        with patch('app.dependencies.auth.oauth2_scheme', return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_token_payload(token=None)
            
            assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_token_payload_invalid_token(self):
        """Test token payload extraction with invalid token."""
        invalid_token = "invalid.token.here"
        
        with patch('app.dependencies.auth.oauth2_scheme', return_value=invalid_token):
            with pytest.raises(HTTPException) as exc_info:
                await get_current_token_payload(token=invalid_token)
            
            assert exc_info.value.status_code == 401


class TestGetCurrentUser:
    """Test get_current_user dependency."""
    
    @pytest.mark.asyncio
    async def test_get_current_user_success(self):
        """Test successful user extraction from payload."""
        payload = {
            "sub": str(uuid.uuid4()),
            "user_code": "USER001",
            "tenant_id": str(uuid.uuid4()),
            "tenant_code": "TENANT001",
            "kyc_tier": "TIER_1",
            "roles": ["ADMIN"],
            "is_super_admin": False
        }
        
        result = await get_current_user(payload=payload)
        
        assert result["user_id"] == payload["sub"]
        assert result["user_code"] == payload["user_code"]
        assert result["tenant_id"] == payload["tenant_id"]
        assert result["roles"] == payload["roles"]
    
    @pytest.mark.asyncio
    async def test_get_current_user_no_user_id(self):
        """Test user extraction with missing user_id."""
        payload = {
            "tenant_id": str(uuid.uuid4())
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(payload=payload)
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_current_user_defaults(self):
        """Test user extraction with default values."""
        payload = {
            "sub": str(uuid.uuid4())
        }
        
        result = await get_current_user(payload=payload)
        
        assert result["user_id"] == payload["sub"]
        assert result["roles"] == []
        assert result["is_super_admin"] is False


class TestRequireTenantAccess:
    """Test require_tenant_access dependency."""
    
    @pytest.mark.asyncio
    async def test_require_tenant_access_success(self):
        """Test successful tenant access check."""
        tenant_id = str(uuid.uuid4())
        payload = {
            "tenant_id": tenant_id,
            "is_super_admin": False
        }
        
        result = await require_tenant_access(payload=payload)
        
        assert result == tenant_id
    
    @pytest.mark.asyncio
    async def test_require_tenant_access_super_admin(self):
        """Test tenant access for super admin."""
        payload = {
            "is_super_admin": True,
            "tenant_id": None
        }
        
        result = await require_tenant_access(payload=payload)
        
        assert result == "system"
    
    @pytest.mark.asyncio
    async def test_require_tenant_access_no_tenant(self):
        """Test tenant access check with no tenant_id."""
        payload = {
            "is_super_admin": False
        }
        
        with pytest.raises(HTTPException) as exc_info:
            await require_tenant_access(payload=payload)
        
        assert exc_info.value.status_code == 401


class TestVerifyTenantAccess:
    """Test verify_tenant_access dependency."""
    
    def test_verify_tenant_access_success(self):
        """Test successful tenant verification."""
        tenant_id = str(uuid.uuid4())
        payload = {
            "tenant_id": tenant_id,
            "is_super_admin": False
        }
        
        # verify_tenant_access is not async, it's a regular function
        result = verify_tenant_access(tenant_id, payload=payload)
        
        assert result is True
    
    def test_verify_tenant_access_super_admin(self):
        """Test tenant verification for super admin."""
        tenant_id = str(uuid.uuid4())
        payload = {
            "is_super_admin": True
        }
        
        # verify_tenant_access is not async
        result = verify_tenant_access(tenant_id, payload=payload)
        
        assert result is True
    
    def test_verify_tenant_access_mismatch(self):
        """Test tenant verification with mismatched tenant_id."""
        requested_tenant = str(uuid.uuid4())
        user_tenant = str(uuid.uuid4())
        payload = {
            "tenant_id": user_tenant,
            "is_super_admin": False
        }
        
        with pytest.raises(HTTPException) as exc_info:
            verify_tenant_access(requested_tenant, payload=payload)
        
        assert exc_info.value.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

