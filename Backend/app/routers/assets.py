"""
Asset Management Router

Handles Asset Management module operations:
- Assets
- Asset Maintenance
- Asset Movements
- Depreciation

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
    prefix="/assets",
    tags=["Modules - Assets"]
)


def check_permission(payload: dict, action: str, doctype: str):
    """Check if user has permission for the given action and doctype."""
    require_permission(payload, f"assets:{doctype.lower().replace(' ', '_')}:{action}")


# ==================== Assets ====================

@router.get("/assets")
def list_assets(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Assets."""
    check_permission(payload, "view", "Asset")
    result = erpnext_adapter.list_resource("Asset", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/assets", status_code=status.HTTP_201_CREATED)
def create_asset(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Asset."""
    check_permission(payload, "create", "Asset")
    result = erpnext_adapter.create_resource("Asset", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/assets/{asset_name}")
def get_asset(
    asset_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Asset details."""
    check_permission(payload, "view", "Asset")
    asset = erpnext_adapter.get_resource("Asset", asset_name, tenant_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return ResponseNormalizer.normalize_erpnext(asset)


@router.put("/assets/{asset_name}")
def update_asset(
    asset_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Asset."""
    check_permission(payload, "edit", "Asset")
    result = erpnext_adapter.update_resource("Asset", asset_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


# ==================== Asset Maintenance ====================

@router.get("/maintenance")
def list_maintenance(
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """List Asset Maintenance records."""
    check_permission(payload, "view", "Asset Maintenance")
    result = erpnext_adapter.list_resource("Asset Maintenance", tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.post("/maintenance", status_code=status.HTTP_201_CREATED)
def create_maintenance(
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Create Asset Maintenance record."""
    check_permission(payload, "create", "Asset Maintenance")
    result = erpnext_adapter.create_resource("Asset Maintenance", data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)


@router.get("/maintenance/{maintenance_name}")
def get_maintenance(
    maintenance_name: str,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload)
):
    """Get Asset Maintenance details."""
    check_permission(payload, "view", "Asset Maintenance")
    maintenance = erpnext_adapter.get_resource("Asset Maintenance", maintenance_name, tenant_id)
    if not maintenance:
        raise HTTPException(status_code=404, detail="Asset Maintenance not found")
    return ResponseNormalizer.normalize_erpnext(maintenance)


@router.put("/maintenance/{maintenance_name}")
def update_maintenance(
    maintenance_name: str,
    tenant_id: str = Depends(require_tenant_access),
    data: Dict[str, Any] = Body(...),
    payload: dict = Depends(get_current_token_payload)
):
    """Update Asset Maintenance."""
    check_permission(payload, "edit", "Asset Maintenance")
    result = erpnext_adapter.update_resource("Asset Maintenance", maintenance_name, data, tenant_id)
    return ResponseNormalizer.normalize_erpnext(result)
