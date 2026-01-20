#!/usr/bin/env python3
"""
Generate Postman Collection from FastAPI Application

This script analyzes all FastAPI routers and generates a comprehensive
Postman Collection v2.1 with all endpoints, authentication, and examples.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.routing import APIRoute
from app.main import app


def get_route_info(route: APIRoute) -> Dict[str, Any]:
    """Extract detailed information from a FastAPI route."""
    
    # Get path parameters
    path_params = []
    for param_name in route.path_regex.groupindex.keys():
        path_params.append({
            "key": param_name,
            "value": f"{{{param_name}}}",
            "description": f"Path parameter: {param_name}"
        })
    
    # Get query parameters from function signature
    query_params = []
    body_params = {}
    
    # Extract from route dependencies and parameters
    if route.dependant:
        for param in route.dependant.query_params:
            query_params.append({
                "key": param.name,
                "value": "",
                "description": f"Query parameter: {param.name}",
                "disabled": not param.required
            })
    
    # Build request body example if POST/PUT/PATCH
    request_body = None
    if route.methods and any(m in ["POST", "PUT", "PATCH"] for m in route.methods):
        # Try to get body schema from route
        if route.body_field:
            request_body = {
                "mode": "raw",
                "raw": json.dumps({
                    "example": "Add request body based on endpoint schema"
                }, indent=2),
                "options": {
                    "raw": {
                        "language": "json"
                    }
                }
            }
    
    return {
        "path": route.path,
        "methods": list(route.methods) if route.methods else ["GET"],
        "name": route.name,
        "summary": route.summary or route.name,
        "description": route.description or "",
        "tags": route.tags or [],
        "path_params": path_params,
        "query_params": query_params,
        "request_body": request_body
    }


def create_postman_request(route_info: Dict[str, Any], method: str) -> Dict[str, Any]:
    """Create a Postman request item from route information."""
    
    # Build URL with path parameters
    url_path = route_info["path"]
    
    # Replace FastAPI path params {param} with Postman variables {{param}}
    for param in route_info["path_params"]:
        param_name = param["key"]
        url_path = url_path.replace(f"{{{param_name}}}", f"{{{{{param_name}}}}}")
    
    request = {
        "name": f"{route_info['summary']} ({method})",
        "request": {
            "method": method,
            "header": [
                {
                    "key": "Content-Type",
                    "value": "application/json",
                    "type": "text"
                },
                {
                    "key": "Authorization",
                    "value": "Bearer {{access_token}}",
                    "type": "text",
                    "description": "JWT token from login"
                }
            ],
            "url": {
                "raw": f"{{{{base_url}}}}{url_path}",
                "host": ["{{base_url}}"],
                "path": [p for p in url_path.split("/") if p],
                "query": route_info["query_params"]
            },
            "description": route_info["description"]
        },
        "response": []
    }
    
    # Add request body for POST/PUT/PATCH
    if route_info["request_body"] and method in ["POST", "PUT", "PATCH"]:
        request["request"]["body"] = route_info["request_body"]
    
    return request


def organize_by_module(routes: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Organize routes by their tags/modules."""
    
    modules = {}
    
    for route in routes:
        # Get primary tag or use "General"
        tag = route["tags"][0] if route["tags"] else "General"
        
        if tag not in modules:
            modules[tag] = []
        
        # Create requests for each HTTP method
        for method in route["methods"]:
            modules[tag].append(create_postman_request(route, method))
    
    return modules


def create_auth_examples() -> List[Dict[str, Any]]:
    """Create example requests for authentication flow."""
    
    return [
        {
            "name": "Login",
            "request": {
                "method": "POST",
                "header": [
                    {
                        "key": "Content-Type",
                        "value": "application/json"
                    }
                ],
                "body": {
                    "mode": "raw",
                    "raw": json.dumps({
                        "email": "admin@example.com",
                        "password": "your_password"
                    }, indent=2),
                    "options": {
                        "raw": {
                            "language": "json"
                        }
                    }
                },
                "url": {
                    "raw": "{{base_url}}/auth/login",
                    "host": ["{{base_url}}"],
                    "path": ["auth", "login"]
                },
                "description": "Login to get user details and available tenants"
            },
            "response": []
        },
        {
            "name": "Login with Tenant",
            "request": {
                "method": "POST",
                "header": [
                    {
                        "key": "Content-Type",
                        "value": "application/json"
                    }
                ],
                "body": {
                    "mode": "raw",
                    "raw": json.dumps({
                        "email": "admin@example.com",
                        "password": "your_password",
                        "tenant_id": "{{tenant_id}}"
                    }, indent=2),
                    "options": {
                        "raw": {
                            "language": "json"
                        }
                    }
                },
                "url": {
                    "raw": "{{base_url}}/auth/v1/login-with-tenant",
                    "host": ["{{base_url}}"],
                    "path": ["auth", "v1", "login-with-tenant"]
                },
                "description": "Login with tenant selection to get access token. Save the access_token to environment."
            },
            "response": [],
            "event": [
                {
                    "listen": "test",
                    "script": {
                        "exec": [
                            "// Save access token to environment",
                            "const response = pm.response.json();",
                            "if (response.access_token) {",
                            "    pm.environment.set('access_token', response.access_token);",
                            "    console.log('Access token saved to environment');",
                            "}",
                            "if (response.tenant && response.tenant.id) {",
                            "    pm.environment.set('tenant_id', response.tenant.id);",
                            "    console.log('Tenant ID saved to environment');",
                            "}"
                        ],
                        "type": "text/javascript"
                    }
                }
            ]
        },
        {
            "name": "Get My Memberships",
            "request": {
                "method": "GET",
                "header": [
                    {
                        "key": "Authorization",
                        "value": "Bearer {{access_token}}",
                        "type": "text"
                    }
                ],
                "url": {
                    "raw": "{{base_url}}/auth/me/memberships",
                    "host": ["{{base_url}}"],
                    "path": ["auth", "me", "memberships"]
                },
                "description": "Get current user's tenant memberships"
            },
            "response": []
        }
    ]


