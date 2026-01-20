#!/usr/bin/env python3
"""
Fix ERPNext schema using Frappe ORM.
Uses frappe.database.schema.add_column() to properly add missing columns.
"""
import sys
import os

# Set up Frappe environment
sys.path.insert(0, '/app/frappe')
sys.path.insert(0, '/app/erpnext')

os.environ['FRAPPE_SITES_PATH'] = '/home/frappe/frappe-bench/sites'
os.chdir('/home/frappe/frappe-bench/sites')

try:
    import frappe
    
    # Initialize Frappe for the site
    site_name = 'moran.localhost'
    print(f"Initializing Frappe for site: {site_name}")
    frappe.init(site=site_name)
    frappe.connect(site=site_name)
    
    print("✅ Frappe initialized successfully")
    
    # Check if column exists
    from frappe.database.database import get_table_name
    table_name = get_table_name("Installed Application")
    
    # Check current columns
    columns = frappe.db.get_table_columns(table_name)
    column_names = [col.get('name') if isinstance(col, dict) else col for col in columns]
    
    print(f"Current columns in {table_name}: {len(column_names)} columns")
    
    # Add has_setup_wizard column if missing
    if 'has_setup_wizard' not in column_names:
        print("Adding column 'has_setup_wizard'...")
        from frappe.database.schema import add_column
        add_column(
            doctype="Installed Application",
            column_name="has_setup_wizard",
            fieldtype="Check",
            default="0"
        )
        print("✅ Column 'has_setup_wizard' added successfully")
    else:
        print("✅ Column 'has_setup_wizard' already exists")
    
    # Add is_setup_complete column if missing
    if 'is_setup_complete' not in column_names:
        print("Adding column 'is_setup_complete'...")
        from frappe.database.schema import add_column
        add_column(
            doctype="Installed Application",
            column_name="is_setup_complete",
            fieldtype="Check",
            default="0"
        )
        print("✅ Column 'is_setup_complete' added successfully")
    else:
        print("✅ Column 'is_setup_complete' already exists")
    
    frappe.db.commit()
    print("\n✅ Schema fix completed successfully!")
    
except ImportError as e:
    print(f"❌ Could not import Frappe: {e}")
    print("This script must be run inside the ERPNext container")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    if 'frappe' in sys.modules:
        frappe.destroy()
