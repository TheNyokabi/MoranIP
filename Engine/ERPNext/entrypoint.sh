#!/bin/bash

set -e

echo "🚀 Starting ERPNext Local Build..."
echo "Framework: Frappe v15"
echo "Application: ERPNext v15"

# Wait for MariaDB to be ready (simple port check)
echo "⏳ Waiting for MariaDB to be ready..."
DB_HOST="${DB_HOST:-mariadb}"
DB_PORT="${DB_PORT:-3306}"

# Simple port connectivity check with timeout
for i in {1..15}; do
    if timeout 2 bash -c "echo > /dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; then
        echo "✅ MariaDB port is accessible"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  MariaDB port check timeout, but continuing (Frappe will handle connection)"
    else
        echo "   Waiting for MariaDB... (attempt $i/15)"
        sleep 2
    fi
done

# Wait for Redis
echo "⏳ Waiting for Redis..."
while ! redis-cli -h redis ping > /dev/null 2>&1; do
    echo "Redis is unavailable - sleeping"
    sleep 1
done
echo "✅ Redis is ready"

# Ensure logs directory exists in sites path (Frappe creates logs per site)
mkdir -p /home/frappe/frappe-bench/sites/moran.localhost/logs
mkdir -p /home/frappe/frappe-bench/logs

# Set PYTHONPATH to include frappe and erpnext
export PYTHONPATH="/app/frappe:/app/erpnext:${PYTHONPATH}"

# Set sites path
export FRAPPE_SITES_PATH="/home/frappe/frappe-bench/sites"

# Start ERPNext
echo "🎯 Starting Frappe..."
cd /app/frappe

# Use frappe.app.serve with proper sites path
exec python -c "
import sys
import os
sys.path.insert(0, '/app/frappe')
sys.path.insert(0, '/app/erpnext')

# Set environment variables
os.environ['FRAPPE_SITES_PATH'] = '/home/frappe/frappe-bench/sites'

# Ensure site logs directory exists
os.makedirs('/home/frappe/frappe-bench/sites/moran.localhost/logs', exist_ok=True)
os.makedirs('/home/frappe/frappe-bench/logs', exist_ok=True)

# Change to sites directory so Frappe can find relative paths correctly
os.chdir('/home/frappe/frappe-bench/sites')

import frappe.app
# Serve with sites_path and default site
frappe.app.serve(port=8000, sites_path='/home/frappe/frappe-bench/sites', site='moran.localhost')
"
