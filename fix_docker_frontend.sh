#!/bin/bash

# Docker Frontend Troubleshooting Script
# Fixes common issues with Next.js 500 errors in Docker

set -e

echo "🐳 Docker Frontend Troubleshooting"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Step 1: Checking frontend container status..."
if docker ps | grep -q moran-frontend; then
    echo -e "${GREEN}✅ Frontend container is running${NC}"
else
    echo -e "${RED}❌ Frontend container is not running${NC}"
    echo "Starting container..."
    docker-compose up -d frontend
    sleep 5
fi

echo ""
echo "Step 2: Checking container logs for errors..."
echo "---------------------------------------------"
docker logs moran-frontend --tail 50 | tail -20

echo ""
echo "Step 3: Restarting frontend container..."
docker-compose restart frontend

echo ""
echo "Step 4: Waiting for container to start..."
sleep 10

echo ""
echo "Step 5: Checking logs after restart..."
echo "--------------------------------------"
docker logs moran-frontend --tail 30 | tail -15

echo ""
echo -e "${GREEN}✅ Troubleshooting complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Check logs: docker logs moran-frontend --tail 100 -f"
echo "  2. Check browser: http://localhost:4000"
echo "  3. If still errors, check the logs for specific errors"
echo "  4. Share error messages for help"
echo ""
