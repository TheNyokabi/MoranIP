import requests
import json
import sys

BASE_URL = "http://localhost:9010"
HEADERS = {
    "Authorization": "token mock_key:mock_secret",
    "Content-Type": "application/json"
}

def log(msg):
    print(f"[VERIFY] {msg}")

def check_health():
    try:
        resp = requests.get(f"{BASE_URL}/health", headers=HEADERS)
        if resp.status_code == 200:
            log(f"ERPNext Service is UP: {resp.json().get('engine')}")
            return True
        else:
            log(f"ERPNext Service returned {resp.status_code}")
            return False
    except Exception as e:
        log(f"Failed to connect to ERPNext: {e}")
        return False

def get_items():
    resp = requests.get(f"{BASE_URL}/api/resource/Item", headers=HEADERS)
    if resp.status_code == 200:
        items = resp.json().get('data', [])
        log(f"Found {len(items)} items")
        return items
    return []

def create_customer(name):
    payload = {
        "customer_name": name,
        "customer_type": "Individual",
        "customer_group": "Direct"
    }
    resp = requests.post(f"{BASE_URL}/api/resource/Customer", headers=HEADERS, json=payload)
    if resp.status_code in [200, 201]:
        log(f"Created/Found Customer: {name}")
        return resp.json().get('data', {})
    else:
        log(f"Failed to create customer: {resp.text}")
        return None

def create_invoice(customer, item_code):
    payload = {
        "customer": customer,
        "items": [
            {
                "item_code": item_code,
                "qty": 1,
                "rate": 1000,
                "warehouse": "Stores - MPS" 
            }
        ],
        "payments": [
            {
                "mode_of_payment": "Cash",
                "amount": 1000
            }
        ],
        "is_pos": 1
    }
    resp = requests.post(f"{BASE_URL}/api/resource/Sales Invoice", headers=HEADERS, json=payload)
    if resp.status_code in [200, 201]:
        inv = resp.json().get('data', {})
        log(f"SUCCESS: Created Invoice {inv.get('name')}")
        return inv
    else:
        log(f"Failed to create invoice: {resp.text}")
        return None

def list_accounts():
    resp = requests.get(f"{BASE_URL}/api/resource/Account", headers=HEADERS)
    if resp.status_code == 200:
        accounts = resp.json().get('data', [])
        log(f"Found {len(accounts)} Accounts")
        return accounts
    log("Failed to list Accounts")
    return []

def list_gl_entries():
    resp = requests.get(f"{BASE_URL}/api/resource/GL Entry", headers=HEADERS)
    if resp.status_code == 200:
        entries = resp.json().get('data', [])
        log(f"Found {len(entries)} GL Entries")
        for entry in entries:
             print(f" [GL] {entry.get('posting_date')} | {entry.get('account')} | Dr: {entry.get('debit')} | Cr: {entry.get('credit')}")
        return entries
    log("Failed to list GL Entries")
    return []

def list_invoices():
    resp = requests.get(f"{BASE_URL}/api/resource/Sales Invoice", headers=HEADERS)
    if resp.status_code == 200:
        invoices = resp.json().get('data', [])
        log(f"Current Invoices in DB: {len(invoices)}")
        for inv in invoices:
            print(f" - {inv.get('name')} | {inv.get('customer')} | Total: {inv.get('grand_total')}")
    else:
        log(f"Failed to list invoices: {resp.text}")

def main():
    if not check_health():
        sys.exit(1)

    items = get_items()
    if not items:
        log("No items found. Cannot create invoice.")
        sys.exit(1)
    
    test_item = items[0].get('item_code') or items[0].get('name')
    
    # Verify Accounts exist first
    accounts = list_accounts()
    if not accounts:
        log("No accounts found. Simulator might not be updated.")
        sys.exit(1)

    create_customer("Test Customer A")
    
    log("Creating Test Invoice...")
    create_invoice("Test Customer A", test_item)
    
    log("Verifying GL Postings...")
    list_gl_entries()
    
    log("Verifying Data Persistence...")
    list_invoices()

if __name__ == "__main__":
    main()
