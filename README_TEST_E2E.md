# End-to-End POS System Test

## Overview

This test suite validates the complete POS workflow from workspace creation through sales transactions, ensuring data integrity, proper accounting entries, and inventory accuracy.

## Prerequisites

1. **Backend API running**: `http://localhost:9000`
2. **ERPNext running**: `http://localhost:8080` (if direct access needed)
3. **Required tools**:
   - `bash` (version 4+)
   - `curl`
   - `jq` (for JSON parsing - optional but recommended)
   - `bc` (for calculations)
   - `python3` (for JSON parsing in helpers)

## Test Data

The test uses a fictional company "TechMart Electronics" with:
- 1 admin user
- 3 workspace members (2 cashiers, 1 manager)
- 3 warehouses (Main Store, Branch A, Branch B)
- 3 products (iPhone 15 Pro, MacBook Air M2, iPad Pro 11")
- Stock entries with expense accounts
- POS profile with Cash and M-Pesa payment modes
- A test sale transaction

## Running the Tests

### Basic Execution

```bash
# Make scripts executable (if needed)
chmod +x test_e2e_*.sh

# Run the test suite
./test_e2e_pos_workflow.sh
```

### With Output Redirection

```bash
# Run and save output
./test_e2e_pos_workflow.sh 2>&1 | tee test_output.log

# Run in background
nohup ./test_e2e_pos_workflow.sh > test_output.log 2>&1 &
```

## Test Phases

1. **Workspace Creation**: Creates tenant and admin user
2. **User Management**: Creates 3 workspace members
3. **COA Verification**: Verifies Chart of Accounts provisioning
4. **Warehouse Creation**: Creates 3 warehouses
5. **Item Creation**: Creates 3 products
6. **Stock Entry**: Adds stock to all warehouses with expenses
7. **POS Setup**: Creates POS profile
8. **POS Sale**: Creates a test sale transaction
9. **Inventory Verification**: Verifies stock balances after sale
10. **GL Verification**: Verifies GL entries balance
11. **Dashboard Verification**: Verifies dashboard data consistency

## Test Output

### Log Files

- `test_logs/test_execution.log`: Detailed execution log
- `test_logs/test_report.json`: JSON test report
- `test_logs/platform_token.txt`: Platform admin token
- `test_logs/tenant_token.txt`: Tenant admin token
- `test_logs/tenant_id.txt`: Created tenant ID
- `test_logs/pos_profile_id.txt`: Created POS profile ID
- `test_logs/invoice_id.txt`: Created invoice ID
- `test_logs/last_response.json`: Last API response

### Test Report Format

The JSON report includes:
- Test execution timestamp
- Test phase name
- Total tests run
- Results array with:
  - Phase name
  - Test name
  - Status (pass/fail/skip)
  - Message
  - Duration in milliseconds

## Troubleshooting

### Common Issues

1. **API Not Running**
   - Ensure backend is running on `http://localhost:9000`
   - Check `docker-compose ps` if using Docker

2. **Authentication Failures**
   - Verify platform admin credentials in `test_e2e_config.sh`
   - Check if tenant already exists (test will skip creation)

3. **Provisioning Timeout**
   - Provisioning may take 2-5 minutes
   - Test will continue even if provisioning is still running
   - Check ERPNext logs if provisioning fails

4. **Account Not Found**
   - Accounts are created during provisioning
   - Some accounts may be created dynamically
   - Test will warn but continue

5. **Stock Balance Mismatches**
   - Verify stock entries were created successfully
   - Check ERPNext Stock Ledger Entries
   - Ensure items exist before adding stock

### Debug Mode

To enable verbose logging, modify `test_e2e_helpers.sh`:

```bash
# Add at the top
set -x  # Enable debug mode
```

## Configuration

Edit `test_e2e_config.sh` to customize:
- API base URLs
- Test tenant name
- User credentials
- Product details
- Stock quantities
- Expected values

## Cleanup

To clean up test data:

1. Delete the tenant via API:
```bash
curl -X DELETE "${API_BASE}/iam/tenants/${TENANT_ID}" \
  -H "Authorization: Bearer ${PLATFORM_TOKEN}"
```

2. Or manually delete from database (if needed)

## Expected Duration

- Full test run: 5-10 minutes
- Individual phases: 30 seconds - 2 minutes each

## Success Criteria

All tests pass when:
- ✅ All HTTP requests return expected status codes
- ✅ All data created successfully
- ✅ Inventory balances accurate
- ✅ GL entries balance correctly
- ✅ VAT calculations correct
- ✅ Dashboard data consistent
- ✅ No placeholder data found

## Next Steps After Test Completion

1. Review test report: `test_logs/test_report.json`
2. Check for failures in execution log
3. Fix any identified issues
4. Re-run tests to verify fixes
5. Integrate into CI/CD pipeline
