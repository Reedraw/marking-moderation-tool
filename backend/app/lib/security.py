from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Literal
from uuid import UUID

import asyncpg
from authlib.jose import jwt
from authlib.jose.errors import JoseError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.lib.config import settings
from app.lib.database import get_database
from app.queries.users import get_active_user_by_id

# Bearer token extractor
security = HTTPBearer()

Role = Literal["lecturer", "moderator", "third_marker", "admin"]
ALLOWED_ROLES = {"lecturer", "moderator", "third_marker", "admin"}


# -------------------------------------------------------------------
# JWT creation / decoding
# -------------------------------------------------------------------

def create_access_token(
    *,
    subject: str,
    role: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create a JWT access token.

    Payload contains:
      - sub: user id
      - role: RBAC role
      - exp: expiry
    """
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {role}")

    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expire,
    }

    if extra_claims:
        payload.update(extra_claims)

    header = {"alg": settings.ALGORITHM}
    token = jwt.encode(header, payload, settings.SECRET_KEY)
    return token.decode("utf-8") if isinstance(token, bytes) else token


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate JWT signature + exp.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY)
        payload.validate()  # validates exp, nbf, etc. if present
        return dict(payload)
    except JoseError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# -------------------------------------------------------------------
# Current user dependency
# -------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Pool = Depends(get_database),
) -> dict[str, Any]:
    """
    Load the currently authenticated user from the database.
    Returns a dict row (aligned with your asyncpg query style).

    Token must include:
      - sub (uuid string)
      - role
    """
    payload = decode_access_token(credentials.credentials)

    user_id_str = payload.get("sub")
    role = payload.get("role")

    if not user_id_str or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate UUID
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate role claim is one of our system roles
    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid role claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_active_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# -------------------------------------------------------------------
# RBAC helpers
# -------------------------------------------------------------------

def require_role(*allowed: Role) -> Callable[[dict[str, Any]], dict[str, Any]]:
    """
    Dependency factory: restrict endpoint to one of the specified roles.

    Usage:
      @router.get(..., dependencies=[Depends(require_role("admin"))])
      or
      current_user = Depends(require_role("moderator"))
    """

    allowed_set = set(allowed)

    async def _dep(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _dep


# Convenience dependencies (optional)
require_lecturer = require_role("lecturer")
require_moderator = require_role("moderator")
require_third_marker = require_role("third_marker")
require_admin = require_role("admin")
