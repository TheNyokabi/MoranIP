from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from app.database import get_db
from app.models.iam import User, Tenant, Membership
from app.models.rbac import Role, UserRole
from app.utils.codes import generate_entity_code
from app.services.auth_service import auth_service
from app.dependencies.auth import get_current_user, require_tenant_access, get_current_token_payload
from typing import Optional, List
from datetime import datetime
import uuid
import secrets

router = APIRouter(
    prefix="/iam",
    tags=["IAM Provisioning"],
)

# Optional OAuth2 scheme for endpoints that work with or without authentication
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/v1/login-with-tenant", auto_error=False)

def get_optional_token_payload(token: str = Depends(oauth2_scheme_optional)):
    """Get token payload if available, return None if not provided or invalid"""
    if not token:
        return None
    try:
        from app.config import settings
        from app.services.auth_service import ALGORITHM
        from jose import jwt, JWTError
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (JWTError, Exception):
        return None

class CreateTenantRequest(BaseModel):
    name: str
    category: str = "Enterprise"  # Enterprise, SME, Startup, etc.
    description: Optional[str] = None
    country_code: str = "KE"
    admin_email: str
    admin_name: str
    admin_password: str
    engine: str = "odoo"

class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "CASHIER"  # ADMIN, MANAGER, CASHIER, VIEWER

class AcceptInvitationRequest(BaseModel):
    """Request to accept an invitation and set password"""
    invitation_code: str
    full_name: str
    password: str = Field(..., min_length=8)

class CreateUserRequest(BaseModel):
    """Admin creates a user directly with password (for internal staff)"""
    email: EmailStr
    full_name: str
    password: str = Field(..., min_length=8)
    role: str = "CASHIER"
    country_code: str = "KE"

class UpdateMembershipRequest(BaseModel):
    """Update a user's role in a tenant"""
    role: str  # ADMIN, MANAGER, CASHIER, VIEWER
    status: Optional[str] = None  # ACTIVE, SUSPENDED

