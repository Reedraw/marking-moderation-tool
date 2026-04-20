# Import json module for parsing JSON strings (used for CORS_ORIGINS parsing)
import json
# Import Enum base class for creating enumerated types
from enum import Enum
# Import Any type hint for flexible type annotations
from typing import Any
# Import Path for cross-platform file system path handling
from pathlib import Path

# Import Field for adding validation/metadata to Pydantic model fields
# Import field_validator for custom validation logic on specific fields
from pydantic import Field, field_validator
# Import BaseSettings for environment-variable-backed configuration
# Import SettingsConfigDict for configuring how settings are loaded
from pydantic_settings import BaseSettings, SettingsConfigDict


# Resolve project root directory by navigating up 3 levels from this file:
# config.py -> lib/ -> app/ -> backend/ -> project root (where .env lives)
BASE_DIR = Path(__file__).resolve().parents[3]


# Enum defining the possible application environments
# Used to toggle behaviour between development, production, and test modes
class Environment(str, Enum):
    DEVELOPMENT = "development"  # Local development with debug features
    PRODUCTION = "production"    # Live deployment with optimised settings
    TEST = "test"                # Automated testing environment


# Main application settings class - automatically loads values from .env file
# and environment variables. Pydantic validates all values on startup.
class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.
    """

    # Configure Pydantic to read from the root .env file
    # extra="ignore" means unknown env vars won't cause errors
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",       # Path to the .env file
        env_file_encoding="utf-8",        # File encoding for .env
        extra="ignore",                    # Ignore env vars not defined here
    )

    # -------------------------
    # Core app settings
    # -------------------------
    APP_NAME: str = "MMT_API"                              # Application name used in logs/docs
    ENVIRONMENT: Environment = Environment.DEVELOPMENT      # Current environment mode

    HOST: str = "127.0.0.1"    # Host address the server binds to
    PORT: int = 8000           # Port number the server listens on

    API_V1_STR: str = ""       # API version prefix (e.g. "/api/v1") prepended to all routes

    # -------------------------
    # Database
    # -------------------------
    # PostgreSQL connection string - required, no default (must be in .env)
    DATABASE_URL: str = Field(..., description="PostgreSQL database connection URL")

    # -------------------------
    # Security
    # -------------------------
    # Secret key used to sign and verify JWT tokens - required, no default
    SECRET_KEY: str = Field(..., description="Secret key for JWT token signing")
    ALGORITHM: str = "HS256"                 # JWT signing algorithm (HMAC-SHA256)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30    # How long tokens remain valid

    # -------------------------
    # CORS (Cross-Origin Resource Sharing)
    # -------------------------
    # List of allowed frontend origins that can make API requests
    # Defaults to localhost:3000 for local Next.js development
    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        description="Allowed CORS origins",
    )
    CORS_ALLOW_CREDENTIALS: bool = True  # Allow cookies/auth headers in cross-origin requests
    # HTTP methods allowed from cross-origin requests
    CORS_ALLOW_METHODS: list[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    )
    # HTTP headers allowed from cross-origin requests
    CORS_ALLOW_HEADERS: list[str] = Field(
        default_factory=lambda: ["Authorization", "Content-Type", "X-Request-ID"]
    )

    # Custom validator that runs before Pydantic's default parsing
    # Handles CORS_ORIGINS being a JSON array string like '["http://localhost:3000"]'
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        """Parse CORS_ORIGINS from JSON string or comma-separated values."""
        if isinstance(v, str):
            try:
                # First try parsing as JSON array (e.g. from .env file)
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed]
            except json.JSONDecodeError:
                pass
            # Fallback: treat as comma-separated string (e.g. "http://a.com,http://b.com")
            return [x.strip() for x in v.split(",") if x.strip()]
        if isinstance(v, list):
            # Already a list, just ensure all items are stripped strings
            return [str(x).strip() for x in v]
        # Default fallback if nothing else matches
        return ["http://localhost:3000"]

    # -------------------------
    # Logging
    # -------------------------
    LOG_LEVEL: str = "INFO"  # Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    # Helper methods to check current environment
    def is_dev(self) -> bool:
        return self.ENVIRONMENT == Environment.DEVELOPMENT

    def is_prod(self) -> bool:
        return self.ENVIRONMENT == Environment.PRODUCTION


# Create a singleton settings instance - loaded once at app startup
# All other modules import this instance to access configuration
settings = Settings()
