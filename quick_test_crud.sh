#!/bin/bash
# Quick CRUD test - assumes you're already logged in
# Usage: TOKEN="your-token" TENANT_ID="your-tenant-id" ./quick_test_crud.sh

BASE_URL="http://localhost:4000/api"

if [ -z "$TOKEN" ] || [ -z "$TENANT_ID" ]; then
  echo "Usage: TOKEN='your-token' TENANT_ID='your-tenant-id' $0"
  echo ""
  echo "To get token and tenant_id, first run:"
  echo "  ./test_crud_curl.sh"
  exit 1
fi

echo "Testing CRUD operations..."
echo ""

# Test 1: List Items
echo "1. List Items:"
curl -s -X GET "$BASE_URL/tenants/$TENANT_ID/erp/inventory/items?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" | jq '.items | length' 2>/dev/null || echo "Failed"
echo ""

# Test 2: Create Item
TIMESTAMP=$(date +%s)
ITEM_CODE="TEST-$TIMESTAMP"
echo "2. Create Item ($ITEM_CODE):"
curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/erp/inventory/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"item_code\": \"$ITEM_CODE\",
    \"item_name\": \"Test Item $TIMESTAMP\",
    \"item_group\": \"Products\",
    \"stock_uom\": \"Nos\",
    \"standard_rate\": 100.0
  }" | jq -r '.name // .message // "Failed"' 2>/dev/null || echo "Check response"
echo ""

# Test 3: List Warehouses
echo "3. List Warehouses:"
curl -s -X GET "$BASE_URL/tenants/$TENANT_ID/erp/inventory/warehouses?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" | jq '.warehouses | length' 2>/dev/null || echo "Failed"
echo ""

# Test 4: Create Warehouse
echo "4. Create Warehouse:"
curl -s -X POST "$BASE_URL/tenants/$TENANT_ID/erp/inventory/warehouses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"warehouse_name\": \"Test WH $TIMESTAMP\",
    \"is_group\": 0
  }" | jq -r '.name // .message // "Failed"' 2>/dev/null || echo "Check response"
echo ""

# Test 5: POS Items
echo "5. POS Items:"
curl -s -X GET "$BASE_URL/pos/items" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID" | jq '.items | length' 2>/dev/null || echo "Failed"
echo ""

echo "Done!"
