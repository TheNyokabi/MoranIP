"""
PoS Service Factory - Multi-tenant aware
"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies.auth import get_current_token_payload, require_tenant_access
from app.models.iam import Tenant
from .pos_service_base import PosServiceBase
from .erpnext_pos_service import ErpnextPosService
from app.config import settings


async def get_pos_service(
    tenant_id: str = Depends(require_tenant_access),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
) -> PosServiceBase:
    """
    Factory function to get appropriate PoS service based on tenant.
    
    Now properly extracts tenant from JWT and ensures multi-tenant isolation.
    
    Args:
        token_payload: JWT payload containing tenant_id
        db: Database session
        
    Returns:
        PosServiceBase implementation with proper tenant context
        
    Raises:
        HTTPException: If tenant not found or unauthorized
    """
    
    # Get tenant from database to get engine and credentials
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail={"type": "tenant_not_found", "message": f"Tenant {tenant_id} not found"}
        )
    
    # Get engine (default to erpnext)
    engine = tenant.engine or "erpnext"
    
    if engine == "erpnext":
        return ErpnextPosService(
            tenant_id=tenant_id,  # Pass tenant_id for multi-tenancy
            company_name=tenant.name,  # Pass tenant's company name
            base_url=settings.ERPNEXT_HOST,
            username=settings.ERPNEXT_USER,
            password=settings.ERPNEXT_PASSWORD
        )
    else:
        raise HTTPException(
            status_code=400,
            detail={"type": "unsupported_engine", "message": f"Engine {engine} not supported for POS"}
        )
