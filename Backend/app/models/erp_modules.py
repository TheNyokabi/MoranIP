from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP, text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from app.models.iam import Base
import uuid

class TenantERPConfig(Base):
    """Stores ERPNext site configuration for each tenant"""
    __tablename__ = "tenant_erp_config"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    erp_site_name = Column(String(100), nullable=False, unique=True)  # tenant_code
    erp_company_name = Column(String(200), nullable=False)
    erp_api_key = Column(String(200), nullable=True)
    erp_api_secret = Column(String(200), nullable=True)
    is_provisioned = Column(Boolean, nullable=False, default=False)
    provisioned_at = Column(TIMESTAMP(timezone=True), nullable=True)
    configuration = Column(JSONB, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), onupdate=text("now()"))
    
    # Relationships
    tenant = relationship("Tenant", backref=backref("erp_config", uselist=False))
    
class TenantERPModule(Base):
    """Tracks which ERP modules are enabled for each tenant"""
    __tablename__ = "tenant_erp_modules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    module_code = Column(String(50), nullable=False)  # 'inventory', 'pos', 'manufacturing', etc.
    module_name = Column(String(100), nullable=False)  # 'Inventory Management', 'Point of Sale', etc.
    is_enabled = Column(Boolean, nullable=False, default=True)
    configuration = Column(JSONB, nullable=True)  # Module-specific configuration
    enabled_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    configured_at = Column(TIMESTAMP(timezone=True), nullable=True)  # When configuration was last updated
    enabled_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), onupdate=text("now()"))
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'module_code', name='unique_tenant_module'),
        Index('idx_tenant_erp_modules_tenant', 'tenant_id'),
        Index('idx_tenant_erp_modules_enabled', 'tenant_id', 'is_enabled'),
    )
    
    # Relationships
    tenant = relationship("Tenant", backref="erp_modules")
    enabled_by_user = relationship("User")
