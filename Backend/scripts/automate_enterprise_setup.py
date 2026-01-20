#!/usr/bin/env python3
"""
Automated Enterprise Setup Script
Creates tenant, initiates onboarding, and loads test data in one go
"""

import sys
import os
import requests
import json
from typing import Dict, Any, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:9000")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@moran.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
TENANT_NAME = os.getenv("TENANT_NAME", "Tech Manufacturing Co. Ltd.")

def api_call(method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> Dict:
    """Make API call and return response"""
    url = f"{BASE_URL}{endpoint}"
    hdrs = headers or {}
    try:
        if method == "GET":
            resp = requests.get(url, headers=hdrs, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=hdrs, json=data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=hdrs, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        if resp.status_code not in [200, 201]:
            error_msg = f"HTTP {resp.status_code}"
            try:
                error_json = resp.json()
                error_msg = error_json.get('detail', error_msg)
            except:
                error_msg = resp.text[:200]
            raise requests.exceptions.HTTPError(f"{error_msg} - {endpoint}", response=resp)
        
        return resp.json() if resp.content else {}
    except requests.exceptions.RequestException as e:
        print(f"❌ Error calling {method} {endpoint}: {e}")
        raise

def login() -> str:
    """Login and get access token"""
    print("\n🔐 Step 1: Authenticating...")
    try:
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        response = api_call("POST", "/api/auth/login", login_data)
        token = response.get("access_token") or response.get("token")
        if not token:
            raise ValueError("No access token in login response")
        print(f"✅ Authenticated as {ADMIN_EMAIL}")
        return token
    except Exception as e:
        print(f"❌ Login failed: {e}")
        print(f"   Please check ADMIN_EMAIL and ADMIN_PASSWORD environment variables")
        raise

def find_or_create_tenant(token: str) -> Dict[str, str]:
    """Find existing tenant or create new one"""
    print("\n🏢 Step 2: Finding or Creating Tenant...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # First, try to find existing tenant
    try:
        memberships = api_call("GET", "/api/auth/me/memberships", headers=headers)
        tenants = memberships.get("memberships", []) or memberships.get("data", [])
        
        for membership in tenants:
            tenant = membership.get("tenant", membership)
            if tenant.get("name") == TENANT_NAME or "Tech Manufacturing" in tenant.get("name", ""):
                tenant_id = tenant.get("id") or tenant.get("tenant_id")
                tenant_code = tenant.get("tenant_code") or tenant.get("code")
                print(f"✅ Found existing tenant: {tenant.get('name')} (ID: {tenant_id})")
                return {"tenant_id": tenant_id, "tenant_code": tenant_code, "exists": True}
    except Exception as e:
        print(f"⚠️  Could not check existing tenants: {e}")
    
    # Create new tenant
    print(f"   Creating new tenant: {TENANT_NAME}")
    tenant_data = {
        "name": TENANT_NAME,
        "category": "Enterprise",
        "description": "Enterprise ERPNext tenant for Tech Manufacturing Co. Ltd.",
        "country_code": "KE",
        "admin_email": ADMIN_EMAIL,
        "admin_name": "Admin User",
        "admin_password": ADMIN_PASSWORD,
        "engine": "erpnext"  # Set engine to erpnext directly
    }
    
    try:
        response = api_call("POST", "/api/iam/tenants", tenant_data)
        tenant = response.get("tenant", {})
        tenant_id = tenant.get("id")
        tenant_code = tenant.get("code")
        print(f"✅ Created tenant: {TENANT_NAME} (ID: {tenant_id}, Code: {tenant_code})")
        return {"tenant_id": tenant_id, "tenant_code": tenant_code, "exists": False}
    except Exception as e:
        print(f"❌ Failed to create tenant: {e}")
        raise

def initiate_onboarding(token: str, tenant_id: str) -> bool:
    """Initiate Enterprise onboarding"""
    print("\n🚀 Step 3: Initiating Enterprise Onboarding...")
    headers = {"Authorization": f"Bearer {token}"}
    
    onboarding_data = {
        "workspace_type": "ENTERPRISE",
        "template_code": "ENTERPRISE",
        "custom_config": None
    }
    
    try:
        response = api_call("POST", f"/api/onboarding/tenants/{tenant_id}/start", onboarding_data, headers)
        onboarding_id = response.get("onboarding_id") or response.get("data", {}).get("id")
        status = response.get("status_flow") or response.get("status")
        print(f"✅ Onboarding initiated (ID: {onboarding_id}, Status: {status})")
        return True
    except Exception as e:
        print(f"⚠️  Onboarding initiation failed: {e}")
        print(f"   Tenant engine may already be set to erpnext")
        return False

def start_onboarding(token: str, tenant_id: str) -> bool:
    """Start onboarding (transition from DRAFT to IN_PROGRESS)"""
    print("\n▶️  Step 4: Starting Onboarding Process...")
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = api_call("POST", f"/api/onboarding/tenants/{tenant_id}/execute-next", None, headers)
        print(f"✅ Onboarding process started")
        return True
    except Exception as e:
        print(f"⚠️  Could not auto-start onboarding: {e}")
        print(f"   You may need to complete onboarding via UI at /t/{tenant_id}/onboarding")
        return False

def main():
    """Main execution"""
    print("=" * 60)
    print("Enterprise Automated Setup")
    print("Tech Manufacturing Co. Ltd.")
    print("=" * 60)
    
    try:
        # Step 1: Login
        token = login()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Step 2: Find or create tenant
        tenant_info = find_or_create_tenant(token)
        tenant_id = tenant_info["tenant_id"]
        tenant_code = tenant_info.get("tenant_code", "")
        
        # Step 3: Verify/Set engine to erpnext
        print("\n⚙️  Step 3: Verifying Tenant Configuration...")
        try:
            tenant_details = api_call("GET", f"/api/iam/tenants/{tenant_id}", headers=headers)
            current_engine = tenant_details.get("engine") or tenant_details.get("data", {}).get("engine")
            if current_engine != "erpnext":
                print(f"⚠️  Tenant engine is '{current_engine}', should be 'erpnext'")
                print(f"   Initiate onboarding with ENTERPRISE workspace type to set engine")
            else:
                print(f"✅ Tenant engine is set to: erpnext")
        except Exception as e:
            print(f"⚠️  Could not verify tenant engine: {e}")
        
        # Step 4: Initiate onboarding (if tenant is new)
        if not tenant_info.get("exists"):
            initiate_onboarding(token, tenant_id)
        
        # Step 5: Export credentials for next steps
        print("\n" + "=" * 60)
        print("Setup Summary")
        print("=" * 60)
        print(f"✅ Tenant ID: {tenant_id}")
        print(f"✅ Tenant Code: {tenant_code}")
        print(f"✅ Access Token: {token[:20]}...")
        print("\n📋 Next Steps:")
        print(f"1. Export credentials:")
        print(f"   export TENANT_ID=\"{tenant_id}\"")
        print(f"   export ACCESS_TOKEN=\"{token}\"")
        print(f"   export API_BASE_URL=\"{BASE_URL}\"")
        print(f"\n2. Complete onboarding via UI:")
        print(f"   Navigate to: http://localhost:4000/t/{tenant_code or tenant_id}/onboarding")
        print(f"   Or: http://localhost:4000/t/{tenant_id}/onboarding")
        print(f"\n3. Load test data:")
        print(f"   cd Backend/scripts")
        print(f"   python3 setup_enterprise_test_data.py")
        print(f"\n4. Verify setup:")
        print(f"   python3 verify_enterprise_setup.py")
        
        # Save credentials to file for easy sourcing
        env_file = "/tmp/enterprise_env.sh"
        with open(env_file, "w") as f:
            f.write(f"export TENANT_ID=\"{tenant_id}\"\n")
            f.write(f"export ACCESS_TOKEN=\"{token}\"\n")
            f.write(f"export API_BASE_URL=\"{BASE_URL}\"\n")
            f.write(f"export TENANT_CODE=\"{tenant_code}\"\n")
        
        print(f"\n💡 Credentials saved to: {env_file}")
        print(f"   Source it with: source {env_file}")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
