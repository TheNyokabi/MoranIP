# CRUD Features Testing Guide

## Overview

This guide provides comprehensive testing instructions for all CRUD features across all ERPNext modules using curl via the frontend API proxy.

## Use Case Study: ABC Electronics

**Scenario**: Setting up a new retail electronics store "ABC Electronics"

**Business Flow**:
1. Set up customer relationships (CRM)
2. Add inventory items and warehouses
3. Configure accounting accounts
4. Create sales quotations
5. Manage employees and attendance (HR)
6. Plan manufacturing operations
7. Track projects and tasks
8. Handle support issues
9. Manage assets
10. Perform quality inspections

## Prerequisites

1. Frontend running on `http://localhost:4000`
2. Backend API accessible
3. ERPNext service running
4. Valid user credentials:
   - Email: `admin@moran.com`
   - Password: `admin123`
5. Active tenant/workspace

## Quick Test

Run the automated test script:

```bash
./test_all_crud_features.sh
```

## Manual Testing Steps

### Step 1: Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@moran.com",
    "password": "admin123"
  }'
```

**Expected**: Returns `access_token`

**Save the token**:
```bash
export TOKEN="your_access_token_here"
export TENANT_SLUG="your_tenant_slug_here"
```

### Step 2: Get Tenant Information

```bash
curl -X GET http://localhost:4000/api/auth/me/memberships \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: Returns tenant information including `slug`

---

## Module-by-Module Testing

### Module 1: CRM (Customer Relationship Management)

#### Create Contact
```bash
curl -X POST http://localhost:4000/api/crm/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email_id": "john.doe@example.com",
    "mobile_no": "+254712345678",
    "company_name": "ABC Electronics",
    "designation": "Manager"
  }'
```

#### List Contacts
```bash
curl -X GET http://localhost:4000/api/crm/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG"
```

#### Create Lead
```bash
curl -X POST http://localhost:4000/api/crm/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_name": "Tech Solutions Ltd",
    "company_name": "Tech Solutions Ltd",
    "email_id": "info@techsolutions.com",
    "mobile_no": "+254723456789",
    "source": "Website",
    "industry": "Technology"
  }'
```

#### Create Customer
```bash
curl -X POST http://localhost:4000/api/crm/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "ABC Electronics",
    "customer_type": "Company",
    "customer_group": "Retail",
    "territory": "Kenya",
    "email_id": "sales@abcelectronics.com",
    "mobile_no": "+254700000000"
  }'
```

---

### Module 2: Inventory

#### Create Item
```bash
curl -X POST http://localhost:4000/api/inventory/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "LAPTOP-001",
    "item_name": "Dell Laptop XPS 15",
    "item_group": "Products",
    "stock_uom": "Nos",
    "standard_rate": 120000,
    "description": "High-performance laptop for business use"
  }'
```

#### List Items
```bash
curl -X GET http://localhost:4000/api/inventory/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG"
```

#### Create Warehouse
```bash
curl -X POST http://localhost:4000/api/inventory/warehouses \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_name": "Main Store",
    "warehouse_type": "Store",
    "company": "ABC Electronics"
  }'
```

---

### Module 3: Accounting

#### Create Account
```bash
curl -X POST http://localhost:4000/api/accounting/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "account_name": "Sales Account",
    "account_type": "Income Account",
    "root_type": "Income",
    "company": "ABC Electronics"
  }'
```

#### Create Journal Entry
```bash
curl -X POST http://localhost:4000/api/accounting/journal-entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "posting_date": "2025-01-15",
    "company": "ABC Electronics",
    "accounts": [
      {
        "account": "Sales Account",
        "debit": 0,
        "credit": 50000
      }
    ]
  }'
```

---

### Module 4: Sales

#### Create Quotation
```bash
curl -X POST http://localhost:4000/api/sales/quotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "quotation_to": "Customer",
    "party_name": "ABC Electronics",
    "transaction_date": "2025-01-15",
    "company": "ABC Electronics",
    "items": [
      {
        "item_code": "LAPTOP-001",
        "qty": 2,
        "rate": 120000
      }
    ]
  }'
```

#### List Quotations
```bash
curl -X GET http://localhost:4000/api/sales/quotations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG"
```

---

### Module 5: HR

