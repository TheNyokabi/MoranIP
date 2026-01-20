"""Unit tests for OnboardingOrchestrator."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from app.services.onboarding_service import OnboardingOrchestrator
from app.models.iam import Tenant
from app.services.erpnext_client import erpnext_adapter
import uuid


class TestOnboardingOrchestrator:
    """Test suite for OnboardingOrchestrator."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return Mock()
    
    @pytest.fixture
    def onboarding_service(self, mock_db):
        """Create OnboardingOrchestrator instance."""
        return OnboardingOrchestrator(mock_db)
    
    @pytest.fixture
    def mock_tenant(self):
        """Create mock tenant."""
        tenant = Mock(spec=Tenant)
        tenant.id = uuid.uuid4()
        tenant.tenant_code = "TENANT001"
        tenant.name = "Test Tenant"
        tenant.engine = "erpnext"
        return tenant
    
    def test_initiate_onboarding_success(self, onboarding_service, mock_db, mock_tenant):
        """Test successful onboarding initiation."""
        # Setup query chain mocks
        query_mock = Mock()
        filter_mock = Mock()
        
        # First query: get tenant
        query_mock.filter.return_value = filter_mock
        filter_mock.first.return_value = mock_tenant
        
        # Second query: check existing onboarding (none)
        # The query uses: .filter().filter().first() where second filter uses .in_()
        query_mock2 = Mock()
        filter_mock2 = Mock()
        # First filter() call
        query_mock2.filter.return_value = filter_mock2
        # Second filter() call with .in_() - need to handle this
        filter_mock2.filter.return_value = filter_mock2
        filter_mock2.first.return_value = None  # No existing onboarding
        
        # Setup side_effect for multiple query calls
        mock_db.query.side_effect = [query_mock, query_mock2]
        
        # Mock commit and refresh
        mock_db.commit.return_value = None
        mock_db.refresh.return_value = None
        mock_db.flush.return_value = None
        
        result = onboarding_service.initiate_onboarding(
            str(mock_tenant.id),
            "STARTUP",
            custom_config=None,
            initiated_by_user_id=str(uuid.uuid4())
        )
        
        assert result is not None
        assert result.status == "DRAFT"
        assert mock_db.add.called
        assert mock_db.commit.called
    
    def test_initiate_onboarding_tenant_not_found(self, onboarding_service, mock_db):
        """Test onboarding initiation with non-existent tenant."""
        mock_db.query().filter().first.return_value = None
        
        with pytest.raises(ValueError, match="Tenant.*not found"):
            onboarding_service.initiate_onboarding(
                str(uuid.uuid4()),
                "STARTUP"
            )
    
    def test_get_onboarding_status_not_started(self, onboarding_service, mock_db):
        """Test getting onboarding status when not started."""
        tenant_id = str(uuid.uuid4())
        
        # Mock no active onboarding
        mock_db.query().filter().first.return_value = None
        
        status = onboarding_service.get_onboarding_status(tenant_id)
        
        assert status["status"] == "NOT_STARTED"
        assert status["progress"] == 0
    
    def test_resolve_module_order(self, onboarding_service):
        """Test module dependency resolution."""
        # Test that dependencies are resolved correctly
        modules = ["pos", "inventory", "accounting"]
        
        # Access private method for testing
        sorted_modules = onboarding_service._resolve_module_order(modules)
        
        # Accounting and inventory should come before pos
        assert "accounting" in sorted_modules
        assert "inventory" in sorted_modules
        assert "pos" in sorted_modules
        pos_index = sorted_modules.index("pos")
        accounting_index = sorted_modules.index("accounting")
        inventory_index = sorted_modules.index("inventory")
        
        # POS should come after its dependencies
        assert pos_index > accounting_index
        assert pos_index > inventory_index


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

