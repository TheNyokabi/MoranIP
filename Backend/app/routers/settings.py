from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional, Dict, Any
from uuid import UUID
from app.database import get_db
from app.models.iam import TenantSettings, Tenant, TenantSecuritySettings, TenantNotificationSettings
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
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    @model_validator(mode='before')
    @classmethod
    def clean_empty_strings(cls, data: Any) -> Any:
        """Convert empty strings to None for optional fields"""
        if isinstance(data, dict):
            # Convert empty strings to None for optional string fields
            optional_string_fields = [
                'legal_name', 'business_type', 'registration_number', 'tax_id',
                'email', 'phone', 'website',
                'street_address', 'city', 'state_province', 'postal_code', 'country',
                'industry', 'annual_revenue', 'logo_url', 'company_name'
            ]
            for field in optional_string_fields:
                if field in data and data[field] == '':
                    data[field] = None
            # Handle employees_count - convert empty string to None
            if 'employees_count' in data:
                if data['employees_count'] == '' or data['employees_count'] is None:
                    data['employees_count'] = None
                else:
                    # Ensure it's an integer
                    try:
                        data['employees_count'] = int(data['employees_count'])
                    except (ValueError, TypeError):
                        data['employees_count'] = None
        return data
    
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
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to retrieve settings: {str(e)}"
            }
        )

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
    try:
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
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to update settings: {str(e)}"
            }
        )

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
    try:
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
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to update settings: {str(e)}"
            }
        )

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
    try:
        # Check if user has admin permissions
        user_role = current_user.get("role", "")
        if user_role not in ["ADMIN", "OWNER"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "type": "permission_denied",
                    "message": "Only ADMIN or OWNER can modify module settings"
                }
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
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to update module settings: {str(e)}"
            }
        )

# ==================== SECURITY SETTINGS ====================

class SecuritySettingsRequest(BaseModel):
    min_password_length: Optional[int] = None
    require_uppercase: Optional[bool] = None
    require_lowercase: Optional[bool] = None
    require_numbers: Optional[bool] = None
    require_special_chars: Optional[bool] = None
    password_expiry_days: Optional[int] = None
    session_timeout_minutes: Optional[int] = None
    max_concurrent_sessions: Optional[int] = None
    require_mfa: Optional[bool] = None
    ip_whitelist_enabled: Optional[bool] = None
    ip_whitelist: Optional[list[str]] = None
    block_suspicious_activity: Optional[bool] = None
    enable_audit_log: Optional[bool] = None
    log_failed_login_attempts: Optional[bool] = None
    log_sensitive_operations: Optional[bool] = None

class SecuritySettingsResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    min_password_length: int
    require_uppercase: bool
    require_lowercase: bool
    require_numbers: bool
    require_special_chars: bool
    password_expiry_days: int
    session_timeout_minutes: int
    max_concurrent_sessions: int
    require_mfa: bool
    ip_whitelist_enabled: bool
    ip_whitelist: list[str]
    block_suspicious_activity: bool
    enable_audit_log: bool
    log_failed_login_attempts: bool
    log_sensitive_operations: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/security")
def get_security_settings(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get Tenant Security Settings.
    Returns the security configuration for the current tenant.
    """
    try:
        settings = db.query(TenantSecuritySettings).filter(
            TenantSecuritySettings.tenant_id == tenant_id
        ).first()
        
        if not settings:
            # Create default settings if they don't exist
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise HTTPException(status_code=404, detail="Tenant not found")
            
            settings = TenantSecuritySettings(tenant_id=tenant_id)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        # Convert JSONB to list if needed
        ip_whitelist = settings.ip_whitelist
        if ip_whitelist is None:
            ip_whitelist = []
        elif not isinstance(ip_whitelist, list):
            try:
                import json
                if isinstance(ip_whitelist, str):
                    ip_whitelist = json.loads(ip_whitelist)
                else:
                    ip_whitelist = list(ip_whitelist) if ip_whitelist else []
            except:
                ip_whitelist = []
        
        settings_data = SecuritySettingsResponse(
            id=settings.id,
            tenant_id=settings.tenant_id,
            min_password_length=settings.min_password_length,
            require_uppercase=settings.require_uppercase,
            require_lowercase=settings.require_lowercase,
            require_numbers=settings.require_numbers,
            require_special_chars=settings.require_special_chars,
            password_expiry_days=settings.password_expiry_days,
            session_timeout_minutes=settings.session_timeout_minutes,
            max_concurrent_sessions=settings.max_concurrent_sessions,
            require_mfa=settings.require_mfa,
            ip_whitelist_enabled=settings.ip_whitelist_enabled,
            ip_whitelist=ip_whitelist,
            block_suspicious_activity=settings.block_suspicious_activity,
            enable_audit_log=settings.enable_audit_log,
            log_failed_login_attempts=settings.log_failed_login_attempts,
            log_sensitive_operations=settings.log_sensitive_operations,
            created_at=settings.created_at,
            updated_at=settings.updated_at,
        )
        return {"data": settings_data}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to retrieve security settings: {str(e)}"
            }
        )

@router.patch("/security")
def patch_security_settings(
    req: SecuritySettingsRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Partially Update Tenant Security Settings.
    Only provided fields are updated.
    Requires ADMIN or OWNER role.
    """
    try:
        # Check if user has admin permissions
        user_role = current_user.get("role", "")
        if user_role not in ["ADMIN", "OWNER"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "type": "permission_denied",
                    "message": "Only ADMIN or OWNER can modify security settings"
                }
            )
        
        settings = db.query(TenantSecuritySettings).filter(
            TenantSecuritySettings.tenant_id == tenant_id
        ).first()
        
        if not settings:
            settings = TenantSecuritySettings(tenant_id=tenant_id)
            db.add(settings)
        
        # Update only provided fields
        for field, value in req.model_dump(exclude_unset=True).items():
            if value is not None:
                # Special handling for ip_whitelist to ensure it's stored as JSONB list
                if field == 'ip_whitelist' and isinstance(value, list):
                    setattr(settings, field, value)
                else:
                    setattr(settings, field, value)
        
        db.commit()
        db.refresh(settings)
        
        # Convert JSONB to list if needed
        ip_whitelist = settings.ip_whitelist
        if ip_whitelist is None:
            ip_whitelist = []
        elif not isinstance(ip_whitelist, list):
            try:
                import json
                if isinstance(ip_whitelist, str):
                    ip_whitelist = json.loads(ip_whitelist)
                else:
                    ip_whitelist = list(ip_whitelist) if ip_whitelist else []
            except:
                ip_whitelist = []
        
        settings_data = SecuritySettingsResponse(
            id=settings.id,
            tenant_id=settings.tenant_id,
            min_password_length=settings.min_password_length,
            require_uppercase=settings.require_uppercase,
            require_lowercase=settings.require_lowercase,
            require_numbers=settings.require_numbers,
            require_special_chars=settings.require_special_chars,
            password_expiry_days=settings.password_expiry_days,
            session_timeout_minutes=settings.session_timeout_minutes,
            max_concurrent_sessions=settings.max_concurrent_sessions,
            require_mfa=settings.require_mfa,
            ip_whitelist_enabled=settings.ip_whitelist_enabled,
            ip_whitelist=ip_whitelist,
            block_suspicious_activity=settings.block_suspicious_activity,
            enable_audit_log=settings.enable_audit_log,
            log_failed_login_attempts=settings.log_failed_login_attempts,
            log_sensitive_operations=settings.log_sensitive_operations,
            created_at=settings.created_at,
            updated_at=settings.updated_at,
        )
        return {"data": settings_data}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to update security settings: {str(e)}"
            }
        )

