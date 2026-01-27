#!/bin/bash

# Setup Default Admin User via Frontend API
# This script creates an admin user and optionally a test tenant

set -e

#API_URL="http://localhost:4000/api"
API_URL="http://localhost:9000"
BACKEND_URL="http://localhost:9000"

echo "============================================================"
echo "SETUP DEFAULT ADMIN USER"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Create Admin User (if user creation endpoint exists)
# For now, we'll create a tenant which will create the admin user
echo -e "${YELLOW}Step 1: Creating admin user via tenant creation...${NC}"

ADMIN_EMAIL="admin@moran.com"
ADMIN_NAME="System Administrator"
ADMIN_PASSWORD="admin123"
TENANT_NAME="Admin Workspace"
COUNTRY_CODE="KE"
ENGINE="erpnext"

echo "Creating tenant with admin user..."
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo "  Tenant: $TENANT_NAME"
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/iam/tenants" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TENANT_NAME\",
    \"country_code\": \"$COUNTRY_CODE\",
    \"engine\": \"$ENGINE\",
    \"admin_email\": \"$ADMIN_EMAIL\",
    \"admin_name\": \"$ADMIN_NAME\",
    \"admin_password\": \"$ADMIN_PASSWORD\",
    \"category\": \"ENTERPRISE\",
    \"description\": \"Default admin workspace\"
  }")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if tenant creation was successful
if echo "$RESPONSE" | grep -q "\"id\"" || echo "$RESPONSE" | grep -q "tenant_code"; then
    echo -e "${GREEN}✅ Tenant and admin user created successfully!${NC}"
    TENANT_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null || echo "")
    
    if [ -n "$TENANT_ID" ]; then
        echo "  Tenant ID: $TENANT_ID"
    fi
else
    echo -e "${RED}❌ Failed to create tenant/admin user${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "============================================================"
echo "Step 2: Testing login...${NC}"
echo "============================================================"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")
    
    if [ -n "$TOKEN" ]; then
        echo "  Access token: ${TOKEN:0:50}..."
    fi
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo ""
echo "============================================================"
echo -e "${GREEN}SETUP COMPLETE!${NC}"
echo "============================================================"
echo ""
echo "You can now log in with:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Or use curl to login:"
echo "  curl -X POST $API_URL/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}'"
echo ""
