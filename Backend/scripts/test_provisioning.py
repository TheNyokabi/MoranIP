#!/usr/bin/env python3
"""
Test script for provisioning functionality.

This script tests the provisioning endpoints and verifies the flow works correctly.
Run this after starting the backend server.

Usage:
    python scripts/test_provisioning.py
"""

import requests
import json
import sys
import time
from typing import Dict, Any

BASE_URL = "http://localhost:9000"

def print_step(message: str):
    """Print a step message."""
    print(f"\n{'='*60}")
    print(f"  {message}")
    print(f"{'='*60}")

def print_success(message: str):
    """Print a success message."""
    print(f"✓ {message}")

def print_error(message: str):
    """Print an error message."""
    print(f"✗ {message}")

def print_info(message: str):
    """Print an info message."""
    print(f"ℹ {message}")

def login(email: str, password: str) -> str:
    """Login and get identity token."""
    print_step("Step 1: Login")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    
    if response.status_code != 200:
        print_error(f"Login failed: {response.status_code} - {response.text}")
        sys.exit(1)
    
    data = response.json()
    token = data.get("access_token")
    
    if not token:
        print_error("No access token in response")
        sys.exit(1)
    
    print_success(f"Logged in as {email}")
    print_info(f"User ID: {data.get('user_id')}")
    print_info(f"Available tenants: {len(data.get('tenants', []))}")
    
    return token

def create_workspace(token: str, workspace_name: str) -> Dict[str, Any]:
    """Create a new workspace."""
    print_step("Step 2: Create Workspace")
    
    response = requests.post(
        f"{BASE_URL}/iam/tenants",
        json={
            "name": workspace_name,
            "category": "Enterprise",
            "description": "Test workspace for provisioning",
            "country_code": "KE",
            "admin_email": "test@example.com",
            "admin_name": "Test Admin",
            "admin_password": "testpass123",
            "engine": "erpnext"
        }
    )
    
    if response.status_code != 200:
        print_error(f"Workspace creation failed: {response.status_code} - {response.text}")
        sys.exit(1)
    
    data = response.json()
    tenant_id = data["tenant"]["id"]
    
    print_success(f"Workspace created: {workspace_name}")
    print_info(f"Tenant ID: {tenant_id}")
    print_info(f"Tenant Code: {data['tenant']['code']}")
    
    # Check if provisioning was started
    if "provisioning" in data:
        provisioning = data["provisioning"]
        print_info(f"Provisioning Status: {provisioning.get('status')}")
        if provisioning.get('status') == 'IN_PROGRESS':
            print_info(f"Current Step: {provisioning.get('current_step')}")
            print_info(f"Progress: {provisioning.get('progress')}%")
    
    return {
        "tenant_id": tenant_id,
        "tenant_code": data["tenant"]["code"],
        "provisioning": data.get("provisioning")
    }

def get_provisioning_status(token: str, tenant_id: str) -> Dict[str, Any]:
    """Get provisioning status."""
    response = requests.get(
        f"{BASE_URL}/api/provisioning/tenants/{tenant_id}/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print_error(f"Failed to get status: {response.status_code} - {response.text}")
        return {}
    
    return response.json()

def poll_provisioning_status(token: str, tenant_id: str, max_wait: int = 120) -> Dict[str, Any]:
    """Poll provisioning status until complete or failed."""
    print_step("Step 3: Monitor Provisioning")
    
    start_time = time.time()
    last_status = None
    
    while time.time() - start_time < max_wait:
        status = get_provisioning_status(token, tenant_id)
        
        if not status:
            break
        
        current_status = status.get("status")
        progress = status.get("progress", 0)
        current_step = status.get("current_step")
        steps_completed = status.get("steps_completed", 0)
        total_steps = status.get("total_steps", 0)
        
        # Only print if status changed
        if current_status != last_status:
            print_info(f"Status: {current_status} | Progress: {progress:.1f}% | Step: {steps_completed}/{total_steps}")
            if current_step:
                print_info(f"  Current Step: {current_step}")
            last_status = current_status
        
        # Check for completion
        if current_status in ["COMPLETED", "FAILED", "PARTIAL"]:
            print_success(f"Provisioning {current_status.lower()}")
            return status
        
        # Check for errors
        errors = status.get("errors", [])
        if errors:
            print_error("Errors detected:")
            for err in errors:
                print_error(f"  {err.get('step')}: {err.get('error')}")
        
        time.sleep(2)  # Poll every 2 seconds
    
    print_error(f"Provisioning timed out after {max_wait} seconds")
    return get_provisioning_status(token, tenant_id)

def get_provisioning_logs(token: str, tenant_id: str) -> list:
    """Get provisioning logs."""
    response = requests.get(
        f"{BASE_URL}/api/provisioning/tenants/{tenant_id}/logs",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return []
    
    data = response.json()
    return data.get("logs", [])

def main():
    """Main test function."""
    print("\n" + "="*60)
    print("  PROVISIONING TEST SCRIPT")
    print("="*60)
    
    # Configuration
    test_email = "admin@moran.com"
    test_password = "admin"  # Change if different
    workspace_name = f"Test Workspace {int(time.time())}"
    
    try:
        # Step 1: Login
        token = login(test_email, test_password)
        
        # Step 2: Create workspace
        workspace = create_workspace(token, workspace_name)
        tenant_id = workspace["tenant_id"]
        
        # Step 3: Monitor provisioning
        final_status = poll_provisioning_status(token, tenant_id)
        
        # Step 4: Get logs
        print_step("Step 4: Provisioning Logs")
        logs = get_provisioning_logs(token, tenant_id)
        if logs:
            print_info(f"Total log entries: {len(logs)}")
            for log in logs[:5]:  # Show first 5
                status_icon = "✓" if log.get("status") == "completed" else "✗" if log.get("status") == "failed" else "○"
                print(f"  {status_icon} {log.get('step')}: {log.get('status')} - {log.get('message', '')}")
        else:
            print_info("No logs available")
        
        # Summary
        print_step("Test Summary")
        print_info(f"Workspace: {workspace_name}")
        print_info(f"Tenant ID: {tenant_id}")
        print_info(f"Final Status: {final_status.get('status')}")
        print_info(f"Progress: {final_status.get('progress', 0):.1f}%")
        print_info(f"Steps Completed: {final_status.get('steps_completed', 0)}/{final_status.get('total_steps', 0)}")
        
        if final_status.get('status') == 'COMPLETED':
            print_success("Provisioning completed successfully!")
            return 0
        elif final_status.get('status') == 'PARTIAL':
            print_error("Provisioning completed with errors (partial)")
            return 1
        else:
            print_error("Provisioning failed")
            return 1
            
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        return 1
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
