import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.main import app

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest_asyncio.fixture
async def async_client():
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
