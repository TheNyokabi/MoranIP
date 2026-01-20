from sqlalchemy import Column, String, Boolean, ForeignKey, Text, TIMESTAMP, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.iam import Base, generate_uuid
from datetime import datetime

class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    role_code = Column(String(50), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String(20), nullable=False)  # SYSTEM, TENANT, CUSTOM
    scope = Column(String(20), nullable=False)  # SYSTEM, TENANT
    is_system = Column(Boolean, nullable=False, default=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    # Relationships
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    user_assignments = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    def __repr__(self):
        return f"<Role {self.code} ({self.role_code})>"


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    permission_code = Column(String(50), unique=True, nullable=False)
    code = Column(String(100), unique=True, nullable=False)
    module = Column(String(50), nullable=False)
    resource = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)
    risk_level = Column(String(20), nullable=False, default='LOW')
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    # Relationships
    roles = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")
    overrides = relationship("PermissionOverride", back_populates="permission", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Permission {self.code} ({self.permission_code})>"


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")

    __table_args__ = (UniqueConstraint('role_id', 'permission_id', name='unique_role_permission'),)

    def __repr__(self):
        return f"<RolePermission role_id={self.role_id} permission_id={self.permission_id}>"


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="role_assignments")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])
    role = relationship("Role", back_populates="user_assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])

    __table_args__ = (UniqueConstraint('user_id', 'tenant_id', 'role_id', name='unique_user_tenant_role'),)

    def __repr__(self):
        return f"<UserRole user_id={self.user_id} role={self.role.code if self.role else 'N/A'}>"

    @property
    def is_expired(self):
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at


class PermissionOverride(Base):
    __tablename__ = "permission_overrides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    grant_type = Column(String(10), nullable=False)  # GRANT or REVOKE
    reason = Column(Text, nullable=True)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="permission_overrides")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])
    permission = relationship("Permission", back_populates="overrides")
    granter = relationship("User", foreign_keys=[granted_by])

    def __repr__(self):
        return f"<PermissionOverride {self.grant_type} {self.permission.code if self.permission else 'N/A'}>"

    @property
    def is_expired(self):
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at


class RoleAuditLog(Base):
    __tablename__ = "role_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="SET NULL"), nullable=True)
    extra_data = Column(JSONB, nullable=True)  # renamed from 'metadata' - reserved in SQLAlchemy
    ip_address = Column(String(45), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    tenant = relationship("Tenant", foreign_keys=[tenant_id])
    target_user = relationship("User", foreign_keys=[target_user_id])
    role = relationship("Role", foreign_keys=[role_id])
    permission = relationship("Permission", foreign_keys=[permission_id])

    def __repr__(self):
        return f"<RoleAuditLog {self.action} at {self.created_at}>"
