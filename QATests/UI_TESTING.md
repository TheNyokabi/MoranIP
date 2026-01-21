# UI Testing with Robot Framework

## Setup

### Install Dependencies
```bash
cd QATests
pip install -r requirements.txt
rfbrowser init
```

### Start Services
```bash
# Terminal 1: Backend
cd Backend
uvicorn app.main:app --reload --port 9000

# Terminal 2: Frontend
cd Frontend
npm run dev
```

## Running UI Tests

### Run All UI Tests
```bash
cd QATests
robot --outputdir results tests/09_ui_inventory.robot tests/10_ui_purchases.robot tests/11_ui_auth.robot
```

### Run Specific Test Suite
```bash
# Inventory UI tests
robot --outputdir results tests/09_ui_inventory.robot

# Purchase UI tests
robot --outputdir results tests/10_ui_purchases.robot

# Auth UI tests
robot --outputdir results tests/11_ui_auth.robot
```

### Run with Tags
```bash
# Run only smoke tests
robot --outputdir results --include smoke tests/

# Run only CRUD tests
robot --outputdir results --include crud tests/

# Run critical tests
robot --outputdir results --include critical tests/
```

### Headless Mode
```bash
# Edit test file and change:
# New Browser    chromium    headless=False
# to:
# New Browser    chromium    headless=True
```

## Test Coverage

### Inventory Tests (09_ui_inventory.robot)
- ✅ Page load verification
- ✅ Create new item
- ✅ Search items
- ✅ View item details
- ✅ Edit item
- ✅ Create warehouse
- ✅ Loading states
- ✅ Error handling
- ✅ Navigation

### Purchase Tests (10_ui_purchases.robot)
- ✅ Suppliers page load
- ✅ Create supplier
- ✅ Search suppliers
- ✅ Purchase orders page
- ✅ View order details
- ✅ Filter orders
- ✅ Status badges
- ✅ Responsive design
- ✅ Form validation

### Auth Tests (11_ui_auth.robot)
- ✅ Login page load
- ✅ Successful login
- ✅ Failed login
- ✅ Session expiry
- ✅ Logout
- ✅ Protected routes
- ✅ Token persistence
- ✅ Form validation

## Configuration

### Update Test Variables
Edit test files to update:
- `${FRONTEND_URL}` - Frontend URL (default: http://localhost:4000)
- `${EMAIL}` - Test user email
- `${PASSWORD}` - Test user password

## Troubleshooting

### Browser Not Found
```bash
rfbrowser init
```

### Frontend Not Running
```bash
cd Frontend
npm run dev
```

### Backend Not Running
```bash
cd Backend
uvicorn app.main:app --reload --port 9000
```

### Test Failures
- Check browser console for errors
- Verify services are running
- Check test user credentials
- Review screenshots in results/

## CI/CD Integration

```yaml
# Example GitHub Actions
- name: Run UI Tests
  run: |
    pip install -r QATests/requirements.txt
    rfbrowser init
    robot --outputdir results QATests/tests/09_*.robot
```

## Best Practices

1. **Use Page Objects** - Create reusable keywords
2. **Tag Tests** - Use tags for organization
3. **Wait Strategies** - Use explicit waits
4. **Screenshots** - Capture on failure
5. **Headless Mode** - Use in CI/CD
