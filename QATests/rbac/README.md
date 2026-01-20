# Robot Framework Test Configuration for RBAC

## Requirements
robot==6.1.1
robotframework-requests==0.9.5
robotframework-jsonlibrary==0.5
requests==2.31.0

## Installation
# pip install -r requirements-robot.txt

## Running Tests

### Run all RBAC tests
# robot tests/robot/rbac/

### Run specific test suite
# robot tests/robot/rbac/test_roles.robot

### Run with tags
# robot --include positive tests/robot/rbac/
# robot --include smoke tests/robot/rbac/
# robot --include negative tests/robot/rbac/
# robot --include edge tests/robot/rbac/

### Run with output directory
# robot --outputdir results tests/robot/rbac/

### Run with variables
# robot --variable BASE_URL:http://localhost:8000 tests/robot/rbac/

### Generate reports
# robot --report report.html --log log.html tests/robot/rbac/

## Test Organization

### Test Suites:
- test_roles.robot: Role management CRUD operations (30+ tests)
- test_permissions.robot: Permission discovery and checking (25+ tests)
- test_user_roles.robot: User role assignments and overrides (20+ tests)
- test_audit.robot: Audit log viewing and filtering (15+ tests)

### Test Categories (Tags):
- positive: Happy path tests
- negative: Error handling and validation tests
- edge: Boundary conditions and edge cases
- smoke: Critical functionality tests
- security: Authorization and authentication tests
- validation: Input validation tests
- performance: Performance-related tests
- concurrency: Concurrent operation tests

## Test Design Techniques Used

1. **Equivalence Partitioning**
   - Valid/invalid inputs
   - Different role types
   - Permission modules

2. **Boundary Value Analysis**
   - Maximum/minimum string lengths
   - Pagination limits
   - Date ranges

3. **State Transition Testing**
   - Role lifecycle (create -> update -> delete)
   - Role assignment lifecycle
   - Permission override states

4. **Decision Table Testing**
   - Permission combinations
   - Role-permission mappings

5. **Error Guessing**
   - Security scenarios
   - Concurrent operations
   - Invalid UUIDs

6. **Pairwise Testing**
   - Role-user combinations
   - Filter combinations

## Coverage

### Positive Tests (~40%)
- CRUD operations
- Filtering and searching
- Batch operations
- Analytics

### Negative Tests (~35%)
- Authentication failures
- Authorization failures
- Validation errors
- Invalid inputs

### Edge Cases (~25%)
- Boundary values
- Concurrency
- Performance limits
- Special characters

## Test Data

Test data is managed through:
- Database seed data (migrations)
- Test user setup in suite setup
- Dynamic test data generation
- Cleanup in teardown

## CI/CD Integration

### GitHub Actions Example:
```yaml
- name: Run Robot Tests
  run: |
    robot --outputdir results --include smoke tests/robot/rbac/
    
- name: Publish Test Results
  uses: joonvena/robotframework-reporter-action@v2
  if: always()
  with:
    report_path: results
```

### Docker Example:
```bash
docker-compose up -d
robot --variable BASE_URL:http://localhost:8000 tests/robot/rbac/
docker-compose down
```

## Metrics

Expected test execution time:
- Smoke tests: ~2 minutes
- Full suite: ~15 minutes
- With database setup: ~20 minutes

Expected coverage:
- API endpoints: 100%
- Positive scenarios: 95%
- Negative scenarios: 90%
- Edge cases: 85%
