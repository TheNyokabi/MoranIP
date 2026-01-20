"""Integration tests for Projects API endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.dependencies.auth import get_current_token_payload
from app.database import get_db
import uuid

client = TestClient(app)


class TestProjectsAPI:
    """Test suite for Projects API endpoints."""
    
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
    
    @patch('app.routers.projects.check_permission')
    @patch('app.routers.projects.erpnext_adapter')
    def test_list_projects(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing projects."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.list_resource.return_value = {
            "data": [
                {"name": "PROJ-001", "project_name": "Project Alpha"},
                {"name": "PROJ-002", "project_name": "Project Beta"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/projects/projects",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.projects.check_permission')
    @patch('app.routers.projects.erpnext_adapter')
    def test_list_tasks(self, mock_adapter, mock_check_permission, mock_user):
        """Test listing tasks."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.list_resource.return_value = {
            "data": [
                {"name": "TASK-001", "subject": "Task 1", "project": "PROJ-001"}
            ]
        }
        
        try:
            response = client.get(
                f"/api/tenants/{tenant_id}/erp/projects/tasks",
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()
    
    @patch('app.routers.projects.check_permission')
    @patch('app.routers.projects.erpnext_adapter')
    def test_create_project(self, mock_adapter, mock_check_permission, mock_user):
        """Test creating project."""
        tenant_id = mock_user['tenant_id']
        app.dependency_overrides[get_current_token_payload] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        
        mock_check_permission.return_value = True
        mock_adapter.create_resource.return_value = {
            "data": {
                "name": "PROJ-001",
                "project_name": "New Project"
            }
        }
        
        try:
            response = client.post(
                f"/api/tenants/{tenant_id}/erp/projects/projects",
                json={
                    "project_name": "New Project",
                    "status": "Open"
                },
                headers={"Authorization": "Bearer test_token"}
            )
            
            assert response.status_code in [200, 201]
        finally:
            app.dependency_overrides.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

