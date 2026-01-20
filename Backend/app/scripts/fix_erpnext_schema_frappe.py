#!/usr/bin/env python3
"""
Scalable schema fix for ERPNext using Frappe's migration system.
This script uses Frappe's ORM and migration utilities to safely add the missing column.
"""
import sys
import os

# Add Frappe to path
sys.path.insert(0, '/app/frappe')
sys.path.insert(0, '/app/erpnext')

# Set environment
os.environ['FRAPPE_SITES_PATH'] = '/home/frappe/frappe-bench/sites'
os.environ['FRAPPE_SITE'] = 'moran.localhost'

# Change to sites directory
os.chdir('/home/frappe/frappe-bench/sites')

try:
    import frappe
    
    # Initialize Frappe
    frappe.init(site='moran.localhost')
    frappe.connect()
    
    try:
        # Check if column exists by querying table structure
        columns = frappe.db.sql("DESCRIBE `tabInstalled Application`", as_dict=True)
        column_names = [col['Field'] for col in columns]
        
        if 'has_setup_wizard' not in column_names:
            print("Adding missing column 'has_setup_wizard' to 'tabInstalled Application'...")
            
            # Use Frappe's database method for safe column addition
            frappe.db.sql("""
                ALTER TABLE `tabInstalled Application`
                ADD COLUMN `has_setup_wizard` INT(1) DEFAULT 0
            """)
            frappe.db.commit()
            print("✅ Successfully added column 'has_setup_wizard'")
        else:
            print("✅ Column 'has_setup_wizard' already exists")
            
    except Exception as e:
        print(f"❌ Error checking/adding column: {e}")
        frappe.db.rollback()
        sys.exit(1)
        
    finally:
        frappe.destroy()
        
except ImportError as e:
    print(f"❌ Could not import Frappe: {e}")
    print("This script must be run inside the ERPNext container")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
