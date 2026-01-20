from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid

from app.database import get_db
from app.dependencies.permissions import (
    require_permission,
    get_current_token_payload,
    get_current_user_permissions
)
from app.models.rbac import Permission
from app.services.rbac_service import rbac_service

router = APIRouter(
    prefix="/permissions",
    tags=["Permissions"],
)


# ==================== Request/Response Models ====================

class PermissionResponse(BaseModel):
    id: str
    permission_code: str
    code: str
    module: str
    resource: str
    action: str
    description: Optional[str]
    risk_level: str

    class Config:
        from_attributes = True


class ModulePermissionsResponse(BaseModel):
    module: str
    module_name: str
    permission_count: int
    permissions: List[PermissionResponse]


class CheckPermissionsRequest(BaseModel):
    permissions: List[str] = Field(..., description="List of permission codes to check")

    class Config:
        json_schema_extra = {
            "example": {
                "permissions": ["crm:leads:create", "inventory:products:edit", "accounting:invoices:approve"]
            }
        }


class CheckPermissionsResponse(BaseModel):
    results: Dict[str, bool]


# ==================== Endpoints ====================

@router.get("", response_model=List[PermissionResponse])
async def list_permissions(
    module: Optional[str] = Query(None, description="Filter by module (e.g., 'crm', 'inventory')"),
    resource: Optional[str] = Query(None, description="Filter by resource (e.g., 'leads', 'products')"),
    action: Optional[str] = Query(None, description="Filter by action (e.g., 'view', 'create', 'edit')"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (LOW, MEDIUM, HIGH, CRITICAL)"),
    search: Optional[str] = Query(None, description="Search in code or description"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:permissions:view"))
):
    """
    List all available permissions with optional filtering.
    
    Supports filtering by module, resource, action, risk level, and text search.
    """
    query = db.query(Permission)
    
    # Apply filters
    if module:
        query = query.filter(Permission.module == module.lower())
    
    if resource:
        query = query.filter(Permission.resource == resource.lower())
    
    if action:
        query = query.filter(Permission.action == action.lower())
    
    if risk_level:
        query = query.filter(Permission.risk_level == risk_level.upper())
    
    if search:
        search_pattern = f"%{search.lower()}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Permission.code.ilike(search_pattern),
                Permission.description.ilike(search_pattern)
            )
        )
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination
    permissions = query.offset(offset).limit(limit).all()
    
    result = [
        PermissionResponse(
            id=str(p.id),
            permission_code=p.permission_code,
            code=p.code,
            module=p.module,
            resource=p.resource,
            action=p.action,
            description=p.description,
            risk_level=p.risk_level
        )
        for p in permissions
    ]
    
    return result


@router.get("/modules", response_model=List[dict])
async def list_modules(
    db: Session = Depends(get_db)
):
    """
    List all modules with permission counts.
    
    Public endpoint - no authentication required.
    """
    from sqlalchemy import func
    
    # Group by module and count
    modules = db.query(
        Permission.module,
        func.count(Permission.id).label('count')
    ).group_by(Permission.module).all()
    
    # Module display names
    module_names = {
        'iam': 'Identity & Access Management',
        'crm': 'Customer Relationship Management',
        'inventory': 'Inventory Management',
        'manufacturing': 'Manufacturing',
        'accounting': 'Accounting & Finance',
        'hr': 'Human Resources',
        'sales': 'Sales',
        'purchasing': 'Purchasing',
        'chama': 'Chama (Groups)',
        'ledger': 'Ledger & Wallets',
        'tenant': 'Tenant Management',
        'dashboard': 'Dashboard & Analytics'
    }
    
    result = [
        {
            "module": module,
            "module_name": module_names.get(module, module.title()),
            "permission_count": count
        }
        for module, count in modules
    ]
    
    # Sort by module name
    result.sort(key=lambda x: x['module'])
    
    return result


@router.get("/modules/{module}", response_model=ModulePermissionsResponse)
async def get_module_permissions(
    module: str,
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:permissions:view"))
):
    """
    Get all permissions for a specific module.
    """
    permissions = db.query(Permission).filter(
        Permission.module == module.lower()
    ).all()
    
    if not permissions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No permissions found for module '{module}'"
        )
    
    module_names = {
        'iam': 'Identity & Access Management',
        'crm': 'Customer Relationship Management',
        'inventory': 'Inventory Management',
        'manufacturing': 'Manufacturing',
        'accounting': 'Accounting & Finance',
        'hr': 'Human Resources',
        'sales': 'Sales',
        'purchasing': 'Purchasing',
        'chama': 'Chama (Groups)',
        'ledger': 'Ledger & Wallets',
        'tenant': 'Tenant Management',
        'dashboard': 'Dashboard & Analytics'
    }
    
    permission_list = [
        PermissionResponse(
            id=str(p.id),
            permission_code=p.permission_code,
            code=p.code,
            module=p.module,
            resource=p.resource,
            action=p.action,
            description=p.description,
            risk_level=p.risk_level
        )
        for p in permissions
    ]
    
    return ModulePermissionsResponse(
        module=module.lower(),
        module_name=module_names.get(module.lower(), module.title()),
        permission_count=len(permission_list),
        permissions=permission_list
    )


