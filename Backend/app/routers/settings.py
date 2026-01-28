from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from uuid import UUID
from app.database import get_db
from app.models.iam import TenantSettings, Tenant
from app.dependencies.auth import require_tenant_access, get_current_user
from datetime import datetime

router = APIRouter(
    prefix="/settings",
    tags=["Tenant Settings"],
)

class TenantSettingsRequest(BaseModel):
    # Company Information
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    business_type: Optional[str] = None
    registration_number: Optional[str] = None
    tax_id: Optional[str] = None
    
    # Contact Information
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    # Address
    street_address: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    
    # Financial Settings
    currency: str = "KES"
    fiscal_year_start_month: int = 1
    accounting_method: str = "accrual"
    
    # Business Settings
    industry: Optional[str] = None
    employees_count: Optional[int] = None
    annual_revenue: Optional[str] = None
    
    # Feature Toggles
    enable_invoicing: bool = True
    enable_pos: bool = False
    enable_inventory: bool = True
    enable_hr: bool = False
    enable_projects: bool = False
    
    # Configuration
    logo_url: Optional[str] = None
    language: str = "en"
    timezone: str = "Africa/Nairobi"
    
    setup_completed: bool = False

class TenantSettingsResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    company_name: Optional[str]
    legal_name: Optional[str]
    business_type: Optional[str]
    registration_number: Optional[str]
    tax_id: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    street_address: Optional[str]
    city: Optional[str]
    state_province: Optional[str]
    postal_code: Optional[str]
    country: Optional[str]
    currency: str
    fiscal_year_start_month: int
    accounting_method: str
    industry: Optional[str]
    employees_count: Optional[int]
    annual_revenue: Optional[str]
    enable_invoicing: bool
    enable_pos: bool
    enable_inventory: bool
    enable_hr: bool
    enable_projects: bool
    logo_url: Optional[str]
    language: str
    timezone: str
    setup_completed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ModuleTogglesRequest(BaseModel):
    """Request to update module enable/disable flags"""
    enable_invoicing: Optional[bool] = None
    enable_pos: Optional[bool] = None
    enable_inventory: Optional[bool] = None
    enable_hr: Optional[bool] = None
    enable_projects: Optional[bool] = None

@router.get("/tenant")
def get_tenant_settings(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get Tenant Settings.
    Returns the configuration for the current tenant.
    """
    settings = db.query(TenantSettings).filter(
        TenantSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        # Create default settings if they don't exist
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        settings = TenantSettings(
            tenant_id=tenant_id,
            company_name=tenant.name,
            country=tenant.country_code
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    settings_data = TenantSettingsResponse.model_validate(settings)
    return {"data": settings_data}

@router.post("/tenant")
def create_or_update_tenant_settings(
    req: TenantSettingsRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create or Update Tenant Settings.
    Updates the configuration for the current tenant.
    """
    settings = db.query(TenantSettings).filter(
        TenantSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)
    
    # Update fields
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    settings_data = TenantSettingsResponse.model_validate(settings)
    return {"data": settings_data}

@router.patch("/tenant")
def patch_tenant_settings(
    req: TenantSettingsRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Partially Update Tenant Settings.
    Only provided fields are updated.
    """
    settings = db.query(TenantSettings).filter(
        TenantSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)
    
    # Update only provided fields
    for field, value in req.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    settings_data = TenantSettingsResponse.model_validate(settings)
    return {"data": settings_data}

@router.patch("/tenant/modules")
def update_tenant_modules(
    req: ModuleTogglesRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Update Tenant Module Toggles.
    Enable or disable specific modules for the tenant.
    Requires ADMIN or OWNER role.
    """
    # Check if user has admin permissions
    user_role = current_user.get("role", "")
    if user_role not in ["ADMIN", "OWNER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or OWNER can modify module settings"
        )
    
    # Get or create settings
    settings = db.query(TenantSettings).filter(
        TenantSettings.tenant_id == tenant_id
    ).first()
    
    if not settings:
        settings = TenantSettings(tenant_id=tenant_id)
        db.add(settings)
    
    # Update module toggles
    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    settings_data = TenantSettingsResponse.model_validate(settings)
    return {"data": settings_data, "message": "Module settings updated successfully"}
