"""Unit tests for IAM models."""
import pytest
from datetime import datetime
from app.models.iam import User, Tenant, Membership, StaffProfile, Capability, KYCLog, TenantSettings
import uuid


class TestUserModel:
    """Test User model."""
    
    def test_user_creation(self):
        """Test creating a User instance."""
        user = User(
            id=uuid.uuid4(),
            email="test@example.com",
            user_code="USER001",
            full_name="Test User",
            kyc_tier="TIER_1"
        )
        assert user.email == "test@example.com"
        assert user.user_code == "USER001"
        assert user.kyc_tier == "TIER_1"
    
    def test_user_password_hash(self):
        """Test user password hash storage."""
        from app.services.auth_service import auth_service
        
        user = User()
        user.password_hash = auth_service.get_password_hash("password123")
        assert user.password_hash is not None
        assert user.password_hash != "password123"
        # User model doesn't have verify_password, use auth_service
        assert auth_service.verify_password("password123", user.password_hash) is True
        assert auth_service.verify_password("wrong_password", user.password_hash) is False


class TestTenantModel:
    """Test Tenant model."""
    
    def test_tenant_creation(self):
        """Test creating a Tenant instance."""
        tenant = Tenant(
            id=uuid.uuid4(),
            name="Test Tenant",
            tenant_code="TENANT001",
            engine="erpnext",
            status="ACTIVE"
        )
        assert tenant.name == "Test Tenant"
        assert tenant.tenant_code == "TENANT001"
        assert tenant.engine == "erpnext"
        assert tenant.status == "ACTIVE"
    
    def test_tenant_status(self):
        """Test tenant status values."""
        tenant = Tenant()
        tenant.status = "ACTIVE"
        assert tenant.status == "ACTIVE"
        
        tenant.status = "SUSPENDED"
        assert tenant.status == "SUSPENDED"


class TestMembershipModel:
    """Test Membership model."""
    
    def test_membership_creation(self):
        """Test creating a Membership instance."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        membership = Membership(
            user_id=user_id,
            tenant_id=tenant_id,
            status="ACTIVE",
            role="ADMIN"
        )
        assert membership.user_id == user_id
        assert membership.tenant_id == tenant_id
        assert membership.status == "ACTIVE"
        assert membership.role == "ADMIN"
    
    def test_membership_status(self):
        """Test membership status values."""
        membership = Membership()
        membership.status = "ACTIVE"
        assert membership.status == "ACTIVE"
        
        membership.status = "INACTIVE"
        assert membership.status == "INACTIVE"


class TestStaffProfileModel:
    """Test StaffProfile model."""
    
    def test_staff_profile_creation(self):
        """Test creating a StaffProfile instance."""
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        
        profile = StaffProfile(
            user_id=user_id,
            tenant_id=tenant_id,
            staff_code="STAFF001",
            department="Sales"
        )
        assert profile.user_id == user_id
        assert profile.tenant_id == tenant_id
        assert profile.staff_code == "STAFF001"
        assert profile.department == "Sales"


class TestCapabilityModel:
    """Test Capability model."""
    
    def test_capability_creation(self):
        """Test creating a Capability instance."""
        capability = Capability(
            code="inventory.view",
            description="View inventory items",
            risk_level="LOW"
        )
        assert capability.code == "inventory.view"
        assert capability.description == "View inventory items"
        assert capability.risk_level == "LOW"
    
    def test_capability_risk_levels(self):
        """Test capability risk levels."""
        capability = Capability()
        capability.risk_level = "LOW"
        assert capability.risk_level == "LOW"
        
        capability.risk_level = "HIGH"
        assert capability.risk_level == "HIGH"


class TestKYCLogModel:
    """Test KYCLog model."""
    
    def test_kyc_log_creation(self):
        """Test creating a KYCLog instance."""
        user_id = uuid.uuid4()
        verified_by = uuid.uuid4()
        
        log = KYCLog(
            user_id=user_id,
            previous_tier="KYC-T0",
            new_tier="TIER_1",
            verified_by=verified_by,
            documents={"id_card": "path/to/id.pdf"},
            notes="KYC verification completed"
        )
        assert log.user_id == user_id
        assert log.previous_tier == "KYC-T0"
        assert log.new_tier == "TIER_1"
        assert log.verified_by == verified_by
        assert log.documents == {"id_card": "path/to/id.pdf"}
        assert log.notes == "KYC verification completed"


class TestTenantSettingsModel:
    """Test TenantSettings model."""
    
    def test_tenant_settings_creation(self):
        """Test creating a TenantSettings instance."""
        tenant_id = uuid.uuid4()
        
        settings = TenantSettings(
            tenant_id=tenant_id,
            company_name="Test Company",
            legal_name="Test Company Ltd",
            currency="KES",
            enable_invoicing=True,
            enable_pos=False
        )
        assert settings.tenant_id == tenant_id
        assert settings.company_name == "Test Company"
        assert settings.currency == "KES"
        assert settings.enable_invoicing is True
        assert settings.enable_pos is False
    
    def test_tenant_settings_feature_toggles(self):
        """Test tenant settings feature toggles."""
        settings = TenantSettings()
        settings.enable_invoicing = True
        settings.enable_inventory = True
        settings.enable_hr = False
        assert settings.enable_invoicing is True
        assert settings.enable_inventory is True
        assert settings.enable_hr is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

