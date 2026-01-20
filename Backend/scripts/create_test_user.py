"""
Create test user directly in database for case study
"""
import sys
import os
# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.iam import User
from app.services.auth_service import auth_service
from passlib.context import CryptContext
import uuid
from datetime import datetime
from sqlalchemy import text

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_test_user():
    """Create test user for case study"""
    db = SessionLocal()
    
    try:
        test_email = "testuser@techmart.com"
        test_password = "TestUser123!"
        
        # Check if user exists
        existing = db.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": test_email}
        ).fetchone()
        
        if existing:
            print(f"Test user already exists: {test_email}")
            return True
        
        # Create new user
        user_id = str(uuid.uuid4())
        user_code = f"USR-TEST-{int(datetime.now().timestamp())}"
        hashed_password = pwd_context.hash(test_password)
        
        db.execute(
            text("""
                INSERT INTO users (id, user_code, email, password_hash, full_name, kyc_tier, is_active, created_at)
                VALUES (:id, :code, :email, :password, :name, :tier, :is_active, :created_at)
            """),
            {
                "id": user_id,
                "code": user_code,
                "email": test_email,
                "password": hashed_password,
                "name": "Test User",
                "tier": "VERIFIED",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        )
        db.commit()
        
        print(f"✓ Created test user: {test_email}")
        print(f"  Password: {test_password}")
        print(f"  User ID: {user_id}")
        return True
        
    except Exception as e:
        print(f"✗ Error creating test user: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if create_test_user():
        sys.exit(0)
    else:
        sys.exit(1)
