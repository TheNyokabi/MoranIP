#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Create it before deploying."
  exit 1
fi

if [[ ! -d "secrets" ]]; then
  echo "Missing secrets/ directory. Ensure secrets are provisioned."
  exit 1
fi

echo "Starting MoranERP live deployment..."

docker-compose pull || true

if [[ "${RESET_DB:-0}" == "1" ]]; then
  echo "RESET_DB=1 set: removing volumes for a fresh database..."
  docker-compose down -v
fi

docker-compose build
docker-compose up -d

echo "Waiting for API container to be ready..."
sleep 5

echo "Running database migrations..."
docker-compose exec -T -e SKIP_TEST_SEED=1 api alembic upgrade head

echo "Creating default admin user..."
./setup_admin.sh

ensure_erpnext_site() {
  local site_name="${1:-moran.localhost}"
  local site_config_path="/home/frappe/frappe-bench/sites/${site_name}/site_config.json"

  echo "Ensuring ERPNext site '${site_name}' is valid..."

  # If the site directory exists but is incomplete, ERPNext will return 404 "<site> does not exist".
  # Repair by removing the broken site directory and re-running the site creator.
  if docker-compose exec -T erpnext bash -lc "test -f '${site_config_path}'" >/dev/null 2>&1; then
    echo "ERPNext site '${site_name}' looks healthy (site_config.json present)."
    return 0
  fi

  echo "ERPNext site '${site_name}' is missing site_config.json; recreating site..."
  docker-compose exec -T erpnext bash -lc "rm -rf '/home/frappe/frappe-bench/sites/${site_name}'" || true
  docker-compose up -d create-site || true

  echo "Restarting ERPNext to pick up recreated site..."
  docker-compose restart erpnext

  echo "Waiting for ERPNext ping to succeed..."
  for i in {1..60}; do
    if curl -fsS "http://localhost:9010/api/method/ping" >/dev/null 2>&1; then
      echo "ERPNext ping OK."
      return 0
    fi
    sleep 2
  done

  echo "ERPNext did not become healthy in time. Check: docker-compose logs --tail 200 erpnext create-site"
  return 1
}

ensure_erpnext_site "${ERPNEXT_SITE:-moran.localhost}"

echo "Deployment complete."
docker-compose ps
