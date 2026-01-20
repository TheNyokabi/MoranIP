#!/usr/bin/env python3
"""
TechMart Electronics - Comprehensive Retail Case Study
========================================================

This script demonstrates a complete end-to-end retail business workflow
across all major ERP modules: IAM, Inventory, Purchasing, Sales, CRM, and Finance.

Business Scenario:
- Electronics retail store sourcing from suppliers
- Managing inventory across warehouses
- Processing sales to individuals and corporates
- Handling multiple payment methods
- Tracking performance across the dashboard

Usage:
    python case_study_techmart.py
"""

import sys
import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import requests
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.panel import Panel
from rich import print as rprint

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

console = Console()

# Configuration
# When running inside Docker, use internal hostname; otherwise use localhost
BASE_URL = os.getenv("API_BASE_URL", "http://api:8000" if os.path.exists("/.dockerenv") else "http://localhost:9000")
# Use superadmin credentials
ADMIN_EMAIL = "admin@moran"
ADMIN_PASSWORD = "admin123"


class TechMartCaseStudy:
    """Main class to execute the TechMart Electronics case study"""

    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.global_token: Optional[str] = None
        self.tenant_token: Optional[str] = None
        self.tenant_id: Optional[str] = None
        self.tenant_slug: Optional[str] = None
        self.user_email: str = ADMIN_EMAIL
        self.user_password: str = ADMIN_PASSWORD
        
        # Store created entities
        self.entities = {
            "tenant": None,
            "users": [],
            "products": [],
            "warehouses": [],
            "suppliers": [],
            "purchase_orders": [],
            "customers": [],
            "sales_orders": [],
            "invoices": [],
            "payments": []
        }
        
        self.results_summary = {
            "total_steps": 0,
            "successful_steps": 0,
            "failed_steps": 0,
            "start_time": None,
            "end_time": None
        }

    def log_step(self, step: str, status: str = "info"):
        """Log execution step with color"""
        colors = {
            "info": "cyan",
            "success": "green",
            "error": "red",
            "warning": "yellow"
        }
        console.print(f"[{colors.get(status, 'white')}]{'[✓]' if status == 'success' else '[→]'} {step}[/]")

    def make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        use_tenant_token: bool = False,
        expected_status: List[int] = None
    ) -> Optional[Dict]:
        """Make HTTP request with proper authentication"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if use_tenant_token and self.tenant_token:
            headers["Authorization"] = f"Bearer {self.tenant_token}"
        elif self.global_token:
            headers["Authorization"] = f"Bearer {self.global_token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            expected_status = expected_status or [200, 201]
            
            if response.status_code in expected_status:
                self.results_summary["successful_steps"] += 1
                return response.json() if response.content else {}
            else:
                self.results_summary["failed_steps"] += 1
                console.print(f"[red]Request failed: {response.status_code} - {response.text}[/]")
                return None
                
        except Exception as e:
            self.results_summary["failed_steps"] += 1
            console.print(f"[red]Exception during request: {str(e)}[/]")
            return None


    # ==================== STEP 1: Register & Authentication ====================
    
    def register_user(self):
        """Register a new test user"""
        self.log_step("Step 1a: Registering test user")
        self.results_summary["total_steps"] += 1
        
        result = self.make_request(
            "POST",
            "/iam/users/register",
            {
                "email": self.user_email,
                "password": self.user_password,
                "full_name": "Test User TechMart"
            },
            expected_status=[200, 201, 409]  # 409 if already exists
        )
        
        if result:
            self.log_step("User registered or already exists", "success")
            return True
        
        # If registration endpoint doesn't exist, try to continue with authentication anyway
        self.log_step("Registration endpoint may not exist, continuing...", "warning")
        return True
    
    def authenticate(self):
        """Authenticate and get global token"""
        self.log_step("Step 1b: Authenticating test user")
        self.results_summary["total_steps"] += 1
        
        result = self.make_request(
            "POST",
            "/auth/login",
            {"email": self.user_email, "password": self.user_password}
        )
        
        if result and "user_id" in result:
            # Global login successful, now need to get a tenant token later
            self.log_step("Authentication successful", "success")
            return True
        
        self.log_step("Authentication failed", "error")
        return False

    # ==================== STEP 2: Create Tenant ====================
    
    def create_tenant(self):
        """Create TechMart Electronics tenant"""
        self.log_step("Step 2: Creating TechMart Electronics tenant")
        self.results_summary["total_steps"] += 1
        
        tenant_data = {
            "name": "TechMart Electronics",
            "slug": f"techmart-{int(time.time())}",
            "contact_email": "admin@techmart.com",
            "business_type": "retail",
            "admin_email": self.user_email,  # Required field
            "admin_name": "System Administrator",  # Required field
            "admin_password": self.user_password,  # Required field
            "settings": {
                "currency": "KES",
                "timezone": "Africa/Nairobi"
            }
        }
        
        result = self.make_request("POST", "/iam/tenants", tenant_data)
        
        # API returns: {"message": "...", "tenant": {...}, "admin": {...}}
        if result and "tenant" in result:
            tenant = result["tenant"]
            self.entities["tenant"] = tenant
            self.tenant_id = tenant["id"]
            self.tenant_slug = tenant.get("slug", tenant.get("code", "unknown"))
            self.log_step(f"Tenant created: {tenant['name']} (ID: {self.tenant_id})", "success")
            return True
        elif result and "id" in result:
            # Fallback for different response format
            self.entities["tenant"] = result
            self.tenant_id = result["id"]
            self.tenant_slug = result.get("slug", result.get("code", "unknown"))
            self.log_step(f"Tenant created: {result['name']} (ID: {self.tenant_id})", "success")
            return True
        
        self.log_step("Tenant creation failed", "error")
        return False

    def get_tenant_token(self):
        """Get scoped token for tenant"""
        self.log_step("Getting scoped tenant token")
        self.results_summary["total_steps"] += 1
        
        result = self.make_request(
            "POST",
            "/auth/v1/login-with-tenant",
            {
                "email": self.user_email,
                "password": self.user_password,
                "tenant_id": self.tenant_id
            }
        )
        
        if result and "access_token" in result:
            self.tenant_token = result["access_token"]
            self.log_step("Tenant token acquired", "success")
            return True
        
        self.log_step("Failed to get tenant token", "error")
        return False

    # ==================== STEP 3: Create Products ====================
    
    def create_products(self):
        """Create product catalog"""
        self.log_step("Step 3: Creating product catalog (12 products)")
        
        products = [
            # Laptops
            {"item_code": "LAP-DELL-XPS13", "item_name": "Dell XPS 13", "item_group": "Products", "standard_rate": 125000, "stock_uom": "Nos"},
            {"item_code": "LAP-MAC-PRO14", "item_name": "MacBook Pro 14\"", "item_group": "Products", "standard_rate": 250000, "stock_uom": "Nos"},
            {"item_code": "LAP-HP-PAV15", "item_name": "HP Pavilion 15", "item_group": "Products", "standard_rate": 85000, "stock_uom": "Nos"},
            
            # Smartphones
            {"item_code": "PHN-IP15-PRO", "item_name": "iPhone 15 Pro", "item_group": "Products", "standard_rate": 150000, "stock_uom": "Nos"},
            {"item_code": "PHN-SAM-S24", "item_name": "Samsung Galaxy S24", "item_group": "Products", "standard_rate": 120000, "stock_uom": "Nos"},
            {"item_code": "PHN-PIX-8", "item_name": "Google Pixel 8", "item_group": "Products", "standard_rate": 95000, "stock_uom": "Nos"},
            
            # Accessories
            {"item_code": "ACC-USBC-CABLE", "item_name": "USB-C Cable 2m", "item_group": "Products", "standard_rate": 1200, "stock_uom": "Nos"},
            {"item_code": "ACC-MOUSE-LOG", "item_name": "Logitech MX Master 3", "item_group": "Products", "standard_rate": 8500, "stock_uom": "Nos"},
            {"item_code": "ACC-KB-MECH", "item_name": "Mechanical Keyboard RGB", "item_group": "Products", "standard_rate": 12000, "stock_uom": "Nos"},
            {"item_code": "ACC-HP-SONY", "item_name": "Sony WH-1000XM5 Headphones", "item_group": "Products", "standard_rate": 35000, "stock_uom": "Nos"},
            {"item_code": "ACC-HD-1TB", "item_name": "External HDD 1TB", "item_group": "Products", "standard_rate": 6500, "stock_uom": "Nos"},
            {"item_code": "ACC-CHARGER-65W", "item_name": "USB-C Charger 65W", "item_group": "Products", "standard_rate": 4500, "stock_uom": "Nos"},
        ]
        
        for product in products:
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/api/tenants/{self.tenant_id}/erp/inventory/items",
                product,
                use_tenant_token=True
            )
            
            if result:
                self.entities["products"].append(result)
                console.print(f"  [green]✓[/] {product['item_name']} - KES {product['standard_rate']:,}")
            else:
                console.print(f"  [red]✗[/] Failed to create {product['item_name']}")
        
        self.log_step(f"Created {len(self.entities['products'])} products", "success")
        return len(self.entities["products"]) > 0

    # ==================== STEP 4: Create Warehouses ====================
    
    def create_warehouses(self):
        """Create warehouse locations"""
        self.log_step("Step 4: Creating warehouses")
        
        warehouses = [
            {
                "warehouse_name": "WH-MAIN",
                "warehouse_name": "Main Warehouse",
                "location": "Nairobi Industrial Area",
                "type": "storage"
            },
            {
                "warehouse_name": "WH-RETAIL",
                "warehouse_name": "Retail Floor",
                "location": "Westlands Shopping Mall",
                "type": "retail"
            }
        ]
        
        for warehouse in warehouses:
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/api/tenants/{self.tenant_id}/erp/inventory/warehouses",
                warehouse,
                use_tenant_token=True
            )
            
            if result:
                self.entities["warehouses"].append(result)
                console.print(f"  [green]✓[/] {warehouse['name']}")
            else:
                console.print(f"  [red]✗[/] Failed to create {warehouse['name']}")
        
        self.log_step(f"Created {len(self.entities['warehouses'])} warehouses", "success")
        return len(self.entities["warehouses"]) > 0

    # ==================== STEP 5: Create Suppliers ====================
    
    def create_suppliers(self):
        """Create supplier companies"""
        self.log_step("Step 5: Creating suppliers")
        
        suppliers = [
            {
                "item_name": "Tech Distributors Ltd",
                "contact_person": "John Kimani",
                "email": "john@techdist.com",
                "phone": "+254712345001",
                "item_group": "Products"
            },
            {
                "item_name": "Mobile World Suppliers",
                "contact_person": "Jane Wanjiku",
                "email": "jane@mobileworld.com",
                "phone": "+254712345002",
                "item_group": "Products"
            },
            {
                "item_name": "Accessory Hub Kenya",
                "contact_person": "Peter Omondi",
                "email": "peter@accessoryhub.com",
                "phone": "+254712345003",
                "item_group": "Products"
            }
        ]
        
        for supplier in suppliers:
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/tenants/{self.tenant_id}/purchases/suppliers",
                supplier,
                use_tenant_token=True
            )
            
            if result:
                self.entities["suppliers"].append(result)
                console.print(f"  [green]✓[/] {supplier['name']}")
            else:
                console.print(f"  [red]✗[/] Failed to create {supplier['name']}")
        
        self.log_step(f"Created {len(self.entities['suppliers'])} suppliers", "success")
        return len(self.entities["suppliers"]) > 0

    # ==================== STEP 6: Create Purchase Orders ====================
    
    def create_purchase_orders(self):
        """Create purchase orders to stock inventory"""
        self.log_step("Step 6: Creating purchase orders")
        
        if not self.entities["suppliers"] or not self.entities["products"]:
            self.log_step("Missing suppliers or products", "error")
            return False
        
        # PO 1: Laptops
        po1 = {
            "supplier_id": self.entities["suppliers"][0]["id"],
            "order_date": datetime.now().isoformat(),
            "expected_delivery": (datetime.now() + timedelta(days=7)).isoformat(),
            "items": [
                {"item_code": "LAP-DELL-XPS13", "quantity": 10, "unit_price": 120000},
                {"item_code": "LAP-MAC-PRO14", "quantity": 5, "unit_price": 240000},
                {"item_code": "LAP-HP-PAV15", "quantity": 15, "unit_price": 80000},
            ],
            "status": "draft"
        }
        
        # PO 2: Smartphones
        po2 = {
            "supplier_id": self.entities["suppliers"][1]["id"],
            "order_date": datetime.now().isoformat(),
            "expected_delivery": (datetime.now() + timedelta(days=5)).isoformat(),
            "items": [
                {"item_code": "PHN-IP15-PRO", "quantity": 8, "unit_price": 145000},
                {"item_code": "PHN-SAM-S24", "quantity": 12, "unit_price": 115000},
                {"item_code": "PHN-PIX-8", "quantity": 10, "unit_price": 92000},
            ],
            "status": "draft"
        }
        
        # PO 3: Accessories
        po3 = {
            "supplier_id": self.entities["suppliers"][2]["id"],
            "order_date": datetime.now().isoformat(),
            "expected_delivery": (datetime.now() + timedelta(days=3)).isoformat(),
            "items": [
                {"item_code": "ACC-USBC-CABLE", "quantity": 50, "unit_price": 1000},
                {"item_code": "ACC-MOUSE-LOG", "quantity": 20, "unit_price": 8000},
                {"item_code": "ACC-KB-MECH", "quantity": 15, "unit_price": 11000},
                {"item_code": "ACC-HP-SONY", "quantity": 10, "unit_price": 33000},
                {"item_code": "ACC-HD-1TB", "quantity": 25, "unit_price": 6000},
                {"item_code": "ACC-CHARGER-65W", "quantity": 30, "unit_price": 4200},
            ],
            "status": "draft"
        }
        
        for i, po_data in enumerate([po1, po2, po3], 1):
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/tenants/{self.tenant_id}/purchases/orders",
                po_data,
                use_tenant_token=True
            )
            
            if result:
                self.entities["purchase_orders"].append(result)
                total_value = sum(item["quantity"] * item["unit_price"] for item in po_data["items"])
                console.print(f"  [green]✓[/] PO-{i:03d} - {len(po_data['items'])} items - KES {total_value:,}")
            else:
                console.print(f"  [red]✗[/] Failed to create PO-{i:03d}")
        
        self.log_step(f"Created {len(self.entities['purchase_orders'])} purchase orders", "success")
        return len(self.entities["purchase_orders"]) > 0

    # ==================== STEP 7: Create Customers ====================
    
    def create_customers(self):
        """Create customer records"""
        self.log_step("Step 7: Creating customers")
        
        customers = [
            {
                "item_name": "Mary Njeri",
                "type": "individual",
                "email": "mary.njeri@email.com",
                "phone": "+254720111001",
                "customer_group": "Walk-in"
            },
            {
                "item_name": "David Kiprop",
                "type": "individual",
                "email": "david.k@email.com",
                "phone": "+254720111002",
                "customer_group": "Walk-in"
            },
            {
                "item_name": "Sarah Mwangi",
                "type": "individual",
                "email": "sarah.m@email.com",
                "phone": "+254720111003",
                "customer_group": "Regular"
            },
            {
                "item_name": "StartupCo Inc.",
                "type": "corporate",
                "email": "procurement@startupco.com",
                "phone": "+254720222001",
                "customer_group": "Corporate",
                "payment_terms": "Net 30"
            }
        ]
        
        for customer in customers:
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/api/tenants/{self.tenant_id}/crm/customers",
                customer,
                use_tenant_token=True,
                expected_status=[200, 201, 404]  # Accept 404 if endpoint not implemented
            )
            
            if result:
                self.entities["customers"].append(result)
                console.print(f"  [green]✓[/] {customer['name']} ({customer['type']})")
            else:
                console.print(f"  [yellow]⚠[/] Customer endpoint may not be available - {customer['name']}")
        
        self.log_step(f"Attempted to create {len(customers)} customers", "warning" if not self.entities["customers"] else "success")
        return True  # Continue even if this fails

    # ==================== STEP 8: Create Sales Orders ====================
    
    def create_sales_orders(self):
        """Create sales orders for customers"""
        self.log_step("Step 8: Creating sales orders")
        
        if not self.entities["customers"]:
            self.log_step("No customers available, skipping sales orders", "warning")
            return True
        
        # Sales Order 1: Mary Njeri - Laptop + Accessories
        so1 = {
            "customer_id": self.entities["customers"][0]["id"] if len(self.entities["customers"]) > 0 else None,
            "customer_name": "Mary Njeri",
            "order_date": datetime.now().isoformat(),
            "delivery_date": (datetime.now() + timedelta(days=2)).isoformat(),
            "items": [
                {"item_code": "LAP-DELL-XPS13", "quantity": 1, "unit_price": 125000},
                {"item_code": "ACC-MOUSE-LOG", "quantity": 1, "unit_price": 8500},
                {"item_code": "ACC-USBC-CABLE", "quantity": 2, "unit_price": 1200},
            ],
            "status": "confirmed",
            "payment_method": "cash"
        }
        
        # Sales Order 2: David Kiprop - Smartphones
        so2 = {
            "customer_id": self.entities["customers"][1]["id"] if len(self.entities["customers"]) > 1 else None,
            "customer_name": "David Kiprop",
            "order_date": datetime.now().isoformat(),
            "delivery_date": (datetime.now() + timedelta(days=1)).isoformat(),
            "items": [
                {"item_code": "PHN-SAM-S24","quantity": 2, "unit_price": 120000},
                {"item_code": "ACC-CHARGER-65W", "quantity": 2, "unit_price": 4500},
            ],
            "status": "confirmed",
            "payment_method": "mpesa"
        }
        
        # Sales Order 3: Sarah Mwangi - Premium Accessories
        so3 = {
            "customer_id": self.entities["customers"][2]["id"] if len(self.entities["customers"]) > 2 else None,
            "customer_name": "Sarah Mwangi",
            "order_date": datetime.now().isoformat(),
            "delivery_date": (datetime.now() + timedelta(days=1)).isoformat(),
            "items": [
                {"item_code": "ACC-HP-SONY", "quantity": 1, "unit_price": 35000},
                {"item_code": "ACC-KB-MECH", "quantity": 1, "unit_price": 12000},
            ],
            "status": "confirmed",
            "payment_method": "card"
        }
        
        # Sales Order 4: StartupCo Inc. - Corporate Bulk Order
        so4 = {
            "customer_id": self.entities["customers"][3]["id"] if len(self.entities["customers"]) > 3 else None,
            "customer_name": "StartupCo Inc.",
            "order_date": datetime.now().isoformat(),
            "delivery_date": (datetime.now() + timedelta(days=5)).isoformat(),
            "items": [
                {"item_code": "LAP-MAC-PRO14", "quantity": 5, "unit_price": 250000},
                {"item_code": "ACC-MOUSE-LOG", "quantity": 5, "unit_price": 8500},
                {"item_code": "ACC-KB-MECH", "quantity": 5, "unit_price": 12000},
                {"item_code": "ACC-HD-1TB", "quantity": 10, "unit_price": 6500},
            ],
            "status": "confirmed",
            "payment_method": "bank_transfer",
            "payment_terms": "Net 30"
        }
        
        for i, so_data in enumerate([so1, so2, so3, so4], 1):
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/tenants/{self.tenant_id}/sales/orders",
                so_data,
                use_tenant_token=True,
                expected_status=[200, 201, 404]  # Accept 404 if endpoint not available
            )
            
            if result:
                self.entities["sales_orders"].append(result)
                total_value = sum(item["quantity"] * item["unit_price"] for item in so_data["items"])
                console.print(f"  [green]✓[/] SO-{i:03d} - {so_data['customer_name']} - KES {total_value:,}")
            else:
                console.print(f"  [yellow]⚠[/] Sales order endpoint may not be available - SO-{i:03d}")
        
        self.log_step(f"Attempted to create {len([so1, so2, so3, so4])} sales orders", 
                     "success" if self.entities["sales_orders"] else "warning")
        return True

    # ==================== STEP 9: Generate Invoices ====================
    
    def create_invoices(self):
        """Generate invoices from sales orders"""
        self.log_step("Step 9: Generating invoices")
        
        if not self.entities["sales_orders"]:
            self.log_step("No sales orders available, creating invoices manually", "warning")
        
        # Invoice 1: Mary Njeri
        inv1 = {
            "customer_name": "Mary Njeri",
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "items": [
                {"description": "Dell XPS 13 Laptop", "quantity": 1, "unit_price": 125000},
                {"description": "Logitech MX Master 3 Mouse", "quantity": 1, "unit_price": 8500},
                {"description": "USB-C Cable 2m", "quantity": 2, "unit_price": 1200},
            ],
            "tax_rate": 0.16,  # 16% VAT
            "status": "unpaid",
            "payment_method": "cash"
        }
        
        # Invoice 2: David Kiprop
        inv2 = {
            "customer_name": "David Kiprop",
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "items": [
                {"description": "Samsung Galaxy S24", "quantity": 2, "unit_price": 120000},
                {"description": "USB-C Charger 65W", "quantity": 2, "unit_price": 4500},
            ],
            "tax_rate": 0.16,
            "status": "unpaid",
            "payment_method": "mpesa"
        }
        
        # Invoice 3: Sarah Mwangi
        inv3 = {
            "customer_name": "Sarah Mwangi",
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            "items": [
                {"description": "Sony WH-1000XM5 Headphones", "quantity": 1, "unit_price": 35000},
                {"description": "Mechanical Keyboard RGB", "quantity": 1, "unit_price": 12000},
            ],
            "tax_rate": 0.16,
            "status": "unpaid",
            "payment_method": "card"
        }
        
        # Invoice 4: StartupCo Inc.
        inv4 = {
            "customer_name": "StartupCo Inc.",
            "invoice_date": datetime.now().isoformat(),
            "due_date": (datetime.now() + timedelta(days=30)).isoformat(),  # Net 30
            "items": [
                {"description": "MacBook Pro 14\" (Bulk)", "quantity": 5, "unit_price": 250000},
                {"description": "Logitech MX Master 3 Mouse", "quantity": 5, "unit_price": 8500},
                {"description": "Mechanical Keyboard RGB", "quantity": 5, "unit_price": 12000},
                {"description": "External HDD 1TB", "quantity": 10, "unit_price": 6500},
            ],
            "tax_rate": 0.16,
            "status": "unpaid",
            "payment_method": "bank_transfer"
        }
        
        for i, inv_data in enumerate([inv1, inv2, inv3, inv4], 1):
            self.results_summary["total_steps"] += 1
            
            # Calculate totals
            subtotal = sum(item["quantity"] * item["unit_price"] for item in inv_data["items"])
            tax = subtotal * inv_data["tax_rate"]
            total = subtotal + tax
            
            inv_data["subtotal"] = subtotal
            inv_data["tax_amount"] = tax
            inv_data["total_amount"] = total
            
            result = self.make_request(
                "POST",
                f"/api/tenants/{self.tenant_id}/accounting/sales-invoices",
                inv_data,
                use_tenant_token=True,
                expected_status=[200, 201, 404]  # Accept 404 if endpoint not available
            )
            
            if result:
                self.entities["invoices"].append(result)
                console.print(f"  [green]✓[/] INV-{i:03d} - {inv_data['customer_name']} - KES {total:,.2f}")
            else:
                console.print(f"  [yellow]⚠[/] Invoice endpoint may not be available - INV-{i:03d}")
        
        self.log_step(f"Attempted to create {len([inv1, inv2, inv3, inv4])} invoices", 
                     "success" if self.entities["invoices"] else "warning")
        return True

    # ==================== STEP 10: Process Payments ====================
    
    def process_payments(self):
        """Process payments for invoices"""
        self.log_step("Step 10: Processing payments")
        
        # Payment 1: Mary Njeri - Cash
        pmt1 = {
            "customer_name": "Mary Njeri",
            "payment_date": datetime.now().isoformat(),
            "amount": 135900,  # 125000 + 8500 + 2400 with tax
            "payment_method": "cash",
            "reference": f"CASH-{int(time.time())}-001",
            "status": "completed"
        }
        
        # Payment 2: David Kiprop - M-Pesa
        pmt2 = {
            "customer_name": "David Kiprop",
            "payment_date": datetime.now().isoformat(),
            "amount": 289040,  # (240000 + 9000) * 1.16
            "payment_method": "mpesa",
            "reference": f"MPESA-{int(time.time())}-002",
            "mpesa_code": f"QRX{int(time.time())}",
            "status": "completed"
        }
        
        # Payment 3: Sarah Mwangi - Card
        pmt3 = {
            "customer_name": "Sarah Mwangi",
            "payment_date": datetime.now().isoformat(),
            "amount": 54520,  # (35000 + 12000) * 1.16
            "payment_method": "card",
            "reference": f"CARD-{int(time.time())}-003",
            "card_last_4": "4532",
            "status": "completed"
        }
        
        # Payment 4: StartupCo Inc. - Partial Payment (Corporate)
        pmt4 = {
            "customer_name": "StartupCo Inc.",
            "payment_date": datetime.now().isoformat(),
            "amount": 750000,  # Partial payment (50% down payment)
            "payment_method": "bank_transfer",
            "reference": f"BANK-{int(time.time())}-004",
            "bank_reference": f"TRF{int(time.time())}",
            "status": "completed",
            "notes": "50% down payment, balance due Net 30"
        }
        
        for i, pmt_data in enumerate([pmt1, pmt2, pmt3, pmt4], 1):
            self.results_summary["total_steps"] += 1
            result = self.make_request(
                "POST",
                f"/api/tenants/{self.tenant_id}/accounting/payment-entries",
                pmt_data,
                use_tenant_token=True,
                expected_status=[200, 201, 404]  # Accept 404 if endpoint not available
            )
            
            if result:
                self.entities["payments"].append(result)
                console.print(f"  [green]✓[/] PMT-{i:03d} - {pmt_data['customer_name']} - KES {pmt_data['amount']:,.2f} ({pmt_data['payment_method']})")
            else:
                console.print(f"  [yellow]⚠[/] Payment endpoint may not be available - PMT-{i:03d}")
        
        self.log_step(f"Attempted to process {len([pmt1, pmt2, pmt3, pmt4])} payments", 
                     "success" if self.entities["payments"] else "warning")
        return True

    # ==================== STEP 11: Generate Summary Report ====================
    
    def generate_summary_report(self):
        """Generate and display comprehensive summary"""
        console.clear()
        
        # Header
        console.print(Panel.fit(
            "[bold cyan]TechMart Electronics - Case Study Execution Report[/]",
            border_style="cyan"
        ))
        console.print()
        
        # Execution Summary
        duration = (self.results_summary["end_time"] - self.results_summary["start_time"]).total_seconds()
        success_rate = (self.results_summary["successful_steps"] / self.results_summary["total_steps"] * 100) if self.results_summary["total_steps"] > 0 else 0
        
        summary_table = Table(title="Execution Summary", show_header=True, header_style="bold magenta")
        summary_table.add_column("Metric", style="cyan")
        summary_table.add_column("Value", style="green")
        
        summary_table.add_row("Total Steps", str(self.results_summary["total_steps"]))
        summary_table.add_row("Successful", str(self.results_summary["successful_steps"]))
        summary_table.add_row("Failed", str(self.results_summary["failed_steps"]))
        summary_table.add_row("Success Rate", f"{success_rate:.1f}%")
        summary_table.add_row("Duration", f"{duration:.2f}s")
        
        console.print(summary_table)
        console.print()
        
        # Entities Created
        entities_table = Table(title="Entities Created", show_header=True, header_style="bold yellow")
        entities_table.add_column("Entity Type", style="cyan")
        entities_table.add_column("Count", justify="right", style="green")
        
        entities_table.add_row("Tenant", "1" if self.entities["tenant"] else "0")
        entities_table.add_row("Products", str(len(self.entities["products"])))
        entities_table.add_row("Warehouses", str(len(self.entities["warehouses"])))
        entities_table.add_row("Suppliers", str(len(self.entities["suppliers"])))
        entities_table.add_row("Purchase Orders", str(len(self.entities["purchase_orders"])))
        entities_table.add_row("Customers", str(len(self.entities["customers"])))
        entities_table.add_row("Sales Orders", str(len(self.entities["sales_orders"])))
        entities_table.add_row("Invoices", str(len(self.entities["invoices"])))
        entities_table.add_row("Payments", str(len(self.entities["payments"])))
        
        console.print(entities_table)
        console.print()
        
        # Tenant Info
        if self.entities["tenant"]:
            console.print(Panel(
                f"[bold]Tenant:[/] {self.entities['tenant']['name']}\n"
                f"[bold]Slug:[/] {self.entities['tenant']['slug']}\n"
                f"[bold]ID:[/] {self.entities['tenant']['id']}\n"
                f"[bold]Dashboard URL:[/] http://localhost:4000/t/{self.entities['tenant']['slug']}/dashboard",
                title="[bold green]TechMart Electronics[/]",
                border_style="green"
            ))
        
        console.print()
        
        # Next Steps
        console.print(Panel(
            "[bold]1.[/] Access dashboard: http://localhost:4000\n"
            "[bold]2.[/] Login with admin credentials\n"
            "[bold]3.[/] Select TechMart Electronics tenant\n"
            "[bold]4.[/] View created data across modules:\n"
            "   • Inventory: 12 products, 2 warehouses\n"
            "   • Purchasing: 3 suppliers, 3 purchase orders\n"
            "   • Sales: 4 customers (if endpoint available)",
            title="[bold blue]Next Steps[/]",
            border_style="blue"
        ))

    # ==================== Main Execution ====================
    
    def run(self):
        """Execute the complete case study"""
        self.results_summary["start_time"] = datetime.now()
        
        console.print(Panel.fit(
            "[bold cyan]TechMart Electronics - Retail Case Study[/]\n"
            "[dim]Demonstrating end-to-end ERP workflow[/]",
            border_style="cyan"
        ))
        console.print()
        
        try:
            # Step 1: Register & Authentication
            if not self.register_user():
                return False
            
            if not self.authenticate():
                return False
            
            # Step 2: Create Tenant
            if not self.create_tenant():
                return False
            
            if not self.get_tenant_token():
                return False
            
            # Step 3: Create Products
            if not self.create_products():
                return False
            
            # Step 4: Create Warehouses
            if not self.create_warehouses():
                return False
            
            # Step 5: Create Suppliers
            if not self.create_suppliers():
                return False
            
            # Step 6: Create Purchase Orders
            if not self.create_purchase_orders():
                return False
            
            # Step 7: Create Customers (optional)
            self.create_customers()
            
            # Step 8: Create Sales Orders
            self.create_sales_orders()
            
            # Step 9: Generate Invoices
            self.create_invoices()
            
            # Step 10: Process Payments
            self.process_payments()
            
            self.results_summary["end_time"] = datetime.now()
            
            # Generate Summary
            self.generate_summary_report()
            
            return True
            
        except KeyboardInterrupt:
            console.print("\n[yellow]Execution interrupted by user[/]")
            return False
        except Exception as e:
            console.print(f"\n[red]Unexpected error: {str(e)}[/]")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Main entry point"""
    case_study = TechMartCaseStudy()
    success = case_study.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
