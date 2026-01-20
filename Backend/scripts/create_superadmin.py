"""
Create superadmin user (admin@moran) for case study
Uses SAME password hashing as auth_service (argon2)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from passlib.context import CryptContext
import uuid
from datetime import datetime
from sqlalchemy import text

# MUST use same hashing as auth_service!
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def create_superadmin():
    """Create superadmin user for case study"""
    db = SessionLocal()
    
    try:
        admin_email = "admin@moran"
        admin_password = "admin123"
        
        # Check if user exists
        existing = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": admin_email}
        ).fetchone()
        
        if existing:
            print(f"Superadmin already exists: {admin_email}")
            return True
        
        # Create new superadmin user with argon2 hashing
        user_id = str(uuid.uuid4())
        user_code = "USR-ADMIN-001"
        hashed_password = pwd_context.hash(admin_password)
        
        db.execute(
            text("""
                INSERT INTO users (id, user_code, email, password_hash, full_name, kyc_tier, is_active, user_type, created_at)
                VALUES (:id, :code, :email, :password, :name, :tier, :is_active, :user_type, :created_at)
            """),
            {
                "id": user_id,
                "code": user_code,
                "email": admin_email,
                "password": hashed_password,
                "name": "System Administrator",
                "tier": "VERIFIED",
                "is_active": True,
                "user_type": "SUPERADMIN",
                "created_at": datetime.utcnow()
            }
        )
        db.commit()
        
        print(f"✓ Created superadmin user: {admin_email}")
        print(f"  Password: {admin_password}")
        print(f"  User ID: {user_id}")
        print(f"  User Type: SUPERADMIN")
        print(f"  Hash scheme: argon2 (matches auth_service)")
        return True
        
    except Exception as e:
        print(f"✗ Error creating superadmin: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if create_superadmin():
        sys.exit(0)
    else:
        sys.exit(1)
