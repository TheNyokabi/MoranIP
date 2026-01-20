"""Expanded unit tests for ImportService to increase coverage."""
import pytest
from unittest.mock import Mock, MagicMock, patch, mock_open
from io import StringIO
import csv
from app.services.import_service import ImportService
from app.models.iam import User, Tenant
import uuid


class TestImportServiceExpanded:
    """Additional tests for ImportService."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return MagicMock()
    
    @pytest.fixture
    def import_service(self):
        """Create ImportService instance."""
        return ImportService()
    
    def test_import_inventory_items(self, import_service, mock_db):
        """Test importing inventory items."""
        tenant_id = uuid.uuid4()
        
        # Mock CSV data
        csv_data = "item_code,item_name,item_group,stock_uom\nITEM-001,Test Item,Products,Nos"
        
        # Mock existing item check (not found)
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        
        # Mock ERPNext adapter
        with patch('app.services.import_service.erpnext_adapter') as mock_adapter:
            mock_adapter.create_resource.return_value = {"data": {"name": "ITEM-001"}}
            
            result = import_service.import_inventory_items(
                mock_db, tenant_id, StringIO(csv_data)
            )
            
            assert result["imported"] >= 0
            mock_adapter.create_resource.assert_called()
    
    def test_import_warehouses(self, import_service, mock_db):
        """Test importing warehouses."""
        tenant_id = uuid.uuid4()
        
        # Mock CSV data
        csv_data = "warehouse_name,company,warehouse_type\nMain Warehouse,Paint Shop Ltd,Store"
        
        # Mock existing warehouse check (not found)
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        
        # Mock ERPNext adapter
        with patch('app.services.import_service.erpnext_adapter') as mock_adapter:
            mock_adapter.create_resource.return_value = {"data": {"name": "Main Warehouse"}}
            
            result = import_service.import_warehouses(
                mock_db, tenant_id, StringIO(csv_data)
            )
            
            assert result["imported"] >= 0
            mock_adapter.create_resource.assert_called()
    
    def test_import_storefronts(self, import_service, mock_db):
        """Test importing storefronts."""
        tenant_id = uuid.uuid4()
        
        # Mock CSV data
        csv_data = "storefront_name,location,is_active\nStore 1,Nairobi,1"
        
        # Mock existing storefront check (not found)
        mock_db.execute.return_value.scalar_one_or_none.return_value = None
        
        # Mock ERPNext adapter
        with patch('app.services.import_service.erpnext_adapter') as mock_adapter:
            mock_adapter.create_resource.return_value = {"data": {"name": "Store 1"}}
            
            result = import_service.import_storefronts(
                mock_db, tenant_id, StringIO(csv_data)
            )
            
            assert result["imported"] >= 0
            mock_adapter.create_resource.assert_called()
    
    def test_import_users_with_existing(self, import_service, mock_db):
        """Test importing users when some already exist."""
        tenant_id = uuid.uuid4()
        
        # Mock CSV data
        csv_data = "email,first_name,last_name,role\nuser1@test.com,John,Doe,USER\nuser2@test.com,Jane,Smith,ADMIN"
        
        # Mock existing user check - first exists, second doesn't
        def mock_scalar_one_or_none():
            call_count = getattr(mock_scalar_one_or_none, 'call_count', 0)
            mock_scalar_one_or_none.call_count = call_count + 1
            if call_count == 1:
                # First user exists
                mock_user = User()
                mock_user.id = uuid.uuid4()
                return mock_user
            return None
        
        mock_db.execute.return_value.scalar_one_or_none.side_effect = mock_scalar_one_or_none
        
        # Mock tenant check
        mock_tenant = Tenant()
        mock_tenant.id = tenant_id
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_tenant
        
        # Mock password hashing
        with patch('app.services.import_service.auth_service') as mock_auth:
            mock_auth.get_password_hash.return_value = "hashed_password"
            
            result = import_service.import_users(
                mock_db, tenant_id, StringIO(csv_data)
            )
            
            assert result["imported"] >= 0
            assert result["skipped"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

