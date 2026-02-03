import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.lib.config import settings


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        start = time.monotonic()

        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            # Minimal log (prints to console in dev)
            print(
                f"[{request_id}] {request.method} {request.url.path} "
                f"-> {getattr(response, 'status_code', 'ERR')} ({duration_ms}ms)"
            )
            # Add request id header if response exists
            if "response" in locals() and isinstance(response, Response):
                response.headers["X-Request-ID"] = request_id


def add_middleware(app: FastAPI) -> None:
    # CORS (required)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Request logging (optional but helpful)
    app.add_middleware(RequestLoggingMiddleware)
