from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.iam import Tenant
from app.dependencies.auth import get_current_token_payload

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
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
) -> str:
    """
    Get the ERP engine for the current tenant.
    
    Returns:
        Engine name (e.g., 'erpnext', 'odoo', 'sap')
    """
    tenant_id = token_payload.get("tenant_id")
    
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID not found in token")
    
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Return the engine, default to 'erpnext' if not set
    return tenant.engine or "erpnext"