@router.get("/me", response_model=List[str])
async def get_my_permissions(
    permissions: List[str] = Depends(get_current_user_permissions)
):
    """
    Get current user's effective permissions.
    
    Returns a list of all permission codes the user has access to,
    including those from roles and permission overrides.
    """
    return sorted(permissions)


@router.post("/check", response_model=CheckPermissionsResponse)
async def check_permissions(
    req: CheckPermissionsRequest,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Batch permission check for frontend.
    
    Checks if the current user has each of the specified permissions.
    Useful for determining which UI elements to show/hide.
    
    Example request:
    ```json
    {
        "permissions": ["crm:leads:create", "inventory:products:edit"]
    }
    ```
    
    Example response:
    ```json
    {
        "results": {
            "crm:leads:create": true,
            "inventory:products:edit": false
        }
    }
    ```
    """
    # Super admin has all permissions
    if payload.get("is_super_admin"):
        return CheckPermissionsResponse(
            results={perm: True for perm in req.permissions}
        )
    
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    
    if not user_id:
        return CheckPermissionsResponse(
            results={perm: False for perm in req.permissions}
        )
    
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
    except (ValueError, TypeError):
        return CheckPermissionsResponse(
            results={perm: False for perm in req.permissions}
        )
    
    # Check each permission
    results = {}
    for permission in req.permissions:
        has_perm = rbac_service.has_permission(db, user_uuid, tenant_uuid, permission)
        results[permission] = has_perm
    
    return CheckPermissionsResponse(results=results)


@router.get("/actions", response_model=List[str])
async def list_actions(
    db: Session = Depends(get_db)
):
    """
    Get all unique permission actions.
    
    Public endpoint - returns distinct action types (view, create, edit, delete, etc.)
    """
    from sqlalchemy import distinct
    
    actions = db.query(distinct(Permission.action)).all()
    
    return sorted([action[0] for action in actions])


@router.get("/resources", response_model=List[dict])
async def list_resources(
    module: Optional[str] = Query(None, description="Filter by module"),
    db: Session = Depends(get_db)
):
    """
    Get all unique resources, optionally filtered by module.
    
    Public endpoint - returns distinct resource types.
    """
    from sqlalchemy import distinct, func
    
    query = db.query(
        Permission.module,
        Permission.resource,
        func.count(Permission.id).label('permission_count')
    )
    
    if module:
        query = query.filter(Permission.module == module.lower())
    
    resources = query.group_by(Permission.module, Permission.resource).all()
    
    result = [
        {
            "module": module,
            "resource": resource,
            "permission_count": count
        }
        for module, resource, count in resources
    ]
    
    # Sort by module then resource
    result.sort(key=lambda x: (x['module'], x['resource']))
    
    return result


@router.get("/risk-levels", response_model=Dict[str, int])
async def get_risk_level_distribution(
    module: Optional[str] = Query(None, description="Filter by module"),
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:permissions:view"))
):
    """
    Get distribution of permissions by risk level.
    
    Useful for security audits and understanding permission sensitivity.
    """
    from sqlalchemy import func
    
    query = db.query(
        Permission.risk_level,
        func.count(Permission.id).label('count')
    )
    
    if module:
        query = query.filter(Permission.module == module.lower())
    
    distribution = query.group_by(Permission.risk_level).all()
    
    result = {
        risk_level: count
        for risk_level, count in distribution
    }
    
    # Ensure all risk levels are present
    for level in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
        if level not in result:
            result[level] = 0
    
    return result


@router.get("/{permission_id}", response_model=PermissionResponse)
async def get_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(require_permission("iam:permissions:view"))
):
    """
    Get detailed information about a specific permission.
    """
    try:
        perm_uuid = uuid.UUID(permission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid permission ID format"
        )
    
    permission = db.query(Permission).filter(Permission.id == perm_uuid).first()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    return PermissionResponse(
        id=str(permission.id),
        permission_code=permission.permission_code,
        code=permission.code,
        module=permission.module,
        resource=permission.resource,
        action=permission.action,
        description=permission.description,
        risk_level=permission.risk_level
    )
