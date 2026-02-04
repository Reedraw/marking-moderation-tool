from pathlib import Path
from os import environ

from pydantic import Field


BASE_DIR = Path(__file__).resolve().parents[3]

# Load .env file
try:
    from dotenv import load_dotenv
    env_file = BASE_DIR / ".env"
    load_dotenv(env_file)
except ImportError:
    pass


class Environment(str):
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    TEST = "test"


class Settings:
    """
    Application configuration loaded from environment variables.
    """

    def __init__(self):
        self.APP_NAME: str = environ.get("APP_NAME", "MMT_API")
        self.ENVIRONMENT: str = environ.get("ENVIRONMENT", "development")
        self.HOST: str = environ.get("HOST", "127.0.0.1")
        self.PORT: int = int(environ.get("PORT", "8000"))
        self.API_V1_STR: str = environ.get("API_V1_STR", "")
        self.DATABASE_URL: str = environ.get("DATABASE_URL", "")
        self.SECRET_KEY: str = environ.get("SECRET_KEY", "")
        self.ALGORITHM: str = environ.get("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

        cors_origins_str = environ.get("CORS_ORIGINS", '["http://localhost:3000"]')
        if cors_origins_str:
            try:
                import json
                self.CORS_ORIGINS = json.loads(cors_origins_str)
                if not isinstance(self.CORS_ORIGINS, list):
                    self.CORS_ORIGINS = [str(x) for x in self.CORS_ORIGINS]
            except:
                self.CORS_ORIGINS = [v.strip() for v in cors_origins_str.split(",") if v.strip()]
        else:
            self.CORS_ORIGINS = ["http://localhost:3000"]

        self.CORS_ALLOW_CREDENTIALS = environ.get("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
        self.CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
        self.CORS_ALLOW_HEADERS = ["Authorization", "Content-Type", "X-Request-ID"]
        self.LOG_LEVEL: str = environ.get("LOG_LEVEL", "INFO")

    def is_dev(self) -> bool:
        return self.ENVIRONMENT == "development"

    def is_prod(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
