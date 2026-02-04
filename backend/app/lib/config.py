import json
from enum import Enum
from typing import Any
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project root:
# app/lib/config.py → app → backend → project root
BASE_DIR = Path(__file__).resolve().parents[3]


class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TEST = "test"


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -------------------------
    # Core app settings
    # -------------------------
    APP_NAME: str = "MMT_API"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT

    HOST: str = "127.0.0.1"
    PORT: int = 8000

    API_V1_STR: str = ""

    # -------------------------
    # Database
    # -------------------------
    DATABASE_URL: str 

    # -------------------------
    # Security
    # -------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # -------------------------
    # CORS
    # -------------------------
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        description="Allowed CORS origins",
    )
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    )
    CORS_ALLOW_HEADERS: list[str] = Field(
        default_factory=lambda: ["Authorization", "Content-Type", "X-Request-ID"]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        """Parse CORS_ORIGINS from JSON string or comma-separated values."""
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed]
            except json.JSONDecodeError:
                pass
            # Fallback to comma-separated
            return [x.strip() for x in v.split(",") if x.strip()]
        if isinstance(v, list):
            return [str(x).strip() for x in v]
        return ["http://localhost:3000"]

    # -------------------------
    # Logging
    # -------------------------
    LOG_LEVEL: str = "INFO"

    def is_dev(self) -> bool:
        return self.ENVIRONMENT == Environment.DEVELOPMENT

    def is_prod(self) -> bool:
        return self.ENVIRONMENT == Environment.PRODUCTION


settings = Settings()
