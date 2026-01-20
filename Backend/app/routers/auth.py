from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.services.auth_service import auth_service, AuthService
from app.services.engine_health_service import engine_health_service, EngineHealthStatus
from app.models.iam import User, Membership, Tenant
from app.database import get_db
from app.dependencies.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Dict
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

class SwitchTenantRequest(BaseModel):
    tenant_id: str

@router.post("/login")
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    """
    Global Login - Simplified & Decoupled.
    1. Authenticates User.
    2. Returns Global Identity Token (no tenant context).
    3. Returns User Details + List of Available Tenants.
    4. User is redirected to /dashboard to select workspace.
    """
    try:
        user = auth_service.authenticate_user(db, creds.email, creds.password)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        
        tenants = auth_service.get_user_tenants(db, user.id)
        
        # Create global identity token (no tenant context)
        identity_token = auth_service.create_identity_token(user, db)
        
        return {
            "access_token": identity_token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "user_code": user.user_code,
            "email": user.email,
            "full_name": user.full_name,
            "kyc_tier": user.kyc_tier,
            "tenants": [
                {
                    "id": str(t.id), 
                    "name": t.name, 
                    "code": t.tenant_code,
                    "engine": t.engine
                } for t in tenants
            ]
        }
    except HTTPException:
        raise  # Re-raise HTTP exceptions (like 401)
    except Exception as e:
        # Log unexpected errors and return 500
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error during login: {str(e)}"
        )

@router.post("/token")
def issue_token(
    user_id: str = Body(...), 
    tenant_id: str = Body(...),
    db: Session = Depends(get_db)
):
    """
    Select Tenant -> Get Scoped JWT.
    """
    # Verify user exists (simplification, ideally we signature check a temp token from login)
    # For now, we trust the ID provided but we check password again? No.
    # We should have a short lived 'identity token' or session.
    # But adhering to user request "Login Flows", let's assume we re-validate or use a different flow?
    # User Spec: "Tenant-scoped JWTs ONLY".
    
    # Correction: The login endpoint typically returns a Global Token (Refresh Token) or we do this in one step if only 1 tenant.
    # Let's implement robust flow: 
    # Login returns "Global Identity Token" (short lived, no tenant scope).
    # This endpoint exchanges Global Identity Token + Tenant ID for "Tenant Access Token".
    
    # For MVP Step 4:
    # Let's just allow getting token by re-submitting user_id (not secure without auth).
    # Better: Login returns a temporary signed token.
    
    pass 
    # I will revise this to be simpler: Login returns the list.
    # A separate endpoint 'select_tenant' takes a signed "login_token" (from step 1) and tenant_id.
    
    return {"message": "Use /auth/select-tenant"}
    
@router.post("/select-tenant")
def select_tenant(
    req: SwitchTenantRequest,
    current_user_id: str = Body(..., alias="user_id"), # Insecure for now, need JWT
    db: Session = Depends(get_db)
):
    # Retrieve user and tenant, verify membership
    # This is insecure placeholder logic.
    # Real logic: Verify the calling user matches user_id (via global JWT? but we said tenant scoped ONLY).
    
    # Let's pivot: Login returns User + Tenants.
    # Client chooses Tenant.
    # Client sends verify-password/login AGAIN with tenant_id to get Token?
    # Or strict flow:
    # 1. POST /auth/login -> {user, tenants, temp_token}
    # 2. POST /auth/token {temp_token, tenant_id} -> {access_token}
    
    # Implementation:
    # login returns a short lived JWT with scope="identity".
    # token endpoint requires scope="identity" and issues scope="access" with tenant_id.
    
    raise HTTPException(status_code=501, detail="Please use simplified flow for now or implement full OIDC")

# Simplifying for MVP verify
class LoginWithTenantRequest(BaseModel):
    email: str
    password: str
    tenant_id: str | None = None

@router.post("/v1/login-with-tenant")
def login_with_tenant(
    req: LoginWithTenantRequest,
    db: Session = Depends(get_db)
):
    user = auth_service.authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    tenants = auth_service.get_user_tenants(db, user.id)
    
    tenant_id = req.tenant_id
    
    # Auto-select if only 1 tenant and no preference
    if not tenant_id and len(tenants) == 1:
        tenant_id = str(tenants[0].id)
    
    target_tenant = None
    if tenant_id:
        target_tenant = next((t for t in tenants if str(t.id) == tenant_id), None)
        
    if target_tenant:
        membership = auth_service.get_tenant_membership(db, user.id, target_tenant.id)
        if not membership:
             raise HTTPException(status_code=403, detail="Not a member of this tenant")
        
        token = auth_service.create_tenant_token(user, target_tenant, membership, db)  # Pass db session
        return {
            "access_token": token,
            "token_type": "bearer",
            "tenant": {
                "id": str(target_tenant.id), 
                "name": target_tenant.name,
                "code": target_tenant.tenant_code,
                "engine": target_tenant.engine
            }
        }
    
    # If no tenant selected or found:
    return {
        "message": "Select a tenant",
        "tenants": [
            {
                "id": str(t.id), 
                "name": t.name,
                "code": t.tenant_code,
                "engine": t.engine
            } for t in tenants
        ],
        "require_tenant_selection": True
    }


