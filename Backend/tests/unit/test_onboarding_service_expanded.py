"""Expanded unit tests for OnboardingOrchestrator to increase coverage."""
import pytest
from unittest.mock import Mock, MagicMock, patch
from app.services.onboarding_service import OnboardingOrchestrator
from app.models.onboarding import TenantOnboarding, OnboardingStep
from app.models.iam import Tenant
import uuid
from datetime import datetime


class TestOnboardingOrchestratorExpanded:
    """Additional tests for OnboardingOrchestrator."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return MagicMock()
    
    @pytest.fixture
    def orchestrator(self, mock_db):
        """Create OnboardingOrchestrator instance."""
        return OnboardingOrchestrator(mock_db)
    
    def test_get_onboarding_status_completed(self, orchestrator, mock_db):
        """Test getting onboarding status when completed."""
        tenant_id = str(uuid.uuid4())
        
        # Mock onboarding
        mock_onboarding = TenantOnboarding()
        mock_onboarding.id = uuid.uuid4()
        mock_onboarding.tenant_id = uuid.UUID(tenant_id)
        mock_onboarding.status = "COMPLETED"
        mock_onboarding.template = "standard"
        mock_onboarding.configuration = {}
        mock_onboarding.current_step = None
        mock_onboarding.started_at = datetime.now()
        mock_onboarding.completed_at = datetime.now()
        mock_onboarding.error_message = None
        
        mock_db.query().filter().first.return_value = mock_onboarding
        mock_db.query().filter().order_by().all.return_value = []
        
        result = orchestrator.get_onboarding_status(tenant_id)
        
        assert result["status"] == "COMPLETED"
    
    def test_get_onboarding_status_not_found(self, orchestrator, mock_db):
        """Test getting onboarding status when not found."""
        tenant_id = str(uuid.uuid4())
        
        # Mock no onboarding - get_onboarding_status returns dict, not raises
        mock_db.query().filter().first.return_value = None
        
        result = orchestrator.get_onboarding_status(tenant_id)
        
        assert result["status"] == "NOT_STARTED"
        assert result["progress"] == 0
    
    def test_skip_step_success(self, orchestrator, mock_db):
        """Test skipping an onboarding step."""
        tenant_id = str(uuid.uuid4())
        step_code = "setup_warehouse"
        
        # Mock onboarding
        mock_onboarding = TenantOnboarding()
        mock_onboarding.id = uuid.uuid4()
        mock_onboarding.tenant_id = uuid.UUID(tenant_id)
        mock_onboarding.status = "IN_PROGRESS"
        
        # Mock step
        mock_step = OnboardingStep()
        mock_step.step_code = step_code
        mock_step.status = "PENDING"
        
        # Mock _get_active_onboarding
        with patch.object(orchestrator, '_get_active_onboarding', return_value=mock_onboarding):
            mock_db.query().filter().filter().first.return_value = mock_step
            
            result = orchestrator.skip_step(tenant_id, step_code)
            
            assert result.step_code == step_code
            assert result.status == "SKIPPED"
            mock_db.commit.assert_called()
    
    def test_skip_step_not_found(self, orchestrator, mock_db):
        """Test skipping a step that doesn't exist."""
        tenant_id = str(uuid.uuid4())
        step_code = "nonexistent_step"
        
        # Mock onboarding
        mock_onboarding = TenantOnboarding()
        mock_onboarding.id = uuid.uuid4()
        mock_onboarding.tenant_id = uuid.UUID(tenant_id)
        
        # Mock _get_active_onboarding
        with patch.object(orchestrator, '_get_active_onboarding', return_value=mock_onboarding):
            mock_db.query().filter().filter().first.return_value = None
            
            with pytest.raises(ValueError, match="Step.*not found"):
                orchestrator.skip_step(tenant_id, step_code)
    
    def test_execute_next_step_no_pending(self, orchestrator, mock_db):
        """Test executing next step when no pending steps."""
        tenant_id = str(uuid.uuid4())
        
        # Mock onboarding with all steps completed
        mock_onboarding = TenantOnboarding()
        mock_onboarding.id = uuid.uuid4()
        mock_onboarding.tenant_id = uuid.UUID(tenant_id)
        mock_onboarding.status = "IN_PROGRESS"
        
        # Mock _get_active_onboarding
        with patch.object(orchestrator, '_get_active_onboarding', return_value=mock_onboarding):
            # Mock no pending steps
            mock_db.query().filter().filter().order_by().first.return_value = None
            
            result = orchestrator.execute_next_step(tenant_id)
            
            assert result is None  # Returns None when no pending steps


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

