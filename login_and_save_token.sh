#!/bin/bash

# Login via Frontend and Save Token
# This script logs in via the frontend API proxy and extracts the access token

set -e

echo "🔐 Logging in via frontend..."
echo ""

# Make login request and capture response
RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@moran.com", "password": "admin123"}')

# Extract token (handles both direct response and wrapped in data)
TOKEN=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Try direct access_token first
    token = data.get('access_token', '')
    # If not found, try data.access_token
    if not token:
        token = data.get('data', {}).get('access_token', '')
    print(token)
except:
    print('')
" 2>/dev/null)

# Check if token was extracted
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
    echo "✅ Login successful!"
    echo ""
    echo "📝 Access Token:"
    echo "$TOKEN"
    echo ""
    echo "💾 Export command:"
    echo "export AUTH_TOKEN=\"$TOKEN\""
    echo ""
    
    # Show full response
    echo "🔍 Full Response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # Extract and show tenant info if available
    TENANT_INFO=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', data.get('data', {}).get('tenants', []))
    if tenants:
        print('Available Tenants:')
        for t in tenants:
            print(f\"  - {t.get('name', 'N/A')} (ID: {t.get('id', 'N/A')})\")
except:
    pass
" 2>/dev/null)
    
    if [ -n "$TENANT_INFO" ]; then
        echo "$TENANT_INFO"
        echo ""
    fi
    
    echo "💡 Use this token in subsequent requests:"
    echo "   curl -H \"Authorization: Bearer $TOKEN\" \\"
    echo "        -H \"X-Tenant-ID: YOUR_TENANT_ID\" \\"
    echo "        http://localhost:4000/api/pos/items"
    echo ""
    
    # Save token to file for easy sourcing
    echo "export AUTH_TOKEN=\"$TOKEN\"" > .auth_token.sh
    echo "✅ Token saved to .auth_token.sh (source it with: source .auth_token.sh)"
    
else
    echo "❌ Login failed or token not found"
    echo ""
    echo "📋 Full Response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   1. Check if frontend is running: docker ps | grep moran-frontend"
    echo "   2. Check if backend is running: docker ps | grep moran-api"
    echo "   3. Check frontend logs: docker logs moran-frontend --tail 50"
    echo "   4. Check backend logs: docker logs moran-api --tail 50"
    echo "   5. Try different credentials (see LOGIN_CREDENTIALS.md)"
    exit 1
fi
