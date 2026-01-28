from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/projects",
    tags=["Modules - Projects"]
)


def check_permission(tenant_id: str, action: str, doctype: str = ""):
    """Check projects permission.
    
    Args:
        tenant_id: The tenant_id resolved by require_tenant_access (from token or X-Tenant-ID header)
        action: The action being performed (view, create, update, delete)
        doctype: The ERPNext doctype being accessed
    """
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant access required")
    return True


# ==================== Configuration (Master Data) ====================

@router.get("/project-templates")
def list_project_templates(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """List Project Templates."""
    check_permission(tenant_id, "view", "Project Template")
    result = erpnext_adapter.list_resource("Project Template", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/project-templates", status_code=status.HTTP_201_CREATED)
def create_project_template(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Create Project Template."""
    check_permission(tenant_id, "create", "Project Template")
    result = erpnext_adapter.create_resource("Project Template", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/project-templates/{template_name}")
def get_project_template(
    template_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Get Project Template details."""
    check_permission(tenant_id, "view", "Project Template")
    template = erpnext_adapter.get_resource("Project Template", template_name, tenant_id)
    if not template:
        raise HTTPException(status_code=404, detail="Project Template not found")
    return template


@router.put("/project-templates/{template_name}")
def update_project_template(
    template_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload),
):
    """Update Project Template."""
    check_permission(tenant_id, "edit", "Project Template")
    result = erpnext_adapter.update_resource("Project Template", template_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.delete("/project-templates/{template_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_template(
    template_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
):
    """Delete Project Template."""
    check_permission(tenant_id, "delete", "Project Template")
    erpnext_adapter.delete_resource("Project Template", template_name, tenant_id)
    return None


# ==================== Projects ====================

@router.get("/projects")
def list_projects(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Projects.
    
    Query parameters: status (Active|Completed|Closed), customer
    """
    check_permission(tenant_id, "view", "Project")
    result = erpnext_adapter.list_resource("Project", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Project.
    
    Required fields:
    - project_name: str
    - customer: Customer name
    - status: "Active" | "Completed" | "Closed"
    - start_date: date
    """
    check_permission(tenant_id, "create", "Project")
    result = erpnext_adapter.create_resource("Project", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/projects/{project_name}")
def get_project(
    project_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Project details including tasks and progress."""
    check_permission(tenant_id, "view", "Project")
    project = erpnext_adapter.get_resource("Project", project_name, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ResponseNormalizer.normalize_erpnext(project)
@router.put("/projects/{project_name}")
def update_project(
    project_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Project details (status, dates, etc)."""
    check_permission(tenant_id, "edit", "Project")
    result = erpnext_adapter.update_resource("Project", project_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Tasks ====================

@router.get("/tasks")
def list_tasks(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """
    List Tasks.
    
    Can filter by project or status
    """
    check_permission(tenant_id, "view", "Task")
    result = erpnext_adapter.list_resource("Task", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/tasks", status_code=status.HTTP_201_CREATED)
def create_task(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Task.
    
    Required fields:
    - title: str
    - project: Project name
    - assigned_to: User email
    - status: "Open" | "Working" | "Completed" | "Closed"
    """
    check_permission(tenant_id, "create", "Task")
    result = erpnext_adapter.create_resource("Task", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/tasks/{task_name}")
def get_task(
    task_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Task details with progress and assignments."""
    check_permission(tenant_id, "view", "Task")
    task = erpnext_adapter.get_resource("Task", task_name, tenant_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return ResponseNormalizer.normalize_erpnext(task)
@router.put("/tasks/{task_name}")
def update_task(
    task_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Task (status, assignments, dates, etc)."""
    check_permission(tenant_id, "edit", "Task")
    result = erpnext_adapter.update_resource("Task", task_name, data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Timesheets ====================

@router.get("/timesheets")
def list_timesheets(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Timesheets for time tracking."""
    check_permission(tenant_id, "view", "Timesheet")
    result = erpnext_adapter.list_resource("Timesheet", tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/timesheets", status_code=status.HTTP_201_CREATED)
def create_timesheet(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """
    Create Timesheet.
    
    Required fields:
    - employee: Employee ID
    - start_date: date
    - time_logs: [{task, hours, completed}]
    """
    check_permission(tenant_id, "create", "Timesheet")
    result = erpnext_adapter.create_resource("Timesheet", data, tenant_id)

    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/timesheets/{timesheet_name}")
def get_timesheet(
    timesheet_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Timesheet with detailed time logs."""
    check_permission(tenant_id, "view", "Timesheet")
    timesheet = erpnext_adapter.get_resource("Timesheet", timesheet_name, tenant_id)
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    return ResponseNormalizer.normalize_erpnext(timesheet)