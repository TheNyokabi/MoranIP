#!/usr/bin/env python3
"""
Seed test data for Robot Framework RBAC tests.

This script creates:
- Test tenant
- Test users with different roles (SUPER_ADMIN, OWNER, ADMIN, MANAGER, STAFF, VIEWER)
- Assigns appropriate roles to users
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.iam import User, Tenant
from app.models.rbac import Role, UserRole
from passlib.context import CryptContext
import uuid
from datetime import datetime

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)



def create_test_tenant(db: Session) -> Tenant:
    """Create test tenant"""
    print("Creating test tenant...")
    
    # Check if tenant already exists
    tenant = db.query(Tenant).filter(Tenant.name == "Test Tenant 1").first()
    if tenant:
        print(f"✓ Test tenant already exists: {tenant.id}")
        return tenant
    
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name="Test Tenant 1",
        tenant_code="TNT-TEST-001",
        engine="erpnext",
        created_at=datetime.utcnow()
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    
    print(f"✓ Created test tenant: {tenant.id}")
    return tenant


def create_test_users(db: Session, tenant: Tenant) -> dict:
    """Create test users with different roles"""
    print("\nCreating test users...")
    
    # Get roles
    roles = {
        'SUPER_ADMIN': db.query(Role).filter(Role.code == 'SUPER_ADMIN').first(),
        'OWNER': db.query(Role).filter(Role.code == 'OWNER').first(),
        'ADMIN': db.query(Role).filter(Role.code == 'ADMIN').first(),
        'MANAGER': db.query(Role).filter(Role.code == 'MANAGER').first(),
        'STAFF': db.query(Role).filter(Role.code == 'STAFF').first(),
        'VIEWER': db.query(Role).filter(Role.code == 'VIEWER').first(),
    }
    
    # Define test users
    test_users = [
        {
            'email': 'superadmin@moranerp.com',
            'password': 'SuperAdmin123!',
            'full_name': 'Super Admin User',
            'role': 'SUPER_ADMIN',
            'is_super_admin': True
        },
        {
            'email': 'owner@tenant1.com',
            'password': 'Owner123!',
            'full_name': 'Owner User',
            'role': 'OWNER',
            'is_super_admin': False
        },
        {
            'email': 'admin@tenant1.com',
            'password': 'Admin123!',
            'full_name': 'Admin User',
            'role': 'ADMIN',
            'is_super_admin': False
        },
        {
            'email': 'manager@tenant1.com',
            'password': 'Manager123!',
            'full_name': 'Manager User',
            'role': 'MANAGER',
            'is_super_admin': False
        },
        {
            'email': 'staff@tenant1.com',
            'password': 'Staff123!',
            'full_name': 'Staff User',
            'role': 'STAFF',
            'is_super_admin': False
        },
        {
            'email': 'viewer@tenant1.com',
            'password': 'Viewer123!',
            'full_name': 'Viewer User',
            'role': 'VIEWER',
            'is_super_admin': False
        },
    ]
    
    created_users = {}
    
    for user_data in test_users:
        # Check if user already exists
        user = db.query(User).filter(User.email == user_data['email']).first()
        
        if user:
            print(f"✓ User already exists: {user_data['email']}")
            created_users[user_data['role']] = user
            continue
        
        # Create user
        user_code = f"USR-TEST-{len(created_users) + 1:03d}"
        user = User(
            id=str(uuid.uuid4()),
            user_code=user_code,
            email=user_data['email'],
            password_hash=get_password_hash(user_data['password']),
            full_name=user_data['full_name'],
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.flush()
        
        # Assign role
        role = roles[user_data['role']]
        if role:
            user_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=user.id,
                tenant_id=tenant.id,
                role_id=role.id,
                assigned_by=user.id,  # Self-assigned for test data
                assigned_at=datetime.utcnow()
            )
            db.add(user_role)
        
        db.commit()
        db.refresh(user)
        
        print(f"✓ Created user: {user_data['email']} ({user_data['role']})")
        created_users[user_data['role']] = user
    
    return created_users


def verify_setup(db: Session, tenant: Tenant, users: dict):
    """Verify the test setup"""
    print("\nVerifying test setup...")
    
    # Verify tenant
    assert tenant is not None, "Tenant not created"
    print(f"✓ Tenant: {tenant.name} ({tenant.id})")
    
    # Verify users
    for role, user in users.items():
        user_roles = db.query(UserRole).filter(
            UserRole.user_id == user.id,
            UserRole.tenant_id == tenant.id
        ).all()
        print(f"✓ User: {user.email} - Roles: {len(user_roles)}")
    
    print("\n" + "="*60)
    print("TEST DATA SEEDED SUCCESSFULLY!")
    print("="*60)
    print(f"\nTenant ID: {tenant.id}")
    print(f"Tenant Code: {tenant.tenant_code}")
    print("\nTest User Credentials:")
    print("-" * 60)
    print(f"Super Admin: superadmin@moranerp.com / SuperAdmin123!")
    print(f"Owner:       owner@tenant1.com / Owner123!")
    print(f"Admin:       admin@tenant1.com / Admin123!")
    print(f"Manager:     manager@tenant1.com / Manager123!")
    print(f"Staff:       staff@tenant1.com / Staff123!")
    print(f"Viewer:      viewer@tenant1.com / Viewer123!")
    print("-" * 60)
    print("\nYou can now run Robot Framework tests:")
    print("cd QATests && robot --variable BASE_URL:http://localhost:8000 rbac/")
    print("="*60)


def main():
    """Main function"""
    print("="*60)
    print("SEEDING TEST DATA FOR ROBOT FRAMEWORK TESTS")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Create test tenant
        tenant = create_test_tenant(db)
        
        # Create test users
        users = create_test_users(db, tenant)
        
        # Verify setup
        verify_setup(db, tenant, users)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
