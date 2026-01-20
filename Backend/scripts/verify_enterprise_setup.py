#!/usr/bin/env python3
"""
Enterprise Setup Verification Script
Verifies that Enterprise tenant setup and test data are correctly configured
"""

import sys
import os
import requests
import json
from typing import Dict, Any, List

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:9000")
TENANT_ID = os.getenv("TENANT_ID", "")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "")

HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

def check_api_health():
    """Check if API is accessible"""
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        if resp.status_code == 200:
            print("✅ API is healthy")
            return True
        else:
            print(f"⚠️  API returned status {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ API health check failed: {e}")
        return False

def verify_tenant():
    """Verify tenant exists and engine is set to erpnext"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/iam/tenants/{TENANT_ID}",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            tenant = resp.json()
            engine = tenant.get("engine", tenant.get("data", {}).get("engine"))
            if engine == "erpnext":
                print(f"✅ Tenant verified: {tenant.get('name', 'Unknown')} (Engine: {engine})")
                return True
            else:
                print(f"⚠️  Tenant engine is '{engine}', expected 'erpnext'")
                return False
        else:
            print(f"❌ Failed to verify tenant: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Tenant verification failed: {e}")
        return False

def verify_warehouses():
    """Verify warehouses are created"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/tenants/{TENANT_ID}/erp/inventory/warehouses",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            warehouses = data.get("warehouses", data.get("data", []))
            if isinstance(warehouses, dict) and "warehouses" in warehouses:
                warehouses = warehouses["warehouses"]
            
            expected = [
                "Main Factory Warehouse",
                "Raw Materials Warehouse",
                "Finished Goods Warehouse",
                "Showroom Warehouse",
                "Spare Parts Warehouse"
            ]
            
            found = []
            for wh in warehouses if isinstance(warehouses, list) else []:
                wh_name = wh.get("name") or wh.get("warehouse_name", "")
                for exp in expected:
                    if exp in wh_name:
                        found.append(exp)
            
            print(f"✅ Warehouses: Found {len(found)}/{len(expected)} expected warehouses")
            if len(found) < len(expected):
                missing = set(expected) - set(found)
                print(f"   Missing: {', '.join(missing)}")
            return len(found) >= 3  # At least 3 should exist
        else:
            print(f"⚠️  Failed to fetch warehouses: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Warehouse verification failed: {e}")
        return False

def verify_items():
    """Verify items are created"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/tenants/{TENANT_ID}/erp/inventory/items",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("items", data.get("data", []))
            if isinstance(items, dict) and "items" in items:
                items = items["items"]
            
            expected_codes = ["CB-100", "SC-001", "BT-001", "CS-001", "SP-X1", "INST-SVC"]
            found_codes = []
            for item in items if isinstance(items, list) else []:
                item_code = item.get("item_code", "")
                if item_code in expected_codes:
                    found_codes.append(item_code)
            
            print(f"✅ Items: Found {len(found_codes)}/{len(expected_codes)} expected items")
            if len(found_codes) < len(expected_codes):
                missing = set(expected_codes) - set(found_codes)
                print(f"   Missing: {', '.join(missing)}")
            return len(found_codes) >= 3  # At least 3 should exist
        else:
            print(f"⚠️  Failed to fetch items: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Items verification failed: {e}")
        return False

def verify_customers():
    """Verify customers are created"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/tenants/{TENANT_ID}/erp/crm/customers",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            customers = data if isinstance(data, list) else (data.get("data", []) or data.get("customers", []))
            
            expected = ["Corporation X", "Retail Customer B", "International Distributor C"]
            found = []
            for cust in customers:
                cust_name = cust.get("name") or cust.get("customer_name", "")
                for exp in expected:
                    if exp in cust_name:
                        found.append(exp)
            
            print(f"✅ Customers: Found {len(found)}/{len(expected)} expected customers")
            return len(found) >= 1  # At least 1 should exist
        else:
            print(f"⚠️  Failed to fetch customers: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Customers verification failed: {e}")
        return False

def verify_employees():
    """Verify employees are created"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/tenants/{TENANT_ID}/erp/hr/employees",
            headers=HEADERS,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            employees = data if isinstance(data, list) else (data.get("data", []) or data.get("employees", []))
            
            expected = ["John Doe", "Jane Smith"]
            found = []
            for emp in employees:
                emp_name = emp.get("name") or emp.get("employee_name", "")
                for exp in expected:
                    if exp in emp_name:
                        found.append(exp)
            
            print(f"✅ Employees: Found {len(found)}/{len(expected)} expected employees")
            return len(found) >= 1  # At least 1 should exist
        else:
            print(f"⚠️  Failed to fetch employees: {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Employees verification failed: {e}")
        return False

def main():
    """Main verification function"""
    print("=" * 60)
    print("Enterprise Setup Verification")
    print("=" * 60)
    
    if not TENANT_ID:
        print("❌ ERROR: TENANT_ID environment variable not set")
        sys.exit(1)
    
    if not ACCESS_TOKEN:
        print("❌ ERROR: ACCESS_TOKEN environment variable not set")
        sys.exit(1)
    
    print(f"\nTenant ID: {TENANT_ID}")
    print(f"API Base URL: {BASE_URL}\n")
    
    results = []
    
    # Run verification checks
    results.append(("API Health", check_api_health()))
    results.append(("Tenant Configuration", verify_tenant()))
    results.append(("Warehouses", verify_warehouses()))
    results.append(("Items", verify_items()))
    results.append(("Customers", verify_customers()))
    results.append(("Employees", verify_employees()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Verification Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for check_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {check_name}")
    
    print(f"\nOverall: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n✅ All verifications passed! Enterprise setup is complete.")
        return 0
    elif passed >= total * 0.7:
        print("\n⚠️  Most verifications passed. Some setup may be incomplete.")
        return 1
    else:
        print("\n❌ Many verifications failed. Please review setup.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
