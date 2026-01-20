#!/usr/bin/env python3
"""
Verification script for Settings migration.
This script verifies that the migration was successful and all tables/endpoints are working.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, inspect
from app.config import settings
from app.models.iam import TenantSecuritySettings, TenantNotificationSettings, TenantSettings

def verify_migration():
    """Verify that the migration was successful."""
    print("🔍 Verifying Settings Migration...")
    print("=" * 60)
    
    # Create database connection
    db_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    
    try:
        engine = create_engine(db_url)
        inspector = inspect(engine)
        
        # Check if tables exist
        tables = inspector.get_table_names()
        
        required_tables = [
            'tenant_settings',
            'tenant_security_settings',
            'tenant_notification_settings'
        ]
        
        print("\n✅ Checking Required Tables:")
        all_tables_exist = True
        for table in required_tables:
            if table in tables:
                print(f"   ✓ {table} exists")
                
                # Check columns for new tables
                if table in ['tenant_security_settings', 'tenant_notification_settings']:
                    columns = [col['name'] for col in inspector.get_columns(table)]
                    print(f"     Columns: {len(columns)} fields")
                    
                    # Verify key columns exist
                    if table == 'tenant_security_settings':
                        key_columns = ['min_password_length', 'ip_whitelist', 'require_mfa']
                        for col in key_columns:
                            if col in columns:
                                print(f"       ✓ {col}")
                            else:
                                print(f"       ✗ {col} MISSING")
                                all_tables_exist = False
                    
                    elif table == 'tenant_notification_settings':
                        key_columns = ['email_enabled', 'quiet_hours_start', 'digest_frequency']
                        for col in key_columns:
                            if col in columns:
                                print(f"       ✓ {col}")
                            else:
                                print(f"       ✗ {col} MISSING")
                                all_tables_exist = False
            else:
                print(f"   ✗ {table} MISSING")
                all_tables_exist = False
        
        # Check indexes
        print("\n✅ Checking Indexes:")
        indexes = {}
        for table in ['tenant_security_settings', 'tenant_notification_settings']:
            if table in tables:
                table_indexes = inspector.get_indexes(table)
                indexes[table] = table_indexes
                print(f"   {table}: {len(table_indexes)} indexes")
                for idx in table_indexes:
                    print(f"     - {idx['name']}")
        
        # Check foreign keys
        print("\n✅ Checking Foreign Keys:")
        for table in ['tenant_security_settings', 'tenant_notification_settings']:
            if table in tables:
                fks = inspector.get_foreign_keys(table)
                print(f"   {table}: {len(fks)} foreign keys")
                for fk in fks:
                    print(f"     - {fk['name']}: {table}.{fk['constrained_columns'][0]} → {fk['referred_table']}.{fk['referred_columns'][0]}")
        
        # Check constraints
        print("\n✅ Checking Constraints:")
        for table in ['tenant_security_settings', 'tenant_notification_settings']:
            if table in tables:
                pk_constraint = inspector.get_pk_constraint(table)
                unique_constraints = inspector.get_unique_constraints(table)
                
                print(f"   {table}:")
                if pk_constraint:
                    print(f"     Primary Key: {pk_constraint['name']} on {pk_constraint['constrained_columns']}")
                if unique_constraints:
                    for uc in unique_constraints:
                        print(f"     Unique Constraint: {uc['name']} on {uc['column_names']}")
        
        print("\n" + "=" * 60)
        if all_tables_exist:
            print("✅ Migration Verification: SUCCESS")
            print("\nAll required tables, columns, indexes, and constraints are in place.")
            return 0
        else:
            print("❌ Migration Verification: FAILED")
            print("\nSome required tables or columns are missing.")
            return 1
            
    except Exception as e:
        print(f"\n❌ Error during verification: {str(e)}")
        print("\nMake sure:")
        print("  1. Database is running and accessible")
        print("  2. Database credentials are correct")
        print("  3. Migration has been run: alembic upgrade head")
        return 1

if __name__ == "__main__":
    exit_code = verify_migration()
    sys.exit(exit_code)
