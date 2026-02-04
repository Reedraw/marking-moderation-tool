import time
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.lib.config import settings, Environment
from app.lib.database import connect_to_db, close_db_connection, get_database
from app.lib.middleware import add_middleware
from app.routes import auth, lecturer, moderator, third_marker, admin

SERVICE_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Application lifespan manager.

    - Startup: connect to database pool
    - Shutdown: close database pool
    """
    await connect_to_db()
    yield
    await close_db_connection()


app = FastAPI(
    title=getattr(settings, "APP_NAME", "MMT_API"),
    version=SERVICE_VERSION,
    lifespan=lifespan,
    description="Marking Moderation Tool API",
)

add_middleware(app)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(lecturer.router, prefix=settings.API_V1_STR)
app.include_router(moderator.router, prefix=settings.API_V1_STR)
app.include_router(third_marker.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

# -------------------------
# Exception handlers
# -------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors.

    - Dev: return full error details
    - Prod: sanitize message to avoid leaking internal schemas
    """
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors()},
        )

    sanitized = [{"loc": e.get("loc"), "msg": "Invalid input value", "type": e.get("type")} for e in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": sanitized},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(asyncpg.PostgresError)
async def database_exception_handler(_: Request, exc: asyncpg.PostgresError):
    msg = "Database error."
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        msg = f"DB Error: {str(exc)}"
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": msg})


@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    msg = "Internal server error."
    if settings.ENVIRONMENT == Environment.DEVELOPMENT:
        msg = f"Internal Error: {str(exc)}"
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"detail": msg})


# -------------------------
# Health endpoints
# -------------------------
async def _check_database() -> dict[str, Any]:
    try:
        db = get_database()
        start = time.monotonic()
        await db.fetchval("SELECT 1")
        latency_ms = (time.monotonic() - start) * 1000
        return {"status": "ok", "latency_ms": round(latency_ms, 2)}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/")
async def root():
    return {"service": "MMT_API"}


@app.get("/health")
async def health_check():
    # Liveness probe: process is running
    return {"status": "healthy", "service": "MMT_API", "version": SERVICE_VERSION}


@app.get("/health/ready")
async def health_ready():
    # Readiness probe: can we reach DB?
    db_check = await _check_database()
    is_ready = db_check["status"] == "ok"

    return JSONResponse(
        status_code=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "ready" if is_ready else "not_ready", "checks": {"database": db_check}},
    )
