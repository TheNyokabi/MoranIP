#!/usr/bin/env python3
"""
Create 31Paints Tenant Directly in Database
This script creates the tenant directly without needing API access
"""
import sys
import os

# Add Backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.iam import User, Tenant, Membership
from app.models.rbac import Role, UserRole
from app.services.auth_service import auth_service
from app.utils.codes import generate_entity_code
from datetime import datetime
import uuid

def create_31paints_tenant():
    """Create 31Paints tenant directly in database"""
    db = SessionLocal()
    try:
        print("")
        print("═══════════════════════════════════════════════════════════════")
        print("  Creating 31Paints Tenant")
        print("═══════════════════════════════════════════════════════════════")
        print("")
        
        # Get or create admin user
        admin_user = db.query(User).filter(User.email == "admin@moran.com").first()
        if not admin_user:
            print("❌ Admin user not found. Please run init_database.py first.")
            return False
        
        print(f"✓ Using admin user: {admin_user.email}")
        
        # Check if 31Paints tenant already exists
        existing_tenant = db.query(Tenant).filter(Tenant.name == "31Paints").first()
        if existing_tenant:
            print(f"⚠️  31Paints tenant already exists: {existing_tenant.tenant_code}")
            print(f"   Tenant ID: {existing_tenant.id}")
            return str(existing_tenant.id)
        
        # Create 31Paints tenant
        print("Creating 31Paints tenant...")
        tenant = Tenant(
            tenant_code=generate_entity_code("TEN", "KE"),
            name="31Paints",
            country_code="KE",
            status="ACTIVE",
            engine="erpnext"
        )
        db.add(tenant)
        db.flush()
        db.refresh(tenant)
        print(f"✓ Tenant created: {tenant.name} -> {tenant.tenant_code}")
        print(f"  Tenant ID: {tenant.id}")
        
        # Create membership for admin user
        membership = Membership(
            user_id=admin_user.id,
            tenant_id=tenant.id,
            status="ACTIVE",
            role="ADMIN"
        )
        db.add(membership)
        db.flush()
        print("✓ Membership created for admin@moran.com")
        
        # Assign OWNER role if it exists
        owner_role = db.query(Role).filter(Role.code == "OWNER").first()
        if owner_role:
            user_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=admin_user.id,
                tenant_id=tenant.id,
                role_id=owner_role.id,
                assigned_by=admin_user.id,
                assigned_at=datetime.utcnow(),
                is_active=True
            )
            db.add(user_role)
            db.flush()
            print("✓ OWNER role assigned to admin@moran.com")
        
        db.commit()
        
        print("")
        print("═══════════════════════════════════════════════════════════════")
        print("  ✅ 31Paints Tenant Created Successfully!")
        print("═══════════════════════════════════════════════════════════════")
        print("")
        print(f"Tenant Details:")
        print(f"  • Name: {tenant.name}")
        print(f"  • Code: {tenant.tenant_code}")
        print(f"  • ID: {tenant.id}")
        print(f"  • Engine: {tenant.engine}")
        print(f"  • Country: {tenant.country_code}")
        print("")
        print("Next Steps:")
        print("  1. Run setup_31paints.py to complete the setup")
        print("  2. Or use the API to create warehouses, users, and items")
        print("")
        
        return str(tenant.id)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return None
    finally:
        db.close()

if __name__ == "__main__":
    tenant_id = create_31paints_tenant()
    if tenant_id:
        print(f"\n✅ Tenant ID: {tenant_id}")
        sys.exit(0)
    else:
        sys.exit(1)
