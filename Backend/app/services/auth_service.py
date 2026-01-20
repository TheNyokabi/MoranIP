from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings
from app.models.iam import User, Membership, Tenant

# Password Hashing
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# JWT Constants (Should be in settings, but hardcoding defaults for now if missing)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

class AuthService:
    def verify_password(self, plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password):
        return pwd_context.hash(password)

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    def authenticate_user(self, db: Session, email: str, password: str) -> Optional[User]:
        # User is global
        stmt = select(User).where(User.email == email)
        user = db.execute(stmt).scalar_one_or_none()
        
        if not user:
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    def get_user_tenants(self, db: Session, user_id) -> List[Tenant]:
        # Check if user has SUPER_ADMIN role (system-wide access)
        from app.models.rbac import Role, UserRole
        
        super_admin_role = db.query(Role).filter(Role.code == 'SUPER_ADMIN').first()
        if super_admin_role:
            has_super_admin = db.query(UserRole).filter(
                UserRole.user_id == user_id,
                UserRole.role_id == super_admin_role.id,
                UserRole.is_active == True,
                UserRole.tenant_id.is_(None)  # System-wide role has no tenant
            ).first()
            
            if has_super_admin:
                # SUPER_ADMIN: Return ALL active tenants
                stmt = select(Tenant).where(Tenant.status == 'ACTIVE').order_by(Tenant.created_at.desc())
                return db.execute(stmt).scalars().all()
        
        # Regular user: Return only tenants where user has active membership
        stmt = select(Tenant).join(Membership).where(
            Membership.user_id == user_id,
            Membership.status == 'ACTIVE'
        ).order_by(Tenant.created_at.desc())
        return db.execute(stmt).scalars().all()

    def get_tenant_membership(self, db: Session, user_id, tenant_id) -> Optional[Membership]:
         stmt = select(Membership).where(Membership.user_id == user_id, Membership.tenant_id == tenant_id, Membership.status == 'ACTIVE')
         return db.execute(stmt).scalar_one_or_none()

    def create_tenant_token(self, user: User, tenant: Tenant, membership: Membership, db: Session = None):
        """
        Create tenant-scoped JWT token with roles.
        
        Args:
            user: User object
            tenant: Tenant object
            membership: Membership object
            db: Database session (optional, for role lookup)
        
        Returns:
            JWT token string
        """
        payload = {
            "sub": str(user.id),
            "user_code": user.user_code,
            "tenant_id": str(tenant.id),
            "tenant_code": tenant.tenant_code,
            "kyc_tier": user.kyc_tier,
        }
        
        # Add roles if db session provided
        if db:
            try:
                from app.services.rbac_service import rbac_service
                
                # Get user roles
                roles = rbac_service.get_user_roles(db, user.id, tenant.id)
                role_codes = [role.code for role in roles]
                
                # Check if super admin
                is_super_admin = 'SUPER_ADMIN' in role_codes
                
                payload["roles"] = role_codes
                payload["is_super_admin"] = is_super_admin
            except Exception as e:
                # If RBAC not yet set up, continue without roles
                print(f"Warning: Could not load roles: {e}")
                payload["roles"] = []
                payload["is_super_admin"] = False
        else:
            payload["roles"] = []
            payload["is_super_admin"] = False
        
        return self.create_access_token(payload)

    def create_identity_token(self, user: User, db: Session = None):
        """
        Create global identity JWT token (no tenant context).
        Used for accessing global dashboard and selecting workspaces.
        
        Args:
            user: User object
            db: Database session (optional, for super admin check)
        
        Returns:
            JWT token string
        """
        payload = {
            "sub": str(user.id),
            "user_code": user.user_code,
            "email": user.email,
            "kyc_tier": user.kyc_tier,
            "scope": "identity",  # Indicates this is an identity token, not tenant-scoped
        }
        
        # Check if super admin (system-wide, no tenant)
        if db:
            try:
                from app.models.rbac import Role, UserRole
                super_admin_role = db.query(Role).filter(Role.code == 'SUPER_ADMIN').first()
                if super_admin_role:
                    has_super_admin = db.query(UserRole).filter(
                        UserRole.user_id == user.id,
                        UserRole.role_id == super_admin_role.id,
                        UserRole.is_active == True,
                        UserRole.tenant_id.is_(None)  # System-wide role
                    ).first()
                    if has_super_admin:
                        payload["is_super_admin"] = True
                        payload["scope"] = "identity:super_admin"
                    else:
                        payload["is_super_admin"] = False
                else:
                    payload["is_super_admin"] = False
            except Exception as e:
                # If RBAC not yet set up or tables don't exist, continue without super admin flag
                # Use logging instead of print for better error handling
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not check super admin status: {e}", exc_info=False)
                payload["is_super_admin"] = False
        else:
            payload["is_super_admin"] = False
        
        # Identity tokens have longer expiry (7 days) since they're used for dashboard access
        return self.create_access_token(payload, expires_delta=timedelta(days=7))

auth_service = AuthService()
