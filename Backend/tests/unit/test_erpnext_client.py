"""Unit tests for ERPNext client adapter."""
import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.services.erpnext_client import ERPNextClientAdapter
from app.config import settings


class TestERPNextClientAdapter:
    """Test suite for ERPNextClientAdapter."""
    
    @pytest.fixture
    def adapter(self):
        """Create adapter instance."""
        with patch('app.services.erpnext_client.settings') as mock_settings:
            mock_settings.ERPNEXT_HOST = "http://localhost:8080"
            mock_settings.ERPNEXT_USER = "admin"
            mock_settings.ERPNEXT_PASSWORD = "admin"
            mock_settings.ERPNEXT_SITE = "moran.localhost"
            return ERPNextClientAdapter(tenant_id="test-tenant")
    
    def test_init(self, adapter):
        """Test adapter initialization."""
        assert adapter.base_url == "http://localhost:8080"
        assert adapter.session is not None
        assert adapter._current_tenant is None
    
    def test_resolve_site_name_with_uuid(self, adapter):
        """Test site name resolution with UUID tenant_id."""
        site_name = adapter._resolve_site_name("a3f9c6d5-c953-48db-bbb5-309d6f29b20d")
        assert site_name == "moran.localhost"
    
    def test_resolve_site_name_with_site_name(self, adapter):
        """Test site name resolution with actual site name."""
        site_name = adapter._resolve_site_name("custom-site")
        assert site_name == "custom-site"
    
    def test_resolve_site_name_none(self, adapter):
        """Test site name resolution with None."""
        site_name = adapter._resolve_site_name(None)
        assert site_name == "moran.localhost"
    
    @patch('app.services.erpnext_client.requests.Session')
    def test_login_success(self, mock_session_class, adapter):
        """Test successful login."""
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.cookies = {"sid": "test-session-id"}
        mock_session.post.return_value = mock_response
        mock_session_class.return_value = mock_session
        adapter.session = mock_session
        
        result = adapter._login("test-tenant")
        assert result is True
        assert adapter.cookie_jar == mock_response.cookies
        # _current_tenant is set to resolved site name, not the input tenant_id
        assert adapter._current_tenant is not None
    
    @patch('app.services.erpnext_client.requests.Session')
    def test_login_failure(self, mock_session_class, adapter):
        """Test failed login."""
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid credentials"
        mock_session.post.return_value = mock_response
        mock_session_class.return_value = mock_session
        adapter.session = mock_session
        
        result = adapter._login("test-tenant")
        assert result is False
    
    @patch('app.services.erpnext_client.requests.Session')
    def test_login_exception(self, mock_session_class, adapter):
        """Test login with exception."""
        mock_session = MagicMock()
        mock_session.post.side_effect = Exception("Connection error")
        mock_session_class.return_value = mock_session
        adapter.session = mock_session
        
        result = adapter._login("test-tenant")
        assert result is False
    
    @patch.object(ERPNextClientAdapter, '_login')
    def test_proxy_request_success(self, mock_login, adapter):
        """Test successful proxy request."""
        mock_login.return_value = True
        adapter.cookie_jar = {"sid": "test-session-id"}
        adapter._current_tenant = "moran.localhost"
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"message": {"data": "test"}}
        adapter.session.request = MagicMock(return_value=mock_response)
        
        result = adapter.proxy_request("test-tenant", "resource/Item", method="GET")
        assert result == {"data": {"data": "test"}}
    
    @patch.object(ERPNextClientAdapter, '_login')
    def test_proxy_request_error_handling(self, mock_login, adapter):
        """Test proxy request error handling."""
        mock_login.return_value = True
        adapter.cookie_jar = {"sid": "test-session-id"}
        adapter._current_tenant = "moran.localhost"
        
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"message": "Error message"}
        mock_response.text = "Error message"
        adapter.session.request = MagicMock(return_value=mock_response)
        
        with pytest.raises(HTTPException) as exc_info:
            adapter.proxy_request("test-tenant", "resource/Item", method="GET")
        assert exc_info.value.status_code == 400
    
    @patch.object(ERPNextClientAdapter, '_login')
    def test_proxy_request_non_json_error(self, mock_login, adapter):
        """Test proxy request with non-JSON error response."""
        mock_login.return_value = True
        adapter.cookie_jar = {"sid": "test-session-id"}
        adapter._current_tenant = "moran.localhost"
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.side_effect = ValueError("Not JSON")
        mock_response.text = "Plain text error"
        adapter.session.request = MagicMock(return_value=mock_response)
        
        with pytest.raises(HTTPException) as exc_info:
            adapter.proxy_request("test-tenant", "resource/Item", method="GET")
        assert exc_info.value.status_code == 500
        assert "Plain text error" in str(exc_info.value.detail)

    @patch.object(ERPNextClientAdapter, '_login')
    def test_proxy_request_stock_shortage_normalized(self, mock_login, adapter):
        """Stock shortage (negative stock) should normalize into insufficient_stock."""
        mock_login.return_value = True
        adapter.cookie_jar = {"sid": "test-session-id"}
        adapter._current_tenant = "test-tenant"

        msg = (
            "<strong>3.0 units of ITEM-001 needed in Warehouse Finished Goods - AST "
            "for Sales Invoice ACC-SINV-2026-00066 to complete this transaction.</strong>"
        )

        mock_response = MagicMock()
        mock_response.status_code = 417
        mock_response.json.return_value = {"_server_messages": json.dumps([msg])}
        mock_response.text = msg
        adapter.session.request = MagicMock(return_value=mock_response)

        with pytest.raises(HTTPException) as exc_info:
            adapter.proxy_request("test-tenant", "resource/Sales Invoice", method="POST", json_data={"docstatus": 1})

        assert exc_info.value.status_code == 417
        assert isinstance(exc_info.value.detail, dict)
        assert exc_info.value.detail.get("type") == "insufficient_stock"
        assert "<strong>" not in exc_info.value.detail.get("message", "")
        errors = exc_info.value.detail.get("errors")
        assert isinstance(errors, list) and errors
        assert errors[0].get("warehouse") == "Finished Goods - AST"
        assert errors[0].get("required_qty") == pytest.approx(3.0)
        assert errors[0].get("voucher_type") == "Sales Invoice"
        assert errors[0].get("voucher_no") == "ACC-SINV-2026-00066"

    @patch.object(ERPNextClientAdapter, '_login')
    def test_proxy_request_stock_shortage_with_datetime_and_customer(self, mock_login, adapter):
        """Stock shortage variant with posting datetime and customer should parse consistently."""
        mock_login.return_value = True
        adapter.cookie_jar = {"sid": "test-session-id"}
        adapter._current_tenant = "test-tenant"

        msg = (
            "4.0 units of Item 100ml: Paint 100ml needed in Warehouse Finished Goods - AST "
            "on 2026-01-21 15:50:48.632964 for Sales Invoice Walk-In Customer to complete this transaction."
        )

        mock_response = MagicMock()
        mock_response.status_code = 417
        mock_response.json.return_value = {"message": msg}
        mock_response.text = msg
        adapter.session.request = MagicMock(return_value=mock_response)

        with pytest.raises(HTTPException) as exc_info:
            adapter.proxy_request("test-tenant", "resource/Sales Invoice", method="POST", json_data={"docstatus": 1})

        assert exc_info.value.status_code == 417
        detail = exc_info.value.detail
        assert isinstance(detail, dict)
        assert detail.get("type") == "insufficient_stock"
        errors = detail.get("errors")
        assert isinstance(errors, list) and errors
        err0 = errors[0]
        assert err0.get("item_code") == "100ml"
        assert err0.get("item_name") == "Paint 100ml"
        assert err0.get("warehouse") == "Finished Goods - AST"
        assert err0.get("required_qty") == pytest.approx(4.0)
        assert err0.get("posting_datetime").startswith("2026-01-21")
        assert err0.get("voucher_type") == "Sales Invoice"
        assert err0.get("party") == "Walk-In Customer"
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_list_resource(self, mock_proxy, adapter):
        """Test list_resource method."""
        mock_proxy.return_value = {"data": [{"name": "Item1"}, {"name": "Item2"}]}
        result = adapter.list_resource("Item", "test-tenant")
        assert result == [{"name": "Item1"}, {"name": "Item2"}]
        mock_proxy.assert_called_once_with("test-tenant", "resource/Item", method="GET")
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_create_resource(self, mock_proxy, adapter):
        """Test create_resource method."""
        mock_proxy.return_value = {"data": {"name": "ITEM-001", "item_name": "Test Item"}}
        result = adapter.create_resource("Item", {"item_code": "ITEM-001"}, "test-tenant")
        assert result == {"name": "ITEM-001", "item_name": "Test Item"}
        mock_proxy.assert_called_once_with(
            "test-tenant", "resource/Item", method="POST", json_data={"item_code": "ITEM-001"}
        )
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_get_resource(self, mock_proxy, adapter):
        """Test get_resource method."""
        mock_proxy.return_value = {"data": {"name": "ITEM-001", "item_name": "Test Item"}}
        result = adapter.get_resource("Item", "ITEM-001", "test-tenant")
        assert result == {"name": "ITEM-001", "item_name": "Test Item"}
        mock_proxy.assert_called_once_with("test-tenant", "resource/Item/ITEM-001", method="GET")
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_update_resource(self, mock_proxy, adapter):
        """Test update_resource method."""
        mock_proxy.return_value = {"data": {"name": "ITEM-001", "item_name": "Updated Item"}}
        result = adapter.update_resource("Item", "ITEM-001", {"item_name": "Updated Item"}, "test-tenant")
        assert result == {"name": "ITEM-001", "item_name": "Updated Item"}
        mock_proxy.assert_called_once_with(
            "test-tenant", "resource/Item/ITEM-001", method="PUT", json_data={"item_name": "Updated Item"}
        )
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_delete_resource(self, mock_proxy, adapter):
        """Test delete_resource method."""
        mock_proxy.return_value = None  # delete_resource doesn't use return value
        result = adapter.delete_resource("Item", "ITEM-001", "test-tenant")
        assert result == {"status": "deleted", "doctype": "Item", "name": "ITEM-001"}
        mock_proxy.assert_called_once_with("test-tenant", "resource/Item/ITEM-001", method="DELETE")
    
    @patch.object(ERPNextClientAdapter, 'proxy_request')
    def test_execute_method(self, mock_proxy, adapter):
        """Test execute_method."""
        mock_proxy.return_value = {"data": 100.0}
        adapter.tenant_id = "test-tenant"
        result = adapter.execute_method("erpnext.stock.utils.get_stock_balance", item_code="ITEM-001")
        # _wrap_response wraps the data in {"data": ...}
        assert result == {"data": 100.0}
        mock_proxy.assert_called_once_with(
            tenant_id="test-tenant",
            path="method/erpnext.stock.utils.get_stock_balance",
            method="POST",
            json_data={"item_code": "ITEM-001"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

