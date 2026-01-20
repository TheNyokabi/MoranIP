from fastapi import APIRouter, Depends, HTTPException, status, Query
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
from app.models.rbac import Role, Permission, RolePermission
from app.services.rbac_service import rbac_service
from app.utils.codes import generate_role_code

router = APIRouter(
    prefix="/roles",
    tags=["Roles"],
)


# ==================== Request/Response Models ====================

class CreateRoleRequest(BaseModel):
    code: str = Field(..., description="Role code (e.g., 'SALES_MANAGER')")
    name: str = Field(..., description="Human-readable name")
    description: Optional[str] = Field(None, description="Role description")
    permission_ids: List[str] = Field(default_factory=list, description="List of permission UUIDs")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "SALES_MANAGER",
                "name": "Sales Manager",
                "description": "Manages sales team and approves deals",
                "permission_ids": []
            }
        }


class UpdateRoleRequest(BaseModel):
    name: Optional[str] = Field(None, description="Human-readable name")
    description: Optional[str] = Field(None, description="Role description")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Senior Sales Manager",
                "description": "Manages sales team, approves deals, and sets quotas"
            }
        }


class AddPermissionsRequest(BaseModel):
    permission_ids: List[str] = Field(..., description="List of permission UUIDs to add")

    class Config:
        json_schema_extra = {
            "example": {
                "permission_ids": ["123e4567-e89b-12d3-a456-426614174000"]
            }
        }


class RoleResponse(BaseModel):
    id: str
    role_code: str
    code: str
    name: str
    description: Optional[str]
    level: str
    scope: str
    is_system: bool
    tenant_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    permission_count: Optional[int] = None

    class Config:
        from_attributes = True


class RoleWithPermissionsResponse(RoleResponse):
    permissions: List[dict]


# ==================== Endpoints ====================

@router.get("", response_model=List[RoleResponse])
async def list_roles(
    include_system: bool = Query(True, description="Include system roles"),
    include_custom: bool = Query(True, description="Include custom roles"),
    tenant_id: str = Depends(require_tenant_access),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:view"))
):
    """
    List all roles available in the tenant.
    
    Returns system roles (OWNER, ADMIN, etc.) and tenant-specific custom roles.
    """
    query = db.query(Role)
    
    # Filter by scope
    filters = []
    if include_system:
        filters.append(Role.scope == 'SYSTEM')
        filters.append(Role.scope == 'TENANT')
    
    if include_custom:
        filters.append(Role.level == 'CUSTOM')
    
    if filters:
        from sqlalchemy import or_
        query = query.filter(or_(*filters))
    
    # For custom roles, only show those belonging to this tenant
    # System and tenant roles are global
    roles = query.all()
    
    # Filter custom roles by tenant
    tenant_uuid = uuid.UUID(tenant_id)
    filtered_roles = []
    for role in roles:
        if role.level == 'CUSTOM':
            if role.tenant_id == tenant_uuid:
                filtered_roles.append(role)
        else:
            filtered_roles.append(role)
    
    # Add permission count
    result = []
    for role in filtered_roles:
        role_dict = {
            "id": str(role.id),
            "role_code": role.role_code,
            "code": role.code,
            "name": role.name,
            "description": role.description,
            "level": role.level,
            "scope": role.scope,
            "is_system": role.is_system,
            "tenant_id": str(role.tenant_id) if role.tenant_id else None,
            "created_at": role.created_at,
            "updated_at": role.updated_at,
            "permission_count": len(role.permissions)
        }
        result.append(RoleResponse(**role_dict))
    
    return result


