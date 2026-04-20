# Import timedelta for setting JWT token expiration times
from datetime import timedelta

# Import asyncpg for database connection type hints
import asyncpg
# Import FastAPI components: router, dependency injection, HTTP errors, status codes, request
from fastapi import APIRouter, Depends, HTTPException, status, Request

# Import app configuration settings (contains JWT expiry time, etc.)
from app.lib.config import settings
# Import the database connection pool getter (FastAPI dependency)
from app.lib.database import get_database
# Import password verification function (Argon2id)
from app.lib.password import verify_password
# Import JWT token creation and current-user extraction functions
from app.lib.security import create_access_token, get_current_user
# Import Pydantic models for request/response validation
from app.models import (
    UserCreate,       # Request body for user registration
    UserLogin,        # Request body for user login
    UserOut,          # Response body (user without password)
    TokenResponse,    # Response body (JWT token + user info)
)
# Import database query functions for user operations
from app.queries.users import (
    create_user,                         # Insert new user into database
    get_user_by_email,                   # Find user record by email address
    username_exists,                     # Check if username is already taken
    get_user_password_hash_by_email      # Get stored password hash for verification
)

# Create a FastAPI router for all authentication endpoints
# prefix="/auth" means all routes here are under /api/v1/auth/...
# tags=["Authentication"] groups these endpoints in the Swagger docs
router = APIRouter(prefix="/auth", tags=["Authentication"])

# ===============================
# POST /auth/register - User Registration
# ===============================
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, request: Request, db: asyncpg.Pool = Depends(get_database)):
    """
    Register a new user (MMT prototype).

    - Checks if email already exists
    - Ensures unique username
    - Creates user with hashed password (handled in queries.create_user)
    - Returns created user (no token; frontend redirects to /login)
    """

    # Normalise email to lowercase and strip whitespace to prevent duplicates
    email = user.email.strip().lower()
    # Strip whitespace from username
    username = user.username.strip()

    # Check if a user with this email already exists in the database
    existing_user = await get_user_by_email(db, email)
    if existing_user:
        # Return structured error with field_errors for frontend form validation
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Email already registered",
                "field_errors": {"email": ["Email already registered"]},  # Maps to specific form field
                "error_code": "EMAIL_EXISTS",  # Machine-readable error code for frontend
            },
        )

    # Check if the username is already taken by another user
    if await username_exists(db, username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Username already taken",
                "field_errors": {"username": ["Username already taken"]},
                "error_code": "USERNAME_EXISTS",
            },
        )

    # Create the user in the database (password hashing happens inside create_user)
    try:
        new_user = await create_user(
            db=db,
            email=email,
            username=username,
            password=user.password,       # Plain text - hashed inside create_user
            role=user.role,               # Role from registration form (lecturer, moderator, etc.)
            full_name=user.full_name,     # Display name for the user
        )
    except asyncpg.UniqueViolationError:
        # Safety net for race conditions (two simultaneous requests with same email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "User already exists",
                "error_code": "USER_EXISTS",
            },
        )
    except ValueError:
        # Defensive: if role validation happens in queries layer and fails
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid role",
                "field_errors": {"role": ["Invalid role"]},
                "error_code": "INVALID_ROLE",
            },
        )

    # Return the new user data - FastAPI automatically serializes using UserOut model
    # Since response_model=UserOut, the password hash is excluded from the response
    return new_user

# ===============================
# POST /auth/login - User Authentication
# ===============================
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

    # Normalise email to lowercase and strip whitespace
    email = str(credentials.email).strip().lower()

    # Fetch the user record by email
    user = await get_user_by_email(db, email)
    # Fetch the stored password hash separately (not included in user record for security)
    password_hash = await get_user_password_hash_by_email(db, email)

    # Validate credentials - use a single generic error message to avoid
    # leaking information about which part failed (email vs password)
    if (not user) or (not password_hash) or (not verify_password(credentials.password, password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Invalid email or password",
                "field_errors": {
                    "email": ["Invalid email or password"],      # Show error on both fields
                    "password": ["Invalid email or password"],   # to not reveal which was wrong
                },
                "error_code": "INVALID_CREDENTIALS",
            },
        )

    # Check if the account has been deactivated by an admin
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": "Account is deactivated",
                "field_errors": None,                    # No specific field error
                "error_code": "ACCOUNT_DEACTIVATED",
            },
        )

    # Create a JWT access token with the user's ID as subject and role for RBAC
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user["id"]),        # User's UUID as the JWT subject claim
        role=user["role"],              # Role embedded in token for middleware RBAC checks
        expires_delta=access_token_expires,  # Token expiration from settings
    )

    # Return the token and user info (frontend stores token for subsequent requests)
    return {
        "access_token": access_token,   # The JWT string
        "token_type": "bearer",         # OAuth2 standard token type
        "user": user,                   # User details for frontend state
    }


# ===============================
# GET /auth/me - Get Current User Info
# ===============================
@router.get("/me", response_model=UserOut)
async def get_current_user_info(
    current_user: dict = Depends(get_current_user),  # Extract user from JWT via dependency injection
):
    """Get current authenticated user info.
    The get_current_user dependency decodes the JWT, validates it,
    and fetches the full user record from the database."""
    return current_user  # Return the authenticated user's data


@router.post("/logout")
async def logout():
    """Logout endpoint (stateless JWT - client should discard token)."""
    return {"message": "Logged out successfully"}