from typing import List, Set, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from datetime import datetime
import uuid
import fnmatch

from app.models.rbac import Role, Permission, UserRole, PermissionOverride, RolePermission, RoleAuditLog
from app.models.iam import User, Tenant


class RBACService:
    """
    Core RBAC service for permission checking and role management.
    """
    
    def has_permission(
        self, 
        db: Session, 
        user_id: uuid.UUID, 
        tenant_id: Optional[uuid.UUID], 
        permission: str
    ) -> bool:
        """
        Check if user has a specific permission in tenant context.
        
        Logic:
        1. Check for SUPER_ADMIN (bypasses all checks)
        2. Get user's roles in tenant
        3. Resolve all permissions from roles
        4. Check for permission overrides (grants/revokes)
        5. Match against requested permission (support wildcards)
        
        Args:
            db: Database session
            user_id: User UUID
            tenant_id: Tenant UUID (None for system-level permissions)
            permission: Permission code (e.g., "crm:leads:create")
        
        Returns:
            True if user has permission, False otherwise
        """
        # Check if user is SUPER_ADMIN
        super_admin_role = db.query(Role).filter(Role.code == 'SUPER_ADMIN').first()
        if super_admin_role:
            has_super_admin = db.query(UserRole).filter(
                UserRole.user_id == user_id,
                UserRole.role_id == super_admin_role.id,
                UserRole.is_active == True
            ).first()
            if has_super_admin and not has_super_admin.is_expired:
                return True
        
        # Get user's effective permissions
        effective_permissions = self.get_effective_permissions(db, user_id, tenant_id)
        
        # Check if permission matches (with wildcard support)
        return self.check_permission_match(effective_permissions, permission)
    
    def get_user_roles(self, db: Session, user_id: uuid.UUID, tenant_id: Optional[uuid.UUID]) -> List[Role]:
        """
        Get all active roles for a user in a tenant.
        
        Args:
            db: Database session
            user_id: User UUID
            tenant_id: Tenant UUID (None for system-level roles)
        
        Returns:
            List of Role objects
        """
        query = db.query(Role).join(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.is_active == True
        )
        
        if tenant_id:
            query = query.filter(
                or_(
                    UserRole.tenant_id == tenant_id,
                    UserRole.tenant_id == None  # Include system roles
                )
            )
        else:
            query = query.filter(UserRole.tenant_id == None)
        
        roles = query.all()
        
        # Filter out expired roles
        return [role for role in roles if not self._is_user_role_expired(db, user_id, role.id, tenant_id)]
    
    def get_user_permissions(self, db: Session, user_id: uuid.UUID, tenant_id: Optional[uuid.UUID]) -> List[str]:
        """
        Get all permission codes from user's roles (without overrides).
        
        Args:
            db: Database session
            user_id: User UUID
            tenant_id: Tenant UUID
        
        Returns:
            List of permission codes
        """
        roles = self.get_user_roles(db, user_id, tenant_id)
        role_ids = [role.id for role in roles]
        
        if not role_ids:
            return []
        
        permissions = db.query(Permission).join(RolePermission).filter(
            RolePermission.role_id.in_(role_ids)
        ).all()
        
        return [perm.code for perm in permissions]
    
    def get_effective_permissions(self, db: Session, user_id: uuid.UUID, tenant_id: Optional[uuid.UUID]) -> Set[str]:
        """
        Get user's effective permissions including overrides.
        
        Logic:
        1. Get permissions from roles
        2. Apply GRANT overrides (add permissions)
        3. Apply REVOKE overrides (remove permissions)
        4. If user is tenant owner (via Membership or UserRole), grant all permissions
        
        Args:
            db: Database session
            user_id: User UUID
            tenant_id: Tenant UUID
        
        Returns:
            Set of permission codes
        """
        # Start with role-based permissions
        permissions = set(self.get_user_permissions(db, user_id, tenant_id))
        
        if not tenant_id:
            return permissions
        
        # Check if user is tenant owner (even if OWNER role doesn't exist)
        # This handles the case where RBAC migrations haven't run but tenant was created
        from app.models.iam import Membership
        owner_membership = db.query(Membership).filter(
            Membership.user_id == user_id,
            Membership.tenant_id == tenant_id,
            Membership.role == "ADMIN"  # Legacy role field - tenant creator is ADMIN
        ).first()
        
        # Also check UserRole for OWNER role
        owner_user_role = db.query(UserRole).join(Role).filter(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            Role.code == 'OWNER',
            UserRole.is_active == True
        ).first()
        
        # If user is tenant owner/admin, grant all permissions (workaround for missing OWNER role)
        if owner_membership or owner_user_role:
            # Get all permissions from database
            all_permissions = db.query(Permission).all()
            for perm in all_permissions:
                permissions.add(perm.code)
        
        # Get permission overrides
        overrides = db.query(PermissionOverride).join(Permission).filter(
            PermissionOverride.user_id == user_id,
            PermissionOverride.tenant_id == tenant_id
        ).all()
        
        for override in overrides:
            if override.is_expired:
                continue
            
            if override.grant_type == 'GRANT':
                permissions.add(override.permission.code)
            elif override.grant_type == 'REVOKE':
                permissions.discard(override.permission.code)
        
        return permissions
    
    def check_permission_match(self, user_permissions: List[str], required: str) -> bool:
        """
        Check if required permission matches any user permission (with wildcard support).
        
        Wildcard patterns:
        - crm:*:create matches crm:leads:create, crm:contacts:create
        - crm:leads:* matches crm:leads:create, crm:leads:edit
        - *:*:* matches everything
        
        Args:
            user_permissions: List of user's permission codes
            required: Required permission code
        
        Returns:
            True if match found, False otherwise
        """
        for user_perm in user_permissions:
            # Exact match
            if user_perm == required:
                return True
            
            # Wildcard match
            if '*' in user_perm:
                # Convert permission pattern to regex-like pattern
                # crm:*:create -> crm:*:create
                if fnmatch.fnmatch(required, user_perm):
                    return True
        
        return False
    
    def assign_role(
        self, 
        db: Session, 
        user_id: uuid.UUID, 
        tenant_id: Optional[uuid.UUID], 
        role_id: uuid.UUID, 
        assigned_by: uuid.UUID,
        expires_at: Optional[datetime] = None,
        ip_address: Optional[str] = None
    ) -> UserRole:
        """
        Assign a role to a user.
        
        Args:
            db: Database session
            user_id: User to assign role to
            tenant_id: Tenant context (None for system roles)
            role_id: Role to assign
            assigned_by: User performing the assignment
            expires_at: Optional expiration date
            ip_address: IP address of requester
        
        Returns:
            UserRole object
        
        Raises:
            ValueError: If role already assigned
        """
        # Check if already assigned
        existing = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            UserRole.role_id == role_id,
            UserRole.is_active == True
        ).first()
        
        if existing and not existing.is_expired:
            raise ValueError("Role already assigned to user")
        
        # Create user role assignment
        user_role = UserRole(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            assigned_by=assigned_by,
            expires_at=expires_at,
            is_active=True
        )
        db.add(user_role)
        
        # Audit log
        self.audit_log(
            db=db,
            action="ROLE_ASSIGNED",
            user_id=assigned_by,
            tenant_id=tenant_id,
            target_user_id=user_id,
            role_id=role_id,
            metadata={"expires_at": expires_at.isoformat() if expires_at else None},
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(user_role)
        
        return user_role
    
    def revoke_role(
        self, 
        db: Session, 
        user_id: uuid.UUID, 
        tenant_id: Optional[uuid.UUID], 
        role_id: uuid.UUID,
        revoked_by: uuid.UUID,
        ip_address: Optional[str] = None
    ) -> bool:
        """
        Revoke a role from a user.
        
        Args:
            db: Database session
            user_id: User to revoke role from
            tenant_id: Tenant context
            role_id: Role to revoke
            revoked_by: User performing the revocation
            ip_address: IP address of requester
        
        Returns:
            True if revoked, False if not found
        """
        user_role = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.tenant_id == tenant_id,
            UserRole.role_id == role_id,
            UserRole.is_active == True
        ).first()
        
        if not user_role:
            return False
        
        # Deactivate role
        user_role.is_active = False
        
        # Audit log
        self.audit_log(
            db=db,
            action="ROLE_REVOKED",
            user_id=revoked_by,
            tenant_id=tenant_id,
            target_user_id=user_id,
            role_id=role_id,
            metadata={},
            ip_address=ip_address
        )
        
        db.commit()
        
        return True
    
    def grant_permission_override(
        self,
        db: Session,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        permission_id: uuid.UUID,
        granted_by: uuid.UUID,
        reason: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        ip_address: Optional[str] = None
    ) -> PermissionOverride:
        """
        Grant a specific permission to a user (override).
        
        Args:
            db: Database session
            user_id: User to grant permission to
            tenant_id: Tenant context
            permission_id: Permission to grant
            granted_by: User performing the grant
            reason: Reason for override
            expires_at: Optional expiration
            ip_address: IP address of requester
        
        Returns:
            PermissionOverride object
        """
        override = PermissionOverride(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_id=permission_id,
            grant_type='GRANT',
            reason=reason,
            granted_by=granted_by,
            expires_at=expires_at
        )
        db.add(override)
        
        # Audit log
        self.audit_log(
            db=db,
            action="PERMISSION_GRANTED",
            user_id=granted_by,
            tenant_id=tenant_id,
            target_user_id=user_id,
            permission_id=permission_id,
            metadata={"reason": reason, "expires_at": expires_at.isoformat() if expires_at else None},
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(override)
        
        return override
    
    def revoke_permission_override(
        self,
        db: Session,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        permission_id: uuid.UUID,
        revoked_by: uuid.UUID,
        reason: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        ip_address: Optional[str] = None
    ) -> PermissionOverride:
        """
        Revoke a specific permission from a user (override).
        
        Args:
            db: Database session
            user_id: User to revoke permission from
            tenant_id: Tenant context
            permission_id: Permission to revoke
            revoked_by: User performing the revocation
            reason: Reason for override
            expires_at: Optional expiration
            ip_address: IP address of requester
        
        Returns:
            PermissionOverride object
        """
        override = PermissionOverride(
            user_id=user_id,
            tenant_id=tenant_id,
            permission_id=permission_id,
            grant_type='REVOKE',
            reason=reason,
            granted_by=revoked_by,
            expires_at=expires_at
        )
        db.add(override)
        
        # Audit log
        self.audit_log(
            db=db,
            action="PERMISSION_REVOKED",
            user_id=revoked_by,
            tenant_id=tenant_id,
            target_user_id=user_id,
            permission_id=permission_id,
            metadata={"reason": reason, "expires_at": expires_at.isoformat() if expires_at else None},
            ip_address=ip_address
        )
        
        db.commit()
        db.refresh(override)
        
        return override
    
    def audit_log(
        self,
        db: Session,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        tenant_id: Optional[uuid.UUID] = None,
        target_user_id: Optional[uuid.UUID] = None,
        role_id: Optional[uuid.UUID] = None,
        permission_id: Optional[uuid.UUID] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ) -> RoleAuditLog:
        """
        Create an audit log entry.
        
        Args:
            db: Database session
            action: Action performed (e.g., "ROLE_ASSIGNED")
            user_id: User performing action
            tenant_id: Tenant context
            target_user_id: User affected by action
            role_id: Role involved
            permission_id: Permission involved
            metadata: Additional metadata
            ip_address: IP address of requester
        
        Returns:
            RoleAuditLog object
        """
        log = RoleAuditLog(
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            target_user_id=target_user_id,
            role_id=role_id,
            permission_id=permission_id,
            metadata=metadata,
            ip_address=ip_address
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        
        return log
    
    def _is_user_role_expired(self, db: Session, user_id: uuid.UUID, role_id: uuid.UUID, tenant_id: Optional[uuid.UUID]) -> bool:
        """Check if a user's role assignment is expired."""
        user_role = db.query(UserRole).filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
            UserRole.tenant_id == tenant_id,
            UserRole.is_active == True
        ).first()
        
        if not user_role:
            return True
        
        return user_role.is_expired


# Singleton instance
rbac_service = RBACService()
