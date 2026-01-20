#!/usr/bin/env python3
"""
Diagnostic script to test ERPNext connectivity and configuration.
Run this from the Backend directory or as a Python module.

Usage:
    python -m app.scripts.test_erpnext_connection
    OR
    cd Backend && python app/scripts/test_erpnext_connection.py
"""

import sys
import os
from pathlib import Path

# Add the Backend directory to the Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.services.erpnext_client import ERPNextClientAdapter


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_status(status: str, message: str):
    """Print a formatted status message."""
    status_symbol = "✓" if status == "OK" else "✗" if status == "FAIL" else "⚠"
    print(f"{status_symbol} [{status}] {message}")


def test_configuration():
    """Test ERPNext configuration settings."""
    print_section("Configuration Check")
    
    print_status("INFO", f"ERPNext Host: {settings.ERPNEXT_HOST}")
    print_status("INFO", f"ERPNext User: {settings.ERPNEXT_USER}")
    print_status("INFO", f"ERPNext Site: {getattr(settings, 'ERPNEXT_SITE', 'moran.localhost')}")
    print_status("INFO", f"ERPNext Password: {'*' * len(settings.ERPNEXT_PASSWORD)}")
    
    # Check if settings are reasonable
    if not settings.ERPNEXT_HOST or settings.ERPNEXT_HOST == "":
        print_status("FAIL", "ERPNEXT_HOST is not configured")
        return False
    if not settings.ERPNEXT_USER or settings.ERPNEXT_USER == "":
        print_status("FAIL", "ERPNEXT_USER is not configured")
        return False
    if not settings.ERPNEXT_PASSWORD or settings.ERPNEXT_PASSWORD == "":
        print_status("FAIL", "ERPNEXT_PASSWORD is not configured")
        return False
    
    print_status("OK", "Configuration looks valid")
    return True


def test_connection():
    """Test ERPNext connection and authentication."""
    print_section("Connection Test")
    
    try:
        # Create adapter instance
        adapter = ERPNextClientAdapter(tenant_id="test-tenant")
        print_status("INFO", f"Created adapter with base URL: {adapter.base_url}")
        
        # Test site name resolution
        site_name = adapter._resolve_site_name("test-tenant")
        print_status("INFO", f"Resolved site name: {site_name}")
        
        # Test login
        print_status("INFO", "Attempting to connect to ERPNext...")
        login_success, login_error = adapter._login("test-tenant")
        
        if login_success:
            print_status("OK", "Successfully connected and authenticated to ERPNext")
            return True
        else:
            print_status("FAIL", f"Connection successful but authentication failed: {login_error}")
            return False
            
    except Exception as e:
        print_status("FAIL", f"Connection error: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        return False


def test_simple_request():
    """Test a simple API request to ERPNext."""
    print_section("API Request Test")
    
    try:
        adapter = ERPNextClientAdapter(tenant_id="test-tenant")
        
        # Try to get server info (lightweight request)
        print_status("INFO", "Attempting to fetch server information...")
        response = adapter.proxy_request(
            tenant_id="test-tenant",
            path="method/frappe.utils.change_log.get_versions",
            method="GET"
        )
        
        print_status("OK", "Successfully made API request to ERPNext")
        print(f"   Response keys: {list(response.get('data', {}).keys())[:5]}...")
        return True
        
    except Exception as e:
        print_status("FAIL", f"API request failed: {str(e)}")
        return False


def main():
    """Run all diagnostic tests."""
    print("\n" + "=" * 60)
    print("  ERPNext Connection Diagnostic Tool")
    print("=" * 60)
    
    results = []
    
    # Test 1: Configuration
    config_ok = test_configuration()
    results.append(("Configuration", config_ok))
    
    if not config_ok:
        print("\n⚠  Configuration issues detected. Please fix before proceeding.")
        return
    
    # Test 2: Connection and Authentication
    connection_ok = test_connection()
    results.append(("Connection & Authentication", connection_ok))
    
    if not connection_ok:
        print("\n⚠  Connection/Authentication issues detected.")
        print("\nTroubleshooting steps:")
        print("  1. Check if ERPNext container is running: docker-compose ps erpnext")
        print("  2. Check ERPNext logs: docker-compose logs erpnext --tail=50")
        print("  3. Verify site exists: docker-compose logs create-site")
        print("  4. Test direct access: curl http://localhost:9010/api/method/ping")
        return
    
    # Test 3: Simple API Request
    api_ok = test_simple_request()
    results.append(("API Request", api_ok))
    
    # Summary
    print_section("Summary")
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print_status(status, test_name)
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n✓ All tests passed! ERPNext is ready to use.")
    else:
        print("\n✗ Some tests failed. Please review the errors above.")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
