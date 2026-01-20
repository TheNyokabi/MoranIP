"""
Onboarding Router

Provides RESTful API endpoints for:
- Initiating configurable onboarding flows
- Selecting templates
- Executing steps
- Tracking progress
- Managing contacts and customer escalation
"""

from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, List
from datetime import datetime
import uuid

from app.database import get_db
from app.models.iam import User, Tenant
from app.models.onboarding import (
    Contact,
    TenantOnboarding,
    OnboardingTemplate,
    PermissionScope
)
from app.dependencies.auth import require_tenant_access, get_current_user, verify_tenant_access, verify_tenant_membership
from app.services.onboarding_service import get_onboarding_orchestrator, SYSTEM_TEMPLATES
from app.utils.codes import generate_entity_code

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class OnboardingInitiateRequest(BaseModel):
    """Request to initiate onboarding for a tenant"""
    workspace_type: Optional[str] = Field(None, description="SACCO, ENTERPRISE, SME, STARTUP - determines engine selection")
    template_code: Optional[str] = Field(None, description="STARTUP, SME, ENTERPRISE, or custom template code (auto-selected if not provided)")
    custom_config: Optional[Dict] = Field(None, description="Override template configuration")
    
    class Config:
        example = {
            "workspace_type": "SACCO",
            "template_code": "ENTERPRISE",
            "custom_config": {
                "global": {
                    "include_demo_data": False
                },
                "modules": {
                    "accounting": {
                        "company_currency": "KES"
                    }
                }
            }
        }


class OnboardingStatusResponse(BaseModel):
    """Response with onboarding status"""
    status: str
    workspace_type: Optional[str] = None
    template: Optional[str]
    progress: float
    current_step: Optional[str]
    total_steps: int
    completed_steps: int
    steps: List[Dict]
    error: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]


class ContactCreateRequest(BaseModel):
    """Request to create a contact"""
    contact_name: str
    contact_type: str = Field(..., description="customer, supplier, or partner")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    kyc_tier: str = "KYC-T0"
    custom_metadata: Optional[Dict] = Field(None, alias="metadata")
    
    class Config:
        example = {
            "contact_name": "John's Store",
            "contact_type": "customer",
            "email": "johns@example.com",
            "phone": "+254700000000",
            "address": "123 Main St, Nairobi"
        }


class ContactEscalationRequest(BaseModel):
    """Request to escalate contact to user account"""
    password: str = Field(..., min_length=8, description="Password for new user account")
    full_name: Optional[str] = Field(None, description="Full name for user account")
    
    class Config:
        example = {
            "password": "SecurePassword123!",
            "full_name": "John Doe"
        }


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/onboarding",
    tags=["Onboarding & Contacts"],
)

# ============================================================================
# ONBOARDING ENDPOINTS
# ============================================================================

