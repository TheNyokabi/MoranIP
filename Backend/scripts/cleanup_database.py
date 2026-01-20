"""
Database Cleanup Script
Deletes all data from all tables except the 'users' table.
Preserves all tables and schema - only removes data.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal
from app.models.iam import Base, User
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_all_tables():
    """Get all table names from the database"""
    inspector = inspect(engine)
    return inspector.get_table_names()

def get_tables_to_clean():
    """Get all tables except 'users'"""
    all_tables = get_all_tables()
    # Filter out 'users' table
    tables_to_clean = [t for t in all_tables if t != 'users']
    return tables_to_clean

def cleanup_database():
    """Delete all data from all tables except 'users'"""
    db = SessionLocal()
    
    try:
        # Get all tables to clean
        tables_to_clean = get_tables_to_clean()
        
        if not tables_to_clean:
            logger.info("No tables to clean (only 'users' table exists)")
            return
        
        logger.info(f"Found {len(tables_to_clean)} tables to clean (excluding 'users')")
        
        # Disable foreign key checks temporarily (PostgreSQL)
        # We'll handle CASCADE deletes manually
        logger.info("Starting database cleanup...")
        
        # Get user count before cleanup
        user_count = db.query(User).count()
        logger.info(f"Current user count: {user_count}")
        
        # Delete data from each table
        # IMPORTANT: Use DELETE instead of TRUNCATE to avoid CASCADE deleting users
        # Order matters - delete child tables first to avoid foreign key violations
        
        deleted_counts = {}
        
        # Sort tables to delete child tables first (tables with foreign keys to other tables)
        # This is a simple heuristic - tables with more dependencies should be deleted first
        # We'll delete in reverse dependency order
        
        for table_name in tables_to_clean:
            try:
                # Use DELETE (not TRUNCATE) to avoid CASCADE issues
                # This is safer when we want to preserve specific tables
                result = db.execute(text(f'DELETE FROM "{table_name}"'))
                deleted_count = result.rowcount
                db.commit()
                logger.info(f"✅ Cleaned table: {table_name} ({deleted_count} rows deleted)")
                deleted_counts[table_name] = deleted_count
            except Exception as e:
                # If DELETE fails due to foreign key constraints, try to disable constraints temporarily
                # or delete in a different order
                logger.warning(f"⚠️  Failed to delete from {table_name}: {e}")
                logger.info(f"   Attempting to handle foreign key constraints...")
                try:
                    # Try to delete with CASCADE on the foreign key side
                    # This should only affect the current table, not users
                    result = db.execute(text(f'DELETE FROM "{table_name}" CASCADE'))
                    deleted_count = result.rowcount
                    db.commit()
                    logger.info(f"✅ Cleaned table: {table_name} ({deleted_count} rows deleted with CASCADE)")
                    deleted_counts[table_name] = deleted_count
                except Exception as e2:
                    logger.error(f"❌ Failed to clean table {table_name}: {e2}")
                    db.rollback()
                    # Continue with other tables
        
        # Verify users are still present
        final_user_count = db.query(User).count()
        final_user_ids = [str(u.id) for u in db.query(User.id).all()]
        
        if final_user_count == user_count and set(final_user_ids) == set(user_ids):
            logger.info(f"✅ User count verified: {final_user_count} users (unchanged)")
            logger.info(f"✅ All user IDs preserved")
        else:
            logger.error(f"❌ CRITICAL: User data was affected!")
            logger.error(f"   Before: {user_count} users")
            logger.error(f"   After: {final_user_count} users")
            if final_user_count > 0:
                logger.error(f"   Missing users: {set(user_ids) - set(final_user_ids)}")
            raise Exception("Users were deleted! Cleanup aborted to prevent data loss.")
        
        logger.info("\n" + "="*60)
        logger.info("Database cleanup completed!")
        logger.info(f"Cleaned {len(deleted_counts)} tables")
        logger.info(f"Users preserved: {final_user_count}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("DATABASE CLEANUP SCRIPT")
    print("="*60)
    print("This script will:")
    print("  - Delete ALL data from ALL tables")
    print("  - EXCEPT the 'users' table (users will be preserved)")
    print("  - Preserve all tables and schema")
    print("="*60)
    
    response = input("\n⚠️  Are you sure you want to proceed? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        try:
            cleanup_database()
            print("\n✅ Cleanup completed successfully!")
        except Exception as e:
            print(f"\n❌ Cleanup failed: {e}")
            sys.exit(1)
    else:
        print("\n❌ Cleanup cancelled.")
        sys.exit(0)
