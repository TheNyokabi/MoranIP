from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

from app.database import get_db
from app.dependencies.permissions import (
    require_permission,
    get_current_token_payload,
    require_tenant_access
)
from app.models.rbac import Role, Permission, UserRole, PermissionOverride
from app.models.iam import User
from app.services.rbac_service import rbac_service

router = APIRouter(
    prefix="/users",
    tags=["User Roles"],
)


# ==================== Request/Response Models ====================

class AssignRoleRequest(BaseModel):
    role_id: str = Field(..., description="Role UUID to assign")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date for temporary access")

    class Config:
        json_schema_extra = {
            "example": {
                "role_id": "123e4567-e89b-12d3-a456-426614174000",
                "expires_at": None
            }
        }


class GrantPermissionRequest(BaseModel):
    permission_id: str = Field(..., description="Permission UUID to grant/revoke")
    grant_type: str = Field(..., description="GRANT or REVOKE")
    reason: Optional[str] = Field(None, description="Reason for override")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")

    class Config:
        json_schema_extra = {
            "example": {
                "permission_id": "123e4567-e89b-12d3-a456-426614174000",
                "grant_type": "GRANT",
                "reason": "Temporary access for project X",
                "expires_at": None
            }
        }


class UserRoleResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: Optional[str]
    role: dict
    assigned_by: Optional[str]
    assigned_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
    is_expired: bool

    class Config:
        from_attributes = True


class PermissionOverrideResponse(BaseModel):
    id: str
    user_id: str
    tenant_id: str
    permission: dict
    grant_type: str
    reason: Optional[str]
    granted_by: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime]
    is_expired: bool

    class Config:
        from_attributes = True


# ==================== Endpoints ====================

