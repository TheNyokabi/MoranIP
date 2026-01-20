"""Unit tests for utility codes module."""
import pytest
from unittest.mock import MagicMock, patch
from app.utils.codes import (
    generate_base32_suffix,
    generate_entity_code,
    generate_role_code,
    generate_permission_code,
    PREFIX_USER,
    PREFIX_TENANT,
    PREFIX_STAFF,
    PREFIX_KYC,
    PREFIX_CAPABILITY,
    PREFIX_ROLE,
    PREFIX_PERMISSION,
    MODULE_ABBREVIATIONS
)


class TestGenerateBase32Suffix:
    """Test base32 suffix generation."""
    
    def test_generate_base32_suffix_default(self):
        """Test generating base32 suffix with default length."""
        suffix = generate_base32_suffix()
        
        assert len(suffix) == 5
        assert all(c in "0123456789ABCDEFGHJKMNPQRSTVWXYZ" for c in suffix)
    
    def test_generate_base32_suffix_custom_length(self):
        """Test generating base32 suffix with custom length."""
        suffix = generate_base32_suffix(length=10)
        
        assert len(suffix) == 10
        assert all(c in "0123456789ABCDEFGHJKMNPQRSTVWXYZ" for c in suffix)


class TestGenerateEntityCode:
    """Test entity code generation."""
    
    def test_generate_entity_code_default(self):
        """Test generating entity code with default values."""
        code = generate_entity_code(PREFIX_USER)
        
        assert code.startswith(PREFIX_USER)
        assert "GLB" in code
        assert len(code) > len(PREFIX_USER) + 4
    
    def test_generate_entity_code_with_country(self):
        """Test generating entity code with country code."""
        code = generate_entity_code(PREFIX_TENANT, country_code="KE")
        
        assert code.startswith(PREFIX_TENANT)
        assert "KE" in code
        assert "GLB" not in code
    
    def test_generate_entity_code_with_year(self):
        """Test generating entity code with year."""
        code = generate_entity_code(PREFIX_STAFF, year=25)
        
        assert code.startswith(PREFIX_STAFF)
        assert "-25-" in code
    
    def test_generate_entity_code_custom_length(self):
        """Test generating entity code with custom suffix length."""
        code = generate_entity_code(PREFIX_KYC, length=8)
        
        assert code.startswith(PREFIX_KYC)
        # Should have longer suffix
        parts = code.split("-")
        assert len(parts[-1]) == 8


class TestGenerateRoleCode:
    """Test role code generation."""
    
    def test_generate_role_code_system(self):
        """Test generating system role code."""
        code = generate_role_code("SYSTEM")
        
        assert code.startswith("ROL-SYS-")
        assert code.endswith("001")  # First sequence
    
    def test_generate_role_code_tenant(self):
        """Test generating tenant role code."""
        code = generate_role_code("TENANT")
        
        assert code.startswith("ROL-TEN-")
        assert code.endswith("001")  # First sequence
    
    def test_generate_role_code_custom(self):
        """Test generating custom role code."""
        code = generate_role_code("CUSTOM", country_code="KE")
        
        assert code.startswith("ROL-CUS-KE-")
        assert len(code) > len("ROL-CUS-KE-")
    
    def test_generate_role_code_custom_default_country(self):
        """Test generating custom role code with default country."""
        code = generate_role_code("CUSTOM")
        
        assert code.startswith("ROL-CUS-GLB-")
    
    def test_generate_role_code_system_with_db(self):
        """Test generating system role code with database."""
        mock_db = MagicMock()
        from sqlalchemy import text
        mock_db.execute.return_value.scalar.return_value = 5
        
        code = generate_role_code("SYSTEM", db=mock_db)
        
        assert code.startswith("ROL-SYS-")
        assert code.endswith("006")  # 5 + 1


class TestGeneratePermissionCode:
    """Test permission code generation."""
    
    def test_generate_permission_code_default(self):
        """Test generating permission code with default."""
        code = generate_permission_code("crm")
        
        assert code.startswith("PRM-")
        assert "CRM" in code or "crm" in code.upper()
    
    def test_generate_permission_code_with_module_abbreviation(self):
        """Test generating permission code with known module."""
        code = generate_permission_code("inventory")
        
        assert code.startswith("PRM-")
        assert "INV" in code
    
    def test_generate_permission_code_unknown_module(self):
        """Test generating permission code with unknown module."""
        code = generate_permission_code("unknown")
        
        assert code.startswith("PRM-")
        assert "UNK" in code or "unknown"[:3].upper() in code
    
    def test_generate_permission_code_with_db(self):
        """Test generating permission code with database."""
        mock_db = MagicMock()
        mock_db.execute.return_value.scalar.return_value = 3
        
        code = generate_permission_code("crm", db=mock_db)
        
        assert code.startswith("PRM-")
        assert code.endswith("004")  # 3 + 1


class TestConstants:
    """Test module constants."""
    
    def test_prefix_constants(self):
        """Test that prefix constants are defined."""
        assert PREFIX_USER == "USR"
        assert PREFIX_TENANT == "TEN"
        assert PREFIX_STAFF == "STF"
        assert PREFIX_KYC == "KYC"
        assert PREFIX_CAPABILITY == "CAP"
        assert PREFIX_ROLE == "ROL"
        assert PREFIX_PERMISSION == "PRM"
    
    def test_module_abbreviations(self):
        """Test that module abbreviations are defined."""
        assert "CRM" in MODULE_ABBREVIATIONS.values()
        assert "INV" in MODULE_ABBREVIATIONS.values()
        assert "ACC" in MODULE_ABBREVIATIONS.values()
        assert isinstance(MODULE_ABBREVIATIONS, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

