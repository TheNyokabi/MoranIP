"""Unit tests for response normalizer."""
import pytest
from app.middleware.response_normalizer import ResponseNormalizer


class TestResponseNormalizer:
    """Test suite for ResponseNormalizer."""
    
    def test_normalize_erpnext_dict_with_message(self):
        """Test normalizing ERPNext response with message key."""
        response = {"message": {"data": "test"}}
        result = ResponseNormalizer.normalize_erpnext(response)
        assert result == {"data": {"data": "test"}}
    
    def test_normalize_erpnext_dict_without_message(self):
        """Test normalizing ERPNext response without message key."""
        response = {"data": "test"}
        result = ResponseNormalizer.normalize_erpnext(response)
        assert result == {"data": "test"}
    
    def test_normalize_erpnext_primitive(self):
        """Test normalizing ERPNext primitive response."""
        response = 100.0
        result = ResponseNormalizer.normalize_erpnext(response)
        assert result == {"data": 100.0}
    
    def test_normalize_erpnext_list(self):
        """Test normalizing ERPNext list response."""
        response = [{"id": 1}, {"id": 2}]
        result = ResponseNormalizer.normalize_erpnext(response)
        assert result == {"data": [{"id": 1}, {"id": 2}]}
    
    def test_normalize_odoo_dict(self):
        """Test normalizing Odoo response."""
        response = {"id": 1, "name": "Test"}
        result = ResponseNormalizer.normalize_odoo(response)
        assert result == {"data": response}
    
    def test_normalize_odoo_list(self):
        """Test normalizing Odoo list response."""
        response = [{"id": 1}, {"id": 2}]
        result = ResponseNormalizer.normalize_odoo(response)
        assert result == {"data": response}
    
    def test_normalize_error(self):
        """Test normalizing error response."""
        result = ResponseNormalizer.normalize_error("Invalid input", "validation_error", 400)
        assert result["error"]["message"] == "Invalid input"
        assert result["error"]["type"] == "validation_error"
        assert result["error"]["code"] == 400
    
    def test_is_error_true(self):
        """Test is_error returns True for error response."""
        response = {"error": {"message": "Error occurred"}}
        assert ResponseNormalizer.is_error(response) is True
    
    def test_is_error_false(self):
        """Test is_error returns False for success response."""
        response = {"data": {"id": 1}}
        assert ResponseNormalizer.is_error(response) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