@router.get("/{user_id}/roles", response_model=List[UserRoleResponse])
async def get_user_roles(
    user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:view"))
):
    """
    Get all roles assigned to a user in the current tenant.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get user roles
    user_roles = db.query(UserRole).join(Role).filter(
        UserRole.user_id == user_uuid,
        UserRole.tenant_id == tenant_uuid,
        UserRole.is_active == True
    ).all()
    
    result = []
    for ur in user_roles:
        result.append(UserRoleResponse(
            id=str(ur.id),
            user_id=str(ur.user_id),
            tenant_id=str(ur.tenant_id) if ur.tenant_id else None,
            role={
                "id": str(ur.role.id),
                "code": ur.role.code,
                "name": ur.role.name,
                "role_code": ur.role.role_code
            },
            assigned_by=str(ur.assigned_by) if ur.assigned_by else None,
            assigned_at=ur.assigned_at,
            expires_at=ur.expires_at,
            is_active=ur.is_active,
            is_expired=ur.is_expired
        ))
    
    return result


@router.post("/{user_id}/roles", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
async def assign_role_to_user(
    user_id: str,
    req: AssignRoleRequest,
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:assign_role"))
):
    """
    Assign a role to a user.
    
    Supports temporary role assignments with expiration dates.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
        role_uuid = uuid.UUID(req.role_id)
        assigned_by_uuid = uuid.UUID(payload.get("sub"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify role exists
    role = db.query(Role).filter(Role.id == role_uuid).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Check if role is OWNER (special handling)
    if role.code == 'OWNER':
        # Check if there's already an OWNER for this tenant
        existing_owner = db.query(UserRole).join(Role).filter(
            UserRole.tenant_id == tenant_uuid,
            Role.code == 'OWNER',
            UserRole.is_active == True
        ).first()
        
        if existing_owner and existing_owner.user_id != user_uuid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant already has an OWNER. Transfer ownership first."
            )
    
    # Get client IP
    ip_address = request.client.host if request.client else None
    
    try:
        # Assign role
        user_role = rbac_service.assign_role(
            db=db,
            user_id=user_uuid,
            tenant_id=tenant_uuid,
            role_id=role_uuid,
            assigned_by=assigned_by_uuid,
            expires_at=req.expires_at,
            ip_address=ip_address
        )
        
        return UserRoleResponse(
            id=str(user_role.id),
            user_id=str(user_role.user_id),
            tenant_id=str(user_role.tenant_id) if user_role.tenant_id else None,
            role={
                "id": str(role.id),
                "code": role.code,
                "name": role.name,
                "role_code": role.role_code
            },
            assigned_by=str(user_role.assigned_by) if user_role.assigned_by else None,
            assigned_at=user_role.assigned_at,
            expires_at=user_role.expires_at,
            is_active=user_role.is_active,
            is_expired=user_role.is_expired
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


@router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role_from_user(
    user_id: str,
    role_id: str,
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:revoke_role"))
):
    """
    Revoke a role from a user.
    
    OWNER role cannot be revoked (must transfer ownership).
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
        role_uuid = uuid.UUID(role_id)
        revoked_by_uuid = uuid.UUID(payload.get("sub"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Check if role is OWNER
    role = db.query(Role).filter(Role.id == role_uuid).first()
    if role and role.code == 'OWNER':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot revoke OWNER role. Transfer ownership instead."
        )
    
    # Get client IP
    ip_address = request.client.host if request.client else None
    
    # Revoke role
    success = rbac_service.revoke_role(
        db=db,
        user_id=user_uuid,
        tenant_id=tenant_uuid,
        role_id=role_uuid,
        revoked_by=revoked_by_uuid,
        ip_address=ip_address
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role assignment not found"
        )
    
    return None


@router.get("/{user_id}/permissions", response_model=List[str])
async def get_user_effective_permissions(
    user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:view"))
):
    """
    Get user's effective permissions (from roles + overrides).
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get effective permissions
    permissions = rbac_service.get_effective_permissions(db, user_uuid, tenant_uuid)
    
    return sorted(list(permissions))


@router.get("/{user_id}/overrides", response_model=List[PermissionOverrideResponse])
async def get_user_permission_overrides(
    user_id: str,
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:view"))
):
    """
    Get all permission overrides for a user.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Get overrides
    overrides = db.query(PermissionOverride).join(Permission).filter(
        PermissionOverride.user_id == user_uuid,
        PermissionOverride.tenant_id == tenant_uuid
    ).all()
    
    result = []
    for override in overrides:
        result.append(PermissionOverrideResponse(
            id=str(override.id),
            user_id=str(override.user_id),
            tenant_id=str(override.tenant_id),
            permission={
                "id": str(override.permission.id),
                "code": override.permission.code,
                "permission_code": override.permission.permission_code,
                "module": override.permission.module
            },
            grant_type=override.grant_type,
            reason=override.reason,
            granted_by=str(override.granted_by) if override.granted_by else None,
            created_at=override.created_at,
            expires_at=override.expires_at,
            is_expired=override.is_expired
        ))
    
    return result


@router.post("/{user_id}/overrides", response_model=PermissionOverrideResponse, status_code=status.HTTP_201_CREATED)
async def grant_permission_override(
    user_id: str,
    req: GrantPermissionRequest,
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:grant_permission"))
):
    """
    Grant or revoke a specific permission for a user (override).
    
    Use grant_type="GRANT" to add a permission outside their roles.
    Use grant_type="REVOKE" to explicitly deny a permission.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
        permission_uuid = uuid.UUID(req.permission_id)
        granted_by_uuid = uuid.UUID(payload.get("sub"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Validate grant_type
    if req.grant_type not in ['GRANT', 'REVOKE']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="grant_type must be 'GRANT' or 'REVOKE'"
        )
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_uuid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify permission exists
    permission = db.query(Permission).filter(Permission.id == permission_uuid).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    # Get client IP
    ip_address = request.client.host if request.client else None
    
    # Create override
    if req.grant_type == 'GRANT':
        override = rbac_service.grant_permission_override(
            db=db,
            user_id=user_uuid,
            tenant_id=tenant_uuid,
            permission_id=permission_uuid,
            granted_by=granted_by_uuid,
            reason=req.reason,
            expires_at=req.expires_at,
            ip_address=ip_address
        )
    else:  # REVOKE
        override = rbac_service.revoke_permission_override(
            db=db,
            user_id=user_uuid,
            tenant_id=tenant_uuid,
            permission_id=permission_uuid,
            revoked_by=granted_by_uuid,
            reason=req.reason,
            expires_at=req.expires_at,
            ip_address=ip_address
        )
    
    return PermissionOverrideResponse(
        id=str(override.id),
        user_id=str(override.user_id),
        tenant_id=str(override.tenant_id),
        permission={
            "id": str(permission.id),
            "code": permission.code,
            "permission_code": permission.permission_code,
            "module": permission.module
        },
        grant_type=override.grant_type,
        reason=override.reason,
        granted_by=str(override.granted_by) if override.granted_by else None,
        created_at=override.created_at,
        expires_at=override.expires_at,
        is_expired=override.is_expired
    )


@router.delete("/{user_id}/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission_override(
    user_id: str,
    override_id: str,
    request: Request,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:users:revoke_permission"))
):
    """
    Delete a permission override.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        override_uuid = uuid.UUID(override_id)
        deleted_by_uuid = uuid.UUID(payload.get("sub"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    # Get override
    override = db.query(PermissionOverride).filter(
        PermissionOverride.id == override_uuid,
        PermissionOverride.user_id == user_uuid
    ).first()
    
    if not override:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission override not found"
        )
    
    # Get client IP
    ip_address = request.client.host if request.client else None
    
    # Audit log
    rbac_service.audit_log(
        db=db,
        action="PERMISSION_OVERRIDE_DELETED",
        user_id=deleted_by_uuid,
        tenant_id=override.tenant_id,
        target_user_id=user_uuid,
        permission_id=override.permission_id,
        metadata={"override_id": str(override.id), "grant_type": override.grant_type},
        ip_address=ip_address
    )
    
    # Delete override
    db.delete(override)
    db.commit()
    
    return None
