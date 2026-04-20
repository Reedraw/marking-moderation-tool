"""
API integration tests for Marking Moderation Tool

Tests all backend endpoints to ensure they work correctly.
Uses pytest-style async test functions with httpx for async HTTP requests.

NOTE: These are integration tests that require:
1. The backend server running on localhost:8000
2. A configured PostgreSQL database with the schema applied

Run tests with: pytest tests/test_api.py -v
"""
# Import pytest for test framework (fixtures, markers, assertions)
import pytest
# Import pytest_asyncio for async fixture support (session-scoped async setup/teardown)
import pytest_asyncio
# Import AsyncClient from httpx for making async HTTP requests to the API
from httpx import AsyncClient

# Import database lifecycle functions to manage the connection pool during tests
from app.lib.database import connect_to_db, close_db_connection, get_database


# Configure all tests in this module to use session-scoped async event loop
# This means one event loop is shared across all tests (avoids loop-closed errors)
pytestmark = pytest.mark.asyncio(loop_scope="session")

# Base URL for all API requests - points to the local backend server
API_BASE = "http://127.0.0.1:8000/api/v1"


# Session-scoped fixture: creates ONE database connection pool for ALL tests
# This avoids repeatedly connecting/disconnecting for each test
@pytest_asyncio.fixture(scope="session")
async def db_pool():
    """Setup database connection pool for tests"""
    await connect_to_db()          # Create the asyncpg connection pool
    yield get_database()           # Provide the pool to tests that need it
    await close_db_connection()    # Cleanup: close all connections when tests finish


# Function-scoped fixture: creates a fresh HTTP client for EACH test
# This ensures clean state (no shared cookies/headers between tests)
@pytest_asyncio.fixture(scope="function")
async def client():
    """HTTP client for testing API.
    
    Using scope="function" and handling cleanup carefully to avoid
    event loop closed errors on Windows.
    """
    # Create an async HTTP client targeting the API base URL with 30s timeout
    ac = AsyncClient(base_url=API_BASE, timeout=30.0)
    try:
        yield ac    # Provide the client to the test
    finally:
        try:
            await ac.aclose()   # Properly close the HTTP client after each test
        except RuntimeError:
            # Ignore "Event loop is closed" errors that occur on Windows
            # when the event loop shuts down before cleanup completes
            pass


