"""
Quick test script to verify database connection.
Run with: python tests/test_database_connection.py
"""

import asyncio
import sys
import ssl
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncpg
from app.lib.config import settings


async def test_direct_connection():
    """Test direct database connection without pooling."""
    print("Testing database connection (direct connection)...")
    
    url = settings.DATABASE_URL
    print(f"Database URL: {url[:50]}..." if len(url) > 50 else url)
    
    # Check if using direct connection or pooler
    if ":5432/" in url:
        print("⚠ Using direct connection (port 5432)")
        print("  If this fails, try Supabase connection pooler (port 6543)")
        print("  Replace :5432 with :6543 and add ?pgbouncer=true")
    elif ":6543/" in url:
        print("✓ Using Supabase connection pooler (port 6543)")
    
    print("-" * 50)
    
    connection = None
    try:
        # Create SSL context
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        print("Attempting direct connection (timeout: 10 seconds)...")
        
        # Try direct connection with explicit timeout
        connection = await asyncio.wait_for(
            asyncpg.connect(
                dsn=url,
                timeout=10,
                command_timeout=10,
                ssl=ssl_context
            ),
            timeout=10.0
        )
        
        print("✓ Database connection established")
        
        # Test simple query
        result = await connection.fetchval("SELECT 1")
        if result == 1:
            print("✓ Simple query successful (SELECT 1)")
        
        # Test database version
        version = await connection.fetchval("SELECT version()")
        print(f"✓ PostgreSQL version: {version.split(',')[0]}")
        
        # Test tables exist
        tables = await connection.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        if tables:
            print(f"✓ Found {len(tables)} tables in database:")
            for table in tables[:10]:  # Show first 10 only
                print(f"  - {table['table_name']}")
            if len(tables) > 10:
                print(f"  ... and {len(tables) - 10} more")
        else:
            print("⚠ No tables found. Have you run database_setup.sql?")
        
        # Test users table specifically
        user_count = await connection.fetchval("SELECT COUNT(*) FROM users")
        print(f"✓ Users table accessible ({user_count} users)")
        
        print("-" * 50)
        print("✅ All database tests passed!")
        print("Database connection is working correctly.")
        return True
        
    except asyncio.TimeoutError:
        print("-" * 50)
        print(f"❌ Connection timeout!")
        print("\n� Network Issue Detected:")
        print("  Your firewall or network is blocking port 5432 to Supabase")
        print("\n💡 Solutions:")
        print("  1. Use Supabase Connection Pooler (recommended):")
        print("     Change port :5432 to :6543 in DATABASE_URL")
        print("     Add ?pgbouncer=true to the end")
        print("     Example: postgresql://user:pass@db.xxx.supabase.co:6543/postgres?pgbouncer=true")
        print("\n  2. Check firewall settings:")
        print("     - Windows Firewall might be blocking PostgreSQL")
        print("     - Corporate/network firewall might block port 5432")
        print("     - Try from a different network")
        print("\n  3. Verify in Supabase dashboard:")
        print("     - Project is not paused")
        print("     - Database is accessible")
        return False
        
    except asyncpg.InvalidPasswordError:
        print("-" * 50)
        print(f"❌ Authentication failed!")
        print("Check your database password in .env file")
        return False
        
    except Exception as e:
        print("-" * 50)
        print(f"❌ Database connection failed!")
        print(f"Error: {type(e).__name__}: {e}")
        
        if "does not exist" in str(e).lower():
            print("\n💡 Database does not exist. Check connection string.")
        elif "could not translate host name" in str(e).lower():
            print("\n💡 Cannot resolve hostname. Check DATABASE_URL format.")
        
        return False
    
    finally:
        if connection:
            try:
                await connection.close()
                print("✓ Database connection closed")
            except:
                pass


if __name__ == "__main__":
    success = asyncio.run(test_direct_connection())
    sys.exit(0 if success else 1)
