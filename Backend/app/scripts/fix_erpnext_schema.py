#!/usr/bin/env python3
"""
Fix ERPNext database schema issue - Add missing has_setup_wizard column to Installed Application table.

Usage:
    docker-compose exec erpnext python /app/fix_schema.py
    OR
    python -m app.scripts.fix_erpnext_schema
"""

import sys
import os
from pathlib import Path

# Add paths
frappe_path = Path("/app/frappe")
erpnext_path = Path("/app/erpnext")

if frappe_path.exists():
    sys.path.insert(0, str(frappe_path))
if erpnext_path.exists():
    sys.path.insert(0, str(erpnext_path))

def fix_schema():
    """Fix the missing has_setup_wizard column."""
    import frappe
    
    sites_path = "/home/frappe/frappe-bench/sites"
    site_name = "moran.localhost"
    
    # Ensure logs directory exists
    os.makedirs("/home/frappe/frappe-bench/logs", exist_ok=True)
    os.makedirs(f"{sites_path}/{site_name}/logs", exist_ok=True)
    
    print(f"Initializing Frappe with site: {site_name}")
    print(f"Sites path: {sites_path}")
    
    # Set environment variables to avoid log path issues
    os.environ['FRAPPE_SITES_PATH'] = sites_path
    
    # Initialize Frappe
    frappe.init(site=site_name, sites_path=sites_path)
    
    # Connect to database directly (bypassing some initialization that requires logs)
    from frappe.database import get_db
    frappe.local.db = get_db()
    frappe.local.site = site_name
    
    print("\n✅ Connected to Frappe database")
    
    # Check if column exists
    table_name = "tabInstalled Application"
    column_name = "has_setup_wizard"
    
    print(f"\nChecking if column '{column_name}' exists in '{table_name}'...")
    
    try:
        # Check if column exists
        columns = frappe.db.sql(f"SHOW COLUMNS FROM `{table_name}` LIKE '{column_name}'", as_dict=True)
        
        if columns:
            print(f"✅ Column '{column_name}' already exists!")
            return True
        else:
            print(f"❌ Column '{column_name}' is missing. Adding it...")
            
            # Add the column (Check field = TINYINT(1) DEFAULT 0)
            frappe.db.sql(f"""
                ALTER TABLE `{table_name}` 
                ADD COLUMN `{column_name}` TINYINT(1) NOT NULL DEFAULT 0
            """)
            frappe.db.commit()
            
            print(f"✅ Column '{column_name}' added successfully!")
            
            # Also check for is_setup_complete column
            if not frappe.db.sql(f"SHOW COLUMNS FROM `{table_name}` LIKE 'is_setup_complete'", as_dict=True):
                print(f"Adding missing 'is_setup_complete' column...")
                frappe.db.sql(f"""
                    ALTER TABLE `{table_name}` 
                    ADD COLUMN `is_setup_complete` TINYINT(1) NOT NULL DEFAULT 0
                """)
                frappe.db.commit()
                print(f"✅ Column 'is_setup_complete' added successfully!")
            
            # Reload the doctype to ensure schema is updated
            print("\nReloading doctype...")
            frappe.reload_doc("core", "doctype", "installed_application")
            frappe.reload_doc("core", "doctype", "installed_applications")
            frappe.db.commit()
            
            print("✅ Doctypes reloaded successfully!")
            return True
            
    except Exception as e:
        print(f"❌ Error fixing schema: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        frappe.destroy()

if __name__ == "__main__":
    try:
        success = fix_schema()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
