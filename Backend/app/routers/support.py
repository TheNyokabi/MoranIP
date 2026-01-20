"""
Support/Help Desk Router

Handles Help Desk and Support module operations:
- Issues
- Tickets
- Support interactions

Author: MoranERP Team
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Request, status
from sqlalchemy.orm import Session
from app.services.erpnext_client import erpnext_adapter
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.dependencies.permissions import require_permission
from app.database import get_db
from app.middleware.response_normalizer import ResponseNormalizer
from typing import List, Dict, Any

router = APIRouter(
    prefix="/support",
    tags=["Modules - Support"]
)


def check_permission(payload: dict, action: str, doctype: str):
    """Check if user has permission for the given action and doctype."""
    require_permission(payload, f"support:{doctype.lower().replace(' ', '_')}:{action}")


# ==================== Issues ====================

@router.get("/issues")
def list_issues(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Issues."""
    check_permission(payload, "view", "Issue")
    result = erpnext_adapter.list_resource("Issue", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/issues", status_code=status.HTTP_201_CREATED)
def create_issue(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Issue."""
    check_permission(payload, "create", "Issue")
    result = erpnext_adapter.create_resource("Issue", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/issues/{issue_name}")
def get_issue(
    issue_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Issue details."""
    check_permission(payload, "view", "Issue")
    issue = erpnext_adapter.get_resource("Issue", issue_name, tenant_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return ResponseNormalizer.normalize_erpnext(issue)


@router.put("/issues/{issue_name}")
def update_issue(
    issue_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Issue."""
    check_permission(payload, "edit", "Issue")
    result = erpnext_adapter.update_resource("Issue", issue_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)
