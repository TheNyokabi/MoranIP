#!/usr/bin/env python3
"""
Script to list all tenants in the database
"""
import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.iam import Tenant, Membership
from sqlalchemy import func

def list_tenants():
    """List all tenants with their details"""
    db = SessionLocal()
    try:
        # Query all tenants
        tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
        
        if not tenants:
            print("No tenants found in the database.")
            return
        
        print(f"\n{'='*100}")
        print(f"TENANTS IN DATABASE (Total: {len(tenants)})")
        print(f"{'='*100}\n")
        
        for tenant in tenants:
            # Count active members for this tenant
            member_count = db.query(func.count(Membership.id)).filter(
                Membership.tenant_id == tenant.id,
                Membership.status == 'ACTIVE'
            ).scalar()
            
            print(f"ID:              {tenant.id}")
            print(f"Tenant Code:     {tenant.tenant_code}")
            print(f"Name:            {tenant.name}")
            print(f"Country Code:    {tenant.country_code}")
            print(f"Status:          {tenant.status}")
            print(f"Engine:          {tenant.engine}")
            print(f"Created At:      {tenant.created_at}")
            print(f"Active Members:  {member_count}")
            print(f"{'-'*100}\n")
        
        # Summary
        status_counts = {}
        engine_counts = {}
        for tenant in tenants:
            status_counts[tenant.status] = status_counts.get(tenant.status, 0) + 1
            engine_counts[tenant.engine] = engine_counts.get(tenant.engine, 0) + 1
        
        print(f"\n{'='*100}")
        print("SUMMARY")
        print(f"{'='*100}")
        print(f"\nBy Status:")
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        
        print(f"\nBy Engine:")
        for engine, count in sorted(engine_counts.items()):
            print(f"  {engine}: {count}")
        print(f"{'='*100}\n")
        
    except Exception as e:
        print(f"Error querying database: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    list_tenants()
