import requests
import json
import os

# Configuration
API_URL = "http://api:8000"
ADMIN_EMAIL = "admin@moran.com"
ADMIN_PASS = "admin123"

def login():
    print(f"Logging in as {ADMIN_EMAIL}...")
    resp = requests.post(f"{API_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        exit(1)
    
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    resp_memberships = requests.get(f"{API_URL}/api/auth/me/memberships", headers=headers)
    memberships = resp_memberships.json()
    
    target_tenant_id = None
    for m in memberships:
        tenant_name = m.get("name")
        if tenant_name and "Admin Workspace" in tenant_name:
             target_tenant_id = m.get("id")
             break
    
    if not target_tenant_id and memberships:
        target_tenant_id = memberships[0].get("id")
        
    print(f"Target Tenant ID: {target_tenant_id}")
    return token, target_tenant_id

def fix_profile(token, tenant_id):
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_id}
    
    # Get Profile
    print("\nFetching POS Profiles...")
    resp_profiles = requests.get(f"{API_URL}/api/pos/profiles", headers=headers)
    profiles = resp_profiles.json().get("profiles", [])
    
    if not profiles:
        print("No POS Profiles found.")
        return

    profile_id = profiles[0]["name"]
    current_wh = profiles[0].get("warehouse")
    company = profiles[0].get("company")
    print(f"Current Profile: {profile_id}, Warehouse: {current_wh}, Company: {company}")
    
    # Find a valid leaf warehouse for this company
    print("\nFinding valid leaf warehouse...")
    resp_warehouses = requests.get(f"{API_URL}/api/pos/warehouses?include_all=true", headers=headers)
    warehouses_list = resp_warehouses.json().get("warehouses", [])
    
    leaf_wh = None
    # Prefer 'Stores' or 'Finished Goods'
    candidates = ["Stores", "Finished Goods"]
    
    for c in candidates:
        for w in warehouses_list:
            w_name = w.get("name")
            is_group = w.get("is_group")
            # formatting check: "Stores - KIA" usually contains "Stores"
            if c in w_name and (is_group == 0 or is_group is False):
                leaf_wh = w_name
                break
        if leaf_wh:
            break
            
    if not leaf_wh:
        # Pick any leaf
        for w in warehouses_list:
            if w.get("is_group") == 0 or w.get("is_group") is False:
                leaf_wh = w.get("name")
                break
                
    if not leaf_wh:
        print("FATAL: No leaf warehouse found!")
        return
        
    print(f"Selected Leaf Warehouse: {leaf_wh}")
    
    if leaf_wh == current_wh:
        print("Profile already points to this warehouse. No update needed.")
        return

    # Update logic (We need an endpoint to update POS Profile, or create a new one??)
    # The current API might not expose a "Update POS Profile" endpoint directly for admins?
    # Let's check pos.py. There is no update endpoint exposed in provided snippets.
    # But we can use erpnext_adapter proxy to PUT resource/POS Profile/{id}.
    
    # We need to construct the payload cautiously.
    # Usually we just send the fields to update.
    
    print(f"\nUpdating POS Profile '{profile_id}' to use warehouse '{leaf_wh}'...")
    
    # Use proxy endpoint?
    # Actually, we can assume there isn't a direct public proxy for PUT unless I added it.
    # Let's check `pos.py` again? No general proxy.
    # However, I have `erpnext_adapter.proxy_request` available inside the backend, but I am outside.
    # The `pos.py` doesn't expose a generic "update resource" endpoint. 
    # BUT, I can use the `onboarding` or `settings` endpoints? No.
    
    # Wait, the `POST /api/pos/profiles` might exist? Or maybe I should instruct the USER to do it?
    # Or I can ADD a temporary endpoint to `pos.py` to fix this, run it, then remove it.
    # OR, better: `api/pos.py` DOES use `erpnext_adapter`.
    # I can write a small python script that imports `erpnext_adapter` and runs INSIDE the API container.
    # That is safer and easier than trying to route through the public API if endpoints don't exist.
    
    print("This script is intended to run inside API container or via an endpoint.")

if __name__ == "__main__":
    # This logic assumes we can hit an endpoint. detecting if we can't...
    pass
