"""
Direct Supabase connection test without any imports.
Run with: python tests/test_supabase_direct.py
"""

import asyncio
import ssl
import os
from pathlib import Path

import asyncpg


async def test_supabase():
    """Test direct Supabase connection."""
    
    # Load from .env manually - go up from tests/test_supabase_direct.py to project root
    env_file = Path(__file__).resolve().parents[2] / ".env"
    print(f"Reading .env from: {env_file}")
    
    if not env_file.exists():
        print(f"❌ .env file not found at {env_file}")
        return False
    
    database_url = None
    
    with open(env_file) as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                database_url = line.split("=", 1)[1].strip()
                break
    
    if not database_url:
        print("❌ DATABASE_URL not found in .env")
        return False
    
    print("Testing Supabase connection...")
    print(f"Database URL: {database_url[:60]}...")
    
    # Check port
    if ":5432/" in database_url:
        print("⚠ Using port 5432 (direct connection)")
    elif ":6543/" in database_url:
        print("✓ Using port 6543 (pooler)")
    
    print("-" * 50)
    
    connection = None
    try:
        # Create SSL context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        print("Connecting (timeout: 10 seconds)...")
        
        # Try direct connection
        connection = await asyncio.wait_for(
            asyncpg.connect(
                dsn=database_url,
                timeout=10,
                command_timeout=10,
                ssl=ssl_context
            ),
            timeout=10.0
        )
        
        print("✅ Connected successfully!")
        
        # Test query
        result = await connection.fetchval("SELECT 1")
        print(f"✓ Query test: {result}")
        
        # Test version
        version = await connection.fetchval("SELECT version()")
        print(f"✓ PostgreSQL: {version.split(',')[0]}")
        
        # Test tables
        tables = await connection.fetch("""
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        print(f"✓ Tables found: {tables[0]['count']}")
        
        print("-" * 50)
        print("✅ All tests passed! Database is working.")
        return True
        
    except asyncio.TimeoutError:
        print("❌ Connection timeout!")
        print("\nThis means:")
        print("  - Supabase host is unreachable from your network")
        print("  - Firewall/proxy is blocking the connection")
        print("  - Supabase project might be paused")
        return False
        
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        return False
        
    finally:
        if connection:
            await connection.close()
            print("Connection closed")


if __name__ == "__main__":
    import sys
    success = asyncio.run(test_supabase())
    sys.exit(0 if success else 1)
