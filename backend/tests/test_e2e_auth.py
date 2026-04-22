"""
End-to-end tests to verify authentication works with Argon2.

Requires the backend server running on localhost:8000.
Run with: pytest tests/test_e2e_auth.py -v
"""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")

BASE_URL = "http://127.0.0.1:8000"
API_BASE = f"{BASE_URL}/api/v1"


@pytest_asyncio.fixture(scope="session")
async def http_client():
    ac = AsyncClient(base_url=BASE_URL, timeout=30.0)
    try:
        yield ac
    finally:
        try:
            await ac.aclose()
        except RuntimeError:
            pass


@pytest_asyncio.fixture(scope="session")
async def registered_user(http_client: AsyncClient):
    """Register a fresh user for the session and return their credentials."""
    unique_id = str(uuid.uuid4())[:8]
    credentials = {
        "username": f"test_argon_{unique_id}",
        "email": f"test_argon_{unique_id}@example.com",
        "password": "TestPassword123!",
        "role": "lecturer",
        "full_name": "Test Argon User",
    }
    response = await http_client.post("/api/v1/auth/register", json=credentials)
    assert response.status_code == 201, f"Registration failed: {response.text}"
    return credentials


async def test_health_check(http_client: AsyncClient):
    """Health endpoint should return 200."""
    response = await http_client.get("/health")
    assert response.status_code == 200


async def test_register_new_user(http_client: AsyncClient):
    """Registering a new user with Argon2 hashing should return 201."""
    unique_id = str(uuid.uuid4())[:8]
    response = await http_client.post(
        "/api/v1/auth/register",
        json={
            "username": f"test_reg_{unique_id}",
            "email": f"test_reg_{unique_id}@example.com",
            "password": "TestPassword123!",
            "role": "lecturer",
            "full_name": "Test Registration User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == f"test_reg_{unique_id}"
    assert data["role"] == "lecturer"


async def test_login_registered_user(http_client: AsyncClient, registered_user: dict):
    """Logging in with a registered user's Argon2 password should succeed."""
    response = await http_client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        },
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


async def test_get_current_user(http_client: AsyncClient, registered_user: dict):
    """Authenticated /auth/me should return the logged-in user's details."""
    login = await http_client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": registered_user["password"],
        },
    )
    token = login.json()["access_token"]

    response = await http_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == registered_user["username"]
    assert data["role"] == registered_user["role"]


async def test_login_wrong_password(http_client: AsyncClient, registered_user: dict):
    """Login with an incorrect password should return 401."""
    response = await http_client.post(
        "/api/v1/auth/login",
        json={
            "email": registered_user["email"],
            "password": "WrongPassword",
        },
    )
    assert response.status_code == 401
