# Import Optional type hint for nullable types
from typing import Optional
# Import json module for encoding/decoding JSON data in database columns
import json
# Import logging module for structured application logging
import logging
# Import ssl module for creating secure connections to Supabase
import ssl

# Import asyncpg - async PostgreSQL driver for Python
import asyncpg

# Import application settings (DATABASE_URL etc.) from our config module
from app.lib.config import settings

# Create a logger specific to the database module for tracking connection events
logger = logging.getLogger("mmt_api.database")


# Simple class to hold the connection pool as a module-level singleton
# This ensures we only have one pool shared across the entire application
class Database:
    pool: Optional[asyncpg.Pool] = None  # The connection pool, None until initialised


# Single instance of Database - all modules share this same pool reference
db = Database()


def get_database() -> asyncpg.Pool:
    """FastAPI dependency that provides the database connection pool.
    Used with Depends(get_database) in route handlers to inject the pool.
    Raises RuntimeError if the pool hasn't been created yet (app not started)."""
    if db.pool is None:
        raise RuntimeError("Database pool not initialized. Call connect_to_db() first.")
    return db.pool


async def init_connection(connection: asyncpg.Connection) -> None:
    """
    Callback run for each new connection in the pool.
    Configures JSON/JSONB type codecs so PostgreSQL JSON columns
    are automatically serialised/deserialised as Python dicts/lists
    rather than raw strings.
    """
    # Register JSON codec - converts between Python dicts and PostgreSQL JSON type
    await connection.set_type_codec(
        "json",                    # PostgreSQL type name
        encoder=json.dumps,        # Python dict -> JSON string (for INSERT/UPDATE)
        decoder=json.loads,        # JSON string -> Python dict (for SELECT)
        schema="pg_catalog",       # Schema where the type is defined
    )
    # Register JSONB codec - same as JSON but stored in binary format in PostgreSQL
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def connect_to_db() -> None:
    """Create the asyncpg connection pool. Called once during app startup (lifespan).
    Uses SSL for secure connection to Supabase hosted PostgreSQL."""
    # Skip if pool already exists (prevents double-initialisation)
    if db.pool is not None:
        return

    # Create SSL context for encrypted connection to Supabase
    # check_hostname=False and CERT_NONE because Supabase pooler
    # uses a shared certificate that doesn't match the hostname
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False        # Don't verify hostname matches cert
    ssl_context.verify_mode = ssl.CERT_NONE   # Don't verify the SSL certificate

    logger.info("Connecting to database...")
    
    # Create the connection pool with configured parameters
    db.pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,   # PostgreSQL connection string from .env
        min_size=1,                  # Minimum connections kept open (saves resources)
        max_size=10,                 # Maximum concurrent connections allowed
        command_timeout=60,          # Timeout for individual SQL commands (seconds)
        timeout=30,                  # Timeout for acquiring a connection from pool (seconds)
        ssl=ssl_context,             # SSL context for encrypted connection
        init=init_connection,        # Callback to configure each new connection
    )
    
    logger.info("Database connection pool created successfully")


async def close_db_connection() -> None:
    """Gracefully close all connections in the pool. Called during app shutdown."""
    # Skip if pool doesn't exist
    if db.pool is None:
        return

    try:
        await db.pool.close()  # Close all connections in the pool
    except Exception as e:
        # Log any errors but don't crash - we're shutting down anyway
        logger.exception("Error closing database connection: %s", str(e))
    finally:
        db.pool = None  # Reset to None so get_database() knows pool is gone
