import requests
import json
import os

# Configuration
API_URL = "http://api:8000"
ADMIN_EMAIL = "admin@moran.com"
ADMIN_PASS = "admin123"
TENANT_ID = "f83650c4-ca25-48ce-9d5e-eb5a4d9b166e"  # Using seeded ID, or fetch dynamic if needed

def login():
    print(f"Logging in as {ADMIN_EMAIL}...")
    resp = requests.post(f"{API_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        exit(1)
    
    # Login with tenant to get the correct token
    # First get tenants
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    resp_memberships = requests.get(f"{API_URL}/api/auth/me/memberships", headers=headers)
    memberships = resp_memberships.json()
    if not memberships:
        print("No memberships found.")
        exit(1)
    
    print(f"Memberships found: {json.dumps(memberships, indent=2)}")
        
    target_tenant_id = None
    for m in memberships:
        # Debug structure
        # The structure seems to be flat tenant details with membership info merged
        tenant_name = m.get("name")
        if tenant_name and "Admin Workspace" in tenant_name:
             target_tenant_id = m.get("id")
             break
    
    if not target_tenant_id:
        # Fallback to first available tenant
        print("Could not find 'Admin Workspace', picking first available tenant...")
        if memberships:
             target_tenant_id = memberships[0].get("id")
        
    print(f"Target Tenant ID: {target_tenant_id}")
    
    # Login with specific tenant
    resp_login_tenant = requests.post(f"{API_URL}/api/auth/v1/login-with-tenant", json={
        "email": ADMIN_EMAIL, 
        "password": ADMIN_PASS,
        "tenant_id": target_tenant_id
    })
    
    if resp_login_tenant.status_code != 200:
         print(f"Tenant login failed: {resp_login_tenant.text}")
         exit(1)
         
    return resp_login_tenant.json()["access_token"], target_tenant_id

def check_pos_items(token, tenant_id):
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    print("\nFetching POS Profiles...")
    resp_profiles = requests.get(f"{API_URL}/api/pos/profiles", headers=headers)
    profiles = resp_profiles.json().get("profiles", [])
    print(f"Found {len(profiles)} profiles: {[p.get('name') for p in profiles]}")
    
    if not profiles:
        print("No POS Profiles found! Cannot check stock without a profile/warehouse.")
        return

    profile_id = profiles[0]["name"]
    warehouse = profiles[0].get("warehouse")
    print(f"Using Profile: {profile_id}, Warehouse: {warehouse}")
    
    # Valid Leaf Warehouse Search
    print("\nFetching Warehouses...")
    resp_warehouses = requests.get(f"{API_URL}/api/pos/warehouses?include_all=true", headers=headers)
    warehouses_list = resp_warehouses.json().get("warehouses", [])
    
    leaf_warehouses = []
    print(f"Found {len(warehouses_list)} warehouses.")
    for w in warehouses_list:
        if w.get("is_group") == 0 or w.get("is_group") is False:
             leaf_warehouses.append(w.get("name"))
        # print(f" - {w.get('name')} (Group: {w.get('is_group')})")

    target_wh = next((w for w in warehouses_list if w.get("name") == warehouse or w.get("warehouse_name") == warehouse), None)
    if target_wh:
        print(f"Current Warehouse Details: {json.dumps(target_wh, indent=2)}")
        is_group = target_wh.get("is_group")
        if is_group == 1 or is_group is True:
            print("WARNING: Selected warehouse is a GROUP warehouse! Stock is usually 0 in bins for group warehouses.")
            print(f"Suggested Leaf Warehouses: {leaf_warehouses[:5]}...")
    
    # Check POS Profile Accounts
    print("\nFetching Full POS Profile...")
    resp_profile_detail = requests.get(f"{API_URL}/api/pos/profiles/{profile_id}", headers=headers)
    if resp_profile_detail.status_code == 200:
         print(json.dumps(resp_profile_detail.json(), indent=2))
    else:
         print(f"Failed to fetch profile details: {resp_profile_detail.status_code}")

    print("\nFetching POS Items...")
    resp_items = requests.get(f"{API_URL}/api/pos/items", headers=headers)
    items = resp_items.json().get("items", [])
    print(f"Found {len(profiles)} items.")
    
    if not items:
        print("No items found.")
        return

    # Sample items to check stock for
    sample_items = items[:5]
    item_codes = ["BASE-WHITE-1L", "PIG-BLUE-ML"] + [i["item_code"] for i in sample_items]
    item_codes = list(set(item_codes)) # dedump
    
    print(f"Checking stock for: {item_codes}")

    # Check stock for EACH profile
    for profile in profiles:
        p_id = profile["name"]
        wh = profile.get("warehouse")
        print(f"\n--- Checking Profile: {p_id} (Warehouse: {wh}) ---")
        
        payload = {
            "pos_profile_id": p_id,
            "item_codes": item_codes
        }
        resp_stock = requests.post(f"{API_URL}/api/pos/stock/bulk", json=payload, headers=headers)
        if resp_stock.status_code == 200:
             data = resp_stock.json()
             stocks = data.get("stocks", [])
             has_stock = [s for s in stocks if s["qty"] > 0]
             print(f"Items with stock > 0: {json.dumps(has_stock, indent=2)}")
        else:
             print(f"Error: {resp_stock.text}")

    # Query Global Bin for these items to see where they live
    print("\n--- Global Stock Check (Bin Table) ---")
    # We can't query Bin directly via pos API, but we can infer if we had access.
    # Actually, we can't easily. But since I am running as Admin, I might have access to other endpoints?
    # No, assuming standard API.
    # But I can use the 'scripts' inside container approach if I really need to.
    # For now, let's trust the profile loop.

if __name__ == "__main__":
    token, tenant_id = login()
    check_pos_items(token, tenant_id)
