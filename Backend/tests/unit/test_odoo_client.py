"""Unit tests for Odoo client adapter."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.services.odoo_client import OdooClientAdapter
from app.config import settings


class TestOdooClientAdapter:
    """Test suite for OdooClientAdapter."""
    
    @pytest.fixture
    def adapter(self):
        """Create adapter instance."""
        with patch('app.services.odoo_client.settings') as mock_settings:
            mock_settings.ODOO_DB_HOST = "localhost"
            mock_settings.ODOO_DB_PORT = 8069
            mock_settings.POSTGRES_DB = "odoo_db"
            return OdooClientAdapter(tenant_id="demo")
    
    def test_init(self, adapter):
        """Test adapter initialization."""
        assert adapter.common_url is not None
        assert "xmlrpc" in adapter.common_url
    
    @patch('app.services.odoo_client.xmlrpc.client.ServerProxy')
    def test_authenticate_system_success(self, mock_proxy_class, adapter):
        """Test successful system authentication."""
        mock_proxy = MagicMock()
        mock_proxy.authenticate.return_value = 1  # User ID
        mock_proxy_class.return_value = mock_proxy
        
        result = adapter.authenticate_system("demo")
        assert result == 1
    
    @patch('app.services.odoo_client.xmlrpc.client.ServerProxy')
    def test_authenticate_system_failure(self, mock_proxy_class, adapter):
        """Test failed system authentication."""
        mock_proxy = MagicMock()
        mock_proxy.authenticate.return_value = False
        mock_proxy_class.return_value = mock_proxy
        
        with pytest.raises(HTTPException) as exc_info:
            adapter.authenticate_system("demo")
        assert exc_info.value.status_code == 500
    
    @patch('app.services.odoo_client.xmlrpc.client.ServerProxy')
    def test_execute_kw_success(self, mock_proxy_class, adapter):
        """Test successful execute_kw call."""
        # Mock authenticate_system to set up adapter
        mock_common = MagicMock()
        mock_common.authenticate.return_value = 1
        mock_proxy_class.return_value = mock_common
        adapter.authenticate_system("demo")
        
        # Mock models proxy
        mock_models = MagicMock()
        mock_models.execute_kw.return_value = [{"id": 1, "name": "Test"}]
        with patch('app.services.odoo_client.xmlrpc.client.ServerProxy', return_value=mock_models):
            result = adapter.execute_kw("demo", "res.partner", "search_read", [[("name", "=", "Test")]], {})
            assert result == [{"id": 1, "name": "Test"}]
    
    @patch.object(OdooClientAdapter, 'execute_kw')
    def test_list_resource(self, mock_execute, adapter):
        """Test list_resource method."""
        mock_execute.return_value = [{"id": 1, "name": "Item1"}, {"id": 2, "name": "Item2"}]
        result = adapter.list_resource("product.product", {"name": "Test"})
        assert "data" in result
        assert len(result["data"]) == 2
        assert result["data"][0]["name"] == "Item1"
    
    @patch.object(OdooClientAdapter, 'execute_kw')
    def test_get_resource(self, mock_execute, adapter):
        """Test get_resource method."""
        mock_execute.return_value = [{"id": 1, "name": "Test Item"}]
        result = adapter.get_resource("product.product", "1")
        assert "data" in result
        assert result["data"]["name"] == "Test Item"
    
    @patch.object(OdooClientAdapter, 'execute_kw')
    def test_create_resource(self, mock_execute, adapter):
        """Test create_resource method."""
        mock_execute.return_value = 123
        result = adapter.create_resource("product.product", {"name": "New Item"})
        assert "data" in result
        assert result["data"]["id"] == 123
    
    @patch.object(OdooClientAdapter, 'execute_kw')
    def test_update_resource(self, mock_execute, adapter):
        """Test update_resource method."""
        mock_execute.return_value = True
        result = adapter.update_resource("product.product", "1", {"name": "Updated"})
        assert "data" in result
    
    @patch.object(OdooClientAdapter, 'execute_kw')
    def test_delete_resource(self, mock_execute, adapter):
        """Test delete_resource method."""
        mock_execute.return_value = True
        result = adapter.delete_resource("product.product", "1")
        assert "data" in result
        assert result["data"]["deleted"] is True
    
    def test_supports_transactions(self, adapter):
        """Test supports_transactions method."""
        assert adapter.supports_transactions() is True
    
    def test_supports_audit_trail(self, adapter):
        """Test supports_audit_trail method."""
        assert adapter.supports_audit_trail() is True
    
    def test_dict_to_domain(self, adapter):
        """Test _dict_to_domain conversion."""
        filters = {"name": "Test", "category": ["A", "B"]}
        domain = adapter._dict_to_domain(filters)
        assert len(domain) == 2
        assert ("name", "=", "Test") in domain
        assert ("category", "in", ["A", "B"]) in domain


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