@router.post("/tenants/{tenant_id}/start")
def initiate_onboarding(
    tenant_id: str,
    req: OnboardingInitiateRequest,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Initiate onboarding for a tenant with a selected template.
    
    **Access Control:**
    - SUPER_ADMIN users can initiate onboarding for ANY tenant
    - Regular users can only initiate for their assigned tenant
    
    - **template_code**: Choose STARTUP (basic), SME (intermediate), ENTERPRISE (full), or custom
    - **custom_config**: Override template settings (optional)
    
    Returns onboarding object with initial steps.
    """
    # verify_tenant_membership checks SUPER_ADMIN and membership in database
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        onboarding = orchestrator.initiate_onboarding(
            tenant_id=tenant_id,
            workspace_type=req.workspace_type,
            template_code=req.template_code,
            custom_config=req.custom_config,
            initiated_by_user_id=str(current_user["user_id"])
        )
        
        # Get tenant to return engine info
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        
        # Get step count
        from app.models.onboarding import OnboardingStep
        step_count = db.query(OnboardingStep).filter(
            OnboardingStep.onboarding_id == onboarding.id
        ).count()
        
        return {
            "status": "success",
            "message": f"Onboarding initiated with template: {onboarding.template}",
            "onboarding_id": str(onboarding.id),
            "workspace_type": onboarding.workspace_type,
            "template": onboarding.template,
            "engine": tenant.engine if tenant else None,
            "status_flow": onboarding.status,
            "total_steps": step_count,
            "configuration": onboarding.configuration
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenants/{tenant_id}/begin")
def begin_onboarding(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Transition onboarding from DRAFT to IN_PROGRESS.
    Must call after initiate_onboarding.
    
    **Access Control:**
    - SUPER_ADMIN users can begin onboarding for ANY tenant
    - Regular users can only begin for their assigned tenant
    """
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        onboarding = orchestrator.start_onboarding(tenant_id)
        
        return {
            "status": "success",
            "message": "Onboarding started",
            "onboarding_id": str(onboarding.id),
            "status_flow": onboarding.status,
            "started_at": onboarding.started_at.isoformat() if onboarding.started_at else None
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenants/{tenant_id}/next-step")
def execute_next_step(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Execute the next pending onboarding step.
    
    Steps are executed in dependency order (dependencies before dependents).
    Returns step execution result or null if all steps completed.
    
    **Access Control:**
    - SUPER_ADMIN users can execute steps for ANY tenant
    - Regular users can only execute for their assigned tenant
    """
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        step = orchestrator.execute_next_step(tenant_id)
        
        if not step:
            return {
                "status": "success",
                "message": "All onboarding steps completed",
                "step": None,
                "completed": True
            }
        
        return {
            "status": "success",
            "message": f"Step executed: {step.step_code}",
            "step": {
                "code": step.step_code,
                "name": step.step_name,
                "status": step.status,
                "result": step.result_data,
                "error": step.error_message,
                "duration_seconds": step.duration_seconds
            },
            "completed": False
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tenants/{tenant_id}/status")
def get_onboarding_status(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> OnboardingStatusResponse:
    """
    Get current onboarding status and progress for tenant.

    **Access Control:**
    - SUPER_ADMIN users can check status for ANY tenant
    - Regular users can only check their assigned tenant

    Returns:
    - status: NOT_STARTED, DRAFT, IN_PROGRESS, COMPLETED, FAILED
    - progress: Percentage (0-100)
    - steps: Array of step details with current status
    """
    confirm_default = {
        "status": "NOT_STARTED",
        "progress": 0,
        "workspace_type": None,
        "template": None,
        "current_step": None,
        "total_steps": 0,
        "completed_steps": 0,
        "steps": [],
        "error": None,
        "started_at": None,
        "completed_at": None
    }
    try:
        orchestrator = get_onboarding_orchestrator(db)
        status = orchestrator.get_onboarding_status(tenant_id)
        return OnboardingStatusResponse(**status)
    except Exception as e:
        # Log the error for debugging but don't expose it to client
        print(f"Onboarding status error for tenant {tenant_id}: {str(e)}")
        # Graceful fallback to avoid 500s on missing onboarding data
        return OnboardingStatusResponse(**confirm_default)


@router.post("/tenants/{tenant_id}/steps/{step_code}/skip")
def skip_step(
    tenant_id: str,
    step_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Skip a specific onboarding step.
    """
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        step = orchestrator.skip_step(tenant_id, step_code)
        
        return {
            "status": "success",
            "message": f"Step skipped: {step_code}",
            "step": {
                "code": step.step_code,
                "name": step.step_name,
                "status": step.status
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenants/{tenant_id}/pause")
def pause_onboarding(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Pause an ongoing onboarding process.
    User can resume later from where they left off.
    
    **Access Control:**
    - SUPER_ADMIN users can pause onboarding for ANY tenant
    - Regular users can only pause for their assigned tenant
    """
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        onboarding = orchestrator.pause_onboarding(tenant_id)
        
        return {
            "status": "success",
            "message": "Onboarding paused. You can resume later.",
            "onboarding_id": str(onboarding.id),
            "status_flow": onboarding.status,
            "current_step": onboarding.current_step
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tenants/{tenant_id}/resume")
def resume_onboarding(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(verify_tenant_membership),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Resume a paused onboarding process.
    Continues from where it was paused.
    
    **Access Control:**
    - SUPER_ADMIN users can resume onboarding for ANY tenant
    - Regular users can only resume for their assigned tenant
    """
    orchestrator = get_onboarding_orchestrator(db)
    
    try:
        onboarding = orchestrator.resume_onboarding(tenant_id)
        
        return {
            "status": "success",
            "message": "Onboarding resumed. Continuing from where you left off.",
            "onboarding_id": str(onboarding.id),
            "status_flow": onboarding.status,
            "current_step": onboarding.current_step
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/templates")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict:
    """
    List available onboarding templates.
    
    Returns both system templates and custom tenant templates.
    """
    # System templates
    system_templates = [
        {
            "code": code,
            "name": template.get("name"),
            "description": template.get("description"),
            "modules": template.get("modules"),
            "is_system": True
        }
        for code, template in SYSTEM_TEMPLATES.items()
    ]
    
    # Custom templates from database
    custom_templates = db.query(OnboardingTemplate).filter(
        OnboardingTemplate.is_system == False
    ).all()
    
    custom_templates_data = [
        {
            "code": t.code,
            "name": t.name,
            "description": t.description,
            "modules": t.modules,
            "is_system": False
        }
        for t in custom_templates
    ]
    
    return {
        "total": len(system_templates) + len(custom_templates_data),
        "system_templates": system_templates,
        "custom_templates": custom_templates_data
    }


# ============================================================================
# CONTACT & ESCALATION ENDPOINTS
# ============================================================================

@router.post("/tenants/{tenant_id}/contacts")
def create_contact(
    tenant_id: str,
    req: ContactCreateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id_from_token: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Create a new contact (customer, supplier, or partner).
    
    Contacts can later be escalated to user accounts for portal access.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Generate contact code
    contact_code = generate_entity_code("CTT", tenant.country_code)
    
    contact = Contact(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        contact_code=contact_code,
        contact_name=req.contact_name,
        contact_type=req.contact_type,
        email=req.email,
        phone=req.phone,
        address=req.address,
        kyc_tier=req.kyc_tier,
        custom_metadata=req.custom_metadata,
        status="ACTIVE"
    )
    
    db.add(contact)
    db.commit()
    db.refresh(contact)
    
    return {
        "status": "success",
        "message": f"Contact created: {contact.contact_name}",
        "contact": {
            "id": str(contact.id),
            "contact_code": contact.contact_code,
            "contact_name": contact.contact_name,
            "contact_type": contact.contact_type,
            "email": contact.email,
            "kyc_tier": contact.kyc_tier,
            "created_at": contact.created_at.isoformat()
        }
    }


@router.get("/tenants/{tenant_id}/contacts")
def list_contacts(
    tenant_id: str,
    contact_type: Optional[str] = Query(None, description="Filter by type: customer, supplier, partner"),
    current_user: User = Depends(get_current_user),
    tenant_id_from_token: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
) -> Dict:
    """
    List contacts for a tenant.
    
    Optionally filter by contact type.
    """
    query = db.query(Contact).filter(Contact.tenant_id == tenant_id)
    
    if contact_type:
        query = query.filter(Contact.contact_type == contact_type)
    
    contacts = query.all()
    
    return {
        "total": len(contacts),
        "contacts": [
            {
                "id": str(c.id),
                "contact_code": c.contact_code,
                "contact_name": c.contact_name,
                "contact_type": c.contact_type,
                "email": c.email,
                "status": c.status,
                "escalation_requested": c.escalation_requested,
                "created_at": c.created_at.isoformat()
            }
            for c in contacts
        ]
    }


@router.post("/tenants/{tenant_id}/contacts/{contact_id}/request-access")
def request_contact_access(
    tenant_id: str,
    contact_id: str,
    current_user: User = Depends(get_current_user),
    tenant_id_from_token: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Contact requests escalation to user account (for portal access).
    
    Admin must approve via accept-access endpoint.
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.tenant_id == tenant_id
    ).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    contact.escalation_requested = True
    db.commit()
    db.refresh(contact)
    
    return {
        "status": "success",
        "message": "Escalation request submitted",
        "contact_id": str(contact.id),
        "escalation_requested": True
    }


@router.post("/tenants/{tenant_id}/contacts/{contact_id}/accept-access")
def accept_contact_escalation(
    tenant_id: str,
    contact_id: str,
    req: ContactEscalationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id_from_token: str = Depends(require_tenant_access),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Admin accepts contact escalation and creates user account.
    
    This creates a new User with CUSTOMER role in the tenant.
    """
    from app.services.auth_service import auth_service
    
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.tenant_id == tenant_id
    ).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if not contact.email:
        raise HTTPException(status_code=400, detail="Contact must have email to escalate")
    
    if not contact.escalation_requested:
        raise HTTPException(status_code=400, detail="Contact has not requested access")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == contact.email).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create user account
    user = User(
        id=uuid.uuid4(),
        user_code=generate_entity_code("USR", "KE"),
        email=contact.email,
        full_name=req.full_name or contact.contact_name,
        password_hash=auth_service.get_password_hash(req.password),
        user_type="CUSTOMER",  # Mark as customer
        contact_id=contact_id,
        kyc_tier=contact.kyc_tier,
        is_active=True
    )
    
    db.add(user)
    db.flush()
    
    # Create membership with CUSTOMER role
    from app.models.iam import Membership
    
    membership = Membership(
        id=uuid.uuid4(),
        user_id=user.id,
        tenant_id=tenant_id,
        role="CUSTOMER_PORTAL",  # New role for customer portal users
        status="ACTIVE",
        joined_at=datetime.utcnow()
    )
    
    db.add(membership)
    
    # Update contact
    contact.escalation_user_id = user.id
    contact.status = "ESCALATED"
    
    db.commit()
    db.refresh(user)
    
    return {
        "status": "success",
        "message": f"Contact escalated to user account: {user.email}",
        "user": {
            "id": str(user.id),
            "user_code": user.user_code,
            "email": user.email,
            "full_name": user.full_name,
            "user_type": user.user_type,
            "created_at": user.created_at.isoformat()
        },
        "contact": {
            "id": str(contact.id),
            "status": contact.status,
            "escalation_user_id": str(contact.escalation_user_id)
        }
    }