@router.get("/{role_id}", response_model=RoleWithPermissionsResponse)
async def get_role(
    role_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:view"))
):
    """
    Get detailed information about a specific role, including all permissions.
    """
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Get permissions
    permissions = db.query(Permission).join(RolePermission).filter(
        RolePermission.role_id == role.id
    ).all()
    
    permission_list = [
        {
            "id": str(p.id),
            "permission_code": p.permission_code,
            "code": p.code,
            "module": p.module,
            "resource": p.resource,
            "action": p.action,
            "description": p.description,
            "risk_level": p.risk_level
        }
        for p in permissions
    ]
    
    return RoleWithPermissionsResponse(
        id=str(role.id),
        role_code=role.role_code,
        code=role.code,
        name=role.name,
        description=role.description,
        level=role.level,
        scope=role.scope,
        is_system=role.is_system,
        tenant_id=str(role.tenant_id) if role.tenant_id else None,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permission_count=len(permission_list),
        permissions=permission_list
    )


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    req: CreateRoleRequest,
    tenant_id: str = Depends(require_tenant_access),
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:create"))
):
    """
    Create a custom role for the tenant.
    
    System roles (OWNER, ADMIN, etc.) cannot be created via API.
    """
    # Check if role code already exists
    existing = db.query(Role).filter(Role.code == req.code.upper()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with code '{req.code}' already exists"
        )
    
    # Get tenant
    from app.models.iam import Tenant
    tenant_uuid = uuid.UUID(tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Generate role code
    role_code = generate_role_code("CUSTOM", tenant.country_code, db)
    
    # Create role
    role = Role(
        role_code=role_code,
        code=req.code.upper(),
        name=req.name,
        description=req.description,
        level='CUSTOM',
        scope='TENANT',
        is_system=False,
        tenant_id=tenant_uuid
    )
    db.add(role)
    db.flush()
    
    # Add permissions
    if req.permission_ids:
        for perm_id_str in req.permission_ids:
            try:
                perm_id = uuid.UUID(perm_id_str)
                permission = db.query(Permission).filter(Permission.id == perm_id).first()
                if permission:
                    role_perm = RolePermission(
                        role_id=role.id,
                        permission_id=permission.id
                    )
                    db.add(role_perm)
            except ValueError:
                continue
    
    # Audit log
    user_id = uuid.UUID(payload.get("sub"))
    rbac_service.audit_log(
        db=db,
        action="ROLE_CREATED",
        user_id=user_id,
        tenant_id=tenant_uuid,
        role_id=role.id,
        metadata={"role_code": role.code, "name": role.name}
    )
    
    db.commit()
    db.refresh(role)
    
    return RoleResponse(
        id=str(role.id),
        role_code=role.role_code,
        code=role.code,
        name=role.name,
        description=role.description,
        level=role.level,
        scope=role.scope,
        is_system=role.is_system,
        tenant_id=str(role.tenant_id) if role.tenant_id else None,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permission_count=len(req.permission_ids)
    )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    req: UpdateRoleRequest,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:edit"))
):
    """
    Update a custom role.
    
    System roles cannot be modified.
    """
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system roles"
        )
    
    # Update fields
    if req.name is not None:
        role.name = req.name
    if req.description is not None:
        role.description = req.description
    
    role.updated_at = datetime.utcnow()
    
    # Audit log
    user_id = uuid.UUID(payload.get("sub"))
    tenant_id = uuid.UUID(payload.get("tenant_id")) if payload.get("tenant_id") else None
    rbac_service.audit_log(
        db=db,
        action="ROLE_UPDATED",
        user_id=user_id,
        tenant_id=tenant_id,
        role_id=role.id,
        metadata={"changes": req.dict(exclude_unset=True)}
    )
    
    db.commit()
    db.refresh(role)
    
    return RoleResponse(
        id=str(role.id),
        role_code=role.role_code,
        code=role.code,
        name=role.name,
        description=role.description,
        level=role.level,
        scope=role.scope,
        is_system=role.is_system,
        tenant_id=str(role.tenant_id) if role.tenant_id else None,
        created_at=role.created_at,
        updated_at=role.updated_at,
        permission_count=len(role.permissions)
    )


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:delete"))
):
    """
    Delete a custom role.
    
    System roles cannot be deleted.
    Role must not be assigned to any users.
    """
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete system roles"
        )
    
    # Check if role is assigned to any users
    from app.models.rbac import UserRole
    assigned_count = db.query(UserRole).filter(
        UserRole.role_id == role.id,
        UserRole.is_active == True
    ).count()
    
    if assigned_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete role: assigned to {assigned_count} user(s)"
        )
    
    # Audit log
    user_id = uuid.UUID(payload.get("sub"))
    tenant_id = uuid.UUID(payload.get("tenant_id")) if payload.get("tenant_id") else None
    rbac_service.audit_log(
        db=db,
        action="ROLE_DELETED",
        user_id=user_id,
        tenant_id=tenant_id,
        role_id=role.id,
        metadata={"role_code": role.code, "name": role.name}
    )
    
    # Delete role (cascade will handle role_permissions)
    db.delete(role)
    db.commit()
    
    return None


