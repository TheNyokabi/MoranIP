from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, TIMESTAMP, text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

def generate_uuid():
    return uuid.uuid4() # Ideally v7, but v4 is standard in python's UUID lib for now. PG can generate v7 if extension available.

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_code = Column(String(32), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(50), unique=True, nullable=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)
    kyc_tier = Column(String(10), default='KYC-T0')
    
    # User type: INTERNAL (staff), CUSTOMER, SUPPLIER, PARTNER
    user_type = Column(String(20), default='INTERNAL')
    
    # Link to Contact if user is escalated from customer/supplier
    # One-to-one: user can represent one escalated contact
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))

    memberships = relationship("Membership", back_populates="user")
    staff_profiles = relationship("StaffProfile", back_populates="user")

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_code = Column(String(32), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    country_code = Column(String(2), default='KE')
    status = Column(String(20), default='ACTIVE')
    engine = Column(String(20), default='odoo')
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

    memberships = relationship("Membership", back_populates="tenant")
    staff_profiles = relationship("StaffProfile", back_populates="tenant")
    tenant_settings = relationship("TenantSettings", back_populates="tenant", uselist=False, cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = "memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))
    role = Column(String(30), default='CASHIER')  # ADMIN, MANAGER, CASHIER, VIEWER
    status = Column(String(20), default='PENDING')  # PENDING, INVITED, ACTIVE, SUSPENDED
    invitation_code = Column(String(64), nullable=True, unique=True)  # For accepting invitations
    invited_at = Column(TIMESTAMP(timezone=True), nullable=True)
    joined_at = Column(TIMESTAMP(timezone=True), nullable=True)

    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", back_populates="memberships")

    __table_args__ = (UniqueConstraint('user_id', 'tenant_id', name='unique_membership'),)

class StaffProfile(Base):
    __tablename__ = "staff_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    staff_code = Column(String(50), nullable=False)
    title = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)

    user = relationship("User", back_populates="staff_profiles")
    tenant = relationship("Tenant", back_populates="staff_profiles")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'user_id', name='unique_staff_per_tenant'),
        UniqueConstraint('tenant_id', 'staff_code', name='unique_staff_code_per_tenant'),
    )

class Capability(Base):
    __tablename__ = "capabilities"
    
    code = Column(String(100), primary_key=True)
    description = Column(String, nullable=True)
    risk_level = Column(String(20), default='LOW')

class KYCLog(Base):
    __tablename__ = "kyc_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    previous_tier = Column(String(10), nullable=True)
    new_tier = Column(String(10), nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    documents = Column(JSONB, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))

class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Company Information
    company_name = Column(String(255), nullable=True)
    legal_name = Column(String(255), nullable=True)
    business_type = Column(String(100), nullable=True)  # Sole Proprietor, Partnership, Limited Company, etc.
    registration_number = Column(String(100), nullable=True)
    tax_id = Column(String(100), nullable=True)
    
    # Contact Information
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    
    # Address
    street_address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state_province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    
    # Financial Settings
    currency = Column(String(3), default='KES')  # ISO 4217 code
    fiscal_year_start_month = Column(Integer, default=1)  # 1-12
    accounting_method = Column(String(50), default='accrual')  # accrual or cash
    
    # Business Settings
    industry = Column(String(100), nullable=True)
    employees_count = Column(Integer, nullable=True)
    annual_revenue = Column(String(50), nullable=True)
    
    # Feature Toggles
    enable_invoicing = Column(Boolean, default=True)
    enable_pos = Column(Boolean, default=False)
    enable_inventory = Column(Boolean, default=True)
    enable_hr = Column(Boolean, default=False)
    enable_projects = Column(Boolean, default=False)
    
    # Configuration
    logo_url = Column(String(255), nullable=True)
    language = Column(String(10), default='en')  # en, es, fr, etc.
    timezone = Column(String(50), default='Africa/Nairobi')
    
    # Status
    setup_completed = Column(Boolean, default=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text('now()'), onupdate=text('now()'))
    
    tenant = relationship("Tenant", back_populates="tenant_settings")

