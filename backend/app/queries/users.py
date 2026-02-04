import asyncpg
from typing import Any, Optional
from uuid import UUID

from app.lib.password import get_password_hash

# Canonical roles for MMT
ALLOWED_ROLES = {"student", "lecturer", "moderator", "admin", "third_marker"}


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
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")

    password_hash = get_password_hash(password)

    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO users (username, email, full_name, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            username,
            email,
            full_name,
            password_hash,
            role,
            is_active,
        )

        user = await conn.fetchrow(
            """
            SELECT id, username, email, full_name, role, is_active, created_at, updated_at
            FROM users
            WHERE username = $1
            """,
            username,
        )

    return dict(user)


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


async def email_exists(db: asyncpg.Pool, email: str) -> bool:
    return await db.fetchval("SELECT 1 FROM users WHERE email = $1", email) is not None


async def username_exists(db: asyncpg.Pool, username: str) -> bool:
    return await db.fetchval("SELECT 1 FROM users WHERE username = $1", username) is not None


async def get_user_password_hash_by_email(db: asyncpg.Pool, email: str) -> Optional[str]:
    return await db.fetchval("SELECT password_hash FROM users WHERE email = $1", email)


async def get_user_password_hash(db: asyncpg.Pool, user_id: UUID) -> Optional[str]:
    return await db.fetchval("SELECT password_hash FROM users WHERE id = $1", user_id)


async def deactivate_user(db: asyncpg.Pool, user_id: UUID) -> bool:
    result = await db.execute("UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1", user_id)
    return result == "UPDATE 1"


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
