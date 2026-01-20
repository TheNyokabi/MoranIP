"""Unit tests for tenant dependencies."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.dependencies.tenant import get_tenant_engine
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
from app.models.iam import Tenant
import uuid


class TestGetTenantEngine:
    """Test get_tenant_engine dependency."""
    
    @pytest.mark.asyncio
    async def test_get_tenant_engine_success(self):
        """Test successful tenant engine retrieval."""
        tenant_id = str(uuid.uuid4())
        token_payload = {
            "tenant_id": tenant_id
        }
        mock_db = MagicMock()
        
        # Mock tenant lookup
        mock_tenant = Tenant()
        mock_tenant.id = uuid.UUID(tenant_id)
        mock_tenant.engine = "erpnext"
        mock_db.query().filter().first.return_value = mock_tenant
        
        result = await get_tenant_engine(token_payload=token_payload, db=mock_db)
        
        assert result == "erpnext"
    
    @pytest.mark.asyncio
    async def test_get_tenant_engine_not_found(self):
        """Test tenant engine retrieval when tenant not found."""
        tenant_id = str(uuid.uuid4())
        token_payload = {
            "tenant_id": tenant_id
        }
        mock_db = MagicMock()
        
        # Mock tenant not found
        mock_db.query().filter().first.return_value = None
        
        with pytest.raises(HTTPException) as exc_info:
            await get_tenant_engine(token_payload=token_payload, db=mock_db)
        
        assert exc_info.value.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_tenant_engine_no_tenant_id(self):
        """Test tenant engine retrieval with no tenant_id."""
        token_payload = {}
        mock_db = MagicMock()
        
        with pytest.raises(HTTPException) as exc_info:
            await get_tenant_engine(token_payload=token_payload, db=mock_db)
        
        assert exc_info.value.status_code == 400
    
    @pytest.mark.asyncio
    async def test_get_tenant_engine_default(self):
        """Test tenant engine retrieval with default engine."""
        tenant_id = str(uuid.uuid4())
        token_payload = {
            "tenant_id": tenant_id
        }
        mock_db = MagicMock()
        
        # Mock tenant with no engine (should default)
        mock_tenant = Tenant()
        mock_tenant.id = uuid.UUID(tenant_id)
        mock_tenant.engine = None
        mock_db.query().filter().first.return_value = mock_tenant
        
        result = await get_tenant_engine(token_payload=token_payload, db=mock_db)
        
        # Should return default engine
        assert result == "erpnext"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

