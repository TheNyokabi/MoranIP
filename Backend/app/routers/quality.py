"""
Quality Management Router

Handles Quality Management module operations:
- Quality Inspections
- Quality Tests
- Quality Procedures

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
    prefix="/quality",
    tags=["Modules - Quality"]
)


def check_permission(payload: dict, action: str, doctype: str):
    """Check if user has permission for the given action and doctype."""
    require_permission(payload, f"quality:{doctype.lower().replace(' ', '_')}:{action}")


# ==================== Quality Inspections ====================

@router.get("/inspections")
def list_inspections(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Quality Inspections."""
    check_permission(payload, "view", "Quality Inspection")
    result = erpnext_adapter.list_resource("Quality Inspection", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/inspections", status_code=status.HTTP_201_CREATED)
def create_inspection(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Quality Inspection."""
    check_permission(payload, "create", "Quality Inspection")
    result = erpnext_adapter.create_resource("Quality Inspection", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/inspections/{inspection_name}")
def get_inspection(
    inspection_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Quality Inspection details."""
    check_permission(payload, "view", "Quality Inspection")
    inspection = erpnext_adapter.get_resource("Quality Inspection", inspection_name, tenant_id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Quality Inspection not found")
    return ResponseNormalizer.normalize_erpnext(inspection)


@router.put("/inspections/{inspection_name}")
def update_inspection(
    inspection_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Quality Inspection."""
    check_permission(payload, "edit", "Quality Inspection")
    result = erpnext_adapter.update_resource("Quality Inspection", inspection_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Quality Tests ====================

@router.get("/tests")
def list_tests(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Quality Tests."""
    check_permission(payload, "view", "Quality Test")
    result = erpnext_adapter.list_resource("Quality Test", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/tests", status_code=status.HTTP_201_CREATED)
def create_test(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Quality Test."""
    check_permission(payload, "create", "Quality Test")
    result = erpnext_adapter.create_resource("Quality Test", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/tests/{test_name}")
def get_test(
    test_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Quality Test details."""
    check_permission(payload, "view", "Quality Test")
    test = erpnext_adapter.get_resource("Quality Test", test_name, tenant_id)
    if not test:
        raise HTTPException(status_code=404, detail="Quality Test not found")
    return ResponseNormalizer.normalize_erpnext(test)


@router.put("/tests/{test_name}")
def update_test(
    test_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Quality Test."""
    check_permission(payload, "edit", "Quality Test")
    result = erpnext_adapter.update_resource("Quality Test", test_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)