# Response models
class TenantMembership(BaseModel):
    id: str
    name: str
    code: str
    engine: Optional[str] = None
    status: str  # Tenant status (ACTIVE, SUSPENDED, etc.)
    role: str
    membership_status: Optional[str] = None  # Membership status (ACTIVE, INVITED, etc.)


@router.get("/me/memberships", response_model=List[TenantMembership])
def get_my_memberships(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's memberships with their role in each tenant.
    Requires a valid JWT token.
    
    SUPER_ADMIN users see all active tenants with a special role indicator.
    """
    try:
        user_id_str = current_user["user_id"]
        is_super_admin = current_user.get("is_super_admin", False)
        
        # Convert user_id string to UUID
        try:
            user_id = uuid.UUID(user_id_str)
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid user ID format: {str(e)}"
            )
        
        memberships = []
        
        # SUPER_ADMIN: Return all active tenants with special role
        if is_super_admin:
            from app.models.rbac import Role, UserRole
            super_admin_role = db.query(Role).filter(Role.code == 'SUPER_ADMIN').first()
            
            if super_admin_role:
                # Get all active tenants
                tenants = db.query(Tenant).filter(Tenant.status == 'ACTIVE').order_by(Tenant.created_at.desc()).all()
                
                for tenant in tenants:
                    # Check if user has membership in this tenant
                    membership = db.query(Membership).filter(
                        Membership.user_id == user_id,
                        Membership.tenant_id == tenant.id,
                        Membership.status == 'ACTIVE'
                    ).first()
                    
                    if membership:
                        # User has membership - use actual role
                        role = membership.role or 'CASHIER'
                        membership_status = membership.status
                    else:
                        # No membership but SUPER_ADMIN - use special role
                        role = 'SUPER_ADMIN'
                        membership_status = 'ACTIVE'
                    
                    memberships.append(TenantMembership(
                        id=str(tenant.id),
                        name=tenant.name,
                        code=tenant.tenant_code,
                        engine=tenant.engine,
                        status=tenant.status or 'ACTIVE',
                        role=role,
                        membership_status=membership_status
                    ))
        else:
            # Regular user: Query all memberships with tenant info
            stmt = (
                select(Membership, Tenant)
                .join(Tenant, Membership.tenant_id == Tenant.id)
                .where(Membership.user_id == user_id)
                .where(Membership.status == 'ACTIVE')
            )
            
            results = db.execute(stmt).all()
            
            for membership, tenant in results:
                memberships.append(TenantMembership(
                    id=str(tenant.id),
                    name=tenant.name,
                    code=tenant.tenant_code,
                    engine=tenant.engine,
                    status=tenant.status or 'ACTIVE',  # Tenant status (workspace state)
                    role=membership.role or 'CASHIER',
                    membership_status=membership.status  # Membership status
                ))
        
        return memberships
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting memberships for user {current_user.get('user_id', 'unknown')}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve memberships: {str(e)}"
        )


class EngineHealthRequest(BaseModel):
    tenant_ids: List[str]


@router.post("/engine-health")
def check_engine_health(
    req: EngineHealthRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check engine connectivity status for multiple tenants.
    Works with identity tokens (no tenant context required).
    Returns health status for each requested tenant.
    """
    user_id = current_user["user_id"]
    is_super_admin = current_user.get("is_super_admin", False)
    
    results = {}
    
    for tenant_id in req.tenant_ids:
        try:
            # Verify user has access to this tenant
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if not tenant:
                results[tenant_id] = {"status": "not_found", "error": "Tenant not found"}
                continue
            
            # Check if user is member (unless super admin)
            if not is_super_admin:
                membership = db.query(Membership).filter(
                    Membership.user_id == user_id,
                    Membership.tenant_id == tenant_id,
                    Membership.status == 'ACTIVE'
                ).first()
                if not membership:
                    results[tenant_id] = {"status": "unauthorized", "error": "Not a member"}
                    continue
            
            # Use engine_health_service for health check
            engine = tenant.engine or 'erpnext'
            correlation_id = str(uuid.uuid4())[:8]
            
            health_result = engine_health_service.check_engine_health(
                tenant_id=tenant_id,
                engine_type=engine,
                correlation_id=correlation_id
            )
            
            results[tenant_id] = {
                "status": health_result.status.value,
                "engine": engine,
                "message": health_result.message,
                "checked_at": health_result.checked_at.isoformat(),
                "response_time_ms": health_result.response_time_ms,
                "error": health_result.error
            }
            
        except Exception as e:
            results[tenant_id] = {
                "status": "error",
                "error": str(e)
            }
    
    return {"results": results}
