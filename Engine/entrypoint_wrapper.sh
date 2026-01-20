#!/bin/bash
set -e

# Read DB password from secret file if it exists
if [ -f /run/secrets/postgres_password ]; then
    export PASSWORD=$(cat /run/secrets/postgres_password)
    export ODOO_DB_PASSWORD=$(cat /run/secrets/postgres_password)
fi

# Read Admin password from secret file if it exists
if [ -f /run/secrets/odoo_password ]; then
    export ODOO_ADMIN_PASSWORD=$(cat /run/secrets/odoo_password)
fi

echo "Secrets injected. Starting Odoo..."
exec "/entrypoint.sh" "$@"
