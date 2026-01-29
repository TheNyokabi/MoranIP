#!/bin/bash

# Test script to check item prices in ERPNext via the backend API
# Usage: ./test_item_prices.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "POS Item Price Checker"
echo "========================================="
echo ""

# Check if token file exists
if [ ! -f ".schewps_token.txt" ]; then
    echo -e "${RED}Error: Token file not found${NC}"
    echo "Please run login script first to get authentication token"
    exit 1
fi

TOKEN=$(cat .schewps_token.txt)

# Fetch items from POS API
echo "Fetching items from POS API..."
RESPONSE=$(curl -s -X GET "http://localhost:8000/api/pos/items" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

# Check if request was successful
if echo "$RESPONSE" | grep -q "error\|detail"; then
    echo -e "${RED}Error fetching items:${NC}"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Parse and display items with their prices
echo ""
echo "========================================="
echo "Item Price Report"
echo "========================================="
echo ""

# Count items
TOTAL_ITEMS=$(echo "$RESPONSE" | jq '.items | length')
ZERO_RATE_ITEMS=$(echo "$RESPONSE" | jq '[.items[] | select(.standard_rate == 0)] | length')
PRICED_ITEMS=$((TOTAL_ITEMS - ZERO_RATE_ITEMS))

echo "Total Items: $TOTAL_ITEMS"
echo -e "${GREEN}Items with Prices: $PRICED_ITEMS${NC}"
echo -e "${RED}Items with Zero Rate: $ZERO_RATE_ITEMS${NC}"
echo ""

# Show items with zero rates
if [ "$ZERO_RATE_ITEMS" -gt 0 ]; then
    echo -e "${YELLOW}Items with ZERO rates (need pricing):${NC}"
    echo "----------------------------------------"
    echo "$RESPONSE" | jq -r '.items[] | select(.standard_rate == 0) | "  • \(.item_code) - \(.item_name)"'
    echo ""
fi

# Show items with prices
if [ "$PRICED_ITEMS" -gt 0 ]; then
    echo -e "${GREEN}Items with prices:${NC}"
    echo "----------------------------------------"
    echo "$RESPONSE" | jq -r '.items[] | select(.standard_rate > 0) | "  • \(.item_code) - \(.item_name): KES \(.standard_rate)"'
    echo ""
fi

# Summary and recommendations
echo "========================================="
echo "Summary"
echo "========================================="
echo ""

if [ "$ZERO_RATE_ITEMS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: $ZERO_RATE_ITEMS items have zero rates${NC}"
    echo ""
    echo "These items will create invoices with zero amounts!"
    echo ""
    echo "To fix this:"
    echo "1. Log into ERPNext"
    echo "2. Go to Item List"
    echo "3. For each item above, set the 'Standard Selling Rate'"
    echo "4. Save the item"
    echo "5. Refresh the POS page"
    echo ""
else
    echo -e "${GREEN}✓ All items have prices configured${NC}"
    echo ""
fi

# Save detailed report to file
REPORT_FILE="item_price_report_$(date +%Y%m%d_%H%M%S).json"
echo "$RESPONSE" | jq '.' > "$REPORT_FILE"
echo "Detailed report saved to: $REPORT_FILE"
echo ""
