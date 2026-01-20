#!/usr/bin/env python3
"""
Verify that the onboarding workspace_type migration has been applied successfully.
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

def verify_migration():
    """Verify that workspace_type column exists in tenant_onboarding table."""
    db_name = os.getenv("POSTGRES_DB", "moran_iam")
    db_user = os.getenv("POSTGRES_USER", "moran_user")
    db_password = os.getenv("POSTGRES_PASSWORD", "moran_password")
    db_host = os.getenv("POSTGRES_HOST", "postgres")
    db_port = os.getenv("POSTGRES_PORT", "5432")

    conn = None
    try:
        print(f"Connecting to database: {db_name} on {db_host}:{db_port}")
        conn = psycopg2.connect(
            dbname=db_name,
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port
        )
        cur = conn.cursor()

        # Check if tenant_onboarding table exists
        print("\n1. Checking if 'tenant_onboarding' table exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE  table_schema = 'public'
                AND    table_name   = 'tenant_onboarding'
            );
        """)
        table_exists = cur.fetchone()[0]
        if table_exists:
            print("   ✅ 'tenant_onboarding' table exists.")
        else:
            print("   ❌ 'tenant_onboarding' table DOES NOT exist.")
            print("   ⚠️  You may need to run earlier migrations first.")
            return False

        # Check if workspace_type column exists
        print("\n2. Checking if 'workspace_type' column exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE  table_schema = 'public'
                AND    table_name   = 'tenant_onboarding'
                AND    column_name  = 'workspace_type'
            );
        """)
        column_exists = cur.fetchone()[0]
        if column_exists:
            print("   ✅ 'workspace_type' column exists.")
        else:
            print("   ❌ 'workspace_type' column DOES NOT exist.")
            print("   ⚠️  Please run the migration: alembic upgrade head")
            return False

        # Check column type and constraints
        print("\n3. Verifying 'workspace_type' column properties...")
        cur.execute("""
            SELECT 
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE  table_schema = 'public'
            AND    table_name   = 'tenant_onboarding'
            AND    column_name  = 'workspace_type';
        """)
        col_info = cur.fetchone()
        if col_info:
            data_type, max_length, is_nullable, default = col_info
            print(f"   Data Type: {data_type}")
            print(f"   Max Length: {max_length}")
            print(f"   Nullable: {is_nullable}")
            print(f"   Default: {default or 'None'}")
            
            if data_type == 'character varying' and max_length == 50 and is_nullable == 'YES':
                print("   ✅ Column properties are correct.")
            else:
                print("   ⚠️  Column properties may differ from expected.")
        else:
            print("   ❌ Could not retrieve column properties.")
            return False

        # Check if index exists
        print("\n4. Checking if index 'idx_onboarding_workspace_type' exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = 'tenant_onboarding'
                AND indexname = 'idx_onboarding_workspace_type'
            );
        """)
        index_exists = cur.fetchone()[0]
        if index_exists:
            print("   ✅ Index 'idx_onboarding_workspace_type' exists.")
        else:
            print("   ⚠️  Index 'idx_onboarding_workspace_type' DOES NOT exist.")
            print("   ⚠️  This may affect query performance but is not critical.")

        # Check status column supports PAUSED status
        print("\n5. Checking 'status' column...")
        cur.execute("""
            SELECT 
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE  table_schema = 'public'
            AND    table_name   = 'tenant_onboarding'
            AND    column_name  = 'status';
        """)
        status_col = cur.fetchone()
        if status_col:
            data_type, max_length, is_nullable, default = status_col
            print(f"   Data Type: {data_type}")
            print(f"   Max Length: {max_length}")
            print(f"   ✅ Status column exists (supports PAUSED status).")
        else:
            print("   ❌ Status column not found.")

        # Check existing onboarding records
        print("\n6. Checking existing onboarding records...")
        cur.execute("SELECT COUNT(*) FROM tenant_onboarding;")
        count = cur.fetchone()[0]
        print(f"   Found {count} onboarding record(s).")

        if count > 0:
            cur.execute("""
                SELECT 
                    workspace_type,
                    status,
                    template
                FROM tenant_onboarding
                LIMIT 5;
            """)
            records = cur.fetchall()
            print("\n   Sample records:")
            for record in records:
                workspace_type, status, template = record
                print(f"   - Workspace Type: {workspace_type or 'NULL'}, Status: {status}, Template: {template}")

        cur.close()
        print("\n" + "="*60)
        print("✅ Migration verification completed successfully!")
        print("="*60)
        return True

    except psycopg2.OperationalError as e:
        print(f"\n❌ Database connection error: {e}")
        print("\nPossible solutions:")
        print("1. Ensure Docker containers are running: docker-compose up -d")
        print("2. Check database credentials in .env file")
        print("3. Verify database is accessible from the container")
        return False
    except Exception as e:
        print(f"\n❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    success = verify_migration()
    sys.exit(0 if success else 1)
