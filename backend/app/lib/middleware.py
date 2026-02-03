import time
import uuid
import logging
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.lib.config import settings

logger = logging.getLogger("mmt_api.middleware")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        start = time.monotonic()
        response = None

        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            status_code = getattr(response, 'status_code', 'ERR') if response else 'ERR'
            # Log using the standard logging module
            logger.info(
                "%s %s -> %s (%sms)",
                request.method,
                request.url.path,
                status_code,
                duration_ms,
                extra={"request_id": request_id}
            )
            # Add request id header if response exists
            if response is not None and isinstance(response, Response):
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
