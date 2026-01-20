"""Unit tests for ProvisioningService."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from app.services.provisioning_service import (
    ProvisioningService,
    ProvisioningConfig,
    CriticalProvisioningError,
    TransientProvisioningError,
    NonCriticalProvisioningError
)
from app.models.iam import Tenant
from app.models.onboarding import TenantOnboarding
from app.services.engine_health_service import EngineHealthStatus, EngineHealthResult


class TestProvisioningService:
    """Test suite for ProvisioningService."""
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = Mock()
        db.commit = Mock()
        db.refresh = Mock()
        db.add = Mock()
        db.flush = Mock()
        return db
    
    @pytest.fixture
    def provisioning_service(self):
        """Create ProvisioningService instance."""
        return ProvisioningService()
    
    @pytest.fixture
    def mock_tenant(self):
        """Create mock tenant."""
        tenant = Mock(spec=Tenant)
        tenant.id = uuid.uuid4()
        tenant.tenant_code = "TEN-KE-25-XXXXX"
        tenant.name = "Test Tenant"
        tenant.engine = "erpnext"
        tenant.country_code = "KE"
        tenant.provisioning_status = "NOT_PROVISIONED"
        tenant.provisioning_error = None
        return tenant
    
    @pytest.fixture
    def mock_onboarding(self, mock_tenant):
        """Create mock onboarding."""
        onboarding = Mock(spec=TenantOnboarding)
        onboarding.id = uuid.uuid4()
        onboarding.tenant_id = mock_tenant.id
        onboarding.status = "DRAFT"
        onboarding.provisioning_type = None
        onboarding.provisioning_config = {}
        onboarding.provisioning_steps = {}
        onboarding.provisioning_metadata = {}
        onboarding.started_at = None
        onboarding.completed_at = None
        onboarding.error_message = None
        onboarding.error_step = None
        return onboarding
    
    @pytest.fixture
    def provisioning_config(self):
        """Create provisioning config."""
        return ProvisioningConfig(
            include_demo_data=False,
            pos_store_enabled=True,
            country_template=None
        )
    
    def test_step_engine_check_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding):
        """Test successful engine health check."""
        with patch('app.services.provisioning_service.engine_health_service') as mock_health:
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc),
                response_time_ms=100.0
            )
            
            result = provisioning_service._step_engine_check(
                str(mock_tenant.id),
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert result.message == "Engine is online"
            assert result.error is None
    
    def test_step_engine_check_offline(self, provisioning_service, mock_db, mock_tenant, mock_onboarding):
        """Test engine offline scenario."""
        with patch('app.services.provisioning_service.engine_health_service') as mock_health:
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.OFFLINE,
                message="Engine is offline",
                checked_at=datetime.now(timezone.utc),
                error="Connection failed"
            )
            
            result = provisioning_service._step_engine_check(
                str(mock_tenant.id),
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "failed"
            assert "offline" in result.message.lower()
            assert result.error is not None
    
    def test_step_company_creation_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test successful company creation."""
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list companies (empty - company doesn't exist)
            mock_adapter.proxy_request.return_value = {"data": []}
            
            # Mock create company
            mock_adapter.create_resource.return_value = {
                "name": mock_tenant.name,
                "company_name": mock_tenant.name
            }
            
            result = provisioning_service._step_company_creation(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert mock_tenant.name in result.message
            assert result.metadata["company_name"] == mock_tenant.name
    
    def test_step_company_creation_idempotent(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test idempotent company creation (company already exists)."""
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list companies (company exists)
            mock_adapter.proxy_request.return_value = {
                "data": [{"name": mock_tenant.name}]
            }
            
            result = provisioning_service._step_company_creation(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "exists"
            assert "already exists" in result.message
            # Should not call create_resource
            mock_adapter.create_resource.assert_not_called()
    
    def test_step_chart_of_accounts_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test successful chart of accounts import."""
        mock_onboarding.provisioning_metadata = {"company_name": mock_tenant.name}
        
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock idempotency check (no accounts exist)
            mock_adapter.proxy_request.side_effect = [
                {"data": []},  # Existing accounts check
                {"data": [{"name": "Account 1"}, {"name": "Account 2"}]}  # After import
            ]
            
            # Mock import_chart_of_accounts
            mock_adapter.import_chart_of_accounts.return_value = {
                "status": "success",
                "message": "Chart of accounts imported successfully",
                "accounts_count": 2
            }
            
            result = provisioning_service._step_chart_of_accounts(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert "imported" in result.message.lower()
            assert result.metadata["accounts_count"] == 2
    
    def test_step_chart_of_accounts_idempotent(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test idempotent chart of accounts import (accounts already exist)."""
        mock_onboarding.provisioning_metadata = {"company_name": mock_tenant.name}
        
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock idempotency check (accounts exist)
            mock_adapter.proxy_request.return_value = {
                "data": [{"name": "Account 1"}, {"name": "Account 2"}, {"name": "Account 3"}]
            }
            
            # Mock import_chart_of_accounts (returns exists)
            mock_adapter.import_chart_of_accounts.return_value = {
                "status": "exists",
                "message": "Chart of accounts already exists",
                "accounts_count": 3
            }
            
            result = provisioning_service._step_chart_of_accounts(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "exists"
            assert "already exists" in result.message.lower()
    
    def test_step_warehouses_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test successful warehouse creation."""
        mock_onboarding.provisioning_metadata = {"company_name": mock_tenant.name}
        
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list warehouses (empty)
            mock_adapter.proxy_request.return_value = {"data": []}
            
            # Mock create warehouse
            mock_adapter.create_resource.return_value = {"name": "Main Store"}
            
            result = provisioning_service._step_warehouses(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert "Main Store" in result.metadata["warehouse_names"]
            # Should create Main Store and POS Store (if enabled)
            assert mock_adapter.create_resource.call_count >= 1
    
    def test_step_warehouses_idempotent(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test idempotent warehouse creation (warehouses already exist)."""
        mock_onboarding.provisioning_metadata = {"company_name": mock_tenant.name}
        
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list warehouses (warehouses exist)
            mock_adapter.proxy_request.return_value = {
                "data": [{"name": "Main Store"}, {"name": "POS Store"}]
            }
            
            result = provisioning_service._step_warehouses(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert "Main Store" in result.metadata["warehouse_names"]
            # Should not create duplicate warehouses
            mock_adapter.create_resource.assert_not_called()
    
    def test_step_settings_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test successful settings update."""
        mock_onboarding.provisioning_metadata = {
            "company_name": mock_tenant.name,
            "warehouse_names": ["Main Store"]
        }
        
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock get current settings
            mock_adapter.proxy_request.side_effect = [
                {"data": {}},  # Selling Settings
                {"data": {}}   # Stock Settings
            ]
            
            # Mock update settings
            mock_adapter.update_selling_settings.return_value = {"status": "success"}
            mock_adapter.update_stock_settings.return_value = {"status": "success"}
            
            result = provisioning_service._step_settings(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            mock_adapter.update_selling_settings.assert_called_once()
            mock_adapter.update_stock_settings.assert_called_once()
    
    def test_step_customer_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test successful customer creation."""
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list customers (empty - customer doesn't exist)
            mock_adapter.proxy_request.return_value = {"data": []}
            
            # Mock create customer
            mock_adapter.create_resource.return_value = {"name": "Walk-In Customer"}
            
            result = provisioning_service._step_customer(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "completed"
            assert "Walk-In Customer" in result.message
            assert result.metadata["customer_name"] == "Walk-In Customer"
    
    def test_step_customer_idempotent(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test idempotent customer creation (customer already exists)."""
        with patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            # Mock list customers (customer exists)
            mock_adapter.proxy_request.return_value = {
                "data": [{"customer_name": "Walk-In Customer"}]
            }
            
            result = provisioning_service._step_customer(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                mock_onboarding,
                "test-correlation-id"
            )
            
            assert result.status == "exists"
            assert "already exists" in result.message
            # Should not call create_resource
            mock_adapter.create_resource.assert_not_called()
    
    def test_provisioning_full_flow_success(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test full provisioning flow success."""
        # Mock all dependencies
        with patch('app.services.provisioning_service.engine_health_service') as mock_health, \
             patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            
            # Mock engine health check
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc)
            )
            
            # Mock company check and creation
            mock_adapter.proxy_request.side_effect = [
                {"data": []},  # Companies list (empty)
                {"data": []},  # Accounts list (empty)
                {"data": []},  # Warehouses list (empty)
                {"data": []},  # Customers list (empty)
                {"data": []},  # POS sessions list (empty)
                {"data": {}},  # Selling Settings
                {"data": {}}   # Stock Settings
            ]
            
            mock_adapter.create_resource.side_effect = [
                {"name": mock_tenant.name},  # Company
                {"name": "Main Store"},      # Warehouse
                {"name": "POS Store"},       # Warehouse
                {"name": "Walk-In Customer"}, # Customer
                {"name": "Default POS Profile"}, # POS Profile
                {"name": "POS-OPEN-001"}     # POS Session
            ]
            
            mock_adapter.import_chart_of_accounts.return_value = {
                "status": "success",
                "message": "Chart imported",
                "accounts_count": 10
            }
            
            mock_adapter.update_selling_settings.return_value = {"status": "success"}
            mock_adapter.update_stock_settings.return_value = {"status": "success"}
            
            # Mock database queries
            mock_db.query.return_value.filter.return_value.first.side_effect = [
                mock_tenant,  # Get tenant
                None,         # No existing onboarding
            ]
            
            # Execute provisioning
            result = provisioning_service.provision_workspace_to_pos(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                str(uuid.uuid4())
            )
            
            assert result.status.value == "COMPLETED"
            assert result.steps_completed > 0
            assert result.progress == 100.0
    
    def test_provisioning_critical_failure(self, provisioning_service, mock_db, mock_tenant, mock_onboarding, provisioning_config):
        """Test provisioning failure on critical step."""
        with patch('app.services.provisioning_service.engine_health_service') as mock_health, \
             patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            
            # Mock engine health check (online)
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc)
            )
            
            # Mock company creation failure
            mock_adapter.proxy_request.return_value = {"data": []}
            mock_adapter.create_resource.side_effect = HTTPException(
                status_code=500,
                detail="Company creation failed"
            )
            
            # Mock database queries
            mock_db.query.return_value.filter.return_value.first.side_effect = [
                mock_tenant,
                None,
            ]
            
            # Execute provisioning
            result = provisioning_service.provision_workspace_to_pos(
                str(mock_tenant.id),
                provisioning_config,
                mock_db,
                str(uuid.uuid4())
            )
            
            assert result.status.value == "FAILED"
            assert result.current_step == "step_2_company"
            assert len(result.errors) > 0
