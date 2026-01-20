from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.iam import User, Tenant, Membership
from app.models.rbac import Role, UserRole
from app.services.auth_service import auth_service
from app.utils.codes import generate_entity_code
from datetime import datetime
import uuid

def seed_iam():
    db = SessionLocal()
    try:
        # Check/Create admin@moran.com user
        idx = "admin@moran.com"
        user = db.query(User).filter(User.email == idx).first()
        
        if not user:
            # 1. Create User
            user = User(
                user_code=generate_entity_code("USR", "KE"),
                email=idx,
                full_name="System Admin",
                password_hash=auth_service.get_password_hash("password123"),
                kyc_tier="KYC-T5", # Admin gets full tier
                is_active=True
            )
            db.add(user)
            db.commit() # Commit to get ID
            db.refresh(user)
            print(f"✓ User Created: {user.email} -> {user.user_code}")
        else:
            print(f"✓ User already exists: {user.email}")
        
        # Ensure SUPER_ADMIN role exists for system-wide access
        super_admin_role = db.query(Role).filter(Role.code == "SUPER_ADMIN").first()
        if not super_admin_role:
            # Create SUPER_ADMIN role if it doesn't exist
            super_admin_role = Role(
                id=str(uuid.uuid4()),
                code="SUPER_ADMIN",
                name="Super Admin",
                description="God user with access to all tenants and system settings",
                role_code="SUPER_ADMIN",
                level="SYSTEM",
                scope="SYSTEM",
                is_system=True
            )
            db.add(super_admin_role)
            db.commit()
            db.refresh(super_admin_role)
            print(f"✓ SUPER_ADMIN role created")
        
        # Assign SUPER_ADMIN role to admin@moran.com (system-wide, tenant_id = NULL)
        existing_super_admin = db.query(UserRole).filter(
            UserRole.user_id == user.id,
            UserRole.tenant_id == None,  # NULL = system-wide
            UserRole.role_id == super_admin_role.id
        ).first()
        
        if not existing_super_admin:
            super_admin_assignment = UserRole(
                id=str(uuid.uuid4()),
                user_id=user.id,
                tenant_id=None,  # NULL = system-wide role
                role_id=super_admin_role.id,
                assigned_by=user.id,
                assigned_at=datetime.utcnow(),
                is_active=True
            )
            db.add(super_admin_assignment)
            db.commit()
            print(f"✓ Assigned SUPER_ADMIN role to admin@moran.com (system-wide)")
        else:
            print(f"✓ admin@moran.com already has SUPER_ADMIN role")
        
        # Get or create Moran HQ tenant
        tenant = db.query(Tenant).filter(Tenant.name == "Moran HQ").first()
        if not tenant:
            # 2. Create Tenant
            tenant = Tenant(
                tenant_code=generate_entity_code("TEN", "KE"),
                name="Moran HQ",
                country_code="KE"
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"✓ Tenant Created: {tenant.name} -> {tenant.tenant_code}")
        else:
            print(f"✓ Moran HQ tenant already exists: {tenant.tenant_code}")
        
        # Create Membership for admin in Moran HQ
        mem = db.query(Membership).filter(
            Membership.user_id == user.id,
            Membership.tenant_id == tenant.id
        ).first()
        
        if not mem:
            mem = Membership(
                user_id=user.id,
                tenant_id=tenant.id,
                status="ACTIVE",
                role="ADMIN"
            )
            db.add(mem)
            db.commit()
            print("✓ Membership Created for admin@moran.com in Moran HQ")
        
        # Assign OWNER role to admin in Moran HQ
        owner_role = db.query(Role).filter(Role.code == "OWNER").first()
        if owner_role:
            owner_mem = db.query(UserRole).filter(
                UserRole.user_id == user.id,
                UserRole.tenant_id == tenant.id,
                UserRole.role_id == owner_role.id
            ).first()
            
            if not owner_mem:
                owner_mem = UserRole(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    tenant_id=tenant.id,
                    role_id=owner_role.id,
                    assigned_by=user.id,
                    assigned_at=datetime.utcnow(),
                    is_active=True
                )
                db.add(owner_mem)
                db.commit()
                print("✓ Assigned OWNER role to admin@moran.com in Moran HQ")
            else:
                print("✓ admin@moran.com already has OWNER role in Moran HQ")
        
        # ==================== PAINT SHOP TENANT ====================
        # Create Paint Shop Ltd tenant for ERPNext PoS testing
        paintshop_admin = db.query(User).filter(User.email == "admin@paintshop.co.ke").first()
        if not paintshop_admin:
            paintshop_admin = User(
                user_code=generate_entity_code("USR", "KE"),
                email="admin@paintshop.co.ke",
                full_name="Paint Shop Admin",
                password_hash=auth_service.get_password_hash("PaintShop2026!"),
                kyc_tier="KYC-T5",
                is_active=True
            )
            db.add(paintshop_admin)
            db.commit()
            db.refresh(paintshop_admin)
            print(f"✓ Paint Shop Admin Created: {paintshop_admin.email}")
        else:
            print(f"✓ Paint Shop Admin already exists: {paintshop_admin.email}")
        
        paintshop_tenant = db.query(Tenant).filter(Tenant.name == "Paint Shop Ltd").first()
        if not paintshop_tenant:
            paintshop_tenant = Tenant(
                tenant_code=generate_entity_code("TEN", "KE"),
                name="Paint Shop Ltd",
                country_code="KE",
                engine="erpnext"
            )
            db.add(paintshop_tenant)
            db.commit()
            db.refresh(paintshop_tenant)
            print(f"✓ Paint Shop Tenant Created: {paintshop_tenant.name} -> {paintshop_tenant.tenant_code}")
        else:
            print(f"✓ Paint Shop Tenant already exists: {paintshop_tenant.tenant_code}")
        
        paintshop_membership = db.query(Membership).filter(
            Membership.user_id == paintshop_admin.id,
            Membership.tenant_id == paintshop_tenant.id
        ).first()
        
        if not paintshop_membership:
            paintshop_membership = Membership(
                user_id=paintshop_admin.id,
                tenant_id=paintshop_tenant.id,
                status="ACTIVE",
                role="ADMIN"
            )
            db.add(paintshop_membership)
            db.commit()
            print("✓ Paint Shop Membership Created for admin@paintshop.co.ke")
        
        # AUTO-ADD admin@moran.com as OWNER to Paint Shop tenant
        paintshop_admin_membership = db.query(Membership).filter(
            Membership.user_id == user.id,
            Membership.tenant_id == paintshop_tenant.id
        ).first()
        
        if not paintshop_admin_membership:
            paintshop_admin_membership = Membership(
                user_id=user.id,
                tenant_id=paintshop_tenant.id,
                status="ACTIVE",
                role="ADMIN"
            )
            db.add(paintshop_admin_membership)
            db.commit()
        
        if owner_role:
            paintshop_admin_role = db.query(UserRole).filter(
                UserRole.user_id == user.id,
                UserRole.tenant_id == paintshop_tenant.id,
                UserRole.role_id == owner_role.id
            ).first()
            
            if not paintshop_admin_role:
                paintshop_admin_role = UserRole(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    tenant_id=paintshop_tenant.id,
                    role_id=owner_role.id,
                    assigned_by=user.id,
                    assigned_at=datetime.utcnow(),
                    is_active=True
                )
                db.add(paintshop_admin_role)
                db.commit()
                print("✓ admin@moran.com added as OWNER to Paint Shop Ltd tenant")
            else:
                print("✓ admin@moran.com already has OWNER role in Paint Shop Ltd")


    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_iam()
