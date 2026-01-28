from fastapi import Depends, HTTPException, status, Header, Path, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional
import uuid
import re
from app.config import settings
from app.services.auth_service import ALGORITHM
from app.models.iam import Membership
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/v1/login-with-tenant", auto_error=False)

async def get_current_token_payload(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if token was provided
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise credentials_exception

async def get_current_user(payload: dict = Depends(get_current_token_payload)):
    """
    Returns the current user info from the JWT payload.
    """
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user information",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "user_id": user_id,
        "user_code": payload.get("user_code"),
        "tenant_id": payload.get("tenant_id"),
        "tenant_code": payload.get("tenant_code"),
        "kyc_tier": payload.get("kyc_tier"),
        "roles": payload.get("roles", []),
        "is_super_admin": payload.get("is_super_admin", False),
    }

def _extract_tenant_from_path(path: str) -> Optional[str]:
    """Extract tenant_id from URL path like /api/tenants/{tenant_id}/..."""
    match = re.search(r'/tenants/([^/]+)/', path)
    if match:
        return match.group(1)
    return None

async def require_tenant_access(
    request: Request,
    payload: dict = Depends(get_current_token_payload),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    db: Session = Depends(get_db)
):
    """
    Ensures the token has tenant context (either in JWT, URL path, X-Tenant-ID header).
    Returns the tenant_id (UUID).
    
    Priority:
    1. tenant_id from JWT token (if present)
    2. tenant_id from URL path (if present, e.g., /api/tenants/{tenant_id}/...)
    3. X-Tenant-ID header (if present and user has membership)
    
    Note: tenant_id can be either UUID or tenant code/slug (e.g., TEN-KE-26-8K1E0).
    SUPER_ADMIN users bypass membership checks and can access any tenant.
    """
    token_tenant_id = payload.get("tenant_id")
    is_super_admin = payload.get("is_super_admin", False)
    user_id = payload.get("sub")
    
    # Extract tenant_id from URL path
    path_tenant_id = _extract_tenant_from_path(request.url.path)
    
    # Resolve tenant_id from various sources (priority: token > path > header)
    resolved_tenant_id = None
    tenant_source = None
    
    if token_tenant_id:
        resolved_tenant_id = token_tenant_id
        tenant_source = "token"
    elif path_tenant_id:  # Path parameter
        resolved_tenant_id = path_tenant_id
        tenant_source = "path"
    elif x_tenant_id:  # Header
        resolved_tenant_id = x_tenant_id
        tenant_source = "header"
    
    # SUPER_ADMIN can access any tenant
    if is_super_admin:
        if resolved_tenant_id:
            # Convert to UUID if needed
            if tenant_source in ("path", "header"):
                from app.models.iam import Tenant
                # First check if it's a valid UUID, then query accordingly
                try:
                    tenant_uuid = uuid.UUID(resolved_tenant_id)
                    # It's a valid UUID, query by ID
                    tenant_obj = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
                except (ValueError, TypeError):
                    # Not a UUID, query by tenant_code
                    tenant_obj = db.query(Tenant).filter(Tenant.tenant_code == resolved_tenant_id).first()
                if tenant_obj:
                    return str(tenant_obj.id)
                else:
                    # For super admin, allow access even if tenant doesn't exist in DB
                    # This handles cases where tenant context comes from headers
                    return resolved_tenant_id
            return resolved_tenant_id
        # For super admin without specific tenant, return system context
        return "system"
    
    # For non-super-admin users, verify membership
    if not resolved_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing tenant context. Please provide X-Tenant-ID header or use a tenant-scoped token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # If tenant_id is in token, use it directly (tenant-scoped token)
    if tenant_source == "token":
        return resolved_tenant_id
    
    # For path parameter or header, verify membership
    # resolved_tenant_id might be UUID or tenant code/slug (e.g., TEN-KE-26-8K1E0)
    # Verify user has membership in this tenant
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user information",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        from app.models.iam import Tenant
        
        user_uuid = uuid.UUID(user_id)
        
        # resolved_tenant_id can be either a UUID or a tenant code/slug (e.g., TEN-KE-26-8K1E0)
        # First check if it's a valid UUID, then query accordingly
        try:
            tenant_uuid = uuid.UUID(resolved_tenant_id)
            # It's a valid UUID, query by ID
            tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
        except (ValueError, TypeError):
            # Not a UUID, query by tenant_code
            tenant = db.query(Tenant).filter(Tenant.tenant_code == resolved_tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant not found: {resolved_tenant_id}"
            )
        
        # Now verify membership using the actual tenant UUID
        tenant_uuid = tenant.id
        
        stmt = select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.tenant_id == tenant_uuid,
            Membership.status == 'ACTIVE'
        )
        membership = db.execute(stmt).scalar_one_or_none()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this tenant"
            )
        
        # Return the tenant UUID (not the code) for consistency
        return str(tenant_uuid)
    except HTTPException:
        raise
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tenant ID format: {str(e)}"
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error verifying tenant access for user {user_id} and tenant {resolved_tenant_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify tenant access"
        )


def verify_tenant_access(
    requested_tenant_id: str,
    payload: dict = Depends(get_current_token_payload)
) -> bool:
    """
    Verify if user has access to the requested tenant.
    
    Returns True if:
    - User is SUPER_ADMIN (system-wide access), OR
    - User's tenant_id matches requested_tenant_id
    
    Raises HTTPException(403) otherwise.
    """
    is_super_admin = payload.get("is_super_admin", False)
    if is_super_admin:
        return True
    
    user_tenant_id = payload.get("tenant_id")
    if user_tenant_id != requested_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this tenant"
        )
    
    return True


async def verify_tenant_membership(
    tenant_id: str,
    payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
) -> bool:
    """
    Dependency that verifies user has membership in the requested tenant.
    Checks membership from database, not just from token.
    
    Usage:
        @router.get("/tenants/{tenant_id}/status")
        def get_status(
            tenant_id: str,
            _: bool = Depends(verify_tenant_membership),
            ...
        ):
    """
    is_super_admin = payload.get("is_super_admin", False)
    if is_super_admin:
        return True
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user information",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check membership in database
    try:
        user_uuid = uuid.UUID(user_id)
        tenant_uuid = uuid.UUID(tenant_id)
        
        stmt = select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.tenant_id == tenant_uuid,
            Membership.status == 'ACTIVE'
        )
        membership = db.execute(stmt).scalar_one_or_none()
        
        if not membership:
            # Check if tenant exists for better error message
            from app.models.iam import Tenant
            tenant = db.query(Tenant).filter(Tenant.id == tenant_uuid).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tenant not found"
                )
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this tenant"
            )
        
        return True
    except HTTPException:
        raise
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tenant ID format: {str(e)}"
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error verifying tenant membership for user {user_id} and tenant {tenant_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify tenant membership"
        )