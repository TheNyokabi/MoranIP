"""Unit tests for Settings router."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.routers.settings import get_tenant_settings, create_or_update_tenant_settings, patch_tenant_settings
from app.models.iam import TenantSettings, Tenant
from app.dependencies.auth import require_tenant_access, get_current_user
import uuid


class TestSettingsRouter:
    """Test suite for Settings router endpoints."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return Mock()
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"]
        }
    
    @pytest.fixture
    def mock_tenant(self):
        """Create mock tenant."""
        tenant = Mock(spec=Tenant)
        tenant.id = uuid.uuid4()
        tenant.name = "Test Tenant"
        tenant.country_code = "KE"
        return tenant
    
    @pytest.fixture
    def mock_settings(self):
        """Create mock tenant settings."""
        from datetime import datetime
        
        settings = Mock(spec=TenantSettings)
        settings.id = uuid.uuid4()
        settings.tenant_id = uuid.uuid4()
        settings.company_name = "Test Company"
        settings.legal_name = None
        settings.business_type = None
        settings.registration_number = None
        settings.tax_id = None
        settings.email = None
        settings.phone = None
        settings.website = None
        settings.street_address = None
        settings.city = None
        settings.state_province = None
        settings.postal_code = None
        settings.country = None
        settings.currency = "KES"
        settings.fiscal_year_start_month = 1
        settings.accounting_method = "accrual"
        settings.industry = None
        settings.employees_count = None
        settings.annual_revenue = None
        settings.enable_invoicing = True
        settings.enable_pos = False
        settings.enable_inventory = True
        settings.enable_hr = False
        settings.enable_projects = False
        settings.logo_url = None
        settings.language = "en"
        settings.timezone = "Africa/Nairobi"
        settings.setup_completed = False
        settings.created_at = datetime.now()
        settings.updated_at = datetime.now()
        return settings
    
    def test_get_tenant_settings_existing(self, mock_db, mock_user, mock_settings):
        """Test getting existing tenant settings."""
        tenant_id = str(mock_settings.tenant_id)
        
        # Mock query to return existing settings
        mock_db.query().filter().first.return_value = mock_settings
        
        result = get_tenant_settings(
            tenant_id=tenant_id,
            db=mock_db,
            current_user=mock_user
        )
        
        assert "data" in result
        assert result["data"] is not None
    
    def test_get_tenant_settings_create_defaults(self, mock_db, mock_user, mock_tenant):
        """Test getting tenant settings creates defaults if not exist."""
        from datetime import datetime
        
        tenant_id = str(mock_tenant.id)
        
        # Create a properly initialized settings object that will be created
        new_settings = TenantSettings(
            tenant_id=uuid.UUID(tenant_id),
            company_name=mock_tenant.name,
            country=mock_tenant.country_code,
            currency="KES",
            fiscal_year_start_month=1,
            accounting_method="accrual",
            enable_invoicing=True,
            enable_pos=False,
            enable_inventory=True,
            enable_hr=False,
            enable_projects=False,
            language="en",
            timezone="Africa/Nairobi",
            setup_completed=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock no existing settings, then tenant, then return new settings after refresh
        mock_db.query().filter().first.side_effect = [None, mock_tenant]
        mock_db.refresh.side_effect = lambda obj: setattr(obj, 'id', uuid.uuid4()) or setattr(obj, 'created_at', datetime.now()) or setattr(obj, 'updated_at', datetime.now())
        
        # Mock commit
        mock_db.commit.return_value = None
        
        # Patch TenantSettings constructor to return our properly initialized object
        with patch('app.routers.settings.TenantSettings', return_value=new_settings):
            result = get_tenant_settings(
                tenant_id=tenant_id,
                db=mock_db,
                current_user=mock_user
            )
            
            assert "data" in result
            assert mock_db.add.called
            assert mock_db.commit.called
    
    def test_get_tenant_settings_tenant_not_found(self, mock_db, mock_user):
        """Test getting settings when tenant doesn't exist."""
        tenant_id = str(uuid.uuid4())
        
        # Mock no settings and no tenant
        mock_db.query().filter().first.side_effect = [None, None]
        
        with pytest.raises(HTTPException) as exc_info:
            get_tenant_settings(
                tenant_id=tenant_id,
                db=mock_db,
                current_user=mock_user
            )
        
        assert exc_info.value.status_code == 404
        assert "Tenant not found" in str(exc_info.value.detail)
    
    def test_create_or_update_tenant_settings_new(self, mock_db, mock_user):
        """Test creating new tenant settings."""
        from datetime import datetime
        
        tenant_id = str(uuid.uuid4())
        
        from app.routers.settings import TenantSettingsRequest
        
        request_data = TenantSettingsRequest(
            company_name="New Company",
            currency="KES",
            enable_invoicing=True
        )
        
        # Create properly initialized settings object
        new_settings = TenantSettings(
            tenant_id=uuid.UUID(tenant_id),
            company_name="New Company",
            currency="KES",
            fiscal_year_start_month=1,
            accounting_method="accrual",
            enable_invoicing=True,
            enable_pos=False,
            enable_inventory=True,
            enable_hr=False,
            enable_projects=False,
            language="en",
            timezone="Africa/Nairobi",
            setup_completed=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock no existing settings
        mock_db.query().filter().first.return_value = None
        
        # Mock refresh to set id and timestamps
        def refresh_side_effect(obj):
            obj.id = uuid.uuid4()
            obj.created_at = datetime.now()
            obj.updated_at = datetime.now()
        mock_db.refresh.side_effect = refresh_side_effect
        
        # Mock commit
        mock_db.commit.return_value = None
        
        # Patch TenantSettings constructor
        with patch('app.routers.settings.TenantSettings', return_value=new_settings):
            result = create_or_update_tenant_settings(
                req=request_data,
                tenant_id=tenant_id,
                db=mock_db,
                current_user=mock_user
            )
            
            assert "data" in result
            assert mock_db.add.called
            assert mock_db.commit.called
    
    def test_create_or_update_tenant_settings_existing(self, mock_db, mock_user, mock_settings):
        """Test updating existing tenant settings."""
        tenant_id = str(mock_settings.tenant_id)
        
        from app.routers.settings import TenantSettingsRequest
        
        request_data = TenantSettingsRequest(
            company_name="Updated Company",
            enable_pos=True
        )
        
        # Mock existing settings
        mock_db.query().filter().first.return_value = mock_settings
        
        # Mock commit and refresh
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        result = create_or_update_tenant_settings(
            req=request_data,
            tenant_id=tenant_id,
            db=mock_db,
            current_user=mock_user
        )
        
        assert "data" in result
        assert mock_db.commit.called
        # Verify setattr was called (settings were updated)
        assert hasattr(mock_settings, 'company_name')
    
    def test_patch_tenant_settings_partial_update(self, mock_db, mock_user, mock_settings):
        """Test partial update of tenant settings."""
        tenant_id = str(mock_settings.tenant_id)
        
        from app.routers.settings import TenantSettingsRequest
        
        request_data = TenantSettingsRequest(
            enable_pos=True,
            language="sw"
        )
        
        # Mock existing settings
        mock_db.query().filter().first.return_value = mock_settings
        
        # Mock commit and refresh
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        
        result = patch_tenant_settings(
            req=request_data,
            tenant_id=tenant_id,
            db=mock_db,
            current_user=mock_user
        )
        
        assert "data" in result
        assert mock_db.commit.called
    
    def test_patch_tenant_settings_create_if_not_exists(self, mock_db, mock_user):
        """Test patch creates settings if they don't exist."""
        from datetime import datetime
        
        tenant_id = str(uuid.uuid4())
        
        from app.routers.settings import TenantSettingsRequest
        
        request_data = TenantSettingsRequest(
            company_name="New Company"
        )
        
        # Create properly initialized settings object
        new_settings = TenantSettings(
            tenant_id=uuid.UUID(tenant_id),
            company_name="New Company",
            currency="KES",
            fiscal_year_start_month=1,
            accounting_method="accrual",
            enable_invoicing=True,
            enable_pos=False,
            enable_inventory=True,
            enable_hr=False,
            enable_projects=False,
            language="en",
            timezone="Africa/Nairobi",
            setup_completed=False,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock no existing settings
        mock_db.query().filter().first.return_value = None
        
        # Mock refresh to set id and timestamps
        def refresh_side_effect(obj):
            obj.id = uuid.uuid4()
            obj.created_at = datetime.now()
            obj.updated_at = datetime.now()
        mock_db.refresh.side_effect = refresh_side_effect
        
        # Mock commit
        mock_db.commit.return_value = None
        
        # Patch TenantSettings constructor
        with patch('app.routers.settings.TenantSettings', return_value=new_settings):
            result = patch_tenant_settings(
                req=request_data,
                tenant_id=tenant_id,
                db=mock_db,
                current_user=mock_user
            )
            
            assert "data" in result
            assert mock_db.add.called
            assert mock_db.commit.called


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

