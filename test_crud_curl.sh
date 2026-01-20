#!/bin/bash
# Test CRUD operations via frontend API proxy (port 4000)
# This script tests creating products, warehouses, and listing them

BASE_URL="http://localhost:4000/api"
FRONTEND_URL="http://localhost:4000"

echo "========================================="
echo "Testing CRUD Operations via Frontend API"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Login and get token
echo "Step 1: Login..."
echo "----------------------------------------"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }')

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Failed to connect to API${NC}"
  echo "Make sure the backend is running on port 4000"
  exit 1
fi

# Extract token from response (login returns "access_token")
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  echo ""
  echo "Note: You may need to create a user first or use different credentials"
  echo "Check QUICK_CURL_COMMANDS.md for setup instructions"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Get user info to find tenant_id
echo "Step 2: Get user info..."
echo "----------------------------------------"
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")

TENANT_ID=$(echo $USER_RESPONSE | grep -o '"tenant_id":"[^"]*' | sed 's/"tenant_id":"//' | head -1)

if [ -z "$TENANT_ID" ]; then
  # Try to get from memberships
  echo "Getting tenant from memberships..."
  MEMBERSHIPS_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/me/memberships" \
    -H "Authorization: Bearer $TOKEN")
  
  TENANT_ID=$(echo $MEMBERSHIPS_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//' | head -1)
  TENANT_CODE=$(echo $MEMBERSHIPS_RESPONSE | grep -o '"code":"[^"]*' | sed 's/"code":"//' | head -1)
fi

if [ -z "$TENANT_ID" ]; then
  echo -e "${YELLOW}⚠ No tenant found. Using test tenant ID${NC}"
  TENANT_ID="test-tenant-id"
  TENANT_CODE="test"
fi

echo -e "${GREEN}✓ Tenant ID: $TENANT_ID${NC}"
echo ""

# Step 3: Test List Items (GET)
echo "Step 3: Test List Items (GET /inventory/items)"
echo "----------------------------------------"
LIST_ITEMS_RESPONSE=$(curl -s -X GET "$BASE_URL/tenants/$TENANT_ID/erp/inventory/items?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

if echo "$LIST_ITEMS_RESPONSE" | grep -q '"items"'; then
  echo -e "${GREEN}✓ List items works${NC}"
  ITEM_COUNT=$(echo "$LIST_ITEMS_RESPONSE" | grep -o '"item_code"' | wc -l | tr -d ' ')
  echo "  Found $ITEM_COUNT items"
else
  echo -e "${RED}✗ List items failed${NC}"
  echo "  Response: ${LIST_ITEMS_RESPONSE:0:200}"
fi
echo ""

# Step 4: Test Create Item (POST)
echo "Step 4: Test Create Item (POST /inventory/items)"
echo "----------------------------------------"
TIMESTAMP=$(date +%s)
ITEM_CODE="TEST-ITEM-$TIMESTAMP"
CREATE_ITEM_RESPONSE=$(curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/erp/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"item_code\": \"$ITEM_CODE\",
    \"item_name\": \"Test Item $TIMESTAMP\",
    \"item_group\": \"Products\",
    \"stock_uom\": \"Nos\",
    \"standard_rate\": 100.0,
    \"is_stock_item\": 1
  }")

if echo "$CREATE_ITEM_RESPONSE" | grep -q "$ITEM_CODE" || echo "$CREATE_ITEM_RESPONSE" | grep -q '"name"'; then
  echo -e "${GREEN}✓ Create item works${NC}"
  echo "  Created item: $ITEM_CODE"
else
  echo -e "${RED}✗ Create item failed${NC}"
  echo "  Response: ${CREATE_ITEM_RESPONSE:0:300}"
fi
echo ""

# Step 5: Test List Warehouses (GET)
echo "Step 5: Test List Warehouses (GET /inventory/warehouses)"
echo "----------------------------------------"
LIST_WAREHOUSES_RESPONSE=$(curl -s -X GET "$BASE_URL/tenants/$TENANT_ID/erp/inventory/warehouses?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

if echo "$LIST_WAREHOUSES_RESPONSE" | grep -q '"warehouses"'; then
  echo -e "${GREEN}✓ List warehouses works${NC}"
  WAREHOUSE_COUNT=$(echo "$LIST_WAREHOUSES_RESPONSE" | grep -o '"warehouse_name"' | wc -l | tr -d ' ')
  echo "  Found $WAREHOUSE_COUNT warehouses"
else
  echo -e "${RED}✗ List warehouses failed${NC}"
  echo "  Response: ${LIST_WAREHOUSES_RESPONSE:0:200}"
fi
echo ""

# Step 6: Test Create Warehouse (POST)
echo "Step 6: Test Create Warehouse (POST /inventory/warehouses)"
echo "----------------------------------------"
TIMESTAMP=$(date +%s)
WAREHOUSE_NAME="Test Warehouse $TIMESTAMP"
CREATE_WAREHOUSE_RESPONSE=$(curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/erp/inventory/warehouses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"warehouse_name\": \"$WAREHOUSE_NAME\",
    \"is_group\": 0
  }")

if echo "$CREATE_WAREHOUSE_RESPONSE" | grep -q "$WAREHOUSE_NAME" || echo "$CREATE_WAREHOUSE_RESPONSE" | grep -q '"name"'; then
  echo -e "${GREEN}✓ Create warehouse works${NC}"
  echo "  Created warehouse: $WAREHOUSE_NAME"
else
  echo -e "${RED}✗ Create warehouse failed${NC}"
  echo "  Response: ${CREATE_WAREHOUSE_RESPONSE:0:300}"
fi
echo ""

# Step 7: Test POS Items (GET)
echo "Step 7: Test POS Items (GET /pos/items)"
echo "----------------------------------------"
POS_ITEMS_RESPONSE=$(curl -s -X GET "$BASE_URL/pos/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID")

if echo "$POS_ITEMS_RESPONSE" | grep -q '"items"'; then
  echo -e "${GREEN}✓ POS list items works${NC}"
  POS_ITEM_COUNT=$(echo "$POS_ITEMS_RESPONSE" | grep -o '"item_code"' | wc -l | tr -d ' ')
  echo "  Found $POS_ITEM_COUNT items in POS"
else
  echo -e "${RED}✗ POS list items failed${NC}"
  echo "  Response: ${POS_ITEMS_RESPONSE:0:200}"
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "All CRUD operations tested via frontend API (port 4000)"
echo ""
echo "To test manually, use:"
echo "  curl -X GET \"$BASE_URL/tenants/$TENANT_ID/erp/inventory/items\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -H \"X-Tenant-ID: $TENANT_ID\""
echo ""
echo "Note: Make sure backend is running on port 4000"
echo "      and you have valid credentials"
