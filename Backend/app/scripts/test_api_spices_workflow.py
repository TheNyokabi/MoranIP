import requests
import json
import time

BASE_URL = "http://localhost:9000"
ERPNEXT_URL = "http://localhost:9010" # Mapped port for verification

# Data for Spices Shop
ADMIN_EMAIL = "admin@spices.com"
ADMIN_PASS = "Admin123!"
TENANT_NAME = "Spices Shop Test"

def print_step(msg):
    print(f"\n>>> {msg}")

def initialize_erpnext_defaults():
    print_step("Initializing ERPNext Defaults (Master Data)")
    try:
        session = requests.Session()
        headers = {"X-Frappe-Site-Name": "moran.localhost"}
        # Login
        login_resp = session.post(f"{ERPNEXT_URL}/api/method/login", headers=headers, data={"usr": "Administrator", "pwd": "admin"})
        if login_resp.status_code != 200:
            print(f"Init Login Failed: {login_resp.text}")
            return False

        # 0. Prerequisites (Warehouse Types, Root IG)
        if session.get(f"{ERPNEXT_URL}/api/resource/Warehouse Type/Transit", headers=headers).status_code == 404:
            print("Creating Warehouse Type 'Transit'...")
            r = session.post(f"{ERPNEXT_URL}/api/resource/Warehouse Type", headers=headers, json={"doctype": "Warehouse Type", "name": "Transit"})
            if r.status_code != 200: print(f"Failed to create WT Transit: {r.status_code} - {r.text}")

        if session.get(f"{ERPNEXT_URL}/api/resource/Item Group/All Item Groups", headers=headers).status_code == 404:
            print("Creating Root Item Group 'All Item Groups'...")
            r = session.post(f"{ERPNEXT_URL}/api/resource/Item Group", headers=headers, json={"doctype": "Item Group", "item_group_name": "All Item Groups", "is_group": 1})
            if r.status_code != 200: print(f"Failed to create Root IG: {r.status_code} - {r.text}")

        # 1. Create Company
        check_r = session.get(f"{ERPNEXT_URL}/api/resource/Company/Paint Shop Ltd", headers=headers)
        print(f"DEBUG: Check Company 'Paint Shop Ltd' -> {check_r.status_code}")
        
        if check_r.status_code == 404 or (check_r.status_code == 200 and "Paint Shop Ltd" not in check_r.text):
             # If it returns 200 but text is HTML login page, it treats as 'exists' which is wrong.
             # Real API returns JSON.
             pass
        
        if check_r.status_code == 404:
            print("Creating Company 'Paint Shop Ltd'...")
            r = session.post(f"{ERPNEXT_URL}/api/resource/Company", headers=headers, json={
                "doctype": "Company", "company_name": "Paint Shop Ltd", "default_currency": "KES", "country": "Kenya", "abbr": "PSL"
            })
            if r.status_code != 200: print(f"Failed to create Company: {r.status_code} - {r.text}")
        
        # 2. Create Item Groups
        for ig in ["Raw Material", "Spices"]:
            check_r = session.get(f"{ERPNEXT_URL}/api/resource/Item Group/{ig}", headers=headers)
            print(f"DEBUG: Check IG '{ig}' -> {check_r.status_code}")
            if check_r.status_code == 404:
                print(f"Creating Item Group '{ig}'...")
                r = session.post(f"{ERPNEXT_URL}/api/resource/Item Group", headers=headers, json={
                    "doctype": "Item Group", "item_group_name": ig, "is_group": 0, "parent_item_group": "All Item Groups"
                })
                if r.status_code != 200: print(f"Failed to create IG {ig}: {r.status_code} - {r.text}")

        # 3. Create UOMs
        for uom in ["Kg", "Nos"]:
             check_r = session.get(f"{ERPNEXT_URL}/api/resource/UOM/{uom}", headers=headers)
             print(f"DEBUG: Check UOM '{uom}' -> {check_r.status_code}")
             if check_r.status_code == 404:
                print(f"Creating UOM '{uom}'...")
                r = session.post(f"{ERPNEXT_URL}/api/resource/UOM", headers=headers, json={
                    "doctype": "UOM", "uom_name": uom
                })
                if r.status_code != 200: print(f"Failed to create UOM {uom}: {r.status_code} - {r.text}")

        return True

    except Exception as e:
        print(f"Initialization Exception: {e}")
        return False

def check_response(resp, expected_code=200):
    if resp.status_code != expected_code:
        print(f"FAILED: {resp.status_code} - {resp.text}")
        return False
    return True

