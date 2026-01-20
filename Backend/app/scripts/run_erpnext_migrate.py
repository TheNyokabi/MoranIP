#!/usr/bin/env python3
"""
Scalable migration script for ERPNext using Frappe's SiteMigration class.
This uses the same migration system that 'bench migrate' uses, ensuring
proper schema synchronization and patch execution.
"""
import sys
import os

# Add Frappe to path
sys.path.insert(0, '/app/frappe')
sys.path.insert(0, '/app/erpnext')

# Set environment
os.environ['FRAPPE_SITES_PATH'] = '/home/frappe/frappe-bench/sites'

# Change to sites directory
os.chdir('/home/frappe/frappe-bench/sites')

try:
    from frappe.migrate import SiteMigration
    
    site_name = 'moran.localhost'
    print(f"Running migration for site: {site_name}")
    
    # Create migration instance (same as 'bench migrate')
    migration = SiteMigration(skip_failing=False, skip_search_index=True)
    
    # Run migration - this will:
    # 1. Run pre_model_sync patches
    # 2. Sync all doctype schemas (including adding missing columns)
    # 3. Run post_model_sync patches
    # 4. Sync jobs, fixtures, dashboards, customizations, etc.
    migration.run(site=site_name)
    
    print("✅ Migration completed successfully")
    
except ImportError as e:
    print(f"❌ Could not import Frappe: {e}")
    print("This script must be run inside the ERPNext container")
    sys.exit(1)
except Exception as e:
    print(f"❌ Migration error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
