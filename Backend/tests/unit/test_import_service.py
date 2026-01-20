"""Unit tests for ImportService."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.services.import_service import ImportService
from app.models.iam import User, Tenant, Membership
import uuid
import csv
import io


class TestImportService:
    """Test suite for ImportService."""
    
    @pytest.fixture
    def import_service(self):
        """Create ImportService instance."""
        return ImportService()
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return Mock()
    
    @pytest.fixture
    def sample_csv_content(self):
        """Sample CSV content for testing."""
        return b"email,full_name,phone,role\njohn@example.com,John Doe,+1234567890,ADMIN\njane@example.com,Jane Smith,+0987654321,STAFF"
    
    def test_parse_csv_success(self, import_service, sample_csv_content):
        """Test successful CSV parsing."""
        result = import_service.parse_csv(sample_csv_content)
        
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]["email"] == "john@example.com"
        assert result[0]["full_name"] == "John Doe"
        assert result[1]["email"] == "jane@example.com"
    
    def test_parse_csv_invalid_encoding(self, import_service):
        """Test CSV parsing with invalid encoding."""
        invalid_content = b"\xff\xfe\x00\x00"  # Invalid UTF-8
        
        with pytest.raises(HTTPException) as exc_info:
            import_service.parse_csv(invalid_content)
        
        assert exc_info.value.status_code == 400
        assert "Failed to parse CSV" in str(exc_info.value.detail)
    
    def test_parse_csv_empty(self, import_service):
        """Test parsing empty CSV."""
        empty_content = b"email,full_name\n"
        result = import_service.parse_csv(empty_content)
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    @patch('app.services.import_service.select')
    def test_validate_users_success(self, mock_select, import_service, mock_db):
        """Test successful user validation."""
        data = [
            {"email": "new@example.com", "full_name": "New User", "role": "STAFF"},
            {"email": "another@example.com", "full_name": "Another User", "role": "ADMIN"}
        ]
        
        # Mock no existing users
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        errors = import_service.validate_users(data, mock_db)
        
        assert len(errors) == 0
    
    @patch('app.services.import_service.select')
    def test_validate_users_missing_email(self, mock_select, import_service, mock_db):
        """Test validation with missing email."""
        data = [
            {"email": "", "full_name": "User", "role": "STAFF"},
            {"email": "valid@example.com", "full_name": "Valid User", "role": "ADMIN"}
        ]
        
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        errors = import_service.validate_users(data, mock_db)
        
        assert len(errors) > 0
        assert any("Missing email" in error for error in errors)
    
    @patch('app.services.import_service.select')
    def test_validate_users_duplicate_email_in_file(self, mock_select, import_service, mock_db):
        """Test validation with duplicate emails in file."""
        data = [
            {"email": "duplicate@example.com", "full_name": "User 1", "role": "STAFF"},
            {"email": "duplicate@example.com", "full_name": "User 2", "role": "ADMIN"}
        ]
        
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        errors = import_service.validate_users(data, mock_db)
        
        assert len(errors) > 0
        assert any("Duplicate email" in error for error in errors)
    
    @patch('app.services.import_service.select')
    def test_validate_users_existing_email(self, mock_select, import_service, mock_db):
        """Test validation with existing email in database."""
        data = [
            {"email": "existing@example.com", "full_name": "User", "role": "STAFF"}
        ]
        
        # Mock existing user
        existing_user = Mock(spec=User)
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = existing_user
        mock_db.execute.return_value = mock_result
        
        errors = import_service.validate_users(data, mock_db)
        
        assert len(errors) > 0
        assert any("already exists" in error for error in errors)
    
    @patch('app.services.import_service.select')
    def test_validate_users_invalid_role(self, mock_select, import_service, mock_db):
        """Test validation with invalid role."""
        data = [
            {"email": "user@example.com", "full_name": "User", "role": "INVALID_ROLE"}
        ]
        
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        errors = import_service.validate_users(data, mock_db)
        
        assert len(errors) > 0
        assert any("Invalid role" in error for error in errors)
    
    @patch('app.services.import_service.select')
    @patch('app.services.import_service.generate_entity_code')
    @patch('app.services.import_service.auth_service')
    def test_import_users_success(self, mock_auth, mock_code_gen, mock_select, import_service, mock_db):
        """Test successful user import."""
        tenant_id = uuid.uuid4()
        data = [
            {"email": "new@example.com", "full_name": "New User", "phone": "+1234567890", "role": "STAFF"}
        ]
        
        # Mock tenant
        mock_tenant = Mock(spec=Tenant)
        mock_tenant.id = tenant_id
        mock_tenant.country_code = "KE"
        mock_tenant_result = Mock()
        mock_tenant_result.scalar_one_or_none.return_value = mock_tenant
        
        # Mock code generation
        mock_code_gen.return_value = "USER001"
        
        # Mock password hashing
        mock_auth.get_password_hash.return_value = "hashed_password"
        
        # Mock user doesn't exist
        mock_user_result = Mock()
        mock_user_result.scalar_one_or_none.return_value = None
        
        # Mock membership doesn't exist
        mock_membership_result = Mock()
        mock_membership_result.scalar_one_or_none.return_value = None
        
        # Setup side_effect for multiple execute calls
        mock_db.execute.side_effect = [
            mock_tenant_result,      # First call: get tenant
            mock_user_result,        # Second call: check user exists
            mock_membership_result   # Third call: check membership exists
        ]
        
        result = import_service.import_users(data, str(tenant_id), mock_db)
        
        assert result["created"] == 1
        assert result["processed"] == 1
        assert mock_db.add.called
        assert mock_db.commit.called
    
    @patch('app.services.import_service.select')
    def test_import_users_tenant_not_found(self, mock_select, import_service, mock_db):
        """Test import with non-existent tenant."""
        tenant_id = uuid.uuid4()
        data = [{"email": "user@example.com", "full_name": "User", "role": "STAFF"}]
        
        # Mock tenant not found
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result
        
        with pytest.raises(HTTPException) as exc_info:
            import_service.import_users(data, str(tenant_id), mock_db)
        
        assert exc_info.value.status_code == 404
        assert "Tenant not found" in str(exc_info.value.detail)
    
    @patch('app.services.import_service.select')
    @patch('app.services.import_service.generate_entity_code')
    def test_import_users_skip_existing(self, mock_code_gen, mock_select, import_service, mock_db):
        """Test import skips existing users."""
        tenant_id = uuid.uuid4()
        data = [
            {"email": "existing@example.com", "full_name": "Existing User", "role": "STAFF"}
        ]
        
        # Mock tenant
        mock_tenant = Mock(spec=Tenant)
        mock_tenant.id = tenant_id
        mock_tenant.country_code = "KE"
        mock_tenant_result = Mock()
        mock_tenant_result.scalar_one_or_none.return_value = mock_tenant
        
        # Mock existing user
        existing_user = Mock(spec=User)
        existing_user.id = uuid.uuid4()
        mock_user_result = Mock()
        mock_user_result.scalar_one_or_none.return_value = existing_user
        
        # Mock existing membership
        existing_membership = Mock(spec=Membership)
        mock_membership_result = Mock()
        mock_membership_result.scalar_one_or_none.return_value = existing_membership
        
        # Setup side_effect for multiple execute calls
        mock_db.execute.side_effect = [
            mock_tenant_result,      # First call: get tenant
            mock_user_result,        # Second call: check user exists (found)
            mock_membership_result   # Third call: check membership exists (found)
        ]
        
        result = import_service.import_users(data, str(tenant_id), mock_db)
        
        assert result["created"] == 0
        assert result["processed"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

