#!/usr/bin/env python3
"""
Complete 31Paints Setup via FastAPI Backend
Uses the new setup API endpoints to complete tenant configuration
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional, List

# Configuration
BASE_URL = "http://localhost:9000"
ADMIN_EMAIL = "admin@moran.com"
ADMIN_PASSWORD = "password123"
TENANT_NAME = "31Paints"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_step(message: str):
    print(f"\n{Colors.BLUE}▶ {message}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.CYAN}ℹ {message}{Colors.END}")

def login(tenant_id: Optional[str] = None) -> Optional[str]:
    """Login and get access token"""
    print_step("Logging in as admin...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=10
        )
        
        if response.status_code != 200:
            print_error(f"Login failed: {response.status_code}")
            return None
        
        login_data = response.json()
        tenants = login_data.get("tenants", [])
        
        if not tenants:
            print_error("No tenants available")
            return None
        
        target_tenant_id = tenant_id
        if not target_tenant_id:
            for t in tenants:
                if t.get("name") == TENANT_NAME:
                    target_tenant_id = t.get("id")
                    break
        
        if not target_tenant_id:
            target_tenant_id = tenants[0].get("id")
        
        response = requests.post(
            f"{BASE_URL}/auth/v1/login-with-tenant",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "tenant_id": target_tenant_id
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            if token:
                print_success(f"Login successful (tenant: {data.get('tenant', {}).get('name', 'N/A')})")
                return token, target_tenant_id
        return None, None
    except Exception as e:
        print_error(f"Login exception: {e}")
        return None, None

def get_setup_status(token: str, tenant_id: str) -> Dict[str, Any]:
    """Get current setup status"""
    print_step("Checking setup status...")
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/tenants/{tenant_id}/setup/status",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            status = response.json()
            print_success("Setup status retrieved")
            return status
        else:
            print_error(f"Failed to get status: {response.status_code} - {response.text}")
            return {}
    except Exception as e:
        print_error(f"Error getting status: {e}")
        return {}

def list_warehouses_for_setup(token: str, tenant_id: str) -> List[Dict[str, Any]]:
    """List warehouses for setup"""
    print_step("Listing warehouses...")
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/tenants/{tenant_id}/setup/warehouses",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            warehouses = data.get("warehouses", [])
            print_success(f"Found {len(warehouses)} warehouses")
            return warehouses
        else:
            print_error(f"Failed to list warehouses: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print_error(f"Error listing warehouses: {e}")
        return []

def create_pos_profile(token: str, tenant_id: str, profile_name: str, warehouse_name: str, payment_methods: List[str] = None) -> bool:
    """Create a POS profile via API"""
    print_step(f"Creating POS profile: {profile_name}...")
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    payload = {
        "name": profile_name,
        "warehouse": warehouse_name,
        "payment_methods": payment_methods or ["Cash"]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/tenants/{tenant_id}/setup/pos-profiles",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            print_success(f"POS profile '{profile_name}' created successfully")
            return True
        else:
            error_detail = response.json().get("detail", {})
            error_msg = error_detail.get("message", str(response.text))[:200] if isinstance(error_detail, dict) else str(response.text)[:200]
            print_error(f"Failed to create POS profile: {error_msg}")
            return False
    except Exception as e:
        print_error(f"Error creating POS profile: {e}")
        return False

def main():
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}")
    print("  Complete 31Paints Setup via FastAPI Backend")
    print(f"{'='*60}{Colors.END}\n")
    
    # Step 1: Login
    login_result = login()
    if not login_result or not login_result[0]:
        print_error("Cannot proceed without authentication")
        sys.exit(1)
    
    token, tenant_id = login_result
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # Step 2: Check Setup Status
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 1: Current Setup Status")
    print(f"{'='*60}{Colors.END}")
    
    status = get_setup_status(token, tenant_id)
    if status:
        print(f"\n{Colors.CYAN}Current Status:{Colors.END}")
        print(f"  • Warehouses: {status.get('warehouses', 0)}")
        print(f"  • POS Profiles: {status.get('pos_profiles', 0)}")
        print(f"  • Items: {status.get('items', 0)}")
        print(f"  • Price List: {'✓' if status.get('price_list') else '✗'}")
        print(f"  • Payment Methods: {', '.join(status.get('payment_methods', []))}")
    
    # Step 3: List Warehouses
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 2: Available Warehouses")
    print(f"{'='*60}{Colors.END}")
    
    warehouses = list_warehouses_for_setup(token, tenant_id)
    
    # Filter for 31Paints storefronts
    storefront_warehouses = []
    for wh in warehouses:
        wh_name = wh.get("warehouse_name") or wh.get("name", "")
        if "Storefront" in wh_name and "Warehouse" in wh_name:
            storefront_warehouses.append(wh)
            print(f"  • {wh_name} (ID: {wh.get('name', 'N/A')})")
    
    if not storefront_warehouses:
        print_warning("No storefront warehouses found. Listing all warehouses:")
        for wh in warehouses[:10]:
            wh_name = wh.get("warehouse_name") or wh.get("name", "")
            print(f"  • {wh_name}")
    
    # Step 4: Create POS Profiles
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 3: Creating POS Profiles")
    print(f"{'='*60}{Colors.END}")
    
    pos_profiles_created = 0
    
    # Try to create POS profiles for storefronts
    if storefront_warehouses:
        for i, wh in enumerate(storefront_warehouses[:5], 1):
            warehouse_name = wh.get("name")  # Use 'name' field for ERPNext reference
            if not warehouse_name:
                warehouse_name = wh.get("warehouse_name")
            
            profile_name = f"Storefront {i} POS"
            
            if create_pos_profile(token, tenant_id, profile_name, warehouse_name, ["Cash", "Mpesa"]):
                pos_profiles_created += 1
            time.sleep(1)
    else:
        print_warning("No storefront warehouses found. Cannot create POS profiles automatically.")
        print_info("You may need to create POS profiles manually or check warehouse names.")
    
    # Step 5: Final Status Check
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 4: Final Setup Status")
    print(f"{'='*60}{Colors.END}")
    
    final_status = get_setup_status(token, tenant_id)
    if final_status:
        print(f"\n{Colors.GREEN}Final Status:{Colors.END}")
        print(f"  • Warehouses: {final_status.get('warehouses', 0)}")
        print(f"  • POS Profiles: {final_status.get('pos_profiles', 0)}")
        print(f"  • Items: {final_status.get('items', 0)}")
        print(f"  • Price List: {'✓' if final_status.get('price_list') else '✗'}")
        print(f"  • Payment Methods: {', '.join(final_status.get('payment_methods', []))}")
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}")
    print("  Setup Summary")
    print(f"{'='*60}{Colors.END}")
    print(f"\n{Colors.GREEN}✓ Setup status checked")
    print(f"✓ Warehouses listed: {len(warehouses)}")
    print(f"✓ POS Profiles created: {pos_profiles_created}")
    print(f"\n{Colors.END}")
    
    if pos_profiles_created < 5:
        print(f"{Colors.YELLOW}Note:{Colors.END} Some POS profiles may need manual creation.")
        print(f"Check warehouse names and ensure they exist in ERPNext.")
        print(f"You can also create them via the API or ERPNext UI.")
    
    print(f"\n{Colors.CYAN}Next Steps:{Colors.END}")
    print("1. Verify warehouses are visible in the UI")
    print("2. Test POS profile creation if needed")
    print("3. Configure user permissions (RBAC)")
    print("4. Test POS transactions")
    print(f"\n{Colors.END}")

if __name__ == "__main__":
    main()