@router.post("/tenants")
def create_tenant(
    req: CreateTenantRequest, 
    db: Session = Depends(get_db),
    current_user_payload: Optional[dict] = Depends(get_optional_token_payload)
):
    """
    Register a New Tenant (Organization) - Platform Admin Function.
    
    This endpoint:
    1. Creates or finds the admin user (from form)
    2. Creates the tenant with category and description
    3. Creates Membership for form admin user (ADMIN role)
    4. If authenticated user exists, makes them OWNER; otherwise form admin is OWNER
    5. Creates Company in ERPNext (if engine is "erpnext") using tenant name
    
    Ownership Model:
    - The user creating/committing the workspace (authenticated user) = OWNER
    - The user provided in the form (admin_email) = ADMIN
    """
    # Get the authenticated user (the one creating the workspace)
    owner_user = None
    owner_user_id = None
    if current_user_payload:
        owner_user_id = current_user_payload.get("sub")
        if owner_user_id:
            try:
                owner_user = db.query(User).filter(User.id == uuid.UUID(owner_user_id)).first()
            except (ValueError, TypeError):
                owner_user = None
    
    # 1. Check/Create Admin User (from form - will be ADMIN, not OWNER)
    admin_user = db.query(User).filter(User.email == req.admin_email).first()
    if not admin_user:
        admin_user = User(
            user_code=generate_entity_code("USR", req.country_code),
            email=req.admin_email,
            full_name=req.admin_name,
            password_hash=auth_service.get_password_hash(req.admin_password),
            kyc_tier="KYC-T1", # Basic tier for new admin
            is_active=True
        )
        db.add(admin_user)
        db.flush()
    
    # Determine who will be OWNER:
    # - If authenticated user exists, they are OWNER
    # - Otherwise, the form admin user is OWNER (backward compatibility)
    if owner_user:
        owner_user_final = owner_user
    else:
        owner_user_final = admin_user
    
    # 2. Create Tenant with category and description
    tenant = Tenant(
        tenant_code=generate_entity_code("TEN", req.country_code),
        name=req.name,
        country_code=req.country_code,
        status="ACTIVE",
        engine=req.engine
    )
    db.add(tenant)
    db.flush()

    # 3. Create Membership for OWNER (the user creating the workspace)
    owner_role = db.query(Role).filter(Role.code == "OWNER").first()
    
    # Create/update OWNER membership
    owner_membership = db.query(Membership).filter(
        Membership.user_id == owner_user_final.id,
        Membership.tenant_id == tenant.id
    ).first()
    
    if not owner_membership:
        owner_membership = Membership(
            user_id=owner_user_final.id,
            tenant_id=tenant.id,
            role="ADMIN",  # Legacy role (RBAC OWNER role is separate)
            status="ACTIVE",
            joined_at=datetime.utcnow()
        )
        db.add(owner_membership)
    else:
        if owner_membership.status != "ACTIVE":
            owner_membership.status = "ACTIVE"
    
    # Assign RBAC OWNER Role to the workspace creator
    if owner_role:
        existing_owner_role = db.query(UserRole).filter(
            UserRole.user_id == owner_user_final.id,
            UserRole.tenant_id == tenant.id,
            UserRole.role_id == owner_role.id
        ).first()
        
        if not existing_owner_role:
            owner_user_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=owner_user_final.id,
                tenant_id=tenant.id,
                role_id=owner_role.id,
                assigned_by=owner_user_final.id,
                assigned_at=datetime.utcnow(),
                is_active=True
            )
            db.add(owner_user_role)
    
    # 4. Create Membership for ADMIN (the user from the form)
    # Only create if different from owner
    admin_membership = None
    if admin_user.id != owner_user_final.id:
        admin_membership = db.query(Membership).filter(
            Membership.user_id == admin_user.id,
            Membership.tenant_id == tenant.id
        ).first()
        
        if not admin_membership:
            admin_membership = Membership(
                user_id=admin_user.id,
                tenant_id=tenant.id,
                role="ADMIN",  # Form admin is ADMIN, not OWNER
                status="ACTIVE",
                joined_at=datetime.utcnow()
            )
            db.add(admin_membership)
        else:
            if admin_membership.status != "ACTIVE":
                admin_membership.status = "ACTIVE"
                admin_membership.role = "ADMIN"
        
        # Assign RBAC ADMIN role (not OWNER) to form admin user
        if owner_role:
            admin_role = db.query(Role).filter(Role.code == "ADMIN").first()
            if admin_role:
                existing_admin_role = db.query(UserRole).filter(
                    UserRole.user_id == admin_user.id,
                    UserRole.tenant_id == tenant.id,
                    UserRole.role_id == admin_role.id
                ).first()
                
                if not existing_admin_role:
                    admin_user_role = UserRole(
                        id=str(uuid.uuid4()),
                        user_id=admin_user.id,
                        tenant_id=tenant.id,
                        role_id=admin_role.id,
                        assigned_by=owner_user_final.id,  # Assigned by owner
                        assigned_at=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(admin_user_role)
    
    # 5. AUTO-ADD admin@moran.com as OWNER (god user for all tenants)
    # This ensures the platform admin has access to ALL tenants including new ones
    platform_admin_user = db.query(User).filter(User.email == "admin@moran.com").first()
    if platform_admin_user and owner_role and platform_admin_user.id != owner_user_final.id:
        # Check if platform admin is already a member of this tenant
        existing_platform_membership = db.query(Membership).filter(
            Membership.user_id == platform_admin_user.id,
            Membership.tenant_id == tenant.id
        ).first()
        
        if not existing_platform_membership:
            # Create membership for admin@moran.com
            platform_admin_membership = Membership(
                user_id=platform_admin_user.id,
                tenant_id=tenant.id,
                role="ADMIN",  # Legacy role
                status="ACTIVE"
            )
            db.add(platform_admin_membership)
            db.flush()
        
        # Check if already has OWNER role
        existing_platform_role = db.query(UserRole).filter(
            UserRole.user_id == platform_admin_user.id,
            UserRole.tenant_id == tenant.id,
            UserRole.role_id == owner_role.id
        ).first()
        
        if not existing_platform_role:
            # Assign OWNER role to admin@moran.com
            platform_admin_user_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=platform_admin_user.id,
                tenant_id=tenant.id,
                role_id=owner_role.id,
                assigned_by=platform_admin_user.id,
                assigned_at=datetime.utcnow(),
                is_active=True
            )
            db.add(platform_admin_user_role)
    
    # 6. Create Company in ERPNext if engine is "erpnext"
    company_created = False
    company_name = None
    if req.engine == "erpnext":
        try:
            from app.services.erpnext_client import erpnext_adapter
            
            # Map country code to country name (default to Kenya)
            country_map = {
                "KE": "Kenya",
                "UG": "Uganda",
                "TZ": "Tanzania",
                "RW": "Rwanda",
                "ET": "Ethiopia"
            }
            country = country_map.get(req.country_code, "Kenya")
            
            # Map country code to currency (default to KES)
            currency_map = {
                "KE": "KES",
                "UG": "UGX",
                "TZ": "TZS",
                "RW": "RWF",
                "ET": "ETB"
            }
            currency = currency_map.get(req.country_code, "KES")
            
            # Generate company code from tenant name (first 3 letters of each word)
            company_code = "".join([word[:3].upper() for word in req.name.split()[:3]])[:10] or "TEN"
            
            # Create company in ERPNext using tenant name as company name
            company_data = {
                "doctype": "Company",
                "company_name": req.name,  # Use tenant name as company name
                "abbr": company_code,
                "country": country,
                "default_currency": currency,
                "is_group": 0,
                "parent_company": ""
            }
            
            # Use tenant.id as tenant_id for ERPNext operations
            company_result = erpnext_adapter.create_resource("Company", company_data, str(tenant.id))
            
            if company_result and company_result.get("data"):
                company_created = True
                company_name = company_result.get("data", {}).get("company_name") or req.name
        except Exception as e:
            # Log error but don't fail tenant creation
            print(f"Warning: Failed to create company in ERPNext for tenant {tenant.id}: {e}")
            # Continue with tenant creation even if company creation fails
    
    # Commit all changes (user, tenant, membership, roles) BEFORE provisioning
    # This ensures the membership is available immediately for the new admin user
    db.commit()
    
    # Refresh objects to ensure they're up to date and available for subsequent operations
    db.refresh(tenant)
    db.refresh(admin_user)
    db.refresh(owner_user_final)
    if owner_membership:
        db.refresh(owner_membership)
    if admin_membership:
        db.refresh(admin_membership)
    
    response = {
        "message": "Tenant created successfully",
        "tenant": {
            "id": str(tenant.id),
            "code": tenant.tenant_code,
            "name": tenant.name,
            "category": req.category,
            "description": req.description,
            "engine": tenant.engine
        },
        "owner": {
            "id": str(owner_user_final.id),
            "code": owner_user_final.user_code,
            "email": owner_user_final.email,
            "role": "OWNER"
        },
        "admin": {
            "id": str(admin_user.id),
            "code": admin_user.user_code,
            "email": admin_user.email,
            "role": "ADMIN"
        }
    }
    
    # Add company creation status if ERPNext
    if req.engine == "erpnext":
        response["company"] = {
            "created": company_created,
            "name": company_name or req.name,
            "message": "Company created in ERPNext" if company_created else "Company creation skipped (ERPNext may not be available)"
        }
    
    # 7. Trigger provisioning if engine is available
    provisioning_status = None
    if req.engine == "erpnext":
        try:
            from app.services.engine_health_service import engine_health_service
            from app.services.provisioning_service import provisioning_service, ProvisioningConfig
            
            # Check engine health
            health_result = engine_health_service.check_engine_health(
                tenant_id=str(tenant.id),
                engine_type=req.engine
            )
            
            if health_result.status.value == "online":
                # Start provisioning in background (don't wait for completion)
                # This prevents timeout and response issues
                try:
                    config = ProvisioningConfig(
                        include_demo_data=False,  # Default: no demo data
                        pos_store_enabled=True,
                        country_template=None  # Auto-detect from country_code
                    )
                    
                    # Start provisioning asynchronously - don't wait for completion
                    # This ensures the response is sent immediately
                    import asyncio
                    import threading
                    
                    def start_provisioning_async():
                        """Start provisioning in background thread"""
                        try:
                            # Create new DB session for background thread
                            from app.database import SessionLocal
                            background_db = SessionLocal()
                            try:
                                result = provisioning_service.provision_workspace_to_pos(
                                    tenant_id=str(tenant.id),
                                    config=config,
                                    db=background_db,
                                    user_id=str(owner_user_final.id)  # Use owner user ID for provisioning
                                )
                            finally:
                                background_db.close()
                        except Exception as e:
                            # Log error but don't fail - provisioning can be retried
                            print(f"Background provisioning failed for tenant {tenant.id}: {e}")
                    
                    # Start provisioning in background thread
                    provisioning_thread = threading.Thread(target=start_provisioning_async, daemon=True)
                    provisioning_thread.start()
                    
                    # Return initial status - provisioning is starting
                    provisioning_status = {
                        "status": "IN_PROGRESS",
                        "progress": 0,
                        "current_step": "step_0_engine_check",
                        "steps_completed": 0,
                        "total_steps": 11,
                        "message": "Provisioning started in background"
                    }
                except Exception as e:
                    # Provisioning failed but tenant creation succeeded
                    # Import CriticalProvisioningError to handle it properly
                    from app.exceptions.provisioning import CriticalProvisioningError
                    
                    error_message = str(e)
                    if isinstance(e, CriticalProvisioningError):
                        error_message = f"{e.step}: {e.message}"
                    
                    print(f"Warning: Provisioning failed for tenant {tenant.id}: {error_message}")
                    tenant.provisioning_status = "FAILED"
                    tenant.provisioning_error = error_message
                    db.commit()
                    db.refresh(tenant)
                    
                    # Get more details from the provisioning result if available
                    try:
                        from app.models.onboarding import TenantOnboarding
                        onboarding = db.query(TenantOnboarding).filter(
                            TenantOnboarding.tenant_id == tenant.id
                        ).first()
                        if onboarding and onboarding.error_message:
                            error_message = onboarding.error_message
                    except:
                        pass
                    
                    # Try to get more details from onboarding record
                    try:
                        from app.models.onboarding import TenantOnboarding
                        onboarding = db.query(TenantOnboarding).filter(
                            TenantOnboarding.tenant_id == tenant.id
                        ).first()
                        if onboarding:
                            steps = onboarding.provisioning_steps or {}
                            completed_steps = len([s for s, d in steps.items() if d.get("status") in ["completed", "exists"]])
                            current_step = onboarding.error_step
                            
                            provisioning_status = {
                                "status": "FAILED",
                                "progress": int((completed_steps / 11) * 100) if completed_steps > 0 else 0,
                                "current_step": current_step,
                                "steps_completed": completed_steps,
                                "total_steps": 11,
                                "error": error_message
                            }
                        else:
                            provisioning_status = {
                                "status": "FAILED",
                                "progress": 0,
                                "current_step": None,
                                "steps_completed": 0,
                                "total_steps": 11,
                                "error": error_message
                            }
                    except Exception as e2:
                        # Fallback if we can't get onboarding details
                        print(f"Warning: Could not get onboarding details: {e2}")
                        provisioning_status = {
                            "status": "FAILED",
                            "progress": 0,
                            "current_step": None,
                            "steps_completed": 0,
                            "total_steps": 11,
                            "error": error_message
                        }
            else:
                # Engine offline - mark as not provisioned
                tenant.provisioning_status = "NOT_PROVISIONED"
                db.commit()
                provisioning_status = {
                    "status": "NOT_STARTED",  # Map to NOT_STARTED for API consistency
                    "progress": 0,
                    "current_step": None,
                    "steps_completed": 0,
                    "total_steps": 11,
                    "message": f"Engine is {health_result.status.value}: {health_result.message}. You can start provisioning manually when the engine is online."
                }
        except Exception as e:
            # Provisioning check failed - mark as not provisioned
            print(f"Warning: Could not check engine health for provisioning: {e}")
            tenant.provisioning_status = "NOT_PROVISIONED"
            db.commit()
            provisioning_status = {
                "status": "NOT_STARTED",  # Map to NOT_STARTED for API consistency
                "progress": 0,
                "current_step": None,
                "steps_completed": 0,
                "total_steps": 11,
                "message": "Could not check engine availability. You can start provisioning manually."
            }
    
    # Add provisioning status to response
    if provisioning_status:
        response["provisioning"] = provisioning_status
    
    return response

