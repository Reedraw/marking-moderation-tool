"""
API integration tests for Marking Moderation Tool

Tests all backend endpoints to ensure they work correctly.
Uses pytest-style async test functions.

NOTE: These are integration tests that require:
1. The backend server running on localhost:8000
2. A configured PostgreSQL database

Run tests with: pytest tests/test_api.py -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.lib.database import connect_to_db, close_db_connection, get_database


# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="session")

API_BASE = "http://127.0.0.1:8000/api/v1"


@pytest_asyncio.fixture(scope="session")
async def db_pool():
    """Setup database connection pool for tests"""
    await connect_to_db()
    yield get_database()
    await close_db_connection()


@pytest_asyncio.fixture(scope="function")
async def client():
    """HTTP client for testing API.
    
    Using scope="function" and handling cleanup carefully to avoid
    event loop closed errors on Windows.
    """
    ac = AsyncClient(base_url=API_BASE, timeout=30.0)
    try:
        yield ac
    finally:
        try:
            await ac.aclose()
        except RuntimeError:
            # Ignore "Event loop is closed" errors on Windows
            pass


class TestAuthEndpoints:
    """Test authentication endpoints"""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, db_pool):
        """Test successful user registration"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
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
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == f"testlecturer_{unique_id}"
        assert data["email"] == f"testlecturer_{unique_id}@example.com"
        assert data["role"] == "lecturer"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, db_pool):
        """Test registration with duplicate email"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        await client.post(
            "/auth/register",
            json={
                "username": f"testlecturer2_{unique_id}",
                "email": f"duplicate_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

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
        assert "Email already registered" in data.get("detail", {}).get("message", "")

    @pytest.mark.asyncio
    async def test_register_invalid_role(self, client: AsyncClient, db_pool):
        """Test registration with invalid role"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        response = await client.post(
            "/auth/register",
            json={
                "username": f"invalidrole_{unique_id}",
                "email": f"invalidrole_{unique_id}@example.com",
                "password": "Password123",
                "role": "invalid_role",
            }
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db_pool):
        """Test successful login"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        await client.post(
            "/auth/register",
            json={
                "username": f"loginuser_{unique_id}",
                "email": f"loginuser_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        response = await client.post(
            "/auth/login",
            json={"email": f"loginuser_{unique_id}@example.com", "password": "Password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient, db_pool):
        """Test login with invalid credentials"""
        response = await client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        data = response.json()
        assert "Invalid email or password" in data.get("detail", {}).get("message", "")

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, db_pool):
        """Test getting current authenticated user"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        await client.post(
            "/auth/register",
            json={
                "username": f"getuser_{unique_id}",
                "email": f"getuser_{unique_id}@example.com",
                "password": "Password123",
                "role": "moderator",
            }
        )

        login_response = await client.post(
            "/auth/login",
            json={"email": f"getuser_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == f"getuser_{unique_id}"
        assert data["role"] == "moderator"

    @pytest.mark.asyncio
    async def test_logout(self, client: AsyncClient, db_pool):
        """Test logout (stateless, just returns success)"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        await client.post(
            "/auth/register",
            json={
                "username": f"logoutuser_{unique_id}",
                "email": f"logout_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        login_response = await client.post(
            "/auth/login",
            json={"email": f"logout_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        response = await client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestLecturerEndpoints:
    """Test lecturer endpoints"""

    @pytest.mark.asyncio
    async def test_create_assessment(self, client: AsyncClient, db_pool):
        """Test creating a new assessment"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        await client.post(
            "/auth/register",
            json={
                "username": f"lecturer_assessment_{unique_id}",
                "email": f"lecturer_assessment_{unique_id}@example.com",
                "password": "Password123",
                "role": "lecturer",
            }
        )

        login_response = await client.post(
            "/auth/login",
            json={"email": f"lecturer_assessment_{unique_id}@example.com", "password": "Password123"}
        )
        token = login_response.json()["access_token"]

        response = await client.post(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "module_code": f"6COSC{unique_id}",
                "module_name": "Database Systems",
                "title": "Final Exam",
                "cohort": "2025/26",
                "due_date": "2026-03-31",
                "weighting": 50,
                "credit_size": 15
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Final Exam"
        assert data["status"] == "DRAFT"

    @pytest.mark.asyncio
    async def test_get_lecturer_assessments(self, client: AsyncClient, db_pool):
        """Test getting lecturer's assessments"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/lecturer/assessments",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_upload_marks(self, client: AsyncClient, db_pool):
        """Test uploading marks for an assessment"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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
        assessment_id = assessment_response.json()["id"]

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
        assert data["processed"] == 3

    @pytest.mark.asyncio
    async def test_generate_sample(self, client: AsyncClient, db_pool):
        """Test generating moderation sample"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        await client.post(
            f"/lecturer/assessments/{assessment_id}/marks/upload",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "marks": [
                    {"student_id": f"S{i:03d}_{unique_id}", "mark": 70.0 + i, "marker_id": f"M{i%3+1:03d}"}
                    for i in range(10)
                ]
            }
        )

        sample_response = await client.post(
            f"/lecturer/assessments/{assessment_id}/generate-sample",
            headers={"Authorization": f"Bearer {token}"},
            json={"method": "RISK_BASED", "percent": 10.0}
        )
        assert sample_response.status_code == 200
        data = sample_response.json()
        assert "sample_size" in data
        assert data["sample_size"] > 0

    @pytest.mark.asyncio
    async def test_get_lecturer_dashboard(self, client: AsyncClient, db_pool):
        """Test getting lecturer dashboard stats"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/lecturer/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data


class TestModeratorEndpoints:
    """Test moderator endpoints"""

    @pytest.mark.asyncio
    async def test_get_moderator_queue(self, client: AsyncClient, db_pool):
        """Test getting moderator queue"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/moderator/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_moderator_dashboard(self, client: AsyncClient, db_pool):
        """Test getting moderator dashboard stats"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/moderator/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data


class TestThirdMarkerEndpoints:
    """Test third marker endpoints"""

    @pytest.mark.asyncio
    async def test_get_third_marker_queue(self, client: AsyncClient, db_pool):
        """Test getting third marker queue"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/third-marker/queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_third_marker_dashboard(self, client: AsyncClient, db_pool):
        """Test getting third marker dashboard stats"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/third-marker/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data


class TestAdminEndpoints:
    """Test admin endpoints"""

    @pytest.mark.asyncio
    async def test_get_admin_stats(self, client: AsyncClient, db_pool):
        """Test getting admin stats"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_audit_log(self, client: AsyncClient, db_pool):
        """Test getting audit log"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/admin/audit",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_users(self, client: AsyncClient, db_pool):
        """Test getting users list"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
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

        response = await client.get(
            "/admin/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestHealthEndpoints:
    """Test health check endpoints"""

    @pytest.mark.asyncio
    async def test_health(self, client: AsyncClient):
        """Test health endpoint"""
        # Health endpoint is at root level, not under /api/v1
        async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as c:
            response = await c.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_health_ready(self, client: AsyncClient, db_pool):
        """Test health ready endpoint (includes DB check)"""
        # Health endpoint is at root level, not under /api/v1
        async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as c:
            response = await c.get("/health/ready")
            assert response.status_code in [200, 503]


class TestPreModerationChecklist:
    """Test pre-moderation checklist endpoints"""

    @pytest.mark.asyncio
    async def test_submit_checklist(self, client: AsyncClient, db_pool):
        """Test submitting pre-moderation checklist"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lecturer and login
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
        
        # If assessment creation failed, skip this test
        if create_response.status_code != 201:
            pytest.skip("Assessment creation failed, skipping checklist test")
        
        assessment_id = create_response.json()["id"]
        
        # Submit pre-moderation checklist
        checklist_response = await client.post(
            f"/lecturer/assessments/{assessment_id}/checklist",
            json={
                "marking_in_accordance": True,
                "late_work_policy_adhered": True,
                "plagiarism_policy_adhered": True,
                "marks_available_with_percentages": True,
                "totalling_checked": True,
                "consistency_comments": "All markers attended standardisation meeting"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert checklist_response.status_code == 200
        data = checklist_response.json()
        assert data["marking_in_accordance"] == True
        assert data["late_work_policy_adhered"] == True
        assert data["plagiarism_policy_adhered"] == True
        assert data["marks_available_with_percentages"] == True
        assert data["totalling_checked"] == True
        assert data["consistency_comments"] == "All markers attended standardisation meeting"

    @pytest.mark.asyncio
    async def test_get_checklist(self, client: AsyncClient, db_pool):
        """Test getting pre-moderation checklist"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lecturer and login
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
        
        # Submit checklist first
        await client.post(
            f"/lecturer/assessments/{assessment_id}/checklist",
            json={
                "marking_in_accordance": True,
                "late_work_policy_adhered": False,
                "plagiarism_policy_adhered": True,
                "marks_available_with_percentages": True,
                "totalling_checked": False,
                "consistency_comments": "Test comments"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Get checklist
        get_response = await client.get(
            f"/lecturer/assessments/{assessment_id}/checklist",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["marking_in_accordance"] == True
        assert data["late_work_policy_adhered"] == False
        assert data["totalling_checked"] == False

    @pytest.mark.asyncio
    async def test_checklist_not_found(self, client: AsyncClient, db_pool):
        """Test getting checklist that doesn't exist"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lecturer and login
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
        
        # Create an assessment without checklist
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
        
        # Try to get non-existent checklist
        get_response = await client.get(
            f"/lecturer/assessments/{assessment_id}/checklist",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 404


class TestModuleLeaderResponse:
    """Test module leader response endpoints"""

    @pytest.mark.asyncio
    async def test_response_no_moderation_case(self, client: AsyncClient, db_pool):
        """Test submitting response when no moderation case exists"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lecturer and login
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
            pytest.skip("Assessment creation failed")
        
        assessment_id = create_response.json()["id"]
        
        # Try to submit response (should fail - no moderation case)
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
        assert "No moderation case found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_response_unauthorized(self, client: AsyncClient, db_pool):
        """Test submitting response for someone else's assessment"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        
        # Create first lecturer
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
        
        # Create second lecturer
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
        
        # Create assessment as first lecturer
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
        
        # Try to submit response as second lecturer (should fail - not authorized)
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
        assert response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
