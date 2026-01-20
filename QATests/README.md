# MoranERP QA Tests

Comprehensive test suite for MoranERP platform using Robot Framework.

## Directory Structure

```
QATests/
├── rbac/                          # RBAC (Role-Based Access Control) tests
│   ├── test_roles.robot          # Role management tests (30+ tests)
│   ├── test_permissions.robot    # Permission API tests (25+ tests)
│   ├── test_user_roles.robot     # User role assignment tests (20+ tests)
│   ├── test_audit.robot          # Audit log tests (15+ tests)
│   ├── README.md                 # RBAC test documentation
│   ├── data/                     # Test data files
│   └── resources/                # RBAC-specific resources
├── resources/                     # Shared test resources
│   ├── common.resource           # Common keywords
│   └── rbac_keywords.robot       # RBAC-specific keywords
├── tests/                         # Other test suites
├── requirements.txt              # Python dependencies
└── README.md                     # This file
```

## Installation

```bash
# Install Robot Framework and dependencies
pip install -r requirements.txt
```

## Running Tests

### RBAC Tests

```bash
# Run all RBAC tests
robot rbac/

# Run specific test suite
robot rbac/test_roles.robot

# Run with tags
robot --include smoke rbac/           # Smoke tests only
robot --include positive rbac/        # Positive tests only
robot --include negative rbac/        # Negative tests only
robot --include edge rbac/            # Edge cases only

# Run with output directory
robot --outputdir results rbac/

# Run with variables
robot --variable BASE_URL:http://localhost:8000 rbac/
```

### Generate Reports

```bash
# Run tests and generate HTML reports
robot --report report.html --log log.html --outputdir results rbac/

# View reports
open results/report.html
open results/log.html
```

## Test Categories

### Tags
- `smoke` - Critical functionality tests
- `positive` - Happy path scenarios
- `negative` - Error handling and validation
- `edge` - Boundary conditions and edge cases
- `security` - Authorization and authentication
- `validation` - Input validation
- `performance` - Performance-related tests
- `concurrency` - Concurrent operation tests

## Test Design Techniques

The test suite uses industry-standard test design techniques:

1. **Equivalence Partitioning** - Valid/invalid inputs, role types
2. **Boundary Value Analysis** - String lengths, pagination limits
3. **State Transition Testing** - Role lifecycle, assignment states
4. **Decision Table Testing** - Permission combinations
5. **Error Guessing** - Security scenarios, edge cases
6. **Pairwise Testing** - Role-user combinations

## Coverage

- **Positive Tests (40%)** - CRUD operations, filtering, batch operations
- **Negative Tests (35%)** - Authentication failures, validation errors
- **Edge Cases (25%)** - Boundaries, concurrency, special characters

## Prerequisites

Before running tests:

1. **Start Backend Services**
   ```bash
   cd ../Backend
   docker-compose up -d postgres
   alembic upgrade head
   uvicorn app.main:app --reload
   ```

2. **Verify Backend is Running**
   ```bash
   curl http://localhost:8000/health
   ```

3. **Ensure Test Data Exists**
   - Database migrations applied
   - Seed data loaded
   - Test users created

## CI/CD Integration

### GitHub Actions

```yaml
name: QA Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd QATests
          pip install -r requirements.txt
      
      - name: Start services
        run: |
          docker-compose up -d
          sleep 10
      
      - name: Run migrations
        run: |
          cd Backend
          alembic upgrade head
      
      - name: Run smoke tests
        run: |
          cd QATests
          robot --include smoke --outputdir results rbac/
      
      - name: Publish test results
        uses: joonvena/robotframework-reporter-action@v2
        if: always()
        with:
          report_path: QATests/results
```

## Test Metrics

### Expected Execution Time
- Smoke tests: ~2 minutes
- Full RBAC suite: ~15 minutes
- All tests: ~30 minutes

### Expected Coverage
- API endpoints: 100%
- Positive scenarios: 95%
- Negative scenarios: 90%
- Edge cases: 85%

## Troubleshooting

### Common Issues

**Tests fail with "404 on auth endpoint"**
- Backend is not running
- Database is not connected
- Solution: Start backend and database

**Tests fail with "Connection refused"**
- Backend URL is incorrect
- Solution: Check `BASE_URL` variable in test files

**Import errors**
- Dependencies not installed
- Solution: `pip install -r requirements.txt`

**Database errors**
- Migrations not applied
- Solution: `cd Backend && alembic upgrade head`

## Contributing

When adding new tests:

1. Follow existing test structure
2. Use appropriate tags
3. Add test documentation
4. Update this README if needed
5. Ensure tests are idempotent
6. Clean up test data in teardown

## Support

For issues or questions:
- Check test logs in `results/` directory
- Review test documentation in `rbac/README.md`
- Check backend logs for API errors
