#!/usr/bin/env python3
"""
Direct fix for ERPNext database schema - Add missing has_setup_wizard column.
Uses direct MySQL connection to avoid Frappe initialization issues.
"""

import pymysql
import sys

def fix_schema_direct():
    """Fix schema using direct MySQL connection."""
    
    # Get database info from site config
    import json
    import os
    
    site_config_path = "/home/frappe/frappe-bench/sites/moran.localhost/site_config.json"
    
    try:
        with open(site_config_path, 'r') as f:
            site_config = json.load(f)
    except Exception as e:
        print(f"Error reading site config: {e}")
        return False
    
    db_name = site_config.get("db_name")
    db_password = site_config.get("db_password")
    db_host = os.getenv("DB_HOST", "mariadb")
    db_port = int(os.getenv("DB_PORT", "3306"))
    
    if not db_name or not db_password:
        print("❌ Could not read database credentials from site config")
        print(f"Site config: {site_config}")
        return False
    
    print(f"Connecting to database: {db_name} on {db_host}:{db_port}")
    
    try:
        # Connect to MariaDB using site-specific credentials
        connection = pymysql.connect(
            host=db_host,
            port=db_port,
            user=db_name,  # Site uses db_name as username
            password=db_password,
            database=db_name,
            charset='utf8mb4'
        )
        
        print("✅ Connected to database")
        
        table_name = "tabInstalled Application"
        cursor = connection.cursor()
        
        # Check if column exists
        cursor.execute(f"SHOW COLUMNS FROM `{table_name}` LIKE 'has_setup_wizard'")
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Column 'has_setup_wizard' already exists!")
        else:
            print(f"Adding column 'has_setup_wizard'...")
            cursor.execute(f"""
                ALTER TABLE `{table_name}` 
                ADD COLUMN `has_setup_wizard` TINYINT(1) NOT NULL DEFAULT 0
            """)
            connection.commit()
            print(f"✅ Column 'has_setup_wizard' added successfully!")
        
        # Check and add is_setup_complete column
        cursor.execute(f"SHOW COLUMNS FROM `{table_name}` LIKE 'is_setup_complete'")
        result = cursor.fetchone()
        
        if result:
            print(f"✅ Column 'is_setup_complete' already exists!")
        else:
            print(f"Adding column 'is_setup_complete'...")
            cursor.execute(f"""
                ALTER TABLE `{table_name}` 
                ADD COLUMN `is_setup_complete` TINYINT(1) NOT NULL DEFAULT 0
            """)
            connection.commit()
            print(f"✅ Column 'is_setup_complete' added successfully!")
        
        cursor.close()
        connection.close()
        
        print("\n✅ Schema fix completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    try:
        success = fix_schema_direct()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
