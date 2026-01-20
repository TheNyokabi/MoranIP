"""Integration tests for HR API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid

client = TestClient(app)


class TestHRAPI:
    """Test suite for HR API endpoints."""
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        return {
            "user_id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "email": "test@example.com",
            "roles": ["ADMIN"],
            "user_code": "USER001"
        }
    
    @patch('app.routers.hr.check_permission')
    @patch('app.routers.hr.erpnext_adapter')
    def test_list_employees(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing employees."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.list_resource.return_value = {
            "data": [
                {"name": "EMP-001", "employee_name": "John Doe"},
                {"name": "EMP-002", "employee_name": "Jane Smith"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/hr/employees",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.hr.check_permission')
    @patch('app.routers.hr.erpnext_adapter')
    def test_create_employee(self, mock_adapter, mock_check_permission, mock_user):
        """Test creating employee."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.create_resource.return_value = {
            "data": {
                "name": "EMP-001",
                "employee_name": "New Employee"
            }
        }
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/hr/employees",
                json={
                    "employee_name": "New Employee",
                    "date_of_joining": "2026-01-09"
                },
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.hr.check_permission')
    @patch('app.routers.hr.erpnext_adapter')
    def test_list_attendance(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing attendance records."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.list_resource.return_value = {
            "data": [
                {"name": "ATT-001", "employee": "EMP-001", "attendance_date": "2026-01-09"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/hr/attendance",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

