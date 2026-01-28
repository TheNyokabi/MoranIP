import os
import pytest
import pytest_asyncio
import uuid
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session
from sqlalchemy import event

from app.main import app as fastapi_app
from app.database import SessionLocal, engine
from app.models.iam import Base, User
import app.models.rbac  # Register RBAC models
from app.services.auth_service import auth_service

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(scope="session")
def db_engine():
    """Create test database tables once per session."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    yield engine
    # Drop all tables after session
    try:
        Base.metadata.drop_all(bind=engine)
    except Exception:
        pass

@pytest.fixture
def db(db_engine) -> Generator[Session, None, None]:
    """
    Yield a database session for a test.
    Rollback constraints are handled by nested transaction or just by using a session that we close/rollback.
    Since we want isolation, we can force a rollback after each test.
    """
    connection = db_engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)

    # Force nested transaction for savepoints if needed, but simple rollback is usually enough for isolation
    # in integration tests unless we commit inside code.
    # If code commits, we need to handle that. 
    # For now, let's use the standard patterns.
    
    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Yield an async client for API testing."""
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

@pytest.fixture
def test_user(db: Session) -> User:
    """Create a test user."""
    user = User(
        email="test_integration@example.com",
        user_code="USER-TEST-INT",
        full_name="Test Integration User",
        password_hash=auth_service.get_password_hash("password123"),
        kyc_tier="KYC-T3",
        user_type="INTERNAL",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def auth_token(test_user: User, db: Session) -> str:
    """Create an identity token for the test user."""
    return auth_service.create_identity_token(test_user, db)
