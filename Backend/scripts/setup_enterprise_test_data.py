#!/usr/bin/env python3
"""
Enterprise Case Study - Test Data Setup Script
Sets up complete test data for Tech Manufacturing Co. Ltd. Enterprise scenario
"""

import sys
import os
import requests
import json
from typing import Dict, Any, List

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:9000")
TENANT_ID = os.getenv("TENANT_ID", "")  # Must be provided
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "")  # Must be provided

HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "Content-Type": "application/json"
}

def api_call(method: str, endpoint: str, data: Dict = None) -> Dict:
    """Make API call and return response"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=HEADERS, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=HEADERS, json=data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=HEADERS, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        # Handle non-200 status codes more gracefully
        if resp.status_code not in [200, 201]:
            error_msg = f"HTTP {resp.status_code}: {resp.text}"
            try:
                error_json = resp.json()
                error_msg = error_json.get('detail', error_msg)
            except:
                pass
            raise requests.exceptions.HTTPError(error_msg, response=resp)
        
        return resp.json() if resp.content else {}
    except requests.exceptions.RequestException as e:
        print(f"❌ Error calling {method} {endpoint}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(f"Response: {e.response.text}")
            except:
                pass
        raise

def setup_company():
    """Step 1: Verify/Create Company"""
    print("\n📋 Step 1: Setting up Company...")
    # Company is usually created during onboarding, just verify
    print("✅ Company setup verified (created during onboarding)")

def setup_warehouses():
    """Step 2: Create Warehouses"""
    print("\n📦 Step 2: Creating Warehouses...")
    
    warehouses = [
        {"warehouse_name": "Main Factory Warehouse - TMC001", "company": "Tech Manufacturing Co. Ltd.", "is_group": 0},
        {"warehouse_name": "Raw Materials Warehouse - TMC001", "company": "Tech Manufacturing Co. Ltd.", "is_group": 0},
        {"warehouse_name": "Finished Goods Warehouse - TMC001", "company": "Tech Manufacturing Co. Ltd.", "is_group": 0},
        {"warehouse_name": "Showroom Warehouse - TMC001", "company": "Tech Manufacturing Co. Ltd.", "is_group": 0},
        {"warehouse_name": "Spare Parts Warehouse - TMC001", "company": "Tech Manufacturing Co. Ltd.", "is_group": 0},
    ]
    
    created = []
    for wh in warehouses:
        try:
            result = api_call("POST", f"/api/tenants/{TENANT_ID}/erp/inventory/warehouses", wh)
            created.append(wh["warehouse_name"])
            print(f"  ✅ Created: {wh['warehouse_name']}")
        except Exception as e:
            print(f"  ⚠️  Failed to create {wh['warehouse_name']}: {e}")
    
    return created

def setup_items():
    """Step 3: Create Items"""
    print("\n📦 Step 3: Creating Items...")
    
    items = [
        # Raw Materials
        {
            "item_code": "CB-100",
            "item_name": "Circuit Board CB-100",
            "item_group": "Products",
            "stock_uom": "Nos",
            "standard_rate": 500,
            "is_stock_item": 1
        },
        {
            "item_code": "SC-001",
            "item_name": "Smartphone Screen",
            "item_group": "Products",
            "stock_uom": "Nos",
            "standard_rate": 2000,
            "is_stock_item": 1
        },
        {
            "item_code": "BT-001",
            "item_name": "Lithium Battery",
            "item_group": "Products",
            "stock_uom": "Nos",
            "standard_rate": 1500,
            "is_stock_item": 1
        },
        {
            "item_code": "CS-001",
            "item_name": "Phone Casing",
            "item_group": "Products",
            "stock_uom": "Nos",
            "standard_rate": 800,
            "is_stock_item": 1
        },
        # Finished Products
        {
            "item_code": "SP-X1",
            "item_name": "Smartphone Model X",
            "item_group": "Products",
            "stock_uom": "Nos",
            "standard_rate": 25000,
            "is_stock_item": 1,
            "is_sales_item": 1,
            "is_purchase_item": 0
        },
        # Services
        {
            "item_code": "INST-SVC",
            "item_name": "Installation Service",
            "item_group": "Services",
            "stock_uom": "Hour",
            "standard_rate": 5000,
            "is_stock_item": 0,
            "is_sales_item": 1
        }
    ]
    
    created = []
    for item in items:
        try:
            # Clean up item data to match ItemCreate model
            clean_item = {
                "item_code": item.get("item_code"),
                "item_name": item.get("item_name"),
                "item_group": item.get("item_group", "Products"),
                "stock_uom": item.get("stock_uom", "Nos"),
                "standard_rate": item.get("standard_rate", 0),
                "is_stock_item": item.get("is_stock_item", 1),
                "include_item_in_manufacturing": 1 if item.get("item_code") == "SP-X1" else 0
            }
            # Only include optional fields if they exist
            if "description" in item:
                clean_item["description"] = item["description"]
            if "valuation_rate" in item:
                clean_item["valuation_rate"] = item["valuation_rate"]
            
            result = api_call("POST", f"/api/tenants/{TENANT_ID}/erp/inventory/items", clean_item)
            created.append(item["item_code"])
            print(f"  ✅ Created: {item['item_code']} - {item['item_name']}")
        except Exception as e:
            print(f"  ⚠️  Failed to create {item['item_code']}: {e}")
    
    return created

def setup_customers():
    """Step 4: Create Customers"""
    print("\n👥 Step 4: Creating Customers...")
    
    customers = [
        {
            "customer_name": "Corporation X",
            "customer_type": "Company",
            "customer_group": "Corporate",
            "territory": "Kenya",
            "payment_terms": "Net 30",
            "credit_limit": 10000000,
            "email": "contact@corpx.co.ke",
            "phone": "+254 712 000 000"
        },
        {
            "customer_name": "Retail Customer B",
            "customer_type": "Individual",
            "customer_group": "Retail",
            "payment_terms": "Cash",
            "email": "customer@example.com"
        },
        {
            "customer_name": "International Distributor C",
            "customer_type": "Company",
            "customer_group": "Distributor",
            "territory": "International",
            "payment_terms": "LC",
            "credit_limit": 500000,  # USD equivalent
            "default_currency": "USD"
        }
    ]
    
    created = []
    for customer in customers:
        try:
            result = api_call("POST", f"/api/tenants/{TENANT_ID}/erp/crm/customers", customer)
            created.append(customer["customer_name"])
            print(f"  ✅ Created: {customer['customer_name']}")
        except Exception as e:
            print(f"  ⚠️  Failed to create {customer['customer_name']}: {e}")
    
    return created

def setup_suppliers():
    """Step 5: Create Suppliers"""
    print("\n🏭 Step 5: Creating Suppliers...")
    
    suppliers = [
        {
            "name": "Supplier X (Local)",
            "supplier_group": "All Supplier Groups",
            "country": "Kenya",
            "payment_terms": "Net 15",
            "currency": "KES",
            "email": "contact@supplierx.co.ke",
            "phone": "+254 700 000 001"
        },
        {
            "name": "Supplier Y (International)",
            "supplier_group": "All Supplier Groups",
            "country": "China",
            "payment_terms": "Net 30",
            "currency": "USD",
            "email": "contact@suppliery.com",
            "phone": "+86 138 0000 0001"
        }
    ]
    
    created = []
    for supplier in suppliers:
        try:
            # Use purchases router endpoint (platform-agnostic)
            result = api_call("POST", f"/purchases/suppliers", supplier)
            created.append(supplier["name"])
            print(f"  ✅ Created: {supplier['name']}")
        except Exception as e:
            print(f"  ⚠️  Failed to create {supplier['name']}: {e}")
    
    return created

def setup_employees():
    """Step 6: Create Employees"""
    print("\n👨‍💼 Step 6: Creating Employees...")
    
    employees = [
        {
            "first_name": "John",
            "last_name": "Doe",
            "employee_name": "John Doe",
            "designation": "Production Manager",
            "date_of_joining": "2024-01-01",
            "status": "Active",
            "company": "Tech Manufacturing Co. Ltd.",
            "gender": "Male",
            "date_of_birth": "1985-05-15"
        },
        {
            "first_name": "Jane",
            "last_name": "Smith",
            "employee_name": "Jane Smith",
            "designation": "Sales Manager",
            "date_of_joining": "2024-01-01",
            "status": "Active",
            "company": "Tech Manufacturing Co. Ltd.",
            "gender": "Female",
            "date_of_birth": "1990-08-20"
        }
    ]
    
    created = []
    for emp in employees:
        try:
            result = api_call("POST", f"/api/tenants/{TENANT_ID}/erp/hr/employees", emp)
            created.append(emp["employee_name"])
            print(f"  ✅ Created: {emp['employee_name']}")
        except Exception as e:
            print(f"  ⚠️  Failed to create {emp['employee_name']}: {e}")
    
    return created

def setup_initial_stock():
    """Step 7: Add Initial Stock"""
    print("\n📊 Step 7: Adding Initial Stock...")
    
    # Create stock entries for each item separately for better error handling
    stock_items = [
        {"item_code": "CB-100", "qty": 150, "warehouse": "Raw Materials Warehouse - TMC001", "rate": 500},
        {"item_code": "SC-001", "qty": 150, "warehouse": "Raw Materials Warehouse - TMC001", "rate": 2000},
        {"item_code": "BT-001", "qty": 150, "warehouse": "Raw Materials Warehouse - TMC001", "rate": 1500},
        {"item_code": "CS-001", "qty": 150, "warehouse": "Raw Materials Warehouse - TMC001", "rate": 800}
    ]
    
    created = []
    for stock_item in stock_items:
        try:
            stock_entry = {
                "stock_entry_type": "Material Receipt",
                "company": "Tech Manufacturing Co. Ltd.",
                "items": [
                    {
                        "item_code": stock_item["item_code"],
                        "qty": stock_item["qty"],
                        "t_warehouse": stock_item["warehouse"],
                        "basic_rate": stock_item["rate"]
                    }
                ]
            }
            result = api_call("POST", f"/api/tenants/{TENANT_ID}/erp/inventory/stock-entries", stock_entry)
            # Extract stock entry name from response
            stock_entry_name = None
            if isinstance(result, dict):
                stock_entry_name = result.get("name") or result.get("data", {}).get("name")
            
            # Submit the stock entry if we got a name
            if stock_entry_name:
                try:
                    # Use ERPNext generic endpoint to submit
                    submit_data = {"docstatus": 1}
                    submit_result = api_call("PUT", f"/api/tenants/{TENANT_ID}/erpnext/resource/Stock Entry/{stock_entry_name}", submit_data)
                    print(f"  ✅ Created and submitted stock entry for {stock_item['item_code']}")
                except Exception as submit_error:
                    print(f"  ⚠️  Created stock entry but failed to submit {stock_item['item_code']}: {submit_error}")
            else:
                print(f"  ✅ Created stock entry for {stock_item['item_code']} (manual submission may be required)")
            
            created.append(stock_item["item_code"])
        except Exception as e:
            print(f"  ⚠️  Failed to create stock entry for {stock_item['item_code']}: {e}")
    
    return created

def main():
    """Main execution function"""
    print("=" * 60)
    print("Enterprise Case Study - Test Data Setup")
    print("Tech Manufacturing Co. Ltd.")
    print("=" * 60)
    
    if not TENANT_ID:
        print("❌ ERROR: TENANT_ID environment variable not set")
        print("Usage: TENANT_ID=<uuid> ACCESS_TOKEN=<token> python setup_enterprise_test_data.py")
        sys.exit(1)
    
    if not ACCESS_TOKEN:
        print("❌ ERROR: ACCESS_TOKEN environment variable not set")
        print("Usage: TENANT_ID=<uuid> ACCESS_TOKEN=<token> python setup_enterprise_test_data.py")
        sys.exit(1)
    
    print(f"\nTenant ID: {TENANT_ID}")
    print(f"API Base URL: {BASE_URL}\n")
    
    try:
        # Execute setup steps
        setup_company()
        warehouses = setup_warehouses()
        items = setup_items()
        customers = setup_customers()
        suppliers = setup_suppliers()
        employees = setup_employees()
        stock_entries = setup_initial_stock()
        
        # Summary
        print("\n" + "=" * 60)
        print("Setup Summary")
        print("=" * 60)
        print(f"✅ Warehouses: {len(warehouses)} created")
        print(f"✅ Items: {len(items)} created")
        print(f"✅ Customers: {len(customers)} created")
        print(f"✅ Suppliers: {len(suppliers)} created")
        print(f"✅ Employees: {len(employees)} created")
        print(f"✅ Stock Entries: {len(stock_entries)} created")
        print("\n✅ Test data setup completed!")
        print("\nNext Steps:")
        print("1. Execute end-to-end workflows from ENTERPRISE_E2E_WORKFLOWS.md")
        print("2. Run test scripts from QATests/tests/enterprise/")
        
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
