# Provisioning Testing Guide

## Status: Ready for Testing ✅

All fixes have been implemented and verified. The provisioning service is ready for end-to-end testing.

## Recent Fixes

### 1. Mode of Payment Account Configuration
- **Issue**: ERPNext requires Mode of Payment entries to have a default Cash or Bank account
- **Fix**: Updated `_ensure_mode_of_payment()` to:
  - Accept company name and abbreviation
  - Look up appropriate Cash or Bank accounts
  - Set account in Mode of Payment when creating

### 2. Company Abbreviation Storage
- **Optimization**: Company abbreviation is now stored in provisioning metadata
- **Benefit**: Reduces API calls by reusing stored abbreviation

## Testing Steps

### 1. Create a New Workspace

1. Navigate to `/admin/workspaces`
2. Fill in the form:
   - **Name**: "Test Company" (or any name)
   - **Category**: "Enterprise" (or any category)
   - **Description**: "Test workspace for provisioning"
   - **Country**: Kenya (KE)
   - **Admin Email**: test@example.com
   - **Admin Name**: Test Admin
   - **Admin Password**: (secure password)
   - **Engine**: ERPNext
3. Click "Create Workspace"

### 2. Monitor Provisioning Progress

The UI should show:
- Real-time provisioning status
- Progress bar with percentage
- Current step being executed
- Any errors that occur

### 3. Expected Flow

The provisioning should complete these steps:

1. ✅ **Step 0: Engine Check** - Verifies ERPNext is online
2. ✅ **Step 1: Platform Setup** - Creates onboarding record
3. ✅ **Step 2: Company Creation** - Creates company in ERPNext
   - Country code mapped to full name (KE → Kenya)
   - Unique abbreviation generated
   - Company abbreviation stored in metadata
4. ✅ **Step 3: Chart of Accounts** - Imports country-specific chart
5. ✅ **Step 4: Warehouses** - Creates Main Store and POS Store
   - Warehouse names stored in metadata
6. ✅ **Step 5: Settings** - Configures selling and stock settings
7. ✅ **Step 6: Items** - (Skipped if demo data disabled)
8. ✅ **Step 7: Customer** - Creates default "Walk-In Customer"
9. ✅ **Step 8: POS Profile** - Creates POS Profile
   - Mode of Payment entries created with accounts
   - Uses company abbreviation from metadata
10. ✅ **Step 9: POS Session** - Opens initial POS session
11. ✅ **Step 10: Post-Sale Updates** - Finalizes provisioning

### 4. Verify Success

After provisioning completes:

1. **Check Status**: Should show "COMPLETED" with 100% progress
2. **Check ERPNext**: 
   - Company should exist with correct country name
   - Warehouses should exist
   - POS Profile should exist
   - Mode of Payment entries should have accounts configured
3. **Check Logs**: No critical errors should appear

## Troubleshooting

### If Provisioning Fails

1. **Check Error Message**: The UI should display specific error messages
2. **Check Logs**: 
   ```bash
   docker-compose logs api --tail=100 | grep -i "error\|exception"
   ```
3. **Common Issues**:
   - **Mode of Payment Error**: Account not found - check if chart of accounts was imported
   - **Warehouse Error**: Warehouse not found - check if warehouses were created
   - **Company Error**: Company already exists - try different name

### If Account Lookup Fails

If Mode of Payment creation fails due to missing account:
- The system will log a warning
- Mode of Payment will still be created (may need manual account configuration)
- Check ERPNext to verify accounts exist: "Cash - {ABBR}" or "Bank - {ABBR}"

## Verification Commands

### Check Provisioning Status
```bash
# Get tenant ID from database
TENANT_ID=$(docker-compose exec -T postgres psql -U odoo -d postgres -t -c "SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1" | tr -d ' ')

# Check provisioning status
curl -X GET "http://localhost:9000/api/provisioning/tenants/${TENANT_ID}/status" \
  -H "Authorization: Bearer {token}"
```

### Verify ERPNext Resources
```bash
# Run verification script
docker-compose exec api python scripts/verify_erpnext_provisioning.py ${TENANT_ID}
```

### Check Logs
```bash
# View recent provisioning logs
docker-compose logs api --tail=200 | grep -i "provisioning\|correlation"
```

## Success Criteria

✅ All 11 steps complete successfully  
✅ No critical errors in logs  
✅ Company created with correct country name  
✅ Warehouses created and stored in metadata  
✅ POS Profile created with payment methods  
✅ Mode of Payment entries have accounts configured  
✅ Tenant status is "PROVISIONED"  

## Next Steps After Testing

1. **If Successful**: 
   - Document any edge cases found
   - Consider adding more test scenarios
   - Update documentation with any learnings

2. **If Issues Found**:
   - Document the specific error
   - Check logs for details
   - Report issue with correlation ID

## Notes

- Provisioning is idempotent - can be retried safely
- Steps are cached - completed steps won't re-run
- Error messages are actionable - provide specific guidance
- Company abbreviation is stored in metadata for efficiency
