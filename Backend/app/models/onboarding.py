"""
Onboarding, Contact, and Module Management Models

Supports configurable tenant onboarding with:
- Contact entity for customer escalation (future customers)
- Module dependency tracking and orchestration
- TenantOnboarding state machine (DRAFT → IN_PROGRESS → COMPLETED)
- JSONB-based configuration for flexibility
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from app.models.iam import Base, generate_uuid, User
from datetime import datetime

# ============================================================================
# CONTACT ENTITY - Customer/Supplier/Partner Escalation
# ============================================================================

class Contact(Base):
    """
    Contacts represent customers, suppliers, or partners.
    Can be escalated to User accounts for portal access.
    """
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    contact_code = Column(String(50), nullable=False)  # e.g., CTT-KE-25-X8M4Q
    contact_name = Column(String(255), nullable=False)
    contact_type = Column(String(20), nullable=False)  # 'customer', 'supplier', 'partner'
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)
    
    # KYC Tier separate from user
    kyc_tier = Column(String(10), nullable=False, default='KYC-T0')
    
    # ERP References for sync
    odoo_partner_id = Column(Integer, nullable=True)  # res.partner.id in Odoo
    erpnext_customer_id = Column(String(255), nullable=True)  # Customer name in ERPNext
    erpnext_supplier_id = Column(String(255), nullable=True)  # Supplier name in ERPNext
    
    # Escalation tracking
    escalation_requested = Column(Boolean, default=False)
    escalation_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    status = Column(String(20), default='ACTIVE')  # ACTIVE, INACTIVE, ESCALATED
    
    # Flexible configuration storage (industry, region, credit terms, etc.)
    custom_metadata = Column(JSONB, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    # Relationships
    tenant = relationship("Tenant", foreign_keys=[tenant_id], backref="contacts")
    escalation_user = relationship("User", foreign_keys=[escalation_user_id])

    __table_args__ = (
        UniqueConstraint('tenant_id', 'contact_code', name='unique_contact_code_per_tenant'),
        Index('idx_contacts_tenant_type', 'tenant_id', 'contact_type'),
        Index('idx_contacts_escalation', 'tenant_id', 'escalation_requested'),
    )


# ============================================================================
# MODULE DEFINITIONS & DEPENDENCIES
# ============================================================================

class ModuleDefinition(Base):
    """
    Defines available ERP modules and their onboarding configuration.
    Replaces hardcoded AVAILABLE_ERP_MODULES in erp_modules.py
    """
    __tablename__ = "module_definitions"

    code = Column(String(50), primary_key=True)  # 'inventory', 'pos', 'accounting', etc.
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    category = Column(String(50), nullable=False)  # 'Operations', 'Sales', 'Finance', 'HR'
    icon = Column(String(50), nullable=True)  # 'package', 'shopping-cart', etc.
    
    # Onboarding configuration as JSON
    # Example: {
    #   "steps": ["company_setup", "warehouse_setup", "chart_of_accounts"],
    #   "default_config": {"warehouse": "Main Store"},
    #   "requires_configuration": true
    # }
    onboarding_steps = Column(JSONB, nullable=True)
    default_configuration = Column(JSONB, nullable=True)
    
    is_core = Column(Boolean, default=False)  # Core modules: inventory, accounting, pos
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    # Relationships
    dependencies = relationship(
        "ModuleDependency",
        foreign_keys="ModuleDependency.module_code",
        backref="module",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ModuleDefinition {self.code}>"


class ModuleDependency(Base):
    """
    Defines hard/soft dependencies between modules.
    E.g., POS depends on Inventory + Accounting
    """
    __tablename__ = "module_dependencies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    module_code = Column(String(50), ForeignKey("module_definitions.code", ondelete="CASCADE"), nullable=False)
    depends_on = Column(String(50), ForeignKey("module_definitions.code", ondelete="CASCADE"), nullable=False)
    
    # Hard dependency = must be enabled; Soft dependency = recommended
    required = Column(Boolean, default=True)
    
    # Onboarding order (0 = first, higher = later)
    setup_order = Column(Integer, default=100)
    
    # Configuration to apply when dependency is enabled
    # E.g., {"accounts_receivable": "Customers", "accounts_payable": "Suppliers"}
    dependent_config = Column(JSONB, nullable=True)
    
    description = Column(String(500), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    __table_args__ = (
        UniqueConstraint('module_code', 'depends_on', name='unique_module_dependency'),
        Index('idx_module_dependencies', 'module_code'),
    )

    def __repr__(self):
        return f"<ModuleDependency {self.module_code} -> {self.depends_on}>"


# ============================================================================
# ONBOARDING STATE & ORCHESTRATION
# ============================================================================

class TenantOnboarding(Base):
    """
    Tracks onboarding progress for a tenant.
    State machine: DRAFT → IN_PROGRESS → COMPLETED (or FAILED)
    """
    __tablename__ = "tenant_onboarding"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Workspace type determines engine: SACCO -> CBS/Fineract, ENTERPRISE -> ERPNext/Odoo
    workspace_type = Column(String(50), nullable=True)  # SACCO, ENTERPRISE, SME, STARTUP, etc.
    
    # Onboarding template (STARTUP, SME, ENTERPRISE)
    template = Column(String(50), nullable=False)
    
    # State machine
    status = Column(String(20), default='DRAFT')  # DRAFT, IN_PROGRESS, COMPLETED, PAUSED, FAILED
    
    # Current step being executed
    current_step = Column(String(100), nullable=True)  # 'company_setup', 'module_inventory_setup', etc.
    
    # Track completed steps: {"company_setup": true, "module_inventory": true, ...}
    steps_completed = Column(JSONB, nullable=False, default={})
    
    # Store configuration for entire onboarding (merged from template + user input)
    configuration = Column(JSONB, nullable=True)
    
    # Provisioning fields (for Company → POS provisioning flow)
    provisioning_type = Column(String(20), nullable=True)  # FULL_POS, BASIC, CUSTOM
    provisioning_config = Column(JSONB, nullable=True)  # Step-specific provisioning config
    provisioning_steps = Column(JSONB, nullable=True)  # Track individual step status
    # Example: {
    #   "step_0_engine_check": {"status": "completed", "completed_at": "...", "error": null},
    #   "step_2_company": {"status": "completed", "company_name": "..."},
    #   "step_3_chart_of_accounts": {"status": "failed", "error": "..."}
    # }
    provisioning_metadata = Column(JSONB, nullable=True)  # Store created resource references
    # Example: {
    #   "company_name": "...",
    #   "warehouse_names": ["Main Store", "POS Store"],
    #   "pos_profile_id": "...",
    #   "default_customer": "Walk-In Customer"
    # }
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    error_step = Column(String(100), nullable=True)
    
    # Audit
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    # Relationships
    tenant = relationship("Tenant", backref=backref("onboarding", uselist=False))
    initiated_by_user = relationship("User", foreign_keys=[started_by])

    __table_args__ = (
        Index('idx_onboarding_status', 'status'),
        Index('idx_tenant_onboarding_provisioning_status', 'tenant_id', 'status'),
    )

    def __repr__(self):
        return f"<TenantOnboarding {self.tenant_id} {self.status}>"


class OnboardingTemplate(Base):
    """
    Reusable onboarding templates for different tenant sizes/types.
    Example: STARTUP (basic inventory + POS), ENTERPRISE (all modules)
    """
    __tablename__ = "onboarding_templates"

    code = Column(String(50), primary_key=True)  # 'STARTUP', 'SME', 'ENTERPRISE'
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    
    # Modules to enable: ["inventory", "pos", "accounting"]
    modules = Column(JSONB, nullable=False)  # List of module codes
    
    # Module-specific configs merged in order
    # Example: {
    #   "inventory": {"default_warehouse": "Main Store"},
    #   "accounting": {"company_currency": "KES"}
    # }
    module_configurations = Column(JSONB, nullable=True)
    
    # Global config for all modules
    global_configuration = Column(JSONB, nullable=True)
    
    is_system = Column(Boolean, default=True)  # System templates vs custom
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True)  # Custom template for specific tenant
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    __table_args__ = (
        Index('idx_templates_system', 'is_system'),
    )

    def __repr__(self):
        return f"<OnboardingTemplate {self.code}>"


class OnboardingStep(Base):
    """
    Individual step within an onboarding flow.
    Stores execution result and state.
    """
    __tablename__ = "onboarding_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    onboarding_id = Column(UUID(as_uuid=True), ForeignKey("tenant_onboarding.id", ondelete="CASCADE"), nullable=False)
    
    # Step identifier: 'company_setup', 'module_inventory_setup', 'module_pos_setup', etc.
    step_code = Column(String(100), nullable=False)
    
    # Module this step belongs to (null = global step)
    module_code = Column(String(50), ForeignKey("module_definitions.code", ondelete="SET NULL"), nullable=True)
    
    # Step metadata
    step_name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    order = Column(Integer, nullable=False)  # Execution order
    
    # Status
    status = Column(String(20), default='PENDING')  # PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED
    
    # Result tracking
    result_data = Column(JSONB, nullable=True)  # Store step output (created IDs, etc.)
    error_message = Column(Text, nullable=True)
    
    # Timing
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    # Relationships
    onboarding = relationship("TenantOnboarding", backref="steps")
    module = relationship("ModuleDefinition")

    __table_args__ = (
        UniqueConstraint('onboarding_id', 'step_code', name='unique_onboarding_step'),
        Index('idx_onboarding_steps', 'onboarding_id', 'status'),
    )

    def __repr__(self):
        return f"<OnboardingStep {self.step_code} {self.status}>"


# ============================================================================
# PERMISSION SCOPING BY USER TYPE
# ============================================================================

class PermissionScope(Base):
    """
    Maps permissions to applicable user types.
    Allows same permission to have different meanings for different user types.
    """
    __tablename__ = "permission_scopes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    
    # User types this permission applies to: ['INTERNAL', 'CUSTOMER', 'SUPPLIER']
    applies_to_user_types = Column(JSONB, nullable=False)
    
    # Contact types this permission applies to (for contact-based filtering)
    # Example: ['customer', 'partner']  (null = applies to all)
    applies_to_contact_types = Column(JSONB, nullable=True)
    
    # Scope modifier: 'own' = only resources owned by user
    # Example: 'sales:orders:view_own' = can only view own orders
    scope_modifier = Column(String(50), nullable=True)  # 'own', 'department', 'team', etc.
    
    description = Column(String(500), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    # Relationships
    permission = relationship("Permission", foreign_keys=[permission_id], backref="scopes")

    __table_args__ = (
        UniqueConstraint('permission_id', 'applies_to_user_types', name='unique_permission_scope'),
    )

    def __repr__(self):
        return f"<PermissionScope {self.permission_id}>"
