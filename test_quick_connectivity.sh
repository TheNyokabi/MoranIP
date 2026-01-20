#!/bin/bash
# Quick connectivity test to verify API is accessible

source test_e2e_config.sh

echo "Testing API connectivity..."
echo "Base URL: ${BASE_URL}"

# Test 1: Health check
echo ""
echo "1. Testing health endpoint..."
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo "✓ Health check passed: $body"
else
    echo "✗ Health check failed: HTTP $http_code"
    exit 1
fi

# Test 2: API base
echo ""
echo "2. Testing API base..."
response=$(curl -s -w "\n%{http_code}" "${API_BASE}/health" 2>/dev/null || echo -e "\n000")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    echo "✓ API base accessible (HTTP $http_code)"
else
    echo "✗ API base not accessible: HTTP $http_code"
    echo "  Check if backend is running on ${BASE_URL}"
    exit 1
fi

# Test 3: Auth endpoint
echo ""
echo "3. Testing auth endpoint..."
response=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}' 2>/dev/null || echo -e "\n000")
http_code=$(echo "$response" | tail -1)

if [ "$http_code" = "401" ] || [ "$http_code" = "200" ]; then
    echo "✓ Auth endpoint accessible (HTTP $http_code - expected for invalid credentials)"
else
    echo "✗ Auth endpoint not accessible: HTTP $http_code"
    exit 1
fi

echo ""
echo "All connectivity tests passed!"
echo "Ready to run full test suite."
