# Import asyncpg for typed database connection pool
import asyncpg
# Import type hints for function return types
from typing import Any, Optional
# Import UUID for user ID parameters
from uuid import UUID

# Import our Argon2 password hashing function
from app.lib.password import get_password_hash

# Set of valid roles - used to validate role input before database insert
ALLOWED_ROLES = {"student", "lecturer", "moderator", "admin", "third_marker"}


async def create_user(
    db: asyncpg.Pool,
    *,                              # Force all arguments to be keyword-only
    username: str,
    email: str,
    password: str,
    role: str,
    full_name: str | None = None,
    is_active: bool = True,
) -> dict[str, Any]:
    """Create a new user account in the database.
    Hashes the password with Argon2 before storing."""
    # Validate role against allowed values before hitting the database
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")

    # Hash the plain-text password using Argon2id (never store passwords in plain text)
    password_hash = get_password_hash(password)

    # Acquire a connection from the pool for the transaction
    async with db.acquire() as conn:
        # Insert the new user record with the hashed password
        await conn.execute(
            """
            INSERT INTO users (username, email, full_name, password_hash, role, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            username,       # $1 - unique username
            email,          # $2 - validated email
            full_name,      # $3 - optional display name
            password_hash,  # $4 - Argon2 hash (never the plain password)
            role,           # $5 - validated role string
            is_active,      # $6 - account active by default
        )

        # Fetch the newly created user (without password_hash for security)
        user = await conn.fetchrow(
            """
            SELECT id, username, email, full_name, role, is_active, created_at, updated_at
            FROM users
            WHERE username = $1
            """,
            username,
        )

    # Convert asyncpg Record to dict for Pydantic model compatibility
    return dict(user)


async def get_user_by_id(db: asyncpg.Pool, user_id: UUID) -> Optional[dict[str, Any]]:
    """Fetch a user by their UUID primary key. Returns None if not found."""
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
    """Fetch a user by ID only if their account is active.
    Used by the JWT authentication dependency to reject deactivated users."""
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
    """Fetch a user by their email address. Used during login to look up the account."""
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
    """Fetch a user by their username. Used to check for duplicates during registration."""
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
    """Check if an email is already registered. Returns True/False.
    Uses SELECT 1 for efficiency - doesn't need to fetch the full row."""
    return await db.fetchval("SELECT 1 FROM users WHERE email = $1", email) is not None


async def username_exists(db: asyncpg.Pool, username: str) -> bool:
    """Check if a username is already taken. Returns True/False."""
    return await db.fetchval("SELECT 1 FROM users WHERE username = $1", username) is not None


async def get_user_password_hash_by_email(db: asyncpg.Pool, email: str) -> Optional[str]:
    """Fetch the stored password hash for a user by email.
    Used during login to verify the provided password against the hash."""
    return await db.fetchval("SELECT password_hash FROM users WHERE email = $1", email)


async def get_user_password_hash(db: asyncpg.Pool, user_id: UUID) -> Optional[str]:
    """Fetch the stored password hash for a user by ID."""
    return await db.fetchval("SELECT password_hash FROM users WHERE id = $1", user_id)


async def deactivate_user(db: asyncpg.Pool, user_id: UUID) -> bool:
    """Soft-delete a user by setting is_active to FALSE.
    We don't hard-delete users to maintain audit trail integrity.
    Returns True if a row was updated, False if user not found."""
    result = await db.execute("UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1", user_id)
    # asyncpg returns "UPDATE 1" if exactly one row was affected
    return result == "UPDATE 1"


async def list_users(
    db: asyncpg.Pool,
    *,
    role: str | None = None,         # Optional filter by role
    is_active: bool | None = None,   # Optional filter by active status
    limit: int = 50,                 # Pagination: max results per page
    offset: int = 0,                 # Pagination: skip this many results
) -> list[dict[str, Any]]:
    """List users with optional role/active filters and pagination.
    Builds the WHERE clause dynamically based on provided filters."""
    clauses = []   # SQL WHERE conditions
    values = []    # Parameterised query values (prevents SQL injection)
    idx = 1        # Parameter index counter ($1, $2, etc.)

    # Add role filter if specified
    if role is not None:
        clauses.append(f"role = ${idx}")
        values.append(role)
        idx += 1

    # Add active status filter if specified
    if is_active is not None:
        clauses.append(f"is_active = ${idx}")
        values.append(is_active)
        idx += 1

    # Build WHERE clause from accumulated conditions (empty string if no filters)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    # Execute the dynamically built query with parameterised values
    rows = await db.fetch(
        f"""
        SELECT id, username, email, full_name, role, is_active, created_at, updated_at
        FROM users
        {where_sql}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
        """,
        *values,    # Spread the filter values
        limit,      # LIMIT parameter
        offset,     # OFFSET parameter
    )
    # Convert each asyncpg Record to a dict
    return [dict(r) for r in rows]