#### Create Employee
```bash
curl -X POST http://localhost:4000/api/hr/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "company": "ABC Electronics",
    "date_of_joining": "2025-01-15",
    "designation": "Sales Manager",
    "department": "Sales",
    "email": "jane.smith@abcelectronics.com",
    "cell_number": "+254711111111"
  }'
```

#### Create Attendance
```bash
curl -X POST http://localhost:4000/api/hr/attendance \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "employee": "EMP-001",
    "attendance_date": "2025-01-15",
    "status": "Present",
    "working_hours": 8
  }'
```

---

### Module 6: Manufacturing

#### Create BOM
```bash
curl -X POST http://localhost:4000/api/manufacturing/bom \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "item": "LAPTOP-001",
    "quantity": 1,
    "company": "ABC Electronics"
  }'
```

---

### Module 7: Projects

#### Create Project
```bash
curl -X POST http://localhost:4000/api/projects/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "Store Setup Project",
    "company": "ABC Electronics",
    "expected_start_date": "2025-01-15",
    "expected_end_date": "2025-02-15",
    "project_type": "Internal"
  }'
```

#### Create Task
```bash
curl -X POST http://localhost:4000/api/projects/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Install POS System",
    "project": "Store Setup Project",
    "status": "Open",
    "priority": "High"
  }'
```

---

### Module 8: Support

#### Create Issue
```bash
curl -X POST http://localhost:4000/api/support/issues \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "POS System Not Responding",
    "customer": "ABC Electronics",
    "status": "Open",
    "priority": "High",
    "issue_type": "Technical",
    "description": "POS system freezes when processing payments"
  }'
```

---

### Module 9: Assets

#### Create Asset
```bash
curl -X POST http://localhost:4000/api/assets/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_name": "POS Terminal 01",
    "asset_category": "IT Equipment",
    "company": "ABC Electronics",
    "purchase_date": "2025-01-15",
    "purchase_amount": 50000,
    "location": "Main Store",
    "department": "Sales"
  }'
```

---

### Module 10: Quality

#### Create Quality Inspection
```bash
curl -X POST http://localhost:4000/api/quality/inspections \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "inspection_type": "Incoming",
    "item_code": "LAPTOP-001",
    "status": "Pending",
    "inspection_date": "2025-01-15"
  }'
```

---

## Expected Responses

### Success Response Format
```json
{
  "data": {
    "name": "RESOURCE-001",
    ...
  }
}
```

### List Response Format
```json
{
  "data": [
    {
      "name": "RESOURCE-001",
      ...
    },
    ...
  ]
}
```

### Error Response Format
```json
{
  "detail": "Error message here"
}
```

## HTTP Status Codes

- `200 OK` - Success (GET, PUT)
- `201 Created` - Success (POST)
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Authentication failed
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Testing Checklist

- [ ] Login successful
- [ ] Tenant information retrieved
- [ ] CRM: Contact created
- [ ] CRM: Lead created
- [ ] CRM: Customer created
- [ ] Inventory: Item created
- [ ] Inventory: Warehouse created
- [ ] Accounting: Account created
- [ ] Accounting: Journal Entry created
- [ ] Sales: Quotation created
- [ ] HR: Employee created
- [ ] HR: Attendance created
- [ ] Manufacturing: BOM created
- [ ] Projects: Project created
- [ ] Projects: Task created
- [ ] Support: Issue created
- [ ] Assets: Asset created
- [ ] Quality: Inspection created
- [ ] All list operations working
- [ ] Error handling working

## Troubleshooting

### Authentication Issues
- Verify token is valid and not expired
- Check token format: `Bearer <token>`
- Verify tenant slug is correct

### 404 Errors
- Verify endpoint paths are correct
- Check that backend routes are registered
- Verify module is enabled for tenant

### 500 Errors
- Check backend logs
- Verify ERPNext is running
- Check database connectivity

### Validation Errors
- Verify required fields are provided
- Check data types match expected format
- Review field constraints

## Notes

- All requests go through frontend API proxy at `http://localhost:4000`
- Tenant context is provided via `X-Tenant-ID` header
- Authentication is via JWT token in `Authorization` header
- Dates should be in `YYYY-MM-DD` format
- All monetary values are in base currency units