@router.post("/tenants/{tenant_id}/invite")
def invite_user(
    tenant_id: str, 
    req: InviteUserRequest, 
    db: Session = Depends(get_db)
):
    """
    Invite a user to a tenant. Generates an invitation code that can be used to accept.
    
    Flow:
    1. Admin calls this endpoint with email and role
    2. System creates/finds user, creates INVITED membership with invitation_code
    3. Invitation code is returned (in production, send via email)
    4. User calls /invitations/{code}/accept to set password and activate
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Generate secure invitation code
    invitation_code = secrets.token_urlsafe(32)
    
    user = db.query(User).filter(User.email == req.email).first()
    
    # Scenario A: User exists
    if user:
        # Check if already member
        existing_mem = db.query(Membership).filter(
            Membership.user_id == user.id, 
            Membership.tenant_id == tenant.id
        ).first()
        if existing_mem:
            if existing_mem.status == "ACTIVE":
                raise HTTPException(status_code=409, detail="User is already an active member")
            # Re-invite: update invitation code
            existing_mem.invitation_code = invitation_code
            existing_mem.invited_at = datetime.utcnow()
            existing_mem.role = req.role
            existing_mem.status = "INVITED"
            db.commit()
            return {
                "message": f"Re-invitation sent to {user.email}",
                "invitation_code": invitation_code,
                "user_code": user.user_code,
                "type": "REINVITED"
            }
        
        # Add membership as INVITED
        mem = Membership(
            user_id=user.id,
            tenant_id=tenant.id,
            role=req.role,
            status="INVITED",
            invitation_code=invitation_code,
            invited_at=datetime.utcnow()
        )
        db.add(mem)
        db.commit()
        return {
            "message": f"Invitation sent to existing user {user.email}",
            "invitation_code": invitation_code,
            "user_code": user.user_code,
            "type": "INVITED_EXISTING"
        }

    # Scenario B: User does not exist - create stub user
    new_user = User(
        user_code=generate_entity_code("USR", tenant.country_code),
        email=req.email,
        full_name=req.full_name,
        is_active=False,  # Inactive until they accept
        kyc_tier="KYC-T0"
    )
    db.add(new_user)
    db.flush()
    
    mem = Membership(
        user_id=new_user.id,
        tenant_id=tenant.id,
        role=req.role,
        status="INVITED",
        invitation_code=invitation_code,
        invited_at=datetime.utcnow()
    )
    db.add(mem)
    db.commit()
    
    return {
        "message": f"Invitation created for new user {req.email}",
        "invitation_code": invitation_code,
        "user_code": new_user.user_code,
        "type": "INVITED_NEW"
    }


@router.get("/invitations/{invitation_code}")
def get_invitation_details(
    invitation_code: str,
    db: Session = Depends(get_db)
):
    """
    Get details about an invitation (for the accept invitation page).
    """
    membership = db.query(Membership).filter(
        Membership.invitation_code == invitation_code
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")
    
    if membership.status != "INVITED":
        raise HTTPException(status_code=400, detail="Invitation already accepted or revoked")
    
    user = membership.user
    tenant = membership.tenant
    
    return {
        "invitation_code": invitation_code,
        "email": user.email,
        "full_name": user.full_name,
        "tenant_name": tenant.name,
        "tenant_code": tenant.tenant_code,
        "role": membership.role,
        "invited_at": membership.invited_at.isoformat() if membership.invited_at else None,
        "needs_password": user.password_hash is None
    }


@router.post("/invitations/{invitation_code}/accept")
def accept_invitation(
    invitation_code: str,
    req: AcceptInvitationRequest,
    db: Session = Depends(get_db)
):
    """
    Accept an invitation and set password.
    Activates the user and membership.
    """
    if req.invitation_code != invitation_code:
        raise HTTPException(status_code=400, detail="Invitation code mismatch")
    
    membership = db.query(Membership).filter(
        Membership.invitation_code == invitation_code
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Invitation not found or expired")
    
    if membership.status != "INVITED":
        raise HTTPException(status_code=400, detail="Invitation already accepted or revoked")
    
    user = membership.user
    tenant = membership.tenant
    
    # Update user
    user.full_name = req.full_name
    user.password_hash = auth_service.get_password_hash(req.password)
    user.is_active = True
    user.kyc_tier = "KYC-T1"  # Basic verified tier
    
    # Activate membership
    membership.status = "ACTIVE"
    membership.joined_at = datetime.utcnow()
    membership.invitation_code = None  # Clear the code after use
    
    db.commit()
    
    return {
        "message": "Invitation accepted successfully",
        "user": {
            "id": str(user.id),
            "user_code": user.user_code,
            "email": user.email,
            "full_name": user.full_name
        },
        "tenant": {
            "id": str(tenant.id),
            "name": tenant.name,
            "code": tenant.tenant_code
        },
        "role": membership.role
    }


@router.post("/tenants/{tenant_id}/users/create")
def create_user_directly(
    tenant_id: str,
    req: CreateUserRequest,
    db: Session = Depends(get_db)
):
    """
    Admin creates a user directly with password (for internal staff).
    Skips the invitation flow - user is immediately active.
    
    Use this for:
    - Onboarding staff when you have their details
    - Creating test/demo users
    - Bulk user creation via scripts
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        # Check if already member of this tenant
        existing_mem = db.query(Membership).filter(
            Membership.user_id == existing_user.id,
            Membership.tenant_id == tenant.id
        ).first()
        if existing_mem:
            raise HTTPException(status_code=409, detail="User is already a member of this tenant")
        
        # Add existing user to tenant
        membership = Membership(
            user_id=existing_user.id,
            tenant_id=tenant.id,
            role=req.role,
            status="ACTIVE",
            joined_at=datetime.utcnow()
        )
        db.add(membership)
        db.commit()
        
        return {
            "message": "Existing user added to tenant",
            "user": {
                "id": str(existing_user.id),
                "user_code": existing_user.user_code,
                "email": existing_user.email,
                "full_name": existing_user.full_name
            },
            "role": req.role,
            "type": "EXISTING_USER_ADDED"
        }
    
    # Create new user
    new_user = User(
        user_code=generate_entity_code("USR", req.country_code),
        email=req.email,
        full_name=req.full_name,
        password_hash=auth_service.get_password_hash(req.password),
        kyc_tier="KYC-T1",
        is_active=True
    )
    db.add(new_user)
    db.flush()
    
    # Create membership
    membership = Membership(
        user_id=new_user.id,
        tenant_id=tenant.id,
        role=req.role,
        status="ACTIVE",
        joined_at=datetime.utcnow()
    )
    db.add(membership)
    db.commit()
    
    return {
        "message": "User created and added to tenant",
        "user": {
            "id": str(new_user.id),
            "user_code": new_user.user_code,
            "email": new_user.email,
            "full_name": new_user.full_name
        },
        "role": req.role,
        "type": "NEW_USER_CREATED"
    }


