#!/usr/bin/env python3
"""
Verify provisioning results in ERPNext.

This script checks what resources were actually created in ERPNext for a tenant.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.iam import Tenant
from app.models.onboarding import TenantOnboarding
from app.services.erpnext_client import erpnext_adapter
import uuid

def verify_provisioning(tenant_id: str):
    """Verify what was created in ERPNext for a tenant."""
    db = SessionLocal()
    
    try:
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            print(f"❌ Tenant {tenant_id} not found")
            return
        
        print(f"\n{'='*60}")
        print(f"Verifying Provisioning for: {tenant.name} ({tenant.tenant_code})")
        print(f"{'='*60}\n")
        
        # Get onboarding record
        onboarding = db.query(TenantOnboarding).filter(
            TenantOnboarding.tenant_id == tenant_id
        ).first()
        
        if not onboarding or not onboarding.provisioning_type:
            print("⚠️  No provisioning record found")
            return
        
        metadata = onboarding.provisioning_metadata or {}
        company_name = metadata.get("company_name") or tenant.name
        
        print(f"Company: {company_name}")
        print(f"Provisioning Status: {tenant.provisioning_status}")
        print(f"Provisioning Type: {onboarding.provisioning_type}\n")
        
        # Check Company
        print("📦 Checking Company...")
        try:
            companies = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Company",
                method="GET",
                params={"filters": f'[["company_name", "=", "{company_name}"]]'}
            )
            if companies.get("data"):
                print(f"  ✅ Company '{company_name}' exists")
            else:
                print(f"  ❌ Company '{company_name}' NOT found")
        except Exception as e:
            print(f"  ❌ Error checking company: {e}")
        
        # Check Chart of Accounts
        print("\n📊 Checking Chart of Accounts...")
        try:
            accounts = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Account",
                method="GET",
                params={"limit_page_length": 10}
            )
            account_count = len(accounts.get("data", [])) if isinstance(accounts, dict) else 0
            if account_count > 0:
                print(f"  ✅ Found {account_count} accounts (showing first 10)")
            else:
                print(f"  ❌ No accounts found")
        except Exception as e:
            print(f"  ❌ Error checking accounts: {e}")
        
        # Check Warehouses
        print("\n🏭 Checking Warehouses...")
        try:
            warehouses = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Warehouse",
                method="GET",
                params={"limit_page_length": 100}
            )
            warehouse_list = warehouses.get("data", []) if isinstance(warehouses, dict) else []
            if warehouse_list:
                print(f"  ✅ Found {len(warehouse_list)} warehouse(s):")
                for w in warehouse_list:
                    name = w.get("name") or w.get("warehouse_name", "Unknown")
                    print(f"    - {name}")
            else:
                print(f"  ❌ No warehouses found")
        except Exception as e:
            print(f"  ❌ Error checking warehouses: {e}")
        
        # Check Customer
        print("\n👤 Checking Customer...")
        try:
            customers = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/Customer",
                method="GET",
                params={"filters": f'[["customer_name", "=", "Walk-In Customer"]]'}
            )
            if customers.get("data"):
                print(f"  ✅ Walk-In Customer exists")
            else:
                print(f"  ❌ Walk-In Customer NOT found")
        except Exception as e:
            print(f"  ❌ Error checking customer: {e}")
        
        # Check POS Profile
        print("\n🛒 Checking POS Profile...")
        try:
            pos_profiles = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/POS Profile",
                method="GET",
                params={"limit_page_length": 10}
            )
            profile_list = pos_profiles.get("data", []) if isinstance(pos_profiles, dict) else []
            if profile_list:
                print(f"  ✅ Found {len(profile_list)} POS Profile(s):")
                for p in profile_list:
                    name = p.get("name") or "Unknown"
                    print(f"    - {name}")
            else:
                print(f"  ❌ No POS Profiles found")
        except Exception as e:
            print(f"  ❌ Error checking POS Profiles: {e}")
        
        # Check POS Sessions
        print("\n💳 Checking POS Sessions...")
        try:
            pos_sessions = erpnext_adapter.proxy_request(
                tenant_id,
                "resource/POS Opening Entry",
                method="GET",
                params={"filters": f'[["status", "=", "Open"]]', "limit_page_length": 5}
            )
            session_list = pos_sessions.get("data", []) if isinstance(pos_sessions, dict) else []
            if session_list:
                print(f"  ✅ Found {len(session_list)} open POS Session(s)")
            else:
                print(f"  ℹ️  No open POS Sessions (this is normal if session was closed)")
        except Exception as e:
            print(f"  ❌ Error checking POS Sessions: {e}")
        
        # Show provisioning steps
        print("\n📋 Provisioning Steps Status:")
        steps = onboarding.provisioning_steps or {}
        for step_name in ["step_0_engine_check", "step_2_company", "step_3_chart_of_accounts", 
                         "step_4_warehouses", "step_5_settings", "step_7_customer", 
                         "step_8_pos_profile", "step_9_pos_session"]:
            step_data = steps.get(step_name, {})
            status = step_data.get("status", "not_started")
            status_icon = "✅" if status in ["completed", "exists"] else "❌" if status == "failed" else "⏳"
            print(f"  {status_icon} {step_name}: {status}")
            if status == "failed" and step_data.get("error"):
                print(f"      Error: {step_data.get('error', '')[:100]}")
        
        print(f"\n{'='*60}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_erpnext_provisioning.py <tenant_id>")
        print("\nTo find tenant IDs:")
        print("  docker-compose exec postgres psql -U odoo -d postgres -c \"SELECT id, tenant_code, name FROM tenants ORDER BY created_at DESC LIMIT 5;\"")
        sys.exit(1)
    
    tenant_id = sys.argv[1]
    verify_provisioning(tenant_id)