@router.get("/{role_id}/permissions", response_model=List[dict])
async def get_role_permissions(
    role_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:view"))
):
    """
    Get all permissions assigned to a role.
    """
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    permissions = db.query(Permission).join(RolePermission).filter(
        RolePermission.role_id == role.id
    ).all()
    
    return [
        {
            "id": str(p.id),
            "permission_code": p.permission_code,
            "code": p.code,
            "module": p.module,
            "resource": p.resource,
            "action": p.action,
            "description": p.description,
            "risk_level": p.risk_level
        }
        for p in permissions
    ]


@router.post("/{role_id}/permissions", status_code=status.HTTP_201_CREATED)
async def add_permissions_to_role(
    role_id: str,
    req: AddPermissionsRequest,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:edit"))
):
    """
    Add permissions to a role.
    
    System roles cannot be modified.
    """
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system roles"
        )
    
    added_count = 0
    for perm_id_str in req.permission_ids:
        try:
            perm_id = uuid.UUID(perm_id_str)
            
            # Check if already assigned
            existing = db.query(RolePermission).filter(
                RolePermission.role_id == role.id,
                RolePermission.permission_id == perm_id
            ).first()
            
            if existing:
                continue
            
            # Verify permission exists
            permission = db.query(Permission).filter(Permission.id == perm_id).first()
            if not permission:
                continue
            
            # Add permission
            role_perm = RolePermission(
                role_id=role.id,
                permission_id=perm_id
            )
            db.add(role_perm)
            added_count += 1
            
        except ValueError:
            continue
    
    # Audit log
    user_id = uuid.UUID(payload.get("sub"))
    tenant_id = uuid.UUID(payload.get("tenant_id")) if payload.get("tenant_id") else None
    rbac_service.audit_log(
        db=db,
        action="PERMISSIONS_ADDED_TO_ROLE",
        user_id=user_id,
        tenant_id=tenant_id,
        role_id=role.id,
        metadata={"added_count": added_count, "permission_ids": req.permission_ids}
    )
    
    db.commit()
    
    return {"message": f"Added {added_count} permission(s) to role", "added_count": added_count}


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:roles:edit"))
):
    """
    Remove a permission from a role.
    
    System roles cannot be modified.
    """
    try:
        role_uuid = uuid.UUID(role_id)
        perm_uuid = uuid.UUID(permission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ID format"
        )
    
    role = db.query(Role).filter(Role.id == role_uuid).first()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify system roles"
        )
    
    role_perm = db.query(RolePermission).filter(
        RolePermission.role_id == role.id,
        RolePermission.permission_id == perm_uuid
    ).first()
    
    if not role_perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not assigned to this role"
        )
    
    # Audit log
    user_id = uuid.UUID(payload.get("sub"))
    tenant_id = uuid.UUID(payload.get("tenant_id")) if payload.get("tenant_id") else None
    rbac_service.audit_log(
        db=db,
        action="PERMISSION_REMOVED_FROM_ROLE",
        user_id=user_id,
        tenant_id=tenant_id,
        role_id=role.id,
        permission_id=perm_uuid,
        metadata={}
    )
    
    db.delete(role_perm)
    db.commit()
    
    return None
