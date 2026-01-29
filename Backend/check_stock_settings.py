from app.services.erpnext_client import ERPNextClientAdapter
import asyncio
import os
import json

async def check_stock_settings():
    adapter = ERPNextClientAdapter()
    
    # Needs a tenant ID to resolve URL, using the one from logs
    tenant_id = "TEN-KE-26-YQ52X" 
    
    
    # Override URL for local execution - Directly modify adapter property
    # os.environ modification is too late as settings are already loaded
    adapter.base_url = "http://localhost:9010"
    
    print(f"Checking Stock Settings for tenant {tenant_id}...")
    
    try:
        # Fetch Stock Settings (Single DocType)
        result = adapter.proxy_request(
            tenant_id=tenant_id,
            path="resource/Stock Settings/Stock Settings",
            method="PUT",
            json_data={"allow_negative_stock": 1}
        )
        
        print("Updated Stock Settings. New result:")
        print(result)
        
    except Exception as e:
        print(f"Error checking settings: {e}")

if __name__ == "__main__":
    asyncio.run(check_stock_settings())
