# Database Migration Instructions

## Option 1: Run Migration Inside Docker (Recommended)

If your Docker services are running, execute the migration inside the backend container:

```bash
# Make sure Docker services are running
docker-compose up -d

# Run migration inside the API container
docker-compose exec api alembic upgrade head
```

If the backend service has a different name, check with:
```bash
docker-compose ps
```

## Option 2: Run Migration Locally (If Database is Accessible)

If you have PostgreSQL running locally and want to run the migration outside Docker:

1. **Set environment variables** to point to your local database:
```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=odoo
export POSTGRES_DB=postgres
export POSTGRES_PASSWORD=your_password_here
```

2. **Run the migration**:
```bash
cd Backend
alembic upgrade head
```

## Option 3: Run Migration with Custom Database URL

You can also override the database URL directly:

```bash
cd Backend
DATABASE_URL="postgresql://odoo:password@localhost:5432/postgres" alembic upgrade head
```

## Verify Migration Success

After running the migration, verify the changes:

1. **Check that new columns exist**:
```sql
-- Connect to your database
psql -h localhost -U odoo -d postgres

-- Check tenant_onboarding table
\d tenant_onboarding
-- Should show: provisioning_type, provisioning_config, provisioning_steps, provisioning_metadata

-- Check tenants table
\d tenants
-- Should show: provisioning_status, provisioned_at, provisioning_error
```

2. **Check that indexes exist**:
```sql
-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('tenant_onboarding', 'tenants')
AND indexname LIKE '%provisioning%';
```

Expected indexes:
- `idx_tenant_onboarding_provisioning_status`
- `idx_tenants_provisioning_status`

## Migration Details

The migration `add_provisioning_fields.py` will:

1. **Add to `tenant_onboarding` table:**
   - `provisioning_type` (ENUM: FULL_POS, BASIC, CUSTOM)
   - `provisioning_config` (JSONB)
   - `provisioning_steps` (JSONB, default: {})
   - `provisioning_metadata` (JSONB)

2. **Add to `tenants` table:**
   - `provisioning_status` (ENUM: NOT_PROVISIONED, PROVISIONING, PROVISIONED, FAILED, PARTIAL)
   - `provisioned_at` (TIMESTAMP)
   - `provisioning_error` (TEXT)

3. **Create indexes:**
   - `idx_tenant_onboarding_provisioning_status` on (tenant_id, status) WHERE provisioning_type IS NOT NULL
   - `idx_tenants_provisioning_status` on (provisioning_status)

4. **Set defaults:**
   - All existing tenants get `provisioning_status = 'NOT_PROVISIONED'`
   - All existing onboarding records get `provisioning_steps = {}`

## Troubleshooting

### Error: "could not translate host name 'postgres'"
- **Cause**: Running migration outside Docker but config points to Docker hostname
- **Solution**: Use Option 1 (run inside Docker) or Option 2 (set environment variables)

### Error: "connection refused"
- **Cause**: Database is not running or not accessible
- **Solution**: 
  - Start Docker services: `docker-compose up -d`
  - Or ensure local PostgreSQL is running

### Error: "permission denied"
- **Cause**: Database user doesn't have CREATE/ALTER permissions
- **Solution**: Ensure the database user has sufficient privileges

### Error: "relation already exists"
- **Cause**: Migration was partially applied
- **Solution**: Check current migration version:
  ```bash
  alembic current
  ```
  If needed, manually fix the database state or rollback:
  ```bash
  alembic downgrade -1
  alembic upgrade head
  ```

## Rollback (If Needed)

If you need to rollback the migration:

```bash
# Inside Docker
docker-compose exec api alembic downgrade -1

# Or locally
cd Backend
alembic downgrade -1
```

## Next Steps

After successful migration:

1. ✅ Verify all columns and indexes were created
2. ✅ Test provisioning by creating a workspace
3. ✅ Check provisioning status endpoint
4. ✅ Verify resources are created in ERPNext
