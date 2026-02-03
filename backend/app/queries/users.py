from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

import asyncpg

from app.lib.password import get_password_hash

# Canonical roles for MMT
ALLOWED_ROLES = {"lecturer", "moderator", "third_marker", "admin"}


# ------------------------------------------------------------------
# CREATE
# ------------------------------------------------------------------

async def create_user(
    db: asyncpg.Pool,
    *,
    username: str,
    email: str,
    password: str,
    role: str,
    full_name: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    """
    Create a new user for the Marking Moderation Tool.
    Password is hashed server-side.
    """
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")

    password_hash = get_password_hash(password)

    user = await db.fetchrow(
        """
        INSERT INTO users (username, email, full_name, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, full_name, role, is_active, created_at, updated_at
        """,
        username,
        email,
        full_name,
        password_hash,
        role,
        is_active,
    )
    return dict(user)


# ------------------------------------------------------------------
# READ
# ------------------------------------------------------------------

async def get_user_by_id(db: asyncpg.Pool, user_id: UUID) -> Optional[dict[str, Any]]:
    user = await db.fetchrow(
        """
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        WHERE id = $1
        """,
        user_id,
    )
    return dict(user) if user else None


async def get_active_user_by_id(db: asyncpg.Pool, user_id: UUID) -> Optional[dict[str, Any]]:
    user = await db.fetchrow(
        """
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        WHERE id = $1 AND is_active = TRUE
        """,
        user_id,
    )
    return dict(user) if user else None


async def get_user_by_email(db: asyncpg.Pool, email: str) -> Optional[dict[str, Any]]:
    user = await db.fetchrow(
        """
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        WHERE email = $1
        """,
        email,
    )
    return dict(user) if user else None


async def get_user_by_username(db: asyncpg.Pool, username: str) -> Optional[dict[str, Any]]:
    user = await db.fetchrow(
        """
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        WHERE username = $1
        """,
        username,
    )
    return dict(user) if user else None


# ------------------------------------------------------------------
# VALIDATION / LOGIN HELPERS
# ------------------------------------------------------------------

async def email_exists(db: asyncpg.Pool, email: str) -> bool:
    return await db.fetchval("SELECT 1 FROM users WHERE email = $1") is not None


async def username_exists(db: asyncpg.Pool, username: str) -> bool:
    return await db.fetchval("SELECT 1 FROM users WHERE username = $1") is not None


async def get_user_password_hash_by_email(db: asyncpg.Pool, email: str) -> Optional[str]:
    """
    Used during login. Returns password hash for any user (active or inactive).
    The caller should check is_active separately to provide specific error messages.
    """
    return await db.fetchval(
        "SELECT password_hash FROM users WHERE email = $1",
        email,
    )


async def get_user_password_hash(db: asyncpg.Pool, user_id: UUID) -> Optional[str]:
    return await db.fetchval("SELECT password_hash FROM users WHERE id = $1", user_id)


# ------------------------------------------------------------------
# UPDATE
# ------------------------------------------------------------------

async def update_user_password(db: asyncpg.Pool, user_id: UUID, new_password: str) -> bool:
    password_hash = get_password_hash(new_password)
    result = await db.execute(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        password_hash,
        user_id,
    )
    return result == "UPDATE 1"


async def update_user(
    db: asyncpg.Pool,
    user_id: UUID,
    *,
    username: str | None = None,
    email: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
) -> Optional[dict[str, Any]]:
    """
    Update user fields (admin-only in real system).
    """
    fields: dict[str, Any] = {}

    if username is not None:
        fields["username"] = username
    if email is not None:
        fields["email"] = email
    if role is not None:
        if role not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role: {role}")
        fields["role"] = role
    if is_active is not None:
        fields["is_active"] = is_active

    if not fields:
        return await get_user_by_id(db, user_id)

    set_clauses = []
    values = []
    idx = 1

    for key, value in fields.items():
        set_clauses.append(f"{key} = ${idx}")
        values.append(value)
        idx += 1

    values.append(user_id)

    user = await db.fetchrow(
        f"""
        UPDATE users
        SET {", ".join(set_clauses)}, updated_at = NOW()
        WHERE id = ${idx}
        RETURNING id, username, email, full_name, role, is_active, created_at, updated_at
        """,
        *values,
    )
    return dict(user) if user else None


# ------------------------------------------------------------------
# DELETE (SOFT)
# ------------------------------------------------------------------

async def deactivate_user(db: asyncpg.Pool, user_id: UUID) -> bool:
    result = await db.execute(
        "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        user_id,
    )
    return result == "UPDATE 1"


# ------------------------------------------------------------------
# ADMIN HELPERS (OPTIONAL)
# ------------------------------------------------------------------

async def list_users(
    db: asyncpg.Pool,
    *,
    role: str | None = None,
    is_active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    clauses = []
    values = []
    idx = 1

    if role is not None:
        clauses.append(f"role = ${idx}")
        values.append(role)
        idx += 1

    if is_active is not None:
        clauses.append(f"is_active = ${idx}")
        values.append(is_active)
        idx += 1

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    rows = await db.fetch(
        f"""
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        {where_sql}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *values,
        limit,
        offset,
    )
    return [dict(r) for r in rows]
