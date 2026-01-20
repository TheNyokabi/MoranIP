#!/usr/bin/env python3
"""
Setup script for 31Paints tenant
Creates tenant, users, warehouses, items, and assigns roles
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
        
        # Use provided tenant_id or first tenant
        target_tenant_id = tenant_id or tenants[0].get("id")
        
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
                print(f"Response: {data}")
                return None
        else:
            print_error(f"Token request failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_error(f"Login exception: {e}")
        import traceback
        traceback.print_exc()
        return None

def create_tenant(token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Create 31Paints tenant"""
    print_step("Creating 31Paints tenant...")
    
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    payload = {
        "name": "31Paints",
        "category": "Enterprise",
        "description": "Paint shop with 5 storefronts",
        "country_code": "KE",
        "engine": "erpnext",
        "admin_email": "admin@31paints.com",
        "admin_name": "Admin User",
        "admin_password": "Password123!"
    }
    
    response = requests.post(
        f"{BASE_URL}/iam/tenants",
        json=payload,
        headers=headers if headers else None
    )
    
    if response.status_code in [200, 201]:
        tenant_data = response.json()
        tenant_id = tenant_data.get("tenant", {}).get("id")
        print_success(f"Tenant created: {tenant_data.get('tenant', {}).get('name')}")
        
        # Check company creation
        if tenant_data.get("company", {}).get("created"):
            print_success(f"Company created in ERPNext: {tenant_data.get('company', {}).get('name')}")
        else:
            print_warning("Company creation may have failed")
        
        return {"tenant_id": tenant_id, **tenant_data}
    else:
        print_error(f"Tenant creation failed: {response.status_code} - {response.text}")
        return None

