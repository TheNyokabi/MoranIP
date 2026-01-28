"""Integration tests for Provisioning API endpoints."""
import pytest
import pytest_asyncio
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy.orm import Session
from app.models.iam import User, Tenant, Membership
from app.models.onboarding import TenantOnboarding
from app.services.auth_service import auth_service
import uuid


@pytest.mark.asyncio
class TestProvisioningAPI:
    """Test suite for Provisioning API endpoints."""
    
    @pytest_asyncio.fixture
    async def test_user(self, db: Session):
        """Create test user."""
        user = User(
            user_code="USR-KE-25-TEST",
            email="test@example.com",
            full_name="Test User",
            password_hash=auth_service.get_password_hash("testpass123"),
            kyc_tier="KYC-T1",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @pytest_asyncio.fixture
    async def test_tenant(self, db: Session, test_user):
        """Create test tenant."""
        tenant = Tenant(
            tenant_code="TEN-KE-25-TEST",
            name="Test Tenant",
            country_code="KE",
            status="ACTIVE",
            engine="erpnext",
            provisioning_status="NOT_PROVISIONED"
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        
        # Create membership
        membership = Membership(
            user_id=test_user.id,
            tenant_id=tenant.id,
            role="ADMIN",
            status="ACTIVE"
        )
        db.add(membership)
        db.commit()
        
        return tenant
    
    @pytest_asyncio.fixture
    async def auth_token(self, async_client: AsyncClient, test_user):
        """Get auth token for test user."""
        response = await async_client.post(
            "/auth/login",
            json={
                "email": test_user.email,
                "password": "testpass123"
            }
        )
        assert response.status_code == 200
        data = response.json()
        return data["access_token"]
    
    async def test_start_provisioning_success(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test successful provisioning start."""
        with patch('app.services.engine_health_service.engine_health_service') as mock_health, \
             patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            
            # Mock engine health check
            from app.services.engine_health_service import EngineHealthResult, EngineHealthStatus
            from datetime import datetime, timezone
            
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc)
            )
            
            # Mock ERPNext operations
            mock_adapter.proxy_request.side_effect = [
                {"data": []},  # Companies
                {"data": []},  # Accounts
                {"data": []},  # Warehouses
                {"data": []},  # Customers
                {"data": []},  # POS Sessions
                {"data": {}},  # Selling Settings
                {"data": {}}   # Stock Settings
            ]
            
            mock_adapter.create_resource.side_effect = [
                {"name": test_tenant.name},
                {"name": "Main Store"},
                {"name": "POS Store"},
                {"name": "Walk-In Customer"},
                {"name": "Default POS Profile"},
                {"name": "POS-OPEN-001"}
            ]
            
            mock_adapter.import_chart_of_accounts.return_value = {
                "status": "success",
                "accounts_count": 10
            }
            
            mock_adapter.update_selling_settings.return_value = {"status": "success"}
            mock_adapter.update_stock_settings.return_value = {"status": "success"}
            
            response = await async_client.post(
                f"/api/provisioning/tenants/{test_tenant.id}/start",
                json={
                    "include_demo_data": False,
                    "pos_store_enabled": True
                },
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            # Note: Provisioning may take time, so we check for either success or in-progress
            assert response.status_code in [200, 202]
            data = response.json()
            assert "status" in data
            assert data["status"] in ["IN_PROGRESS", "COMPLETED", "FAILED"]
    
    async def test_start_provisioning_engine_offline(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str
    ):
        """Test provisioning start with engine offline."""
        with patch('app.services.engine_health_service.engine_health_service') as mock_health:
            from app.services.engine_health_service import EngineHealthResult, EngineHealthStatus
            from datetime import datetime, timezone
            
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.OFFLINE,
                message="Engine is offline",
                checked_at=datetime.now(timezone.utc),
                error="Connection failed"
            )
            
            response = await async_client.post(
                f"/api/provisioning/tenants/{test_tenant.id}/start",
                json={},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            assert response.status_code == 503
            data = response.json()
            assert "engine_offline" in data.get("detail", {}).get("type", "")
    
    async def test_get_provisioning_status(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test get provisioning status."""
        # Create onboarding record
        onboarding = TenantOnboarding(
            tenant_id=test_tenant.id,
            template="FULL_POS",
            status="IN_PROGRESS",
            provisioning_type="FULL_POS",
            provisioning_steps={
                "step_0_engine_check": {"status": "completed"},
                "step_2_company": {"status": "completed"}
            },
            provisioning_metadata={"company_name": test_tenant.name}
        )
        db.add(onboarding)
        test_tenant.provisioning_status = "PROVISIONING"
        db.commit()
        
        response = await async_client.get(
            f"/api/provisioning/tenants/{test_tenant.id}/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "progress" in data
        assert "steps_completed" in data
        assert "total_steps" in data
    
    async def test_get_provisioning_status_not_started(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str
    ):
        """Test get provisioning status when not started."""
        response = await async_client.get(
            f"/api/provisioning/tenants/{test_tenant.id}/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "NOT_STARTED"
        assert data["progress"] == 0
    
    async def test_retry_provisioning(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test retry provisioning."""
        # Create failed onboarding
        onboarding = TenantOnboarding(
            tenant_id=test_tenant.id,
            template="FULL_POS",
            status="FAILED",
            provisioning_type="FULL_POS",
            provisioning_steps={
                "step_0_engine_check": {"status": "completed"},
                "step_2_company": {"status": "failed", "error": "Company creation failed"}
            },
            error_message="Company creation failed",
            error_step="step_2_company"
        )
        db.add(onboarding)
        test_tenant.provisioning_status = "FAILED"
        db.commit()
        
        with patch('app.services.engine_health_service.engine_health_service') as mock_health, \
             patch('app.services.provisioning_service.erpnext_adapter') as mock_adapter:
            
            from app.services.engine_health_service import EngineHealthResult, EngineHealthStatus
            from datetime import datetime, timezone
            
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc)
            )
            
            mock_adapter.proxy_request.return_value = {"data": []}
            mock_adapter.create_resource.return_value = {"name": test_tenant.name}
            mock_adapter.import_chart_of_accounts.return_value = {
                "status": "success",
                "accounts_count": 10
            }
            
            response = await async_client.post(
                f"/api/provisioning/tenants/{test_tenant.id}/retry",
                json={},
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            # Should accept retry request
            assert response.status_code in [200, 202]
    
    async def test_skip_step(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test skip optional step."""
        onboarding = TenantOnboarding(
            tenant_id=test_tenant.id,
            template="FULL_POS",
            status="IN_PROGRESS",
            provisioning_type="FULL_POS",
            provisioning_steps={}
        )
        db.add(onboarding)
        db.commit()
        
        response = await async_client.post(
            f"/api/provisioning/tenants/{test_tenant.id}/skip-step",
            json={"step": "step_6_items"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    async def test_get_provisioning_logs(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test get provisioning logs."""
        onboarding = TenantOnboarding(
            tenant_id=test_tenant.id,
            template="FULL_POS",
            status="IN_PROGRESS",
            provisioning_type="FULL_POS",
            provisioning_steps={
                "step_0_engine_check": {
                    "status": "completed",
                    "message": "Engine check passed",
                    "completed_at": "2024-01-01T12:00:00Z",
                    "duration_ms": 100.0
                },
                "step_2_company": {
                    "status": "completed",
                    "message": "Company created",
                    "completed_at": "2024-01-01T12:01:00Z",
                    "duration_ms": 500.0
                }
            }
        )
        db.add(onboarding)
        db.commit()
        
        response = await async_client.get(
            f"/api/provisioning/tenants/{test_tenant.id}/logs",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert len(data["logs"]) == 2
    
    async def test_concurrent_provisioning_prevention(
        self,
        async_client: AsyncClient,
        test_tenant: Tenant,
        auth_token: str,
        db: Session
    ):
        """Test that concurrent provisioning is prevented."""
        # Set tenant to PROVISIONING
        test_tenant.provisioning_status = "PROVISIONING"
        db.commit()
        
        response = await async_client.post(
            f"/api/provisioning/tenants/{test_tenant.id}/start",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 409
        data = response.json()
        assert "already_provisioning" in data.get("detail", {}).get("type", "")