def generate_postman_collection(app: FastAPI) -> Dict[str, Any]:
    """Generate complete Postman collection from FastAPI app."""
    
    # Extract all routes
    routes = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            route_info = get_route_info(route)
            routes.append(route_info)
    
    # Organize by module
    modules = organize_by_module(routes)
    
    # Build collection structure
    collection = {
        "info": {
            "name": "MoranERP API",
            "description": "Comprehensive API collection for MoranERP platform covering all modules: Authentication, IAM, Accounting, CRM, HR, Manufacturing, PoS, and more.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "_postman_id": "moran-erp-api-collection",
            "version": "1.0.0"
        },
        "item": [],
        "variable": [
            {
                "key": "base_url",
                "value": "http://localhost:8000",
                "type": "string"
            }
        ]
    }
    
    # Add authentication folder first
    auth_folder = {
        "name": "Authentication",
        "description": "Authentication and authorization endpoints",
        "item": create_auth_examples()
    }
    collection["item"].append(auth_folder)
    
    # Add other modules
    module_order = [
        "IAM Provisioning",
        "Modules - Accounting",
        "Modules - CRM",
        "Modules - HR",
        "Modules - Manufacturing",
        "Modules - Projects",
        "Inventory",
        "Purchases",
        "PoS",
        "PoS Profiles",
        "PoS Sessions",
        "PoS Orders",
        "Settings",
        "Roles",
        "Permissions",
        "User Roles",
        "Audit",
        "Imports",
        "Onboarding",
        "ERP Modules",
        "Odoo Integration",
        "ERPNext Integration",
        "ERP"
    ]
    
    # Add modules in order
    for module_name in module_order:
        if module_name in modules:
            folder = {
                "name": module_name,
                "item": modules[module_name]
            }
            collection["item"].append(folder)
    
    # Add any remaining modules not in the order
    for module_name, items in modules.items():
        if module_name not in module_order and module_name != "Authentication":
            folder = {
                "name": module_name,
                "item": items
            }
            collection["item"].append(folder)
    
    return collection


def generate_environment() -> Dict[str, Any]:
    """Generate Postman environment template."""
    
    return {
        "name": "MoranERP - Local",
        "values": [
            {
                "key": "base_url",
                "value": "http://localhost:8000",
                "type": "default",
                "enabled": True
            },
            {
                "key": "access_token",
                "value": "",
                "type": "secret",
                "enabled": True
            },
            {
                "key": "tenant_id",
                "value": "",
                "type": "default",
                "enabled": True
            },
            {
                "key": "user_id",
                "value": "",
                "type": "default",
                "enabled": True
            }
        ],
        "_postman_variable_scope": "environment",
        "_postman_exported_at": datetime.utcnow().isoformat() + "Z",
        "_postman_exported_using": "MoranERP Postman Generator"
    }


def main():
    """Main execution function."""
    
    print("🚀 Generating Postman Collection for MoranERP API...")
    
    # Generate collection
    collection = generate_postman_collection(app)
    
    # Generate environment
    environment = generate_environment()
    
    # Create output directory
    output_dir = Path(__file__).parent.parent / "docs"
    output_dir.mkdir(exist_ok=True)
    
    # Write collection file
    collection_file = output_dir / "MoranERP.postman_collection.json"
    with open(collection_file, "w") as f:
        json.dump(collection, f, indent=2)
    
    print(f"✅ Collection saved to: {collection_file}")
    print(f"   Total endpoints: {sum(len(folder['item']) for folder in collection['item'])}")
    print(f"   Total modules: {len(collection['item'])}")
    
    # Write environment file
    env_file = output_dir / "MoranERP.postman_environment.json"
    with open(env_file, "w") as f:
        json.dump(environment, f, indent=2)
    
    print(f"✅ Environment saved to: {env_file}")
    
    print("\n📦 Import Instructions:")
    print("1. Open Postman")
    print("2. Click 'Import' button")
    print(f"3. Import {collection_file.name}")
    print(f"4. Import {env_file.name}")
    print("5. Select 'MoranERP - Local' environment")
    print("6. Run 'Login with Tenant' to get access token")
    print("7. Start testing endpoints!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