def create_user(token: str, tenant_id: str, email: str, name: str, role: str, password: str = "Password123!") -> Optional[Dict[str, Any]]:
    """Create a user and assign to tenant"""
    print_step(f"Creating user: {name} ({email}) as {role}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "email": email,
        "full_name": name,
        "password": password,
        "role": role,
        "country_code": "KE"
    }
    
    response = requests.post(
        f"{BASE_URL}/iam/tenants/{tenant_id}/users/create",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        user_data = response.json()
        print_success(f"User created: {name}")
        return user_data
    else:
        print_error(f"User creation failed: {response.status_code} - {response.text}")
        return None

def create_warehouse(token: str, tenant_id: str, warehouse_name: str) -> Optional[Dict[str, Any]]:
    """Create a warehouse"""
    print_step(f"Creating warehouse: {warehouse_name}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "warehouse_name": warehouse_name,
        "is_group": 0
        # Note: warehouse_type is optional in ERPNext - removing "Stock" as it may not exist
    }
    
    response = requests.post(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/inventory/warehouses",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        warehouse_data = response.json()
        print_success(f"Warehouse created: {warehouse_name}")
        return warehouse_data
    else:
        print_error(f"Warehouse creation failed: {response.status_code} - {response.text}")
        return None

def create_item_group(token: str, tenant_id: str, item_group_name: str) -> Optional[Dict[str, Any]]:
    """Create an item group if it doesn't exist"""
    print_step(f"Creating item group: {item_group_name}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "doctype": "Item Group",
        "item_group_name": item_group_name,
        "is_group": 0,
        "parent_item_group": "All Item Groups"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/tenants/{tenant_id}/erpnext/resource/Item Group",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        group_data = response.json()
        print_success(f"Item group created: {item_group_name}")
        return group_data
    elif response.status_code == 409:
        print_warning(f"Item group already exists: {item_group_name}")
        return {"exists": True}
    else:
        print_error(f"Item group creation failed: {response.status_code} - {response.text}")
        return None

def create_uom(token: str, tenant_id: str, uom_name: str) -> Optional[Dict[str, Any]]:
    """Create a UOM if it doesn't exist"""
    print_step(f"Creating UOM: {uom_name}...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "doctype": "UOM",
        "uom_name": uom_name
    }
    
    response = requests.post(
        f"{BASE_URL}/api/tenants/{tenant_id}/erpnext/resource/UOM",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        uom_data = response.json()
        print_success(f"UOM created: {uom_name}")
        return uom_data
    elif response.status_code == 409:
        print_warning(f"UOM already exists: {uom_name}")
        return {"exists": True}
    else:
        print_error(f"UOM creation failed: {response.status_code} - {response.text}")
        return None

def create_item(token: str, tenant_id: str, item_code: str, item_name: str, uom: str = "Nos", item_group: str = "Products") -> Optional[Dict[str, Any]]:
    """Create an item"""
    print_step(f"Creating item: {item_name} ({item_code})...")
    
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    payload = {
        "item_code": item_code,
        "item_name": item_name,
        "item_group": item_group,  # Use "Paint" if created, else "Products"
        "stock_uom": uom,  # Use appropriate UOM
        "standard_rate": 0,
        "valuation_rate": 0,
        "is_stock_item": 1
    }
    
    response = requests.post(
        f"{BASE_URL}/api/tenants/{tenant_id}/erp/inventory/items",
        json=payload,
        headers=headers
    )
    
    if response.status_code in [200, 201]:
        item_data = response.json()
        print_success(f"Item created: {item_name}")
        return item_data
    else:
        print_error(f"Item creation failed: {response.status_code} - {response.text}")
        return None

def main():
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  31Paints Tenant Setup Script")
    print(f"{'='*60}{Colors.END}\n")
    
    # Step 1: Login (need a tenant to get token, but we'll create tenant first)
    # For tenant creation, we don't need auth (it's platform admin)
    # But for other operations, we need auth. Let's login first with any tenant
    
    token = login()
    if not token:
        print_warning("Login failed, but continuing for tenant creation (no auth required)")
        token = None
    
    # Step 2: Create Tenant with ERPNext engine
    print_step("Creating 31Paints tenant with ERPNext engine...")
    tenant_result = create_tenant(token) if token else None
    if not tenant_result:
        print_error("Cannot proceed without tenant")
        sys.exit(1)
    
    tenant_id = tenant_result["tenant_id"]
    tenant_name = tenant_result.get("tenant", {}).get("name", "31Paints")
    
    print(f"\n{Colors.GREEN}Tenant ID: {tenant_id}{Colors.END}")
    
    # Check company creation status
    company_info = tenant_result.get("company", {})
    if company_info.get("created"):
        print_success(f"Company '{company_info.get('name')}' created in ERPNext")
    else:
        print_warning("Company creation may have failed - check ERPNext")
    
    # Wait a bit for company creation to complete
    time.sleep(3)
    
    # Step 2.5: Re-login with the new tenant to get proper token
    print_step(f"Logging in with new tenant '{tenant_name}'...")
    tenant_token = login(tenant_id=tenant_id)
    if not tenant_token:
        print_warning("Failed to get token for new tenant, using original token")
        tenant_token = token
    
    if not tenant_token:
        print_error("Cannot proceed without authentication token")
        sys.exit(1)
    
    # Use tenant token for all subsequent operations
    token = tenant_token
    
    # Step 3: Create Warehouses in ERPNext (5 storefronts)
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Creating Warehouses in ERPNext")
    print(f"{'='*60}{Colors.END}")
    
    warehouses = []
    for i in range(1, 6):
        warehouse_name = f"Storefront {i} Warehouse"
        warehouse = create_warehouse(token, tenant_id, warehouse_name)
        if warehouse:
            warehouses.append(warehouse_name)
        time.sleep(1)
    
    # Step 4: Create Users
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Creating Users")
    print(f"{'='*60}{Colors.END}")
    
    users = {}
    
    # Accountant
    accountant = create_user(
        token, tenant_id,
        email="accountant@31paints.com",
        name="Accountant User",
        role="ACCOUNTANT"
    )
    if accountant:
        users["accountant"] = accountant
    
    # Store Keeper
    store_keeper = create_user(
        token, tenant_id,
        email="storekeeper@31paints.com",
        name="Store Keeper",
        role="INVENTORY_MANAGER"
    )
    if store_keeper:
        users["storekeeper"] = store_keeper
    
    # 5 Cashiers (one per storefront)
    for i in range(1, 6):
        cashier = create_user(
            token, tenant_id,
            email=f"cashier{i}@31paints.com",
            name=f"Cashier {i}",
            role="CASHIER"
        )
        if cashier:
            users[f"cashier{i}"] = cashier
        time.sleep(0.5)
    
    # Step 5: Create Master Data (Item Groups, UOMs)
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Creating Master Data in ERPNext")
    print(f"{'='*60}{Colors.END}")
    
    # Create Item Group "Paint"
    paint_group = create_item_group(token, tenant_id, "Paint")
    paint_group_name = "Paint" if paint_group else "Products"
    time.sleep(1)
    
    # Create UOMs if needed
    # Note: "Litre" exists (spelled with 'e'), create "ml" if needed
    create_uom(token, tenant_id, "ml")
    # "Litre", "Nos" already exist - don't need to create
    time.sleep(1)
    
    # Step 6: Create Items in ERPNext (Paint in different sizes)
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  Creating Paint Items in ERPNext")
    print(f"{'='*60}{Colors.END}")
    
    # Map UOM: Use "Litre" (exists) for liters, try "ml" for milliliters
    paint_sizes = [
        ("100ml", "Paint 100ml", "ml", 0.1),  # 100ml = 0.1 Litre
        ("250ml", "Paint 250ml", "ml", 0.25),
        ("500ml", "Paint 500ml", "ml", 0.5),
        ("1L", "Paint 1 Liter", "Litre", 1.0),
        ("2L", "Paint 2 Liters", "Litre", 2.0),
        ("5L", "Paint 5 Liters", "Litre", 5.0),
        ("10L", "Paint 10 Liters", "Litre", 10.0)
    ]
    
    items = []
    for code, name, uom, qty in paint_sizes:
        item = create_item(token, tenant_id, code, name, uom=uom, item_group=paint_group_name)
        if not item:
            # Try with "Litre" if "ml" fails, or "Nos" as last resort
            fallback_uom = "Litre" if uom == "ml" else "Nos"
            item = create_item(token, tenant_id, code, name, uom=fallback_uom, item_group=paint_group_name)
        
        if item:
            items.append(code)
        time.sleep(0.5)
    
    # Summary
    print(f"\n{Colors.GREEN}{'='*60}")
    print("  Setup Summary")
    print(f"{'='*60}{Colors.END}")
    print(f"\n{Colors.GREEN}✓ Tenant: 31Paints")
    print(f"✓ Tenant ID: {tenant_id}")
    print(f"✓ Warehouses: {len(warehouses)} created")
    print(f"  {', '.join(warehouses)}")
    print(f"✓ Users: {len(users)} created")
    for role, user_data in users.items():
        print(f"  - {role}: {user_data.get('user', {}).get('email', 'N/A')}")
    print(f"✓ Items: {len(items)} created")
    print(f"  {', '.join(items)}")
    print(f"\n{Colors.END}")
    
    # Next steps
    print(f"{Colors.BLUE}Next Steps:{Colors.END}")
    print("1. Log in as each user to verify permissions")
    print("2. Create POS profiles for each storefront")
    print("3. Assign warehouses to POS profiles")
    print("4. Set up pricing for paint items")
    print(f"\n{Colors.END}")

if __name__ == "__main__":
    main()
