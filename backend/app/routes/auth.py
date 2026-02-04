from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status, Request

from app.lib.config import settings
from app.lib.database import get_database
from app.lib.password import verify_password
from app.lib.security import create_access_token, get_current_user
from app.models import (
    UserCreate,
    UserLogin,
    UserOut,
    TokenResponse,
)
from app.queries.users import (
    create_user,
    get_user_by_email,
    username_exists,
    get_user_password_hash_by_email
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, request: Request, db: asyncpg.Pool = Depends(get_database)):
    """
    Register a new user (MMT prototype).

    - Checks if email already exists
    - Ensures unique username
    - Creates user with hashed password (handled in queries.create_user)
    - Returns created user (no token; frontend redirects to /login)
    """

    # Normalise
    email = user.email.strip().lower()
    username = user.username.strip()

    # Check if user exists by email
    existing_user = await get_user_by_email(db, email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Email already registered",
                "field_errors": {"email": ["Email already registered"]},
                "error_code": "EMAIL_EXISTS",
            },
        )

    # Check username uniqueness
    if await username_exists(db, username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Username already taken",
                "field_errors": {"username": ["Username already taken"]},
                "error_code": "USERNAME_EXISTS",
            },
        )

    # Create user (password hashing happens inside create_user)
    try:
        new_user = await create_user(
            db=db,
            email=email,
            username=username,
            password=user.password,
            role=user.role,
            full_name=user.full_name,
        )
    except asyncpg.UniqueViolationError:
        # Safety net for race conditions (two requests at once)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "User already exists",
                "error_code": "USER_EXISTS",
            },
        )
    except ValueError:
        # Defensive: if role validation happens in queries and fails
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid role",
                "field_errors": {"role": ["Invalid role"]},
                "error_code": "INVALID_ROLE",
            },
        )

    # Since response_model=UserOut, returning the dict is fine
    return new_user

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request, db: asyncpg.Pool = Depends(get_database)):
    """
    Authenticate user and issue an access token (MMT prototype).

    - Validates email + password
    - Ensures account is active
    - Returns a JWT access token for subsequent API requests

    Note:
      For this prototype we use access tokens only (no refresh tokens / sessions).
    """

    email = str(credentials.email).strip().lower()

    # Fetch user + password hash
    user = await get_user_by_email(db, email)
    password_hash = await get_user_password_hash_by_email(db, email)

    # Invalid credentials (avoid leaking which part failed)
    if (not user) or (not password_hash) or (not verify_password(credentials.password, password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Invalid email or password",
                "field_errors": {
                    "email": ["Invalid email or password"],
                    "password": ["Invalid email or password"],
                },
                "error_code": "INVALID_CREDENTIALS",
            },
        )

    # Account deactivated
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Account is deactivated",
                "field_errors": None,
                "error_code": "ACCOUNT_DEACTIVATED",
            },
        )

    # Create JWT (include role claim for RBAC)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user["id"]),
        role=user["role"],
        expires_delta=access_token_expires,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),
):
    """Get current authenticated user info."""
    return current_user


@router.post("/logout")
async def logout():
    """Logout endpoint (stateless JWT - client should discard token)."""
    return {"message": "Logged out successfully"}