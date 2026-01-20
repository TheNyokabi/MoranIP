from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models.rbac import Role, Permission, UserRole, RolePermission
from app.models.iam import User, Tenant
from app.dependencies.auth import get_current_user, require_tenant_access
from app.services.rbac_service import rbac_service
from datetime import datetime
import uuid

router = APIRouter(
    prefix="/rbac",
    tags=["RBAC - Roles & Permissions"],
)

# --- Response Models ---

class PermissionResponse(BaseModel):
    id: str
    code: str
    module: str
    resource: str
    action: str
    description: Optional[str]
    risk_level: str

    class Config:
        from_attributes = True

class RoleResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    level: str
    scope: str
    is_system: bool

    class Config:
        from_attributes = True

class RoleWithPermissionsResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    level: str
    scope: str
    is_system: bool
    permissions: List[PermissionResponse]

    class Config:
        from_attributes = True

class UserRoleResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: Optional[str]
    role_id: str
    role_code: str
    role_name: str
    assigned_by: Optional[str]
    assigned_at: datetime
    expires_at: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True

# --- Request Models ---

class AssignRoleRequest(BaseModel):
    role_code: str
    user_id: str
    expires_at: Optional[datetime] = None

# --- Endpoints ---

@router.get("/roles", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    List all available system roles.
    Returns roles that can be assigned to users.
    """
    roles = db.query(Role).filter(Role.is_system == True).all()
    return [RoleResponse.model_validate(role) for role in roles]

@router.get("/roles/{role_code}/permissions", response_model=RoleWithPermissionsResponse)
def get_role_permissions(
    role_code: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific role with all its permissions.
    """
    role = db.query(Role).filter(Role.code == role_code).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role {role_code} not found")
    
    # Get permissions for this role
    permissions = db.query(Permission).join(RolePermission).filter(
        RolePermission.role_id == role.id
    ).all()
    
    return {
        "id": str(role.id),
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "level": role.level,
        "scope": role.scope,
        "is_system": role.is_system,
        "permissions": [PermissionResponse.model_validate(p) for p in permissions]
    }

@router.post("/tenants/{tenant_id}/roles")
def assign_role_to_user(
    tenant_id: str,
    req: AssignRoleRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Assign a role to a user in a tenant.
    Requires ADMIN or OWNER permissions.
    """
    # Check permissions
    user_role = current_user.get("role", "")
    if user_role not in ["ADMIN", "OWNER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or OWNER can assign roles"
        )
    
    # Validate tenant
    tenant = db.query(Tenant).filter(Tenant.id == uuid.UUID(tenant_id)).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Validate user
    user = db.query(User).filter(User.id == uuid.UUID(req.user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role
    role = db.query(Role).filter(Role.code == req.role_code).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role {req.role_code} not found")
    
    # Assign role using RBAC service
    try:
        user_role = rbac_service.assign_role(
            db=db,
            user_id=uuid.UUID(req.user_id),
            tenant_id=uuid.UUID(tenant_id),
            role_id=role.id,
            assigned_by=uuid.UUID(current_user["user_id"]),
            expires_at=req.expires_at
        )
        
        return {
            "message": f"Role {req.role_code} assigned to user",
            "user_role_id": str(user_role.id)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/tenants/{tenant_id}/users/{user_id}/roles/{role_code}")
def remove_role_from_user(
    tenant_id: str,
    user_id: str,
    role_code: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a role from a user in a tenant.
    Requires ADMIN or OWNER permissions.
    """
    # Check permissions
    user_role = current_user.get("role", "")
    if user_role not in ["ADMIN", "OWNER"]:
        raise HTTPException(
            status_code=403,
            detail="Only ADMIN or OWNER can remove roles"
        )
    
    # Get role
    role = db.query(Role).filter(Role.code == role_code).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role {role_code} not found")
    
    # Revoke role using RBAC service
    success = rbac_service.revoke_role(
        db=db,
        user_id=uuid.UUID(user_id),
        tenant_id=uuid.UUID(tenant_id),
        role_id=role.id,
        revoked_by=uuid.UUID(current_user["user_id"])
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    
    return {"message": f"Role {role_code} removed from user"}

@router.get("/tenants/{tenant_id}/users/{user_id}/roles", response_model=List[UserRoleResponse])
def get_user_roles(
    tenant_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all roles assigned to a user in a tenant.
    """
    user_roles = db.query(UserRole).join(Role).filter(
        UserRole.user_id == uuid.UUID(user_id),
        UserRole.tenant_id == uuid.UUID(tenant_id),
        UserRole.is_active == True
    ).all()
    
    result = []
    for ur in user_roles:
        if not ur.is_expired:
            result.append({
                "id": str(ur.id),
                "user_id": str(ur.user_id),
                "tenant_id": str(ur.tenant_id) if ur.tenant_id else None,
                "role_id": str(ur.role_id),
                "role_code": ur.role.code,
                "role_name": ur.role.name,
                "assigned_by": str(ur.assigned_by) if ur.assigned_by else None,
                "assigned_at": ur.assigned_at,
                "expires_at": ur.expires_at,
                "is_active": ur.is_active
            })
    
    return result