def main():
    print("Starting Spices Shop API End-to-End Test...")
    print("DEBUG: Calling initialize_erpnext_defaults...")
    # Initialize ERPNext with prerequisite data
    initialize_erpnext_defaults()
    print("DEBUG: Init returned.")

    # 1. Create Tenant (Platform Admin)
    print_step("Login as Super Admin")
    # Endpoint is /auth/v1/login-with-tenant (defined in auth.py as /v1/login-with-tenant inside /auth prefix)
    resp = requests.post(f"{BASE_URL}/auth/v1/login-with-tenant", json={
        "email": "admin@example.com", 
        "password": "password"
    })
    
    if not check_response(resp):
        print("Using fallback flow or checking if tenant creation is open...")
    else:
        token = resp.json()["access_token"]
        
    print_step("Creating Tenant 'Spices Shop Test'")
    # Endpoint is /iam/tenants
    tenant_req = {
        "name": TENANT_NAME,
        "category": "Retail",
        "country_code": "KE",
        "admin_email": ADMIN_EMAIL,
        "admin_name": "Spices Admin",
        "admin_password": ADMIN_PASS,
        "engine": "erpnext"
    }
    resp = requests.post(f"{BASE_URL}/iam/tenants", json=tenant_req)
    created_tenant_id = None
    if not check_response(resp):
        if resp.status_code == 409:
             print("Tenant likely exists, proceeding to login...")
        else:
             return
    else:
        print("Tenant Created!")
        created_tenant_id = resp.json().get("tenant", {}).get("id")

    # 2. Login as Spices Admin to get Token & Tenant ID
    print_step("Logging in as Spices Admin")
    login_payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASS
    }
    # If we just created it, pass the ID to avoid selection prompt
    if created_tenant_id:
        login_payload["tenant_id"] = created_tenant_id

    resp = requests.post(f"{BASE_URL}/auth/v1/login-with-tenant", json=login_payload)
    if not check_response(resp): return
    
    data = resp.json()
    
    # Handle selection case if still prompted (e.g. if we didn't pass ID or mismatch)
    if data.get("require_tenant_selection"):
        print("Tenant selection required. Picking 'Spices Shop Test'...")
        tenants = data.get("tenants", [])
        target = next((t for t in tenants if t["name"] == TENANT_NAME), None)
        if not target:
            print("Target tenant not found in user list!")
            return
        
        # Login again with ID
        login_payload["tenant_id"] = target["id"]
        resp = requests.post(f"{BASE_URL}/auth/v1/login-with-tenant", json=login_payload)
        check_response(resp)
        data = resp.json()

    token = data["access_token"]
    tenant_id = data["tenant"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Logged in. Tenant ID: {tenant_id}")

    # 3. Create Warehouses
    print_step("Creating Warehouses")
    warehouses = [
        {"warehouse_name": "Thika Warehouse", "is_group": 0},
        {"warehouse_name": "Nairobi Warehouse", "is_group": 0},
        {"warehouse_name": "Ruiru Warehouse", "is_group": 0}
    ]
    
    for wh in warehouses:
        print(f"Creating {wh['warehouse_name']}...")
        payload = {
            "warehouse_name": wh["warehouse_name"],
            "company": "Paint Shop Ltd" 
        }
        # Endpoint is /erpnext/resource/Warehouse
        resp = requests.post(f"{BASE_URL}/erpnext/resource/Warehouse", headers=headers, json=payload)
        check_response(resp)

    # 4. Create Items
    print_step("Creating Items")
    items = [
        {"item_code": "SPICE-CIN-BULK", "item_name": "Cinnamon Bulk", "item_group": "Raw Material", "stock_uom": "Kg", "valuation_rate": 4000},
        {"item_code": "SPICE-CIN-100G", "item_name": "Cinnamon 100g", "item_group": "Spices", "stock_uom": "Nos", "valuation_rate": 80}
    ]
    
    for item in items:
        print(f"Creating {item['item_code']}...")
        # Endpoint is /erpnext/resource/Item
        resp = requests.post(f"{BASE_URL}/erpnext/resource/Item", headers=headers, json=item)
        if not check_response(resp):
             if "already exists" in resp.text: print("Item exists.")

    # 5. Invite User (Cashier)
    print_step("Inviting Cashier")
    invite_req = {
        "email": "cashier.thika@spices.com",
        "role": "CASHIER",
        "full_name": "Thika Cashier"
    }
    # Endpoint is /iam/tenants/{tenant_id}/invite
    resp = requests.post(f"{BASE_URL}/iam/tenants/{tenant_id}/invite", headers=headers, json=invite_req)
    check_response(resp)
    
    print_step("Verifying Data in Real ERPNext")
    try:
        session = requests.Session()
        headers = {"X-Frappe-Site-Name": "moran.localhost"}
        # Login to ERPNext
        login_resp = session.post(f"{ERPNEXT_URL}/api/method/login", headers=headers, data={"usr": "Administrator", "pwd": "admin"})
        if login_resp.status_code != 200:
             print(f"ERPNext Verification Login Failed: {login_resp.text}")
             return

        r = session.get(f"{ERPNEXT_URL}/api/resource/Item", headers=headers)
        if r.status_code != 200:
            print(f"Simulator/Real ERPNext request failed: {r.status_code} - {r.text}")
            items_list = []
        else:
            items_list = r.json().get('data', [])
            
        codes = [i['name'] for i in items_list] # Real ERPNext often returns 'name' in list view
        print(f"Items in Simulator (Tenant {tenant_id}): {codes}")
        if "SPICE-CIN-BULK" in codes:
            print("SUCCESS: Item SPICE-CIN-BULK found.")
        else:
            print("FAILURE: Item not found.")
            
    except Exception as e:
        print(f"Verification Failed: {e}")

    print("\nTest Complete.")

if __name__ == "__main__":
    main()
