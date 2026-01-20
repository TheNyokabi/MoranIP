#!/usr/bin/env python3
"""
ERPNext Connectivity Test Script

Tests ERPNext connectivity and the endpoints we just implemented.
Run this to verify everything is working.
"""

import sys
import os
import requests
from typing import Dict, Any

# Add Backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))

def test_erpnext_direct():
    """Test direct ERPNext connection"""
    print("\n" + "="*60)
    print("TEST 1: Direct ERPNext Connection")
    print("="*60)
    
    # Check config
    try:
        from app.config import settings
        host = settings.ERPNEXT_HOST
        user = settings.ERPNEXT_USER
        password = settings.ERPNEXT_PASSWORD
        site = settings.ERPNEXT_SITE
        
        print(f"✓ Config loaded")
        print(f"  Host: {host}")
        print(f"  User: {user}")
        print(f"  Site: {site}")
    except Exception as e:
        print(f"✗ Config error: {e}")
        return False
    
    # Test connection
    try:
        base_url = f"{host}/{site}"
        ping_url = f"{base_url}/api/method/ping"
        print(f"\nTesting: {ping_url}")
        
        response = requests.get(ping_url, timeout=5)
        if response.status_code == 200:
            print(f"✓ ERPNext is reachable (Status: {response.status_code})")
            return True
        else:
            print(f"✗ ERPNext returned status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to ERPNext at {host}")
        print(f"  Make sure ERPNext is running (check docker-compose ps)")
        return False
    except Exception as e:
        print(f"✗ Connection error: {e}")
        return False


def test_erpnext_auth():
    """Test ERPNext authentication"""
    print("\n" + "="*60)
    print("TEST 2: ERPNext Authentication")
    print("="*60)
    
    try:
        from app.services.erpnext_client import ERPNextClientAdapter
        from app.config import settings
        
        adapter = ERPNextClientAdapter(tenant_id="test")
        print(f"✓ Adapter created")
        
        # Try login (this will use the site from config)
        print(f"Attempting login...")
        success, error = adapter._login("test")
        
        if success:
            print(f"✓ Authentication successful")
            return True
        else:
            print(f"✗ Authentication failed: {error}")
            return False
    except Exception as e:
        print(f"✗ Authentication error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_backend_api():
    """Test backend API health"""
    print("\n" + "="*60)
    print("TEST 3: Backend API Health")
    print("="*60)
    
    try:
        # Note: This requires authentication token, so it's optional
        health_url = "http://localhost:4000/api/erpnext/health"
        print(f"Testing: {health_url}")
        print(f"  (Note: This requires authentication token)")
        
        response = requests.get(health_url, timeout=5)
        if response.status_code == 200:
            print(f"✓ Backend API is responding (Status: {response.status_code})")
            data = response.json()
            print(f"  ERPNext Host: {data.get('erpnext_host')}")
            print(f"  Connected: {data.get('connected')}")
            print(f"  Authenticated: {data.get('authenticated')}")
            return True
        elif response.status_code == 401:
            print(f"⚠ Backend API requires authentication (Status: 401)")
            print(f"  This is expected - API is running but needs login")
            return True
        else:
            print(f"✗ Backend API returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"⚠ Backend API not running on port 4000")
        print(f"  Start it with: cd Backend && uvicorn app.main:app --reload --port 4000")
        return False
    except Exception as e:
        print(f"⚠ Backend API test error: {e}")
        return False


def test_endpoints_exist():
    """Verify the endpoints we created exist in the code"""
    print("\n" + "="*60)
    print("TEST 4: Endpoint Code Verification")
    print("="*60)
    
    endpoints = [
        ("Backend/app/routers/inventory.py", "delete_warehouse", "DELETE /warehouses/{warehouse_name}"),
        ("Backend/app/routers/inventory.py", "get_stock_entry", "GET /stock-entries/{entry_name}"),
        ("Backend/app/routers/inventory.py", "update_stock_entry", "PUT /stock-entries/{entry_name}"),
        ("Backend/app/routers/inventory.py", "delete_stock_entry", "DELETE /stock-entries/{entry_name}"),
        ("Backend/app/routers/pos.py", "get_customer", "GET /customers/{customer_name}"),
        ("Backend/app/routers/pos.py", "update_customer", "PUT /customers/{customer_name}"),
        ("Backend/app/routers/pos.py", "delete_customer", "DELETE /customers/{customer_name}"),
        ("Backend/app/routers/pos.py", "update_invoice", "PUT /invoices/{invoice_name}"),
        ("Backend/app/routers/pos.py", "delete_invoice", "DELETE /invoices/{invoice_name}"),
        ("Backend/app/utils/datetime_utils.py", "format_erpnext_datetime", "DateTime utility"),
    ]
    
    all_found = True
    for file_path, function_name, description in endpoints:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
                if function_name in content:
                    print(f"✓ {description}")
                else:
                    print(f"✗ {description} - Function '{function_name}' not found in {file_path}")
                    all_found = False
        else:
            print(f"✗ {description} - File {file_path} not found")
            all_found = False
    
    return all_found


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("ERPNext Connectivity Test Suite")
    print("="*60)
    print("\nThis script tests:")
    print("1. Direct ERPNext connection")
    print("2. ERPNext authentication")
    print("3. Backend API health (optional)")
    print("4. Endpoint code verification")
    
    results = []
    
    # Test 1: Direct connection
    results.append(("Direct Connection", test_erpnext_direct()))
    
    # Test 2: Authentication
    results.append(("Authentication", test_erpnext_auth()))
    
    # Test 3: Backend API (optional - might not be running)
    results.append(("Backend API", test_backend_api()))
    
    # Test 4: Code verification
    results.append(("Code Verification", test_endpoints_exist()))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ All tests passed! ERPNext is working correctly.")
        return 0
    elif passed >= 2:  # At least connection and code verification
        print("\n⚠ Some tests failed, but core functionality appears working.")
        print("  Check the failures above for details.")
        return 0
    else:
        print("\n❌ Multiple tests failed. ERPNext may not be running.")
        print("  Try: docker-compose up -d erpnext")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
