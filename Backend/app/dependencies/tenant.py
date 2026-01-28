from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session
import re
from typing import Optional
from app.database import get_db
from app.models.iam import Tenant
from app.dependencies.auth import get_current_token_payload

def _extract_tenant_from_path(path: str) -> Optional[str]:
    """Extract tenant_id from URL path like /api/tenants/{tenant_id}/..."""
    match = re.search(r'/tenants/([^/]+)/', path)
    if match:
        return match.group(1)
    return None

async def get_tenant_id(x_tenant_id: str = Header(..., alias="X-Tenant-ID")):
    """
    Extracts and validates the X-Tenant-ID header.
    In a real system, this would verify the tenant exists in a Tenant Registry.
    """
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is missing")
    
    # Mock validation: allow 'demo' and 'moran'
    allowed_tenants = ["demo", "moran"]
    if x_tenant_id not in allowed_tenants:
        raise HTTPException(status_code=403, detail="Invalid or unauthorized Tenant ID")
    
    return x_tenant_id


async def get_tenant_engine(
    request: Request,
    token_payload: dict = Depends(get_current_token_payload),
    x_tenant_id: str = Header(None, alias="X-Tenant-ID"),
    db: Session = Depends(get_db)
) -> str:
    """
    Get the ERP engine for the current tenant.
    
    Priority:
    1. tenant_id from JWT token (if present)
    2. tenant_id from URL path (if present, e.g., /api/tenants/{tenant_id}/...)
    3. X-Tenant-ID header (if present)
    
    Returns:
        Engine name (e.g., 'erpnext', 'odoo', 'sap')
    """
    import uuid
    
    # Extract tenant_id from URL path
    path_tenant_id = _extract_tenant_from_path(request.url.path)
    
    # Priority: token > path > header
    tenant_id = token_payload.get("tenant_id")
    
    if not tenant_id and path_tenant_id:
        tenant_id = path_tenant_id
    
    if not tenant_id and x_tenant_id:
        tenant_id = x_tenant_id
    
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID not found in token, URL path, or X-Tenant-ID header")
    
    # tenant_id can be UUID or tenant_code (e.g., TEN-KE-26-8K1E0)
    try:
        # Try parsing as UUID first
        tenant_uuid = uuid.UUID(tenant_id)
        tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
    except (ValueError, TypeError):
        # Not a UUID, try as tenant_code
        tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail=f"Tenant not found: {tenant_id}")
    
    # Return the engine, default to 'erpnext' if not set
    return tenant.engine or "erpnext"

