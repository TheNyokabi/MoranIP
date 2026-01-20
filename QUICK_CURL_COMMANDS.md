# Quick Curl Commands (via Frontend)

All commands hit the frontend API proxy at `http://localhost:4000/api`

## 1. Create Admin User & Tenant

```bash
curl -X POST http://localhost:4000/api/iam/tenants \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Admin Workspace",
    "country_code": "KE",
    "engine": "erpnext",
    "admin_email": "admin@moran.com",
    "admin_name": "System Administrator",
    "admin_password": "admin123",
    "category": "ENTERPRISE",
    "description": "Default admin workspace"
  }'
```

## 2. Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }'
```

## 3. Get Current User Info

```bash
# Replace TOKEN with access_token from login response
curl -X GET http://localhost:4000/api/auth/me \
  -H 'Authorization: Bearer TOKEN'
```

## 4. List Tenants

```bash
curl -X GET http://localhost:4000/api/iam/tenants \
  -H 'Authorization: Bearer TOKEN'
```

## 5. Create Another Tenant

```bash
curl -X POST http://localhost:4000/api/iam/tenants \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{
    "name": "Test Company",
    "country_code": "KE",
    "engine": "erpnext",
    "admin_email": "test@example.com",
    "admin_name": "Test Admin",
    "admin_password": "test123456",
    "category": "SME",
    "description": "Test workspace"
  }'
```

## 6. Get Provisioning Status

```bash
# Replace TENANT_ID with actual tenant ID
curl -X GET http://localhost:4000/api/provisioning/tenants/TENANT_ID/status \
  -H 'Authorization: Bearer TOKEN'
```

## Example: Complete Setup Flow

```bash
# 1. Create admin user and tenant
RESPONSE=$(curl -s -X POST http://localhost:4000/api/iam/tenants \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Admin Workspace",
    "country_code": "KE",
    "engine": "erpnext",
    "admin_email": "admin@moran.com",
    "admin_name": "System Administrator",
    "admin_password": "admin123",
    "category": "ENTERPRISE",
    "description": "Default admin workspace"
  }')

echo "$RESPONSE" | python3 -m json.tool

# 2. Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Token: $TOKEN"

# 3. Get user info
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
