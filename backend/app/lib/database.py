from typing import Optional
import json
import logging

import asyncpg

from app.lib.config import settings

logger = logging.getLogger("mmt_api.database")


class Database:
    pool: Optional[asyncpg.Pool] = None


db = Database()


def get_database() -> asyncpg.Pool:
    if db.pool is None:
        raise RuntimeError("Database pool not initialized. Call connect_to_db() first.")
    return db.pool


async def init_connection(connection: asyncpg.Connection) -> None:
    """
    Optional: configure codecs for JSON/JSONB so they decode into Python objects
    consistently across the app.
    """
    await connection.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def connect_to_db() -> None:
    """Create database connection pool."""
    if db.pool is not None:
        return

    db.pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        command_timeout=60,
        init=init_connection,
    )


async def close_db_connection() -> None:
    """Close database connection pool."""
    if db.pool is None:
        return

    try:
        await db.pool.close()
    except Exception as e:
        logger.exception("Error closing database connection: %s", str(e))
    finally:
        db.pool = None
