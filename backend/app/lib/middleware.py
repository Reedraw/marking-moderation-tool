# Import time module for measuring request duration
import time
# Import uuid module for generating unique request IDs
import uuid
# Import logging for structured log output
import logging
# Import Callable type hint for the call_next function parameter
from typing import Callable

# Import FastAPI app class and Request/Response types
from fastapi import FastAPI, Request, Response
# Import CORS middleware - handles Cross-Origin Resource Sharing headers
from fastapi.middleware.cors import CORSMiddleware
# Import Starlette's base middleware class for creating custom middleware
from starlette.middleware.base import BaseHTTPMiddleware

# Import our application settings for CORS configuration values
from app.lib.config import settings

# Create a logger specific to the middleware module
logger = logging.getLogger("mmt_api.middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Custom middleware that logs every HTTP request with its method, path,
    status code, and duration in milliseconds. Also assigns a unique
    request ID to each request for tracing purposes."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate a unique ID for this request (useful for debugging/tracing)
        request_id = str(uuid.uuid4())
        # Record the start time to calculate request duration
        start = time.monotonic()
        response = None

        try:
            # Pass the request to the next middleware or route handler
            response = await call_next(request)
            return response
        finally:
            # Calculate how long the request took in milliseconds
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            # Get the HTTP status code, or 'ERR' if response failed
            status_code = getattr(response, 'status_code', 'ERR') if response else 'ERR'
            # Log the request details: "GET /api/v1/health -> 200 (12.34ms)"
            logger.info(
                "%s %s -> %s (%sms)",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
                extra={"request_id": request_id}
            )
            # Add the request ID as a response header for client-side debugging
            if response is not None and isinstance(response, Response):
                response.headers["X-Request-ID"] = request_id


def add_middleware(app: FastAPI) -> None:
    """Register all middleware with the FastAPI application.
    Called once during app startup in main.py."""

    # CORS middleware - allows the frontend (different origin) to make API requests
    # Without this, browser security would block all cross-origin requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,              # Which origins can make requests
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS, # Allow cookies/auth headers
        allow_methods=settings.CORS_ALLOW_METHODS,         # Which HTTP methods are allowed
        allow_headers=settings.CORS_ALLOW_HEADERS,         # Which headers are allowed
    )

    # Custom request logging middleware - logs every request for monitoring
    app.add_middleware(RequestLoggingMiddleware)
