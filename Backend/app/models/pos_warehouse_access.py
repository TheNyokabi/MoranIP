from sqlalchemy import Column, String, ForeignKey, TIMESTAMP, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.iam import Base, generate_uuid


class WarehouseAccessRole(Base):
    __tablename__ = "warehouse_access_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    warehouse_name = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    role = relationship("Role")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        UniqueConstraint("tenant_id", "role_id", "warehouse_name", name="unique_role_warehouse_access"),
    )


class WarehouseAccessUser(Base):
    __tablename__ = "warehouse_access_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    warehouse_name = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    user = relationship("User")
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "warehouse_name", name="unique_user_warehouse_access"),
    )
