#!/usr/bin/env python3
"""
Quick test to create one product
"""
import requests

# Get tenant token
login = requests.post('http://api:8000/auth/v1/login-with-tenant', 
                      json={'email': 'admin@moran', 'password': 'admin123', 
                            'tenant_id': '65b1e65d-9a37-4a33-9425-a7c80bc47925'})
token = login.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Create item with correct schema
item = {
    "item_code": "TEST-LAPTOP-001",
    "item_name": "Test Laptop",
    "item_group": "Products",
    "stock_uom": "Nos",
    "standard_rate": 100000
}

resp = requests.post('http://api:8000/api/tenants/65b1e65d-9a37-4a33-9425-a7c80bc47925/erp/inventory/items',
                    headers=headers, json=item)
print(f'Status: {resp.status_code}')
print(f'Response: {resp.text}')
