# Robot Framework Test Setup Guide

This guide explains how to set up and run Robot Framework tests for the RBAC system.

## Prerequisites

1. **Backend running** on `http://localhost:8000`
2. **Database** with migrations applied
3. **Test users** seeded in database

## Quick Setup

```bash
# 1. Start services
docker-compose up -d api postgres redis

# 2. Run migrations
cd Backend
alembic upgrade head

# 3. Seed test data
python scripts/seed_test_users.py

# 4. Run tests
cd ../QATests
robot --variable BASE_URL:http://localhost:8000 rbac/
```

## Test Users

The seeding script creates the following test users:

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| `superadmin@moranerp.com` | `SuperAdmin123!` | SUPER_ADMIN | System administrator |
| `owner@tenant1.com` | `Owner123!` | OWNER | Tenant owner |
| `admin@tenant1.com` | `Admin123!` | ADMIN | Administrator |
| `manager@tenant1.com` | `Manager123!` | MANAGER | Manager |
| `staff@tenant1.com` | `Staff123!` | STAFF | Staff member |
| `viewer@tenant1.com` | `Viewer123!` | VIEWER | Read-only user |

## Test Tenant

- **Name:** Test Tenant 1
- **Code:** TNT-TEST-001
- **Engine:** erpnext

## Running Specific Tests

```bash
# Run only role tests
robot rbac/test_roles.robot

# Run only permission tests
robot rbac/test_permissions.robot

# Run with specific tags
robot --include positive rbac/

# Run with verbose output
robot --loglevel DEBUG rbac/
```

## Troubleshooting

### Tests fail with "No keyword found"
- Ensure `rbac_keywords.robot` exists in `QATests/resources/`
- Check resource import path in test files

### Tests fail with 401 Unauthorized
- Verify backend is running
- Check test user credentials
- Ensure migrations are applied

### Tests fail with 404 Not Found
- Verify API endpoints exist
- Check BASE_URL is correct
- Ensure backend is accessible

## Test Coverage

- **Role Management:** 25 tests
- **Permission Management:** 20 tests  
- **User Role Assignment:** 26 tests
- **Audit Logs:** 15 tests

**Total:** 86+ comprehensive tests covering positive, negative, and edge cases.
