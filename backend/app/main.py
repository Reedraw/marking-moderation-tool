# Import time module for measuring database latency in health checks
import time
# Import asynccontextmanager for creating the application lifespan handler
from contextlib import asynccontextmanager
# Import Any type for flexible dictionary type hints
from typing import Any

# Import asyncpg for catching PostgreSQL-specific database exceptions
import asyncpg
# Import FastAPI framework components for building the application
from fastapi import FastAPI, Request, status
# Import Pydantic validation error class for custom error handling
from fastapi.exceptions import RequestValidationError
# Import JSONResponse for returning consistent JSON error responses
from fastapi.responses import JSONResponse
# Import Starlette's HTTPException (parent of FastAPI's) for global HTTP error handling
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import application settings and Environment enum for environment-aware behavior
from app.lib.config import settings, Environment
# Import database lifecycle functions - connect on startup, close on shutdown
from app.lib.database import connect_to_db, close_db_connection, get_database
# Import middleware setup function (adds CORS, trusted hosts, etc.)
from app.lib.middleware import add_middleware
# Import all route modules - each handles a different user role's endpoints
from app.routes import auth, lecturer, moderator, third_marker, admin

# Semantic version string for the API - returned in health check responses
SERVICE_VERSION = "0.1.0"


# Lifespan context manager - replaces the deprecated @app.on_event("startup"/"shutdown")
# This is the modern FastAPI approach (v0.93+) for managing application lifecycle
@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Application lifespan manager.

    - Startup: connect to database pool
    - Shutdown: close database pool
    """
    # STARTUP: Create the asyncpg connection pool before the app starts serving
    await connect_to_db()
    # yield gives control to the application - it runs while requests are being served
    yield
    # SHUTDOWN: Close all database connections when the application stops
    await close_db_connection()


# Create the main FastAPI application instance
app = FastAPI(
    # APP_NAME from settings, defaults to "MMT_API" if not set (uses getattr for safety)
    title=getattr(settings, "APP_NAME", "MMT_API"),
    version=SERVICE_VERSION,               # Version shown in Swagger docs
    lifespan=lifespan,                      # Attach the lifecycle manager
    description="Marking Moderation Tool API",  # Description shown in Swagger docs
)

# Apply all middleware (CORS, TrustedHost) to the app instance
add_middleware(app)

# Register all route modules with the API version prefix (e.g., /api/v1)
# Each router has its own sub-prefix (e.g., /auth, /lecturer, /moderator)
# So full paths become: /api/v1/auth/login, /api/v1/lecturer/assessments, etc.
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(lecturer.router, prefix=settings.API_V1_STR)
app.include_router(moderator.router, prefix=settings.API_V1_STR)
app.include_router(third_marker.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

# -------------------------
# Exception handlers
# -------------------------
# Global exception handlers catch errors from ANY route and return consistent JSON responses
# They prevent stack traces from leaking to clients in production


# Handler for Pydantic/FastAPI request validation errors (malformed request bodies)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors.

    - Dev: return full error details (field names, types, messages) for debugging
    - Prod: sanitize message to avoid leaking internal schema details
    """
    # In development, return the full Pydantic error details for easy debugging
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
        )

    # In production, sanitize errors - remove specific field info to prevent schema leakage
    # Only expose field location, a generic message, and the error type
    sanitized = [{"loc": e.get("loc"), "msg": "Invalid input value", "type": e.get("type")} for e in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": sanitized},
    )


# Handler for all HTTP exceptions (404, 401, 403, etc.) raised by routes
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    # Return the status code and detail message as JSON (instead of HTML)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# Handler specifically for PostgreSQL database errors (connection issues, query failures)
@app.exception_handler(asyncpg.PostgresError)
async def database_exception_handler(_: Request, exc: asyncpg.PostgresError):
    # Default generic message for production (don't expose DB internals)
    msg = "Database error."
    # In development, include the actual error message for debugging
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        msg = f"DB Error: {str(exc)}"
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": msg})


# Catch-all handler for any unhandled exceptions (last resort error handler)
@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    # Default generic message for production (security: don't expose internals)
    msg = "Internal server error."
    # In development, include the actual exception message for debugging
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        msg = f"Internal Error: {str(exc)}"
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": msg})


# -------------------------
# Health endpoints
# -------------------------


# Helper function to check database connectivity and measure latency
async def _check_database() -> dict[str, Any]:
    try:
        db = get_database()                       # Get the connection pool reference
        start = time.monotonic()                   # Start timing (monotonic clock = no drift)
        await db.fetchval("SELECT 1")             # Execute minimal query to test connectivity
        latency_ms = (time.monotonic() - start) * 1000  # Calculate round-trip time in milliseconds
        return {"status": "ok", "latency_ms": round(latency_ms, 2)}  # Return success with latency
    except Exception as e:
        # If database is unreachable, return error status with the exception message
        return {"status": "error", "message": str(e)}


# Root endpoint - simple service identifier (useful for verifying deployment)
@app.get("/")
async def root():
    return {"service": "MMT_API"}


# Liveness probe endpoint - confirms the process is running
# Used by Render/Docker health checks - does NOT check database
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "MMT_API", "version": SERVICE_VERSION}


# Readiness probe endpoint - confirms the app can serve requests (including DB)
# Returns 503 if database is unreachable, so load balancers stop sending traffic
@app.get("/health/ready")
async def health_ready():
    # Check if the database is reachable and measure latency
    db_check = await _check_database()
    # Determine readiness based on database status
    is_ready = db_check["status"] == "ok"

    # Return 200 if ready, 503 (Service Unavailable) if database is down
    return JSONResponse(
        status_code=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ready" if is_ready else "not_ready", "checks": {"database": db_check}},
    )
