"""
Create Default Admin User
Creates a default admin user for initial setup after database cleanup.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.database import SessionLocal
from app.models.iam import User
from app.services.auth_service import auth_service
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_default_admin():
    """Create a default admin user"""
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.email == "admin@moran.com").first()
        if existing_admin:
            logger.info(f"Admin user already exists: {existing_admin.email}")
            return existing_admin
        
        # Create default admin user using raw SQL to avoid ORM foreign key validation issues
        user_id = uuid.uuid4()
        password_hash = auth_service.get_password_hash("admin123")
        
        # Use raw SQL to insert user directly
        db.execute(text("""
            INSERT INTO users (id, user_code, email, full_name, password_hash, kyc_tier, user_type, is_active, created_at, updated_at)
            VALUES (:id, :user_code, :email, :full_name, :password_hash, :kyc_tier, :user_type, :is_active, NOW(), NOW())
        """), {
            "id": user_id,
            "user_code": "USR-KE-01-ADMIN",
            "email": "admin@moran.com",
            "full_name": "System Administrator",
            "password_hash": password_hash,
            "kyc_tier": "KYC-T0",
            "user_type": "INTERNAL",
            "is_active": True
        })
        db.commit()
        
        # Fetch the created user
        admin_user = db.query(User).filter(User.id == user_id).first()
        
        logger.info("✅ Default admin user created successfully!")
        logger.info(f"   Email: {admin_user.email}")
        logger.info(f"   Password: admin123")
        logger.info(f"   User Code: {admin_user.user_code}")
        logger.info(f"   ID: {admin_user.id}")
        
        return admin_user
        
    except Exception as e:
        logger.error(f"Error creating admin user: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("CREATE DEFAULT ADMIN USER")
    print("="*60)
    print("This script will create a default admin user:")
    print("  Email: admin@moran.com")
    print("  Password: admin123")
    print("="*60)
    
    try:
        admin_user = create_default_admin()
        print("\n✅ Admin user created successfully!")
        print(f"\nYou can now log in with:")
        print(f"  Email: {admin_user.email}")
        print(f"  Password: admin123")
    except Exception as e:
        print(f"\n❌ Failed to create admin user: {e}")
        sys.exit(1)
