"""
Seed ERPNext Master Data

Seeds essential master data required for backend operations:
- Customer Groups (Direct, Fundi, Sales Team, Wholesaler)
- Warehouse Types
- Item Groups
- UOMs
- Payment Modes

Author: MoranERP Team
"""

import requests
import json

ERPNEXT_URL = "http://localhost:9010"

def seed_master_data():
    """Seed all required master data"""
    session = requests.Session()
    headers = {"X-Frappe-Site-Name": "moran.localhost"}
    
    # Login
    print("Logging in to ERPNext...")
    login_resp = session.post(
        f"{ERPNEXT_URL}/api/method/login",
        headers=headers,
        data={"usr": "Administrator", "pwd": "admin"}
    )
    
    if login_resp.status_code != 200:
        print(f"✗ Login failed: {login_resp.text}")
        return False
    
    print("✓ Logged in successfully\n")
    
    # 1. Root Customer Group
    print("Creating Root Customer Group...")
    check = session.get(f"{ERPNEXT_URL}/api/resource/Customer Group/All Customer Groups", headers=headers)
    if check.status_code == 404:
        data = {
            "doctype": "Customer Group",
            "customer_group_name": "All Customer Groups",
            "is_group": 1
        }
        resp = session.post(f"{ERPNEXT_URL}/api/resource/Customer Group", headers=headers, json=data)
        if resp.status_code in [200, 201]:
            print(f"  ✓ Created: All Customer Groups")
        else:
            print(f"  ✗ Failed to create root: {resp.status_code}")
    else:
        print(f"  ⚠ Already exists: All Customer Groups")
    
    # 2. Customer Groups
    customer_groups = ["Direct", "Fundi", "Sales Team", "Wholesaler"]
    print("\nCreating Customer Groups...")
    for group in customer_groups:
        check = session.get(f"{ERPNEXT_URL}/api/resource/Customer Group/{group}", headers=headers)
        if check.status_code == 404:
            data = {
                "doctype": "Customer Group",
                "customer_group_name": group,
                "is_group": 0,
                "parent_customer_group": "All Customer Groups"
            }
            resp = session.post(f"{ERPNEXT_URL}/api/resource/Customer Group", headers=headers, json=data)
            if resp.status_code in [200, 201]:
                print(f"  ✓ Created: {group}")
            else:
                print(f"  ✗ Failed to create {group}: {resp.status_code} - {resp.text}")
        else:
            print(f"  ⚠ Already exists: {group}")
    
    # 3. Warehouse Types
    warehouse_types = ["Transit", "Stores", "Work In Progress", "Finished Goods"]
    print("\nCreating Warehouse Types...")
    for wt in warehouse_types:
        check = session.get(f"{ERPNEXT_URL}/api/resource/Warehouse Type/{wt}", headers=headers)
        if check.status_code == 404:
            data = {
                "doctype": "Warehouse Type",
                "name": wt
            }
            resp = session.post(f"{ERPNEXT_URL}/api/resource/Warehouse Type", headers=headers, json=data)
            if resp.status_code in [200, 201]:
                print(f"  ✓ Created: {wt}")
            else:
                print(f"  ✗ Failed to create {wt}: {resp.status_code}")
        else:
            print(f"  ⚠ Already exists: {wt}")
    
    # 4. Item Groups
    item_groups = [
        {"name": "All Item Groups", "is_group": 1, "parent": None},
        {"name": "Products", "is_group": 1, "parent": "All Item Groups"},
        {"name": "Raw Material", "is_group": 0, "parent": "All Item Groups"},
        {"name": "Spices", "is_group": 0, "parent": "Products"},
        {"name": "Consumable", "is_group": 0, "parent": "All Item Groups"}
    ]
    print("\nCreating Item Groups...")
    for ig in item_groups:
        check = session.get(f"{ERPNEXT_URL}/api/resource/Item Group/{ig['name']}", headers=headers)
        if check.status_code == 404:
            data = {
                "doctype": "Item Group",
                "item_group_name": ig["name"],
                "is_group": ig["is_group"]
            }
            if ig["parent"]:
                data["parent_item_group"] = ig["parent"]
            
            resp = session.post(f"{ERPNEXT_URL}/api/resource/Item Group", headers=headers, json=data)
            if resp.status_code in [200, 201]:
                print(f"  ✓ Created: {ig['name']}")
            else:
                print(f"  ✗ Failed to create {ig['name']}: {resp.status_code}")
        else:
            print(f"  ⚠ Already exists: {ig['name']}")
    
    # 5. UOMs
    uoms = ["Kg", "Nos", "Litre", "Meter", "Unit"]
    print("\nCreating UOMs...")
    for uom in uoms:
        check = session.get(f"{ERPNEXT_URL}/api/resource/UOM/{uom}", headers=headers)
        if check.status_code == 404:
            data = {
                "doctype": "UOM",
                "uom_name": uom
            }
            resp = session.post(f"{ERPNEXT_URL}/api/resource/UOM", headers=headers, json=data)
            if resp.status_code in [200, 201]:
                print(f"  ✓ Created: {uom}")
            else:
                print(f"  ✗ Failed to create {uom}: {resp.status_code}")
        else:
            print(f"  ⚠ Already exists: {uom}")
    
    # 6. Mode of Payment
    payment_modes = ["Cash", "Mpesa", "Bank Transfer", "Credit Card"]
    print("\nCreating Payment Modes...")
    for mode in payment_modes:
        check = session.get(f"{ERPNEXT_URL}/api/resource/Mode of Payment/{mode}", headers=headers)
        if check.status_code == 404:
            data = {
                "doctype": "Mode of Payment",
                "mode_of_payment": mode,
                "type": "Cash" if mode == "Cash" else "Bank"
            }
            resp = session.post(f"{ERPNEXT_URL}/api/resource/Mode of Payment", headers=headers, json=data)
            if resp.status_code in [200, 201]:
                print(f"  ✓ Created: {mode}")
            else:
                print(f"  ✗ Failed to create {mode}: {resp.status_code}")
        else:
            print(f"  ⚠ Already exists: {mode}")
    
    print("\n✓ Master data seeding complete!")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("SEEDING ERPNEXT MASTER DATA")
    print("=" * 60)
    print()
    
    seed_master_data()
