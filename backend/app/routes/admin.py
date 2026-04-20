from typing import Any

import asyncpg
from fastapi import APIRouter, Depends, status

from app.lib.database import get_database
from app.lib.security import require_role
from app.models import (
    AdminStats,
    AuditEventOut,
    UserOut,
    ModuleOut,
)
from app.queries.assessments import (
    get_admin_stats,
    get_audit_events,
    log_audit_event,
    list_modules,
)
from app.queries.users import list_users

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStats)
async def get_system_stats(
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get system-wide statistics for admin dashboard."""
    stats = await get_admin_stats(db)
    return stats


@router.get("/audit", response_model=list[AuditEventOut])
async def get_audit_log(
    limit: int = 20,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get recent audit events."""
    if limit > 100:
        limit = 100

    events = await get_audit_events(db, limit=limit)
    return events


@router.get("/users", response_model=list[UserOut])
async def get_all_users(
    role: str | None = None,
    is_active: bool | None = None,
    limit: int = 50,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all users with optional filters."""
    users = await list_users(
        db,
        role=role,
        is_active=is_active,
        limit=min(limit, 100),
    )
    return users


@router.post("/users/{user_id}/deactivate")
async def deactivate_user_account(
    user_id: str,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Deactivate a user account."""
    from uuid import UUID

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return {"error": "Invalid user ID"}, status.HTTP_400_BAD_REQUEST

    if user_id == str(current_user["id"]):
        return {"error": "Cannot deactivate your own account"}, status.HTTP_400_BAD_REQUEST

    from app.queries.users import deactivate_user

    success = await deactivate_user(db, user_uuid)
    if success:
        await log_audit_event(
            db,
            actor_id=current_user["id"],
            actor_name=current_user["full_name"] or current_user["username"],
            actor_role=current_user["role"],
            action=f"Deactivated user {user_id}",
        )
        return {"message": "User deactivated"}
    else:
        return {"error": "User not found"}, status.HTTP_404_NOT_FOUND


@router.get("/modules", response_model=list[ModuleOut])
async def get_all_modules(
    limit: int = 100,
    current_user: dict[str, Any] = Depends(require_role("admin")),
    db: asyncpg.Pool = Depends(get_database),
):
    """Get all modules with assessment counts."""
    modules = await list_modules(db, limit=min(limit, 200))
    return modules
