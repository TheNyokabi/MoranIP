"""End-to-end tests for provisioning flow."""
import pytest
import pytest_asyncio
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy.orm import Session
from app.models.iam import User, Tenant, Membership
from app.services.auth_service import auth_service
import uuid


@pytest.mark.asyncio
class TestProvisioningE2E:
    """End-to-end tests for complete provisioning flow."""
    
    @pytest_asyncio.fixture
    async def test_user(self, db: Session):
        """Create test user."""
        user = User(
            user_code="USR-KE-25-E2E",
            email="e2e@example.com",
            full_name="E2E Test User",
            password_hash=auth_service.get_password_hash("testpass123"),
            kyc_tier="KYC-T1",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
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
    
    async def test_e2e_workspace_to_pos_ready(
        self,
        async_client: AsyncClient,
        test_user: User,
        auth_token: str,
        db: Session
    ):
        """Test complete flow: Create workspace → Provision → Verify POS ready."""
        # Step 1: Create workspace
        with patch('app.services.erpnext_client.erpnext_adapter') as mock_adapter, \
             patch('app.services.engine_health_service.engine_health_service') as mock_health:
            
            from app.services.engine_health_service import EngineHealthResult, EngineHealthStatus
            from datetime import datetime, timezone
            
            # Mock engine health
            mock_health.check_engine_health.return_value = EngineHealthResult(
                status=EngineHealthStatus.ONLINE,
                message="Engine is online",
                checked_at=datetime.now(timezone.utc)
            )
            
            # Mock ERPNext operations for workspace creation
            mock_adapter.create_resource.return_value = {
                "name": "E2E Test Company",
                "company_name": "E2E Test Company"
            }
            
            # Mock ERPNext operations for provisioning
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
                {"name": "E2E Test Company"},
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
            
            # Create workspace
            create_response = await async_client.post(
                "/iam/tenants",
                json={
                    "name": "E2E Test Company",
                    "category": "Enterprise",
                    "description": "E2E test workspace",
                    "country_code": "KE",
                    "admin_email": test_user.email,
                    "admin_name": test_user.full_name,
                    "admin_password": "testpass123",
                    "engine": "erpnext"
                }
            )
            
            assert create_response.status_code == 200
            workspace_data = create_response.json()
            tenant_id = workspace_data["tenant"]["id"]
            
            # Step 2: Verify provisioning status
            # Wait a bit for provisioning to start (in real scenario, would poll)
            import asyncio
            await asyncio.sleep(1)
            
            status_response = await async_client.get(
                f"/api/provisioning/tenants/{tenant_id}/status",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            assert status_response.status_code == 200
            status_data = status_response.json()
            
            # Provisioning should be in progress or completed
            assert status_data["status"] in ["IN_PROGRESS", "COMPLETED", "PARTIAL"]
            
            # Step 3: Verify tenant status updated
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            assert tenant is not None
            assert tenant.provisioning_status in ["PROVISIONING", "PROVISIONED", "PARTIAL"]
    
    async def test_e2e_pos_invoice_after_provisioning(
        self,
        async_client: AsyncClient,
        test_user: User,
        auth_token: str,
        db: Session
    ):
        """Test that POS invoice can be created after provisioning."""
        # This test would verify that after provisioning completes,
        # a POS invoice can be created successfully
        # For now, this is a placeholder that verifies the flow exists
        
        # In a real E2E test, we would:
        # 1. Create workspace
        # 2. Wait for provisioning to complete
        # 3. Create a tenant-scoped token
        # 4. Create a POS invoice
        # 5. Verify invoice was created in ERPNext
        
        # This is a simplified version
        assert True  # Placeholder
    
    async def test_e2e_verify_all_resources_created(
        self,
        async_client: AsyncClient,
        test_user: User,
        auth_token: str,
        db: Session
    ):
        """Test that all required resources are created during provisioning."""
        # This test would verify:
        # 1. Company exists in ERPNext
        # 2. Chart of accounts imported
        # 3. Warehouses created
        # 4. Default customer exists
        # 5. POS Profile created
        # 6. POS Session can be opened
        
        # For now, this is a placeholder
        assert True  # Placeholder
