"""Create test user for case study

Revision ID: test_user_seed
Revises: 
Create Date: 2026-01-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import uuid
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'test_user_seed'
down_revision = None  # Will run independently
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade():
    conn = op.get_bind()
    session = Session(bind=conn)
    
    # Create test user
    test_email = "testuser@techmart.com"
    test_password = "TestUser123!"
    
    # Check if user already exists
    result = conn.execute(
        sa.text("SELECT id FROM iam_users WHERE email = :email"),
        {"email": test_email}
    )
    existing = result.fetchone()
    
    if not existing:
        user_id = str(uuid.uuid4())
        user_code = f"USR-TEST-{int(datetime.now().timestamp())}"
        hashed_password = pwd_context.hash(test_password)
        
        conn.execute(
            sa.text("""
                INSERT INTO iam_users (id, user_code, email, password_hash, full_name, kyc_tier, status, created_at)
                VALUES (:id, :code, :email, :password, :name, :tier, :status, :created_at)
            """),
            {
                "id": user_id,
                "code": user_code,
                "email": test_email,
                "password": hashed_password,
                "name": "Test User",
                "tier": "VERIFIED",
                "status": "ACTIVE",
                "created_at": datetime.utcnow()
            }
        )
        print(f"Created test user: {test_email}")
    else:
        print(f"Test user already exists: {test_email}")
    
    session.commit()


def downgrade():
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM iam_users WHERE email = :email"),
        {"email": "testuser@techmart.com"}
    )