# ==================== NOTIFICATION SETTINGS ====================

class NotificationSettingsRequest(BaseModel):
    email_enabled: Optional[bool] = None
    email_new_user_invite: Optional[bool] = None
    email_role_changes: Optional[bool] = None
    email_payment_received: Optional[bool] = None
    email_invoice_generated: Optional[bool] = None
    email_order_status_change: Optional[bool] = None
    email_low_stock_alert: Optional[bool] = None
    email_monthly_report: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    in_app_new_messages: Optional[bool] = None
    in_app_task_assignments: Optional[bool] = None
    in_app_approval_requests: Optional[bool] = None
    in_app_system_updates: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    sms_order_confirmation: Optional[bool] = None
    sms_payment_received: Optional[bool] = None
    sms_important_alerts: Optional[bool] = None
    push_enabled: Optional[bool] = None
    push_instant_alerts: Optional[bool] = None
    push_daily_summary: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    digest_frequency: Optional[str] = None

class NotificationSettingsResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email_enabled: bool
    email_new_user_invite: bool
    email_role_changes: bool
    email_payment_received: bool
    email_invoice_generated: bool
    email_order_status_change: bool
    email_low_stock_alert: bool
    email_monthly_report: bool
    in_app_enabled: bool
    in_app_new_messages: bool
    in_app_task_assignments: bool
    in_app_approval_requests: bool
    in_app_system_updates: bool
    sms_enabled: bool
    sms_order_confirmation: bool
    sms_payment_received: bool
    sms_important_alerts: bool
    push_enabled: bool
    push_instant_alerts: bool
    push_daily_summary: bool
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str
    digest_frequency: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

@router.get("/notifications")
def get_notification_settings(
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get Tenant Notification Settings.
    Returns the notification configuration for the current tenant.
    """
    try:
        settings = db.query(TenantNotificationSettings).filter(
            TenantNotificationSettings.tenant_id == tenant_id
        ).first()
        
        if not settings:
            # Create default settings if they don't exist
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                raise HTTPException(status_code=404, detail="Tenant not found")
            
            settings = TenantNotificationSettings(tenant_id=tenant_id)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        settings_data = NotificationSettingsResponse.model_validate(settings)
        return {"data": settings_data}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to retrieve notification settings: {str(e)}"
            }
        )

@router.patch("/notifications")
def patch_notification_settings(
    req: NotificationSettingsRequest,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Partially Update Tenant Notification Settings.
    Only provided fields are updated.
    """
    try:
        settings = db.query(TenantNotificationSettings).filter(
            TenantNotificationSettings.tenant_id == tenant_id
        ).first()
        
        if not settings:
            settings = TenantNotificationSettings(tenant_id=tenant_id)
            db.add(settings)
        
        # Update only provided fields
        for field, value in req.model_dump(exclude_unset=True).items():
            if value is not None:
                setattr(settings, field, value)
        
        db.commit()
        db.refresh(settings)
        
        settings_data = NotificationSettingsResponse.model_validate(settings)
        return {"data": settings_data}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "type": "internal_error",
                "message": f"Failed to update notification settings: {str(e)}"
            }
        )
