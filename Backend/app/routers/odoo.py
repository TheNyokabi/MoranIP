from fastapi import APIRouter, Depends, HTTPException, Body
from app.services.odoo_client import odoo_adapter
from app.dependencies.tenant import get_tenant_id
from app.dependencies.permissions import get_current_user_permissions
from app.dependencies.auth import get_current_user
from typing import List

router = APIRouter(
    prefix="/odoo",
    tags=["Engines - Odoo"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(get_tenant_id)] # Tenant context required for ALL engine calls
)

@router.post("/auth")
def authenticate_engine(
    tenant_id: str = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    permissions: List[str] = Depends(get_current_user_permissions)
):
    """
    [INTERNAL] Authenticate the Tenant's System User against the Odoo Engine.
    Used for health checks and connectivity verification.
    Requires: odoo:system:auth permission
    """
    # Check permission
    if "odoo:system:auth" not in permissions and "*:*:*" not in permissions:
        raise HTTPException(
            status_code=403,
            detail="Permission denied: odoo:system:auth required"
        )
    
    uid = odoo_adapter.authenticate_system(tenant_id)
    return {
        "status": "connected",
        "tenant_id": tenant_id,
        "engine_uid": uid,
        "message": "Engine authentication successful"
    }

@router.get("/internal/{model}")
def execute_generic(
    model: str, 
    method: str = "search_read", 
    limit: int = 10, 
    tenant_id: str = Depends(get_tenant_id),
    current_user: dict = Depends(get_current_user),
    permissions: List[str] = Depends(get_current_user_permissions)
):
    """
    [INTERNAL] Generic wrapper for Odoo model execution.
    WARNING: Direct engine access. For system administrators only.
    Requires: odoo:*:admin permission (SUPER_ADMIN only)
    """
    # Check permission - only SUPER_ADMIN should have this
    if "odoo:*:admin" not in permissions and "*:*:*" not in permissions:
        raise HTTPException(
            status_code=403,
            detail="Permission denied: odoo:*:admin required (SUPER_ADMIN only)"
        )
    
    return odoo_adapter.execute_kw(
        tenant_id=tenant_id,
        model=model,
        method=method,
        kwargs={'limit': limit}
    )
