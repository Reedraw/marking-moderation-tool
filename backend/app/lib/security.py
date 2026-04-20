# Enable postponed evaluation of annotations (allows using | syntax for unions in older Python)
from __future__ import annotations

# Import datetime utilities for token expiry calculation
from datetime import datetime, timedelta, timezone
# Import type hints used throughout this module
from typing import Any, Callable, Literal
# Import UUID for parsing user IDs from token payloads
from uuid import UUID

# Import asyncpg for type hints on database pool
import asyncpg
# Import JWT encoding/decoding from authlib (handles signing and verification)
from authlib.jose import jwt
# Import base JWT error class for catching all JWT-related failures
from authlib.jose.errors import JoseError
# Import FastAPI's dependency injection and HTTP exception classes
from fastapi import Depends, HTTPException, status
# Import HTTP Bearer token security scheme for extracting tokens from Authorization header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Import our application settings (SECRET_KEY, ALGORITHM, token expiry etc.)
from app.lib.config import settings
# Import database pool dependency for looking up users
from app.lib.database import get_database
# Import database query function to fetch user by ID
from app.queries.users import get_active_user_by_id

# FastAPI security scheme - extracts Bearer token from the Authorization header
# When used as a dependency, it automatically returns 401 if no token is provided
security = HTTPBearer()

# Define the valid role types using Literal for strict type checking
Role = Literal["lecturer", "moderator", "third_marker", "admin"]
# Set of allowed roles for O(1) membership checking during validation
ALLOWED_ROLES = {"lecturer", "moderator", "third_marker", "admin"}


# -------------------------------------------------------------------
# JWT creation / decoding
# -------------------------------------------------------------------

def create_access_token(
    *,                                          # Force keyword-only arguments
    subject: str,                               # The user's UUID as a string
    role: str,                                  # The user's role (lecturer, moderator, etc.)
    expires_delta: timedelta | None = None,     # Custom expiry time (optional)
    extra_claims: dict[str, Any] | None = None, # Additional JWT claims (optional)
) -> str:
    """
    Create a JWT access token for authentication.
    The token contains the user ID (sub), their role, and an expiry timestamp.
    This is called after successful login to issue a token to the client.
    """
    # Validate that the role is one of our allowed system roles
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")

    # Calculate token expiry - use custom delta or fall back to configured default (30 mins)
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Build the JWT payload with standard claims
    payload: dict[str, Any] = {
        "sub": subject,   # Subject - the user's UUID (standard JWT claim)
        "role": role,      # Custom claim - the user's RBAC role
        "exp": expire,     # Expiration time (standard JWT claim)
    }

    # Merge any additional claims into the payload
    if extra_claims:
        payload.update(extra_claims)

    # Set the JWT header with the signing algorithm (HS256)
    header = {"alg": settings.ALGORITHM}
    # Encode the token using our secret key - this creates the signed JWT string
    token = jwt.encode(header, payload, settings.SECRET_KEY)
    # Return as string (authlib may return bytes depending on version)
    return token.decode("utf-8") if isinstance(token, bytes) else token


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token. Checks the signature matches our secret key
    and that the token hasn't expired. Returns the payload dict if valid.
    """
    try:
        # Decode the token using our secret key (verifies signature)
        payload = jwt.decode(token, settings.SECRET_KEY)
        # Validate standard claims (exp, nbf, etc.) - raises if expired
        payload.validate()
        return dict(payload)
    except JoseError as e:
        # Any JWT error (invalid signature, expired, malformed) returns 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# -------------------------------------------------------------------
# Current user dependency
# -------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),  # Extract Bearer token
    db: asyncpg.Pool = Depends(get_database),                      # Inject database pool
) -> dict[str, Any]:
    """
    FastAPI dependency that resolves the current authenticated user.
    Decodes the JWT token, validates it, then loads the full user record
    from the database. Used by route handlers via Depends(get_current_user).
    """
    # Decode and validate the JWT token from the Authorization header
    payload = decode_access_token(credentials.credentials)

    # Extract user ID and role from the token payload
    user_id_str = payload.get("sub")
    role = payload.get("role")

    # Reject tokens missing required claims
    if not user_id_str or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Parse the user ID string into a UUID object
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        # Invalid UUID format in the token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify the role in the token is a valid system role
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid role claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Look up the user in the database - also checks they're still active
    user = await get_active_user_by_id(db, user_id)
    if user is None:
        # User was deleted or deactivated since the token was issued
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Return the full user record as a dict for use in route handlers
    return user


# -------------------------------------------------------------------
# RBAC helpers (Role-Based Access Control)
# -------------------------------------------------------------------

def require_role(*allowed: Role) -> Callable[[dict[str, Any]], dict[str, Any]]:
    """
    Dependency factory that creates a FastAPI dependency restricting
    access to users with specific roles. Returns the current user if
    their role is in the allowed set, otherwise raises 403 Forbidden.

    Usage:
      @router.get(..., dependencies=[Depends(require_role("admin"))])
      or
      current_user = Depends(require_role("moderator"))
    """
    # Convert allowed roles tuple to a set for O(1) lookup
    allowed_set = set(allowed)

    # Inner dependency function that FastAPI will call for each request
    async def _dep(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = current_user.get("role")
        # Check if the user's role is in the set of allowed roles
        if user_role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        # User has the right role - return their data for use in the route handler
        return current_user

    return _dep


# Pre-built convenience dependencies for common single-role restrictions
require_lecturer = require_role("lecturer")
require_moderator = require_role("moderator")
require_third_marker = require_role("third_marker")
require_admin = require_role("admin")