class TestAuthEndpoints:
    """Test authentication endpoints - registration, login, user profile, logout"""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, db_pool):
        """Test successful user registration - should return 201 with user data"""
        import uuid
        # Generate a unique ID to prevent test collisions when run multiple times
        unique_id = str(uuid.uuid4())[:8]
        # POST to /auth/register with valid registration data
        response = await client.post(
            "/auth/register",
            json={
                "username": f"testlecturer_{unique_id}",
                "email": f"testlecturer_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
                "full_name": "Test Lecturer"
            }
        )
        # Verify 201 Created status
        assert response.status_code == 201
        data = response.json()
        # Verify the returned data matches what was sent
        assert data["username"] == f"testlecturer_{unique_id}"
        assert data["email"] == f"testlecturer_{unique_id}@example.com"
        assert data["role"] == "lecturer"
        # Verify a UUID was generated for the user
        assert "id" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, db_pool):
        """Test registration with duplicate email - should return 400"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # First registration - should succeed
        await client.post(
            "/auth/register",
            json={
                "username": f"testlecturer2_{unique_id}",
                "email": f"duplicate_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        # Second registration with SAME email - should fail with 400
        response = await client.post(
            "/auth/register",
            json={
                "username": f"testlecturer3_{unique_id}",
                "email": f"duplicate_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        assert response.status_code == 400
        data = response.json()
        # Verify the error message indicates duplicate email
        assert "Email already registered" in data.get("detail", {}).get("message", "")

    @pytest.mark.asyncio
    async def test_register_invalid_role(self, client: AsyncClient, db_pool):
        """Test registration with invalid role - should return 422 (validation error)"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        response = await client.post(
            "/auth/register",
            json={
                "username": f"invalidrole_{unique_id}",
                "email": f"invalidrole_{unique_id}@example.com",
                "password": "Password123",
                "role": "invalid_role",    # Not one of: lecturer, moderator, third_marker, admin
            }
        )
        # Pydantic validation should reject the invalid role with 422
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db_pool):
        """Test successful login - should return JWT token"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register a user first
        await client.post(
            "/auth/register",
            json={
                "username": f"loginuser_{unique_id}",
                "email": f"loginuser_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        # Login with the registered credentials
        response = await client.post(
            "/auth/login",
            json={"email": f"loginuser_{unique_id}@example.com", "password": "Password123"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify JWT token is returned
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Verify user object is included in response
        assert "user" in data

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient, db_pool):
        """Test login with wrong credentials - should return 401"""
        response = await client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        data = response.json()
        # Verify the error message
        assert "Invalid email or password" in data.get("detail", {}).get("message", "")

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, db_pool):
        """Test getting current authenticated user via /auth/me endpoint"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register a moderator user
        await client.post(
            "/auth/register",
            json={
                "username": f"getuser_{unique_id}",
                "email": f"getuser_{unique_id}@example.com",
                "password": "Password123",
                "role": "moderator",
            }
        )

        # Login to get JWT token
        login_response = await client.post(
            "/auth/login",
            json={"email": f"getuser_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # Use token to access protected /auth/me endpoint
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Verify the returned user matches who logged in
        assert data["username"] == f"getuser_{unique_id}"
        assert data["role"] == "moderator"

    @pytest.mark.asyncio
    async def test_logout(self, client: AsyncClient, db_pool):
        """Test logout endpoint - stateless JWT so just returns success"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login to get a token
        await client.post(
            "/auth/register",
            json={
                "username": f"logoutuser_{unique_id}",
                "email": f"logout_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        # Login to get token
        login_response = await client.post(
            "/auth/login",
            json={"email": f"logout_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # POST to /auth/logout with the bearer token
        response = await client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should return 200 (JWT is stateless, so logout is just acknowledgment)
        assert response.status_code == 200


class TestLecturerEndpoints:
    """Test lecturer endpoints - assessment CRUD, marks upload, sample generation"""

    @pytest.mark.asyncio
    async def test_create_assessment(self, client: AsyncClient, db_pool):
        """Test creating a new assessment - should return 201 with assessment data"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register a lecturer user
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_assessment_{unique_id}",
                "email": f"lecturer_assessment_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        # Login to get JWT token
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_assessment_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # POST to create a new assessment with all required fields
        response = await client.post(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "module_code": f"6COSC{unique_id}",
                "module_name": "Database Systems",
                "title": "Final Exam",
                "cohort": "2025/26",
                "due_date": "2026-03-31",
                "weighting": 50,         # Assessment weighting percentage
                "credit_size": 15        # Module credit size
            }
        )
        assert response.status_code == 201
        data = response.json()
        # Verify assessment was created with correct data
        assert data["title"] == "Final Exam"
        # New assessments always start in DRAFT status
        assert data["status"] == "DRAFT"

    @pytest.mark.asyncio
    async def test_get_lecturer_assessments(self, client: AsyncClient, db_pool):
        """Test getting lecturer's assessments list - should return array"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_list_{unique_id}",
                "email": f"lecturer_list_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_list_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET all assessments for this lecturer
        response = await client.get(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return a list (may be empty for new user)
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_upload_marks(self, client: AsyncClient, db_pool):
        """Test uploading marks for an assessment - full workflow test"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_marks_{unique_id}",
                "email": f"lecturer_marks_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_marks_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # First create an assessment to upload marks to
        assessment_response = await client.post(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "module_code": f"6COSC{unique_id}",
                "module_name": "Database Systems",
                "title": "Midterm",
                "cohort": "2025/26",
                "due_date": "2026-04-15",
                "weighting": 40,
                "credit_size": 15
            }
        )
        # Extract the assessment ID for the marks upload
        assessment_id = assessment_response.json()["id"]

        # Upload 3 student marks with different markers
        marks_response = await client.post(
            f"/lecturer/assessments/{assessment_id}/marks/upload",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "marks": [
                    {"student_id": f"S001_{unique_id}", "mark": 85.0, "marker_id": "M001"},
                    {"student_id": f"S002_{unique_id}", "mark": 72.5, "marker_id": "M002"},
                    {"student_id": f"S003_{unique_id}", "mark": 91.0, "marker_id": "M001"},
                ]
            }
        )
        assert marks_response.status_code == 200
        data = marks_response.json()
        # Verify all 3 marks were processed successfully
        assert data["processed"] == 3

    @pytest.mark.asyncio
    async def test_generate_sample(self, client: AsyncClient, db_pool):
        """Test generating moderation sample - requires marks to be uploaded first"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_sample_{unique_id}",
                "email": f"lecturer_sample_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_sample_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # Create an assessment
        assessment_response = await client.post(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "module_code": f"6COSC{unique_id}",
                "module_name": "Database Systems",
                "title": "Final Project",
                "cohort": "2025/26",
                "due_date": "2026-05-20",
                "weighting": 60,
                "credit_size": 30
            }
        )
        assessment_id = assessment_response.json()["id"]

        # Upload 10 marks (using list comprehension for varied marks and markers)
        await client.post(
            f"/lecturer/assessments/{assessment_id}/marks/upload",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "marks": [
                    {"student_id": f"S{i:03d}_{unique_id}", "mark": 70.0 + i, "marker_id": f"M{i%3+1:03d}"}
                    for i in range(10)  # Generates marks from 70.0 to 79.0 across 3 markers
                ]
            }
        )

        # Generate a moderation sample using RISK_BASED method
        sample_response = await client.post(
            f"/lecturer/assessments/{assessment_id}/generate-sample",
            headers={"Authorization": f"Bearer {token}"},
            json={"method": "RISK_BASED", "percent": 10.0}
        )
        assert sample_response.status_code == 200
        data = sample_response.json()
        # Verify sample was generated with at least some items
        assert "sample_size" in data
        assert data["sample_size"] > 0

    @pytest.mark.asyncio
    async def test_get_lecturer_dashboard(self, client: AsyncClient, db_pool):
        """Test getting lecturer dashboard statistics"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_dash_{unique_id}",
                "email": f"lecturer_dash_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_dash_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET dashboard stats
        response = await client.get(
            "/lecturer/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Dashboard stats should include a "total" count
        assert "total" in data


class TestModeratorEndpoints:
    """Test moderator endpoints - queue retrieval and dashboard statistics"""

    @pytest.mark.asyncio
    async def test_get_moderator_queue(self, client: AsyncClient, db_pool):
        """Test getting moderator queue - should return list of assessments pending moderation"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as moderator
        await client.post(
            "/auth/register",
            json={
                "username": f"moderator_test_{unique_id}",
                "email": f"moderator_test_{unique_id}@example.com",
                "password": "Password123",
                "role": "moderator",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"moderator_test_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET the moderator queue
        response = await client.get(
            "/moderator/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Queue should be a list (may be empty if no assessments are pending)
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_moderator_dashboard(self, client: AsyncClient, db_pool):
        """Test getting moderator dashboard stats - should return statistics object"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as moderator
        await client.post(
            "/auth/register",
            json={
                "username": f"moderator_dash_{unique_id}",
                "email": f"moderator_dash_{unique_id}@example.com",
                "password": "Password123",
                "role": "moderator",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"moderator_dash_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET dashboard statistics
        response = await client.get(
            "/moderator/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Dashboard should include total count
        assert "total" in data


class TestThirdMarkerEndpoints:
    """Test third marker endpoints - escalated queue and dashboard"""

    @pytest.mark.asyncio
    async def test_get_third_marker_queue(self, client: AsyncClient, db_pool):
        """Test getting third marker queue - should return escalated assessments"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as third_marker
        await client.post(
            "/auth/register",
            json={
                "username": f"third_marker_test_{unique_id}",
                "email": f"third_marker_test_{unique_id}@example.com",
                "password": "Password123",
                "role": "third_marker",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"third_marker_test_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET the third marker queue (escalated assessments)
        response = await client.get(
            "/third-marker/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Queue should be a list
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_third_marker_dashboard(self, client: AsyncClient, db_pool):
        """Test getting third marker dashboard stats"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as third_marker
        await client.post(
            "/auth/register",
            json={
                "username": f"third_marker_dash_{unique_id}",
                "email": f"third_marker_dash_{unique_id}@example.com",
                "password": "Password123",
                "role": "third_marker",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"third_marker_dash_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET dashboard statistics
        response = await client.get(
            "/third-marker/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Dashboard should include total count
        assert "total" in data


class TestAdminEndpoints:
    """Test admin endpoints - system stats, audit log, user management"""

    @pytest.mark.asyncio
    async def test_get_admin_stats(self, client: AsyncClient, db_pool):
        """Test getting admin system-wide statistics"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as admin
        await client.post(
            "/auth/register",
            json={
                "username": f"admin_test_{unique_id}",
                "email": f"admin_test_{unique_id}@example.com",
                "password": "Password123",
                "role": "admin",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"admin_test_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET admin stats
        response = await client.get(
            "/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_audit_log(self, client: AsyncClient, db_pool):
        """Test getting audit log - should return list of audit events"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as admin
        await client.post(
            "/auth/register",
            json={
                "username": f"admin_audit_{unique_id}",
                "email": f"admin_audit_{unique_id}@example.com",
                "password": "Password123",
                "role": "admin",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"admin_audit_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET audit log entries
        response = await client.get(
            "/admin/audit",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Audit log should be a list of events
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_users(self, client: AsyncClient, db_pool):
        """Test getting users list - admin can see all users"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as admin
        await client.post(
            "/auth/register",
            json={
                "username": f"admin_users_{unique_id}",
                "email": f"admin_users_{unique_id}@example.com",
                "password": "Password123",
                "role": "admin",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"admin_users_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        # GET all users
        response = await client.get(
            "/admin/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return a list of user objects
        assert isinstance(data, list)


class TestHealthEndpoints:
    """Test health check endpoints - liveness and readiness probes"""

    @pytest.mark.asyncio
    async def test_health(self, client: AsyncClient):
        """Test basic health/liveness endpoint (no auth needed, root-level URL)"""
        # Health endpoints are at root level, NOT under /api/v1
        # So we create a new client pointing to the root URL
        async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as c:
            response = await c.get("/health")
            assert response.status_code == 200
            data = response.json()
            # Verify the service reports as healthy
            assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_ready(self, client: AsyncClient, db_pool):
        """Test readiness probe endpoint (checks database connectivity)"""
        # Health endpoints are at root level, NOT under /api/v1
        async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as c:
            response = await c.get("/health/ready")
            # 200 = ready (DB reachable), 503 = not ready (DB unreachable)
            assert response.status_code in [200, 503]


class TestPreModerationChecklist:
    """Test pre-moderation checklist endpoints - lecturers submit before moderation"""

    @pytest.mark.asyncio
    async def test_submit_checklist(self, client: AsyncClient, db_pool):
        """Test submitting pre-moderation checklist - full workflow"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_checklist_{unique_id}",
                "email": f"lecturer_checklist_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_checklist_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]
        
        # Create an assessment to attach the checklist to
        create_response = await client.post(
            "/lecturer/assessments",
            json={
                "module_code": f"CS{unique_id}",
                "module_name": "Test Module",
                "title": "Test Assessment",
                "cohort": "2024-25",
                "due_date": "2025-06-30",
                "weighting": 50,
                "credit_size": 20
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Skip test if assessment creation failed (dependency issue)
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed, skipping checklist test")
        
        assessment_id = create_response.json()["id"]
        
        # Submit pre-moderation checklist with all 5 boolean questions + comments
        checklist_response = await client.post(
            f"/lecturer/assessments/{assessment_id}/checklist",
            json={
                "marking_in_accordance": True,              # Marks follow regulations
                "late_work_policy_adhered": True,            # Late penalties applied correctly
                "plagiarism_policy_adhered": True,           # Plagiarism cases handled
                "marks_available_with_percentages": True,    # Marks expressed as percentages
                "totalling_checked": True,                   # Totals verified
                "consistency_comments": "All markers attended standardisation meeting"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert checklist_response.status_code == 200
        data = checklist_response.json()
        # Verify all checklist values were saved correctly
        assert data["marking_in_accordance"] == True
        assert data["late_work_policy_adhered"] == True
        assert data["plagiarism_policy_adhered"] == True
        assert data["marks_available_with_percentages"] == True
        assert data["totalling_checked"] == True
        assert data["consistency_comments"] == "All markers attended standardisation meeting"

    @pytest.mark.asyncio
    async def test_get_checklist(self, client: AsyncClient, db_pool):
        """Test getting pre-moderation checklist after submission"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_getchecklist_{unique_id}",
                "email": f"lecturer_getchecklist_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_getchecklist_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]
        
        # Create an assessment
        create_response = await client.post(
            "/lecturer/assessments",
            json={
                "module_code": f"CS{unique_id}",
                "module_name": "Test Module",
                "title": "Test Assessment",
                "cohort": "2024-25",
                "due_date": "2025-06-30",
                "weighting": 50,
                "credit_size": 20
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed, skipping checklist test")
        
        assessment_id = create_response.json()["id"]
        
        # Submit checklist first (with some False values to test)
        await client.post(
            f"/lecturer/assessments/{assessment_id}/checklist",
            json={
                "marking_in_accordance": True,
                "late_work_policy_adhered": False,           # Intentionally False for testing
                "plagiarism_policy_adhered": True,
                "marks_available_with_percentages": True,
                "totalling_checked": False,                  # Intentionally False for testing
                "consistency_comments": "Test comments"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # GET the checklist back and verify saved values
        get_response = await client.get(
            f"/lecturer/assessments/{assessment_id}/checklist",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        # Verify the True/False values were persisted correctly
        assert data["marking_in_accordance"] == True
        assert data["late_work_policy_adhered"] == False
        assert data["totalling_checked"] == False

    @pytest.mark.asyncio
    async def test_checklist_not_found(self, client: AsyncClient, db_pool):
        """Test getting checklist that doesn't exist - should return 404"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_nochk_{unique_id}",
                "email": f"lecturer_nochk_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_nochk_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]
        
        # Create assessment WITHOUT submitting a checklist
        create_response = await client.post(
            "/lecturer/assessments",
            json={
                "module_code": f"CS{unique_id}",
                "module_name": "Test Module",
                "title": "Test Assessment",
                "cohort": "2024-25",
                "due_date": "2025-06-30",
                "weighting": 50,
                "credit_size": 20
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed")
        
        assessment_id = create_response.json()["id"]
        
        # Try to GET checklist that was never submitted - should be 404
        get_response = await client.get(
            f"/lecturer/assessments/{assessment_id}/checklist",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 404


class TestModuleLeaderResponse:
    """Test module leader response endpoints - lecturer responds to moderation feedback"""

    @pytest.mark.asyncio
    async def test_response_no_moderation_case(self, client: AsyncClient, db_pool):
        """Test submitting response when no moderation case exists - should return 400"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Register and login as lecturer
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_resp_{unique_id}",
                "email": f"lecturer_resp_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_resp_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]
        
        # Create an assessment (but don't go through moderation workflow)
        create_response = await client.post(
            "/lecturer/assessments",
            json={
                "module_code": f"CS{unique_id}",
                "module_name": "Test Module",
                "title": "Test Assessment",
                "cohort": "2024-25",
                "due_date": "2025-06-30",
                "weighting": 50,
                "credit_size": 20
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed")
        
        assessment_id = create_response.json()["id"]
        
        # Try to submit a module leader response without a moderation case
        # This should fail because no moderator has reviewed this assessment yet
        response = await client.post(
            f"/lecturer/assessments/{assessment_id}/response",
            json={
                "moderator_comments_considered": True,
                "response_to_issues": "Addressed all issues",
                "outliers_explanation": "No outliers",
                "needs_third_marker": False
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400
        # Error should indicate no moderation case exists
        assert "No moderation case found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_response_unauthorized(self, client: AsyncClient, db_pool):
        """Test submitting response for someone else's assessment - should return 403"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create FIRST lecturer (the owner)
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_owner_{unique_id}",
                "email": f"lecturer_owner_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login1 = await client.post(
            "/auth/login",
            json={"email": f"lecturer_owner_{unique_id}@example.com", "password": "Password123"}
        )
        token1 = login1.json()["access_token"]
        
        # Create SECOND lecturer (the unauthorized user)
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_other_{unique_id}",
                "email": f"lecturer_other_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )
        login2 = await client.post(
            "/auth/login",
            json={"email": f"lecturer_other_{unique_id}@example.com", "password": "Password123"}
        )
        token2 = login2.json()["access_token"]
        
        # Create assessment as FIRST lecturer
        create_response = await client.post(
            "/lecturer/assessments",
            json={
                "module_code": f"CS{unique_id}",
                "module_name": "Test Module",
                "title": "Test Assessment",
                "cohort": "2024-25",
                "due_date": "2025-06-30",
                "weighting": 50,
                "credit_size": 20
            },
            headers={"Authorization": f"Bearer {token1}"}
        )
        
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed")
        
        assessment_id = create_response.json()["id"]
        
        # Try to submit response as SECOND lecturer (not the owner)
        # This should fail with 403 Forbidden
        response = await client.post(
            f"/lecturer/assessments/{assessment_id}/response",
            json={
                "moderator_comments_considered": True,
                "response_to_issues": "Addressed all issues",
                "outliers_explanation": "No outliers",
                "needs_third_marker": False
            },
            headers={"Authorization": f"Bearer {token2}"}
        )
        # Only the assessment owner can submit a module leader response
        assert response.status_code == 403


# Entry point for running tests directly (python tests/test_api.py)
if __name__ == "__main__":
    # Run pytest with verbose output (-v) and print stdout (-s)
    pytest.main([__file__, "-v", "-s"])