@router.patch("/tenants/{tenant_id}/users/{user_id}")
def update_user_membership(
    tenant_id: str,
    user_id: str,
    req: UpdateMembershipRequest,
    db: Session = Depends(get_db)
):
    """
    Update a user's role or status in a tenant.
    """
    membership = db.query(Membership).filter(
        Membership.tenant_id == tenant_id,
        Membership.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    if req.role:
        membership.role = req.role
    if req.status:
        membership.status = req.status
    
    db.commit()
    
    return {
        "message": "Membership updated",
        "user_id": user_id,
        "role": membership.role,
        "status": membership.status
    }


@router.delete("/tenants/{tenant_id}/users/{user_id}")
def remove_user_from_tenant(
    tenant_id: str,
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Remove a user from a tenant (revoke membership).
    """
    membership = db.query(Membership).filter(
        Membership.tenant_id == tenant_id,
        Membership.user_id == user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    db.delete(membership)
    db.commit()
    
    return {"message": "User removed from tenant"}

@router.get("/tenants")
def list_all_tenants(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    engine: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all tenants in the platform - SUPER_ADMIN Only.
    Returns tenants with metadata including member counts.
    
    Query Parameters:
    - skip: Pagination offset
    - limit: Max results per page
    - status: Filter by status (ACTIVE, SUSPENDED, etc.)
    - engine: Filter by ERP engine (odoo, erpnext, etc.)
    """
    # Check if user is SUPER_ADMIN
    is_super_admin = current_user.get("is_super_admin", False)
    if not is_super_admin:
        raise HTTPException(
            status_code=403, 
            detail="Access denied: Only SUPER_ADMIN users can list all tenants"
        )
    
    # Build query
    query = db.query(Tenant)
    
    # Apply filters
    if status:
        query = query.filter(Tenant.status == status)
    if engine:
        query = query.filter(Tenant.engine == engine)
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination and order
    tenants = query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()
    
    # Build response with member counts and owner info
    tenant_list = []
    for tenant in tenants:
        # Count active members
        member_count = db.query(Membership).filter(
            Membership.tenant_id == tenant.id,
            Membership.status == 'ACTIVE'
        ).count()
        
        # Find owner (user with OWNER role)
        owner = None
        owner_role = db.query(Role).filter(Role.code == "OWNER").first()
        if owner_role:
            owner_user_role = db.query(UserRole).filter(
                UserRole.tenant_id == tenant.id,
                UserRole.role_id == owner_role.id,
                UserRole.is_active == True
            ).first()
            if owner_user_role:
                owner_user = db.query(User).filter(User.id == owner_user_role.user_id).first()
                if owner_user:
                    owner = {
                        "id": str(owner_user.id),
                        "email": owner_user.email,
                        "full_name": owner_user.full_name
                    }
        
        tenant_list.append({
            "id": str(tenant.id),
            "tenant_code": tenant.tenant_code,
            "name": tenant.name,
            "country_code": tenant.country_code,
            "status": tenant.status,
            "engine": tenant.engine,
            "member_count": member_count,
            "owner": owner,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None
        })
    
    return {
        "total": total,
        "tenants": tenant_list,
        "skip": skip,
        "limit": limit
    }

@router.get("/users")
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List all users in the platform - Platform Admin Only.
    Returns users with their codes, emails, and basic info.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    
    return {
        "total": db.query(User).count(),
        "users": [
            {
                "id": str(user.id),
                "user_code": user.user_code,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "kyc_tier": user.kyc_tier,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
            for user in users
        ]
    }

@router.get("/tenants/{tenant_id}/users")
def list_tenant_users(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    List all users in a specific tenant with their roles.
    """
    # Get all memberships for this tenant
    memberships = db.query(Membership).filter(
        Membership.tenant_id == tenant_id
    ).all()
    
    # Get RBAC user roles for this tenant
    user_roles = db.query(UserRole).filter(
        UserRole.tenant_id == tenant_id,
        UserRole.is_active == True
    ).all()
    
    # Build user list with roles
    user_data = {}
    for membership in memberships:
        user = membership.user
        if user:
            user_id = str(user.id)
            if user_id not in user_data:
                user_data[user_id] = {
                    "id": user_id,
                    "user_code": user.user_code,
                    "email": user.email,
                    "full_name": user.full_name,
                    "is_active": user.is_active,
                    "membership_status": membership.status,
                    "legacy_role": membership.role,
                    "rbac_roles": []
                }
    
    # Add RBAC roles
    for user_role in user_roles:
        user_id = str(user_role.user_id)
        if user_id in user_data:
            user_data[user_id]["rbac_roles"].append({
                "role_id": str(user_role.role_id),
                "role_code": user_role.role.code if user_role.role else None,
                "role_name": user_role.role.name if user_role.role else None,
                "assigned_at": user_role.assigned_at.isoformat() if user_role.assigned_at else None
            })
    
    return {
        "tenant_id": tenant_id,
        "total": len(user_data),
        "users": list(user_data.values())
    }

@router.post("/tenants/{tenant_id}/users")
def add_user_to_tenant(
    tenant_id: str,
    user_email: str = Body(..., embed=True),
    role_code: str = Body("STAFF", embed=True),
    db: Session = Depends(get_db)
):
    """
    Add an existing user to a tenant with a specific RBAC role.
    Creates both Membership and UserRole.
    """
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Find user by email
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already a member
    existing_membership = db.query(Membership).filter(
        Membership.user_id == user.id,
        Membership.tenant_id == tenant_id
    ).first()
    
    if existing_membership:
        raise HTTPException(status_code=409, detail="User is already a member of this tenant")
    
    # Create Membership
    membership = Membership(
        user_id=user.id,
        tenant_id=tenant_id,
        role="MEMBER",  # Legacy role
        status="ACTIVE"
    )
    db.add(membership)
    
    # Assign RBAC role
    role = db.query(Role).filter(Role.code == role_code).first()
    if role:
        user_role = UserRole(
            id=str(uuid.uuid4()),
            user_id=user.id,
            tenant_id=tenant_id,
            role_id=role.id,
            assigned_by=user.id,  # For now, self-assigned
            assigned_at=datetime.utcnow()
        )
        db.add(user_role)
    
    db.commit()
    
    return {
        "message": "User added to tenant successfully",
        "user": {
            "id": str(user.id),
            "user_code": user.user_code,
            "email": user.email,
            "full_name": user.full_name
        },
        "role": role_code
    }
