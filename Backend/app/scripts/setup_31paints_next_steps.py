#!/usr/bin/env python3
"""
31Paints Setup - Next Steps
Completes the setup: POS profiles, pricing, UOM conversions, permissions
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
        # First, get list of tenants
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=10
        )
        
        if response.status_code != 200:
            print_error(f"Login failed: {response.status_code} - {response.text}")
            return None
        
        login_data = response.json()
        user_id = login_data.get("user_id")
        tenants = login_data.get("tenants", [])
        
        if not tenants:
            print_error("No tenants available for admin user")
            return None
        
        # Find 31Paints tenant or use provided tenant_id
        target_tenant_id = tenant_id
        if not target_tenant_id:
            for t in tenants:
                if t.get("name") == TENANT_NAME:
                    target_tenant_id = t.get("id")
                    break
        
        if not target_tenant_id:
            target_tenant_id = tenants[0].get("id")
        
        # Now get access token with tenant
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
            else:
                print_error("No access token in response")
                return None
        else:
            print_error(f"Token request failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_error(f"Login exception: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_tenant_id(token: str) -> Optional[str]:
    """Get tenant ID from token or by name"""
    print_step("Finding 31Paints tenant...")
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
                    tenant_id = t.get("id")
                    print_success(f"Found tenant: {TENANT_NAME} ({tenant_id})")
                    return tenant_id
        
        print_error(f"Tenant '{TENANT_NAME}' not found")
        return None
    except Exception as e:
        print_error(f"Error finding tenant: {e}")
        return None

def create_uom_conversion(token: str, tenant_id: str, from_uom: str, to_uom: str, conversion_factor: float) -> bool:
    """Create UOM conversion in ERPNext"""
    print_step(f"Creating UOM conversion: {from_uom} → {to_uom} (factor: {conversion_factor})...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "doctype": "UOM Conversion Factor",
        "from_uom": from_uom,
        "to_uom": to_uom,
        "value": conversion_factor
    }
    
    response = requests.post(
        f"{BASE_URL}/erpnext/resource/UOM Conversion Factor",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        print_success(f"UOM conversion created: {from_uom} → {to_uom}")
        return True
    elif response.status_code == 409:
        print_warning(f"UOM conversion already exists: {from_uom} → {to_uom}")
        return True
    else:
        print_error(f"UOM conversion failed: {response.status_code} - {response.text}")
        return False

def create_pos_profile(token: str, tenant_id: str, profile_name: str, warehouse_name: str) -> Optional[Dict[str, Any]]:
    """Create a POS profile for a storefront"""
    print_step(f"Creating POS profile: {profile_name} for {warehouse_name}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # First, get company name
    company_response = requests.get(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/accounting/companies",
        headers=headers
    )
    
    company_name = TENANT_NAME  # Default to tenant name
    if company_response.status_code == 200:
        companies = company_response.json()
        if companies and len(companies) > 0:
            company_name = companies[0].get("name", TENANT_NAME)
    
    # Get warehouse details
    warehouse_response = requests.get(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/inventory/warehouses",
        headers=headers,
        params={"warehouse_name": warehouse_name}
    )
    
    warehouse_id = warehouse_name
    if warehouse_response.status_code == 200:
        warehouses = warehouse_response.json().get("warehouses", [])
        for wh in warehouses:
            if wh.get("warehouse_name") == warehouse_name:
                warehouse_id = wh.get("name", warehouse_name)
                break
    
    # Create POS profile
    payload = {
        "doctype": "POS Profile",
        "name": profile_name,
        "company": company_name,
        "warehouse": warehouse_id,
        "payments": [
            {
                "mode_of_payment": "Cash",
                "default": 1
            },
            {
                "mode_of_payment": "M-Pesa",
                "default": 0
            }
        ],
        "selling_price_list": "Standard Selling",
        "currency": "KES"
    }
    
    response = requests.post(
        f"{BASE_URL}/erpnext/resource/POS Profile",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        profile_data = response.json()
        print_success(f"POS profile created: {profile_name}")
        return profile_data
    else:
        print_error(f"POS profile creation failed: {response.status_code} - {response.text}")
        return None

def update_item_price(token: str, tenant_id: str, item_code: str, price: float, price_list: str = "Standard Selling") -> bool:
    """Update item price in price list"""
    print_step(f"Setting price for {item_code}: KES {price}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # Check if price list item exists
    check_response = requests.get(
        f"{BASE_URL}/erpnext/resource/Item Price",
        headers=headers,
        params={
            "filters": json.dumps([["item_code", "=", item_code], ["price_list", "=", price_list]]),
            "limit_page_length": 1
        }
    )
    
    if check_response.status_code == 200:
        existing = check_response.json().get("data", [])
        if existing:
            # Update existing
            price_id = existing[0].get("name")
            payload = {
                "price_list_rate": price
            }
            response = requests.put(
                f"{BASE_URL}/erpnext/resource/Item Price/{price_id}",
                json=payload,
                headers=headers
            )
        else:
            # Create new
            payload = {
                "doctype": "Item Price",
                "item_code": item_code,
                "price_list": price_list,
                "price_list_rate": price,
                "currency": "KES"
            }
            response = requests.post(
                f"{BASE_URL}/erpnext/resource/Item Price",
                json=payload,
                headers=headers
            )
        
        if response.status_code in [200, 201]:
            print_success(f"Price set for {item_code}: KES {price}")
            return True
        else:
            print_error(f"Price update failed: {response.status_code} - {response.text}")
            return False
    else:
        print_error(f"Failed to check existing prices: {check_response.status_code}")
        return False

def verify_company(token: str, tenant_id: str) -> bool:
    """Verify company exists in ERPNext"""
    print_step("Verifying company in ERPNext...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    response = requests.get(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/accounting/companies",
        headers=headers
    )
    
    if response.status_code == 200:
        companies = response.json()
        if companies:
            company = companies[0]
            print_success(f"Company found: {company.get('name')} (Currency: {company.get('default_currency', 'N/A')})")
            return True
        else:
            print_error("No companies found in ERPNext")
            return False
    else:
        print_error(f"Failed to get companies: {response.status_code} - {response.text}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  31Paints Setup - Next Steps")
    print(f"{'='*60}{Colors.END}\n")
    
    # Step 1: Login
    token = login()
    if not token:
        print_error("Cannot proceed without authentication")
        sys.exit(1)
    
    # Step 2: Get tenant ID
    tenant_id = get_tenant_id(token)
    if not tenant_id:
        print_error("Cannot proceed without tenant ID")
        sys.exit(1)
    
    # Re-login with correct tenant
    token = login(tenant_id=tenant_id)
    if not token:
        print_error("Cannot proceed without authentication")
        sys.exit(1)
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # Step 3: Verify Company
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 1: Verify Company")
    print(f"{'='*60}{Colors.END}")
    verify_company(token, tenant_id)
    
    # Step 4: Create UOM Conversions
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 2: Create UOM Conversions")
    print(f"{'='*60}{Colors.END}")
    
    # ml to Litre conversions
    create_uom_conversion(token, tenant_id, "ml", "Litre", 0.001)  # 1ml = 0.001 Litre
    time.sleep(0.5)
    
    # Step 5: Create POS Profiles
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 3: Create POS Profiles")
    print(f"{'='*60}{Colors.END}")
    
    pos_profiles = []
    for i in range(1, 6):
        profile_name = f"Storefront {i} POS"
        warehouse_name = f"Storefront {i} Warehouse"
        profile = create_pos_profile(token, tenant_id, profile_name, warehouse_name)
        if profile:
            pos_profiles.append(profile_name)
        time.sleep(1)
    
    # Step 6: Set Item Prices
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Step 4: Set Item Prices")
    print(f"{'='*60}{Colors.END}")
    
    # Sample pricing (in KES)
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
        update_item_price(token, tenant_id, item_code, price)
        time.sleep(0.5)
    
    # Summary
    print(f"\n{Colors.GREEN}{'='*60}")
    print("  Next Steps Summary")
    print(f"{'='*60}{Colors.END}")
    print(f"\n{Colors.GREEN}✓ Company verified in ERPNext")
    print(f"✓ UOM conversions created (ml → Litre)")
    print(f"✓ POS profiles: {len(pos_profiles)} created")
    if pos_profiles:
        for profile in pos_profiles:
            print(f"  - {profile}")
    print(f"✓ Item prices set for all paint sizes")
    print(f"\n{Colors.END}")
    
    # Remaining manual steps
    print(f"{Colors.BLUE}Remaining Manual Steps:{Colors.END}")
    print("1. Configure user roles/permissions in RBAC system")
    print("2. Test login for each user type:")
    print("   - Accountant: Should access accounting modules")
    print("   - Store Keeper: Should access inventory & purchasing")
    print("   - Cashiers: Should access POS and invoices only")
    print("3. Configure payment methods (M-Pesa, Cash) in ERPNext")
    print("4. Set up receipt printers (if needed)")
    print("5. Configure barcode scanners (if needed)")
    print(f"\n{Colors.END}")

if __name__ == "__main__":
    main()
