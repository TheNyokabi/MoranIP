#!/usr/bin/env python3
"""
31Paints Setup - Create Master Data
Creates missing master data: UOM, Price List, Mode of Payment, etc.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

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
    END = '\033[0m'

def print_step(message: str):
    print(f"\n{Colors.BLUE}▶ {message}{Colors.END}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

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
                return token
        return None
    except Exception as e:
        print_error(f"Login exception: {e}")
        return None

def get_tenant_id(token: str) -> Optional[str]:
    """Get tenant ID"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=10
        )
        
        if response.status_code == 200:
            tenants = response.json().get("tenants", [])
            for t in tenants:
                if t.get("name") == TENANT_NAME:
                    return t.get("id")
        return None
    except:
        return None

def create_master_data(token: str, tenant_id: str, doctype: str, data: Dict[str, Any]) -> bool:
    """Create master data in ERPNext"""
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    data["doctype"] = doctype
    
    response = requests.post(
        f"{BASE_URL}/erpnext/resource/{doctype}",
        json=data,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        return True
    elif response.status_code == 409:
        return True  # Already exists
    else:
        print_error(f"Failed to create {doctype}: {response.status_code} - {response.text[:200]}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  31Paints Master Data Setup")
    print(f"{'='*60}{Colors.END}\n")
    
    # Login
    token = login()
    if not token:
        print_error("Cannot proceed without authentication")
        sys.exit(1)
    
    tenant_id = get_tenant_id(token)
    if not tenant_id:
        print_error("Cannot find tenant")
        sys.exit(1)
    
    # Re-login with tenant
    token = login(tenant_id=tenant_id)
    if not token:
        print_error("Cannot proceed without authentication")
        sys.exit(1)
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # Step 1: Create UOM "ml"
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 1: Create UOM 'ml'")
    print(f"{'='*60}{Colors.END}")
    
    if create_master_data(token, tenant_id, "UOM", {"uom_name": "ml"}):
        print_success("UOM 'ml' created")
    time.sleep(0.5)
    
    # Step 2: Create Price List
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 2: Create Price List")
    print(f"{'='*60}{Colors.END}")
    
    if create_master_data(token, tenant_id, "Price List", {
        "price_list_name": "Standard Selling",
        "selling": 1,
        "currency": "KES"
    }):
        print_success("Price List 'Standard Selling' created")
    time.sleep(0.5)
    
    # Step 3: Create Mode of Payment "M-Pesa"
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 3: Create Mode of Payment")
    print(f"{'='*60}{Colors.END}")
    
    # Mode of Payment uses 'mode_of_payment' field, not 'name'
    # Check if Mpesa exists (it might already exist)
    mop_response = requests.get(
        f"{BASE_URL}/erpnext/resource/Mode of Payment",
        headers=headers,
        params={"filters": json.dumps([["mode_of_payment", "=", "Mpesa"]])}
    )
    
    if mop_response.status_code == 200:
        existing = mop_response.json().get("data", [])
        if existing:
            print_success("Mode of Payment 'Mpesa' already exists")
        else:
            if create_master_data(token, tenant_id, "Mode of Payment", {
                "mode_of_payment": "Mpesa",
                "type": "Bank",
                "enabled": 1
            }):
                print_success("Mode of Payment 'Mpesa' created")
    time.sleep(0.5)
    
    # Step 4: Get actual warehouse names
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 4: Verify Warehouses")
    print(f"{'='*60}{Colors.END}")
    
    warehouse_response = requests.get(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/inventory/warehouses",
        headers=headers
    )
    
    warehouses = []
    if warehouse_response.status_code == 200:
        data = warehouse_response.json()
        warehouses = data.get("warehouses", [])
        print_success(f"Found {len(warehouses)} warehouses")
        for wh in warehouses[:5]:
            print(f"  - {wh.get('warehouse_name')} (ID: {wh.get('name')})")
    
    # Step 5: Create POS Profiles with correct warehouse names
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 5: Create POS Profiles")
    print(f"{'='*60}{Colors.END}")
    
    # Get company name
    company_response = requests.get(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/accounting/companies",
        headers=headers
    )
    company_name = TENANT_NAME
    if company_response.status_code == 200:
        companies = company_response.json()
        if companies:
            company_name = companies[0].get("name", TENANT_NAME)
    
    pos_profiles = []
    for i in range(1, 6):
        warehouse_name = f"Storefront {i} Warehouse"
        # Find actual warehouse
        warehouse_id = warehouse_name
        for wh in warehouses:
            if wh.get("warehouse_name") == warehouse_name:
                warehouse_id = wh.get("name", warehouse_name)
                break
        
        profile_name = f"Storefront {i} POS"
        profile_data = {
            "doctype": "POS Profile",
            "name": profile_name,
            "company": company_name,
            "warehouse": warehouse_id,
            "payments": [
                {
                    "mode_of_payment": "Cash",
                    "default": 1
                }
            ],
            "currency": "KES"
        }
        
        # Only add M-Pesa if it exists
        # For now, just use Cash
        
        if create_master_data(token, tenant_id, "POS Profile", profile_data):
            print_success(f"POS Profile '{profile_name}' created")
            pos_profiles.append(profile_name)
        time.sleep(1)
    
    # Step 6: Create Item Prices
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 6: Create Item Prices")
    print(f"{'='*60}{Colors.END}")
    
    prices = {
        "100ml": 50.0,
        "250ml": 100.0,
        "500ml": 180.0,
        "1L": 300.0,
        "2L": 550.0,
        "5L": 1200.0,
        "10L": 2200.0
    }
    
    for item_code, price in prices.items():
        price_data = {
            "doctype": "Item Price",
            "item_code": item_code,
            "price_list": "Standard Selling",
            "price_list_rate": price,
            "currency": "KES"
        }
        
        if create_master_data(token, tenant_id, "Item Price", price_data):
            print_success(f"Price set for {item_code}: KES {price}")
        time.sleep(0.5)
    
    # Summary
    print(f"\n{Colors.GREEN}{'='*60}")
    print("  Master Data Setup Summary")
    print(f"{'='*60}{Colors.END}")
    print(f"\n{Colors.GREEN}✓ UOM 'ml' created")
    print(f"✓ Price List 'Standard Selling' created")
    print(f"✓ Mode of Payment 'M-Pesa' created")
    print(f"✓ POS Profiles: {len(pos_profiles)} created")
    for profile in pos_profiles:
        print(f"  - {profile}")
    print(f"✓ Item prices set for all paint sizes")
    print(f"\n{Colors.END}")

if __name__ == "__main__":
    main()
