from typing import List, Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.dependencies.auth import get_current_token_payload, require_tenant_access, get_current_user
from app.database import get_db
from app.services.rbac_service import rbac_service

# Re-export auth dependencies for convenience
__all__ = ['require_permission', 'get_current_token_payload', 'require_tenant_access', 'get_current_user', 'get_current_user_permissions']


def require_permission(permission: str) -> Callable:
    """
    Dependency factory for single permission check.
    
    Usage:
        @router.post("/leads", dependencies=[Depends(require_permission("crm:leads:create"))])
        def create_lead(...):
            ...
    
    Args:
        permission: Required permission code (e.g., "crm:leads:create")
    
    Returns:
        Dependency function
    """
    async def permission_checker(
        payload: dict = Depends(get_current_token_payload),
        db: Session = Depends(get_db)
    ) -> bool:
        # Check if super admin (bypass all checks)
        if payload.get("is_super_admin"):
            return True
        
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # Convert string IDs to UUID
        try:
            user_uuid = uuid.UUID(user_id)
            tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: malformed IDs"
            )
        
        # Check permission
        has_perm = rbac_service.has_permission(db, user_uuid, tenant_uuid, permission)
        
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}"
            )
        
        return True
    
    return permission_checker


def require_any_permission(permissions: List[str]) -> Callable:
    """
    Dependency factory for checking if user has ANY of the listed permissions.
    
    Usage:
        @router.get("/data", dependencies=[Depends(require_any_permission(["crm:leads:view", "crm:leads:edit"]))])
        def get_data(...):
            ...
    
    Args:
        permissions: List of permission codes
    
    Returns:
        Dependency function
    """
    async def permission_checker(
        payload: dict = Depends(get_current_token_payload),
        db: Session = Depends(get_db)
    ) -> bool:
        # Check if super admin (bypass all checks)
        if payload.get("is_super_admin"):
            return True
        
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # Convert string IDs to UUID
        try:
            user_uuid = uuid.UUID(user_id)
            tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: malformed IDs"
            )
        
        # Check if user has ANY of the permissions
        for permission in permissions:
            if rbac_service.has_permission(db, user_uuid, tenant_uuid, permission):
                return True
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing required permissions. Need one of: {', '.join(permissions)}"
        )
    
    return permission_checker


def require_all_permissions(permissions: List[str]) -> Callable:
    """
    Dependency factory for checking if user has ALL of the listed permissions.
    
    Usage:
        @router.post("/approve", dependencies=[Depends(require_all_permissions(["crm:leads:edit", "crm:leads:approve"]))])
        def approve_lead(...):
            ...
    
    Args:
        permissions: List of permission codes
    
    Returns:
        Dependency function
    """
    async def permission_checker(
        payload: dict = Depends(get_current_token_payload),
        db: Session = Depends(get_db)
    ) -> bool:
        # Check if super admin (bypass all checks)
        if payload.get("is_super_admin"):
            return True
        
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # Convert string IDs to UUID
        try:
            user_uuid = uuid.UUID(user_id)
            tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: malformed IDs"
            )
        
        # Check if user has ALL permissions
        missing_permissions = []
        for permission in permissions:
            if not rbac_service.has_permission(db, user_uuid, tenant_uuid, permission):
                missing_permissions.append(permission)
        
        if missing_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permissions: {', '.join(missing_permissions)}"
            )
        
        return True
    
    return permission_checker


def require_role(role_code: str) -> Callable:
    """
    Dependency factory for checking if user has a specific role.
    
    Usage:
        @router.get("/admin", dependencies=[Depends(require_role("ADMIN"))])
        def admin_panel(...):
            ...
    
    Args:
        role_code: Required role code (e.g., "ADMIN", "MANAGER")
    
    Returns:
        Dependency function
    """
    async def role_checker(
        payload: dict = Depends(get_current_token_payload)
    ) -> bool:
        # Check if super admin (bypass all checks)
        if payload.get("is_super_admin"):
            return True
        
        roles = payload.get("roles", [])
        
        if role_code not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required role: {role_code}"
            )
        
        return True
    
    return role_checker


async def get_current_user_permissions(
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
) -> List[str]:
    """
    Get current user's effective permissions (for injection into route handlers).
    
    Usage:
        @router.get("/data")
        def get_data(permissions: List[str] = Depends(get_current_user_permissions)):
            if "crm:leads:delete" in permissions:
                # Show delete button
            ...
    
    Returns:
        List of permission codes
    """
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")
    
    if not user_id:
        return []
    
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
    except (ValueError, TypeError):
        return []
    
    permissions = rbac_service.get_effective_permissions(db, user_uuid, tenant_uuid)
    return list(permissions)


async def get_current_user_roles(
    payload: dict = Depends(get_current_token_payload)
) -> List[str]:
    """
    Extract roles from JWT token.
    
    Usage:
        @router.get("/profile")
        def get_profile(roles: List[str] = Depends(get_current_user_roles)):
            ...
    
    Returns:
        List of role codes
    """
    return payload.get("roles", [])


async def is_super_admin(
    payload: dict = Depends(get_current_token_payload)
) -> bool:
    """
    Check if current user is super admin.
    
    Usage:
        @router.get("/system")
        def system_settings(is_admin: bool = Depends(is_super_admin)):
            if not is_admin:
                raise HTTPException(403, "Super admin only")
            ...
    
    Returns:
        True if super admin, False otherwise
    """
    return payload.get("is_super_admin", False)
