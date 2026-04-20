# Import Any type for flexible dictionary typing
from typing import Any

# Import asyncpg for database connection pool type hints
import asyncpg
# Import FastAPI components: router for grouping endpoints, Depends for DI, status codes
from fastapi import APIRouter, Depends, status

# Import the database connection pool getter (FastAPI dependency injection)
from app.lib.database import get_database
# Import the role-based access control dependency (ensures only admins can access)
from app.lib.security import require_role
# Import Pydantic response models for type-safe API responses
from app.models import (
    AdminStats,       # Response model for system-wide statistics
    AuditEventOut,    # Response model for audit log entries
    UserOut,          # Response model for user records (excludes password)
    ModuleOut,        # Response model for module records with assessment count
)
# Import database query functions for assessment-related operations
from app.queries.assessments import (
    get_admin_stats,     # Fetches aggregated system statistics
    get_audit_events,    # Fetches recent audit log entries
    log_audit_event,     # Records actions in the audit trail
    list_modules,        # Fetches all modules with assessment counts
)
# Import database query functions for user operations
from app.queries.users import list_users  # Fetches users with optional filters

# Create a FastAPI router for all admin endpoints
# prefix="/admin" means all routes here are under /api/v1/admin/...
# tags=["Admin"] groups these endpoints in the Swagger/OpenAPI docs
router = APIRouter(prefix="/admin", tags=["Admin"])


# ===============================
# GET /admin/stats - System-Wide Statistics
# ===============================
@router.get("/stats", response_model=AdminStats)
async def get_system_stats(
    # require_role("admin") ensures only users with role="admin" can access this endpoint
    # It extracts the JWT, validates the role, and returns the current user dict
    current_user: dict[str, Any] = Depends(require_role("admin")),
    # Inject the database connection pool via FastAPI dependency injection
    db: asyncpg.Pool = Depends(get_database),
):
    """Get system-wide statistics for admin dashboard.
    Returns assessment counts by status, user counts by role,
    and recent audit activity in the last 24 hours."""
    stats = await get_admin_stats(db)  # Query aggregated stats from database
    return stats  # FastAPI serializes using AdminStats response model


# ===============================
# GET /admin/audit - Audit Log
# ===============================
@router.get("/audit", response_model=list[AuditEventOut])
async def get_audit_log(
    limit: int = 20,  # Query parameter: how many events to return (default 20)
    current_user: dict[str, Any] = Depends(require_role("admin")),  # Admin-only access
    db: asyncpg.Pool = Depends(get_database),
):
    """Get recent audit events for the admin audit trail page.
    Capped at 100 events maximum to prevent excessive data transfer."""
    if limit > 100:        # Enforce maximum limit to prevent abuse
        limit = 100

    events = await get_audit_events(db, limit=limit)  # Fetch from audit_log table
    return events  # Returns list of AuditEventOut objects


# ===============================
# GET /admin/users - User Management
# ===============================
@router.get("/users", response_model=list[UserOut])
async def get_all_users(
    role: str | None = None,           # Optional filter: only users with this role
    is_active: bool | None = None,     # Optional filter: active/inactive users
    limit: int = 50,                   # How many users to return (default 50)
    current_user: dict[str, Any] = Depends(require_role("admin")),  # Admin-only
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all users with optional role and active status filters.
    Used by the admin user management page."""
    users = await list_users(
        db,
        role=role,                     # Pass through optional role filter
        is_active=is_active,           # Pass through optional active filter
        limit=min(limit, 100),         # Cap at 100 to prevent excessive queries
    )
    return users  # Returns list of UserOut objects (password excluded)


# ===============================
# POST /admin/users/{user_id}/deactivate - Deactivate User
# ===============================
@router.post("/users/{user_id}/deactivate")
async def deactivate_user_account(
    user_id: str,  # Path parameter: UUID of the user to deactivate
    current_user: dict[str, Any] = Depends(require_role("admin")),  # Admin-only
    db: asyncpg.Pool = Depends(get_database),
):
    """Deactivate a user account. Prevents the user from logging in.
    Admins cannot deactivate their own account (safety check)."""
    from uuid import UUID  # Import UUID for validation

    # Validate that the user_id is a valid UUID format
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return {"error": "Invalid user ID"}, status.HTTP_400_BAD_REQUEST

    # Prevent admins from accidentally deactivating their own account
    if user_id == str(current_user["id"]):
        return {"error": "Cannot deactivate your own account"}, status.HTTP_400_BAD_REQUEST

    # Import the deactivate query function (lazy import to avoid circular dependencies)
    from app.queries.users import deactivate_user

    # Attempt to deactivate the user in the database
    success = await deactivate_user(db, user_uuid)
    if success:
        # Log the deactivation action in the audit trail for compliance
        await log_audit_event(
            db,
            actor_id=current_user["id"],                                     # Who performed the action
            actor_name=current_user["full_name"] or current_user["username"], # Display name for audit
            actor_role=current_user["role"],                                  # Role of the actor
            action=f"Deactivated user {user_id}",                            # Human-readable action description
        )
        return {"message": "User deactivated"}  # Success response
    else:
        return {"error": "User not found"}, status.HTTP_404_NOT_FOUND  # User doesn't exist


# ===============================
# GET /admin/modules - Module Listing
# ===============================
@router.get("/modules", response_model=list[ModuleOut])
async def get_all_modules(
    limit: int = 100,  # Query parameter: how many modules to return
    current_user: dict[str, Any] = Depends(require_role("admin")),  # Admin-only
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all modules with their assessment counts and latest cohort year.
    Used by the admin Modules page."""
    modules = await list_modules(db, limit=min(limit, 200))  # Cap at 200
    return modules  # Returns list of ModuleOut objects
