#!/usr/bin/env python3
"""
Stock Initialization Script for POS Warehouses

This script creates Stock Entry (Material Receipt) documents in ERPNext
to add initial inventory to POS warehouses. This is required for POS
sales to work - items must have stock before they can be sold.

Usage:
    python scripts/init_pos_stock.py --tenant TEN-KE-26-YQ52X --warehouse "Astro Sports - AG"

Requirements:
    - pip install requests
    - Backend API must be running at http://localhost:9000
"""

import argparse
import sys
import json
import requests
from datetime import datetime

API_BASE = "http://localhost:9000/api"


def login(email: str, password: str) -> str:
    """Login and get JWT token."""
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": email, "password": password}
    )
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        sys.exit(1)
    return resp.json()["access_token"]


def get_pos_items(token: str, tenant_id: str, warehouse: str = None, limit: int = 50):
    """Get POS items that need stock."""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get items from Item master
    params = {
        "limit_page_length": limit,
        "fields": '["item_code","item_name","standard_rate","is_stock_item","stock_uom"]',
        "filters": '[["is_stock_item","=",1],["disabled","=",0]]'
    }
    
    resp = requests.get(
        f"{API_BASE}/tenants/{tenant_id}/erp/resource/Item",
        headers=headers,
        params=params
    )
    
    if resp.status_code != 200:
        print(f"Failed to fetch items: {resp.text}")
        return []
    
    data = resp.json()
    return data.get("data", []) if isinstance(data, dict) else data


def create_stock_entry(token: str, tenant_id: str, warehouse: str, items: list, company: str):
    """Create Stock Entry (Material Receipt) to add stock."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Format items for Stock Entry
    entry_items = []
    for item in items:
        entry_items.append({
            "item_code": item["item_code"],
            "qty": item.get("qty", 100),  # Default 100 units
            "basic_rate": item.get("rate", item.get("standard_rate", 100)),
            "t_warehouse": warehouse  # Target warehouse for Material Receipt
        })
    
    payload = {
        "stock_entry_type": "Material Receipt",
        "company": company,
        "to_warehouse": warehouse,
        "posting_date": datetime.now().strftime("%Y-%m-%d"),
        "items": entry_items,
        "docstatus": 1  # Submit immediately
    }
    
    resp = requests.post(
        f"{API_BASE}/tenants/{tenant_id}/erp/inventory/stock-entries",
        headers=headers,
        json=payload
    )
    
    return resp


def get_warehouses(token: str, tenant_id: str, company: str = None):
    """Get list of warehouses."""
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "limit_page_length": 100,
        "fields": '["name","warehouse_name","company","is_group"]'
    }
    if company:
        params["filters"] = f'[["company","=","{company}"]]'
    
    resp = requests.get(
        f"{API_BASE}/tenants/{tenant_id}/erp/resource/Warehouse",
        headers=headers,
        params=params
    )
    
    if resp.status_code != 200:
        print(f"Failed to fetch warehouses: {resp.text}")
        return []
    
    data = resp.json()
    return data.get("data", []) if isinstance(data, dict) else data


def main():
    parser = argparse.ArgumentParser(description="Initialize stock for POS warehouses")
    parser.add_argument("--tenant", required=True, help="Tenant ID (e.g., TEN-KE-26-YQ52X)")
    parser.add_argument("--warehouse", help="Target warehouse name")
    parser.add_argument("--company", help="Company name")
    parser.add_argument("--email", default="admin@astroglobal.co.ke", help="Login email")
    parser.add_argument("--password", default="astro1234", help="Login password")
    parser.add_argument("--qty", type=int, default=100, help="Default quantity per item")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without creating entries")
    
    args = parser.parse_args()
    
    print(f"Logging in as {args.email}...")
    token = login(args.email, args.password)
    print("Login successful.")
    
    # Get warehouses
    print(f"\nFetching warehouses for tenant {args.tenant}...")
    warehouses = get_warehouses(token, args.tenant, args.company)
    
    if not warehouses:
        print("No warehouses found. Please create warehouses in ERPNext first.")
        sys.exit(1)
    
    print(f"Found {len(warehouses)} warehouses:")
    for w in warehouses:
        print(f"  - {w.get('name')} ({w.get('company', 'N/A')})")
    
    # Select warehouse
    target_warehouse = args.warehouse
    if not target_warehouse and warehouses:
        # Pick first non-group warehouse
        for w in warehouses:
            if not w.get("is_group"):
                target_warehouse = w.get("name")
                break
    
    if not target_warehouse:
        print("\nNo target warehouse specified or found. Use --warehouse flag.")
        sys.exit(1)
    
    print(f"\nTarget warehouse: {target_warehouse}")
    
    # Get company from warehouse
    company = args.company
    for w in warehouses:
        if w.get("name") == target_warehouse:
            company = w.get("company")
            break
    
    if not company:
        print("Could not determine company. Use --company flag.")
        sys.exit(1)
    
    print(f"Company: {company}")
    
    # Get items that need stock
    print(f"\nFetching stock items...")
    items = get_pos_items(token, args.tenant, target_warehouse)
    
    if not items:
        print("No stock items found. Please create items in ERPNext first.")
        sys.exit(1)
    
    print(f"Found {len(items)} stock items.")
    
    # Prepare items for stock entry
    stock_items = []
    for item in items[:20]:  # Limit to 20 items per entry for safety
        stock_items.append({
            "item_code": item.get("item_code"),
            "item_name": item.get("item_name"),
            "qty": args.qty,
            "rate": item.get("standard_rate") or 100
        })
    
    print(f"\nItems to add stock for (first 20):")
    for i, item in enumerate(stock_items, 1):
        print(f"  {i}. {item['item_code']}: {item['qty']} units @ {item['rate']}")
    
    if args.dry_run:
        print("\n[DRY RUN] No changes made.")
        return
    
    # Create stock entry
    print(f"\nCreating Stock Entry (Material Receipt)...")
    resp = create_stock_entry(token, args.tenant, target_warehouse, stock_items, company)
    
    if resp.status_code in (200, 201):
        result = resp.json()
        entry_name = result.get("data", {}).get("name", result.get("name", "Unknown"))
        print(f"\n✅ Stock Entry created successfully: {entry_name}")
        print(f"   Added {len(stock_items)} items x {args.qty} units each to {target_warehouse}")
    else:
        print(f"\n❌ Failed to create Stock Entry: {resp.status_code}")
        print(resp.text)
        sys.exit(1)


if __name__ == "__main__":
    main()
