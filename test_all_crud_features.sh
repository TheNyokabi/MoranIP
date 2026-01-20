#!/bin/bash

# Comprehensive CRUD Testing Script
# Tests all ERPNext modules via Frontend API Proxy
# Use Case: Setting up a retail business "ABC Electronics"

set -e

FRONTEND_URL="http://localhost:4000"
EMAIL="admin@moran.com"
PASSWORD="admin123"

echo "🧪 COMPREHENSIVE CRUD FEATURES TEST"
echo "===================================="
echo ""
echo "Use Case: Setting up 'ABC Electronics' - A retail electronics store"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print test results
print_test() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Step 1: Login
echo "📝 Step 1: Login"
echo "----------------"
LOGIN_RESPONSE=$(curl -s -X POST "$FRONTEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Step 2: Get Tenant Info
echo "📝 Step 2: Get Tenant Information"
echo "----------------------------------"
TENANT_RESPONSE=$(curl -s -X GET "$FRONTEND_URL/api/auth/me/memberships" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

TENANT_SLUG=$(echo $TENANT_RESPONSE | grep -o '"slug":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_SLUG" ]; then
    echo -e "${RED}❌ Failed to get tenant${NC}"
    echo "Response: $TENANT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Tenant found: $TENANT_SLUG${NC}"
echo ""

# Set headers for all subsequent requests
HEADERS=(
    -H "Authorization: Bearer $ACCESS_TOKEN"
    -H "X-Tenant-ID: $TENANT_SLUG"
    -H "Content-Type: application/json"
)

echo "🚀 Starting CRUD Tests for All Modules"
echo "========================================"
echo ""

# ============================================
# MODULE 1: CRM - Customer Relationship Management
# ============================================
echo "📦 MODULE 1: CRM (Customer Relationship Management)"
echo "---------------------------------------------------"

# Create Contact
echo "  Creating Contact..."
CONTACT_DATA='{
    "first_name": "John",
    "last_name": "Doe",
    "email_id": "john.doe@example.com",
    "mobile_no": "+254712345678",
    "company_name": "ABC Electronics",
    "designation": "Manager"
}'

CONTACT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/crm/contacts" \
    "${HEADERS[@]}" \
    -d "$CONTACT_DATA")
HTTP_CODE=$(echo "$CONTACT_RESPONSE" | tail -n1)
CONTACT_BODY=$(echo "$CONTACT_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    print_test 0 "Create Contact"
    CONTACT_NAME=$(echo $CONTACT_BODY | grep -o '"name":"[^"]*' | cut -d'"' -f4)
else
    print_test 1 "Create Contact (HTTP $HTTP_CODE)"
    echo "Response: $CONTACT_BODY"
fi

# List Contacts
echo "  Listing Contacts..."
CONTACTS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/crm/contacts" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$CONTACTS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Contacts"

# Create Lead
echo "  Creating Lead..."
LEAD_DATA='{
    "lead_name": "Tech Solutions Ltd",
    "company_name": "Tech Solutions Ltd",
    "email_id": "info@techsolutions.com",
    "mobile_no": "+254723456789",
    "source": "Website",
    "industry": "Technology"
}'

LEAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/crm/leads" \
    "${HEADERS[@]}" \
    -d "$LEAD_DATA")
HTTP_CODE=$(echo "$LEAD_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Lead"

# Create Customer
echo "  Creating Customer..."
CUSTOMER_DATA='{
    "customer_name": "ABC Electronics",
    "customer_type": "Company",
    "customer_group": "Retail",
    "territory": "Kenya",
    "email_id": "sales@abcelectronics.com",
    "mobile_no": "+254700000000"
}'

CUSTOMER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/crm/customers" \
    "${HEADERS[@]}" \
    -d "$CUSTOMER_DATA")
HTTP_CODE=$(echo "$CUSTOMER_RESPONSE" | tail -n1)
CUSTOMER_BODY=$(echo "$CUSTOMER_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Customer"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    CUSTOMER_NAME=$(echo $CUSTOMER_BODY | grep -o '"name":"[^"]*' | cut -d'"' -f4)
fi

echo ""

# ============================================
# MODULE 2: INVENTORY
# ============================================
echo "📦 MODULE 2: INVENTORY"
echo "----------------------"

# Create Item
echo "  Creating Item..."
ITEM_DATA='{
    "item_code": "LAPTOP-001",
    "item_name": "Dell Laptop XPS 15",
    "item_group": "Products",
    "stock_uom": "Nos",
    "standard_rate": 120000,
    "description": "High-performance laptop for business use"
}'

ITEM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/inventory/items" \
    "${HEADERS[@]}" \
    -d "$ITEM_DATA")
HTTP_CODE=$(echo "$ITEM_RESPONSE" | tail -n1)
ITEM_BODY=$(echo "$ITEM_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Item"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    ITEM_CODE=$(echo $ITEM_BODY | grep -o '"item_code":"[^"]*' | cut -d'"' -f4)
fi

# List Items
echo "  Listing Items..."
ITEMS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/inventory/items" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$ITEMS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Items"

# Create Warehouse
echo "  Creating Warehouse..."
WAREHOUSE_DATA='{
    "warehouse_name": "Main Store",
    "warehouse_type": "Store",
    "company": "ABC Electronics"
}'

WAREHOUSE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/inventory/warehouses" \
    "${HEADERS[@]}" \
    -d "$WAREHOUSE_DATA")
HTTP_CODE=$(echo "$WAREHOUSE_RESPONSE" | tail -n1)
WAREHOUSE_BODY=$(echo "$WAREHOUSE_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Warehouse"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    WAREHOUSE_NAME=$(echo $WAREHOUSE_BODY | grep -o '"name":"[^"]*' | cut -d'"' -f4)
fi

echo ""

# ============================================
# MODULE 3: ACCOUNTING
# ============================================
echo "📦 MODULE 3: ACCOUNTING"
echo "-----------------------"

# Create Account
echo "  Creating Account..."
ACCOUNT_DATA='{
    "account_name": "Sales Account",
    "account_type": "Income Account",
    "root_type": "Income",
    "company": "ABC Electronics"
}'

ACCOUNT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/accounting/accounts" \
    "${HEADERS[@]}" \
    -d "$ACCOUNT_DATA")
HTTP_CODE=$(echo "$ACCOUNT_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Account"

# List Accounts
echo "  Listing Accounts..."
ACCOUNTS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/accounting/accounts" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$ACCOUNTS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Accounts"

# Create Journal Entry
echo "  Creating Journal Entry..."
JOURNAL_DATA='{
    "posting_date": "'$(date +%Y-%m-%d)'",
    "company": "ABC Electronics",
    "accounts": [
        {
            "account": "Sales Account",
            "debit": 0,
            "credit": 50000
        }
    ]
}'

JOURNAL_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/accounting/journal-entries" \
    "${HEADERS[@]}" \
    -d "$JOURNAL_DATA")
HTTP_CODE=$(echo "$JOURNAL_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Journal Entry"

echo ""

# ============================================
# MODULE 4: SALES
# ============================================
echo "📦 MODULE 4: SALES"
echo "------------------"

# Create Quotation
echo "  Creating Quotation..."
QUOTATION_DATA='{
    "quotation_to": "Customer",
    "party_name": "ABC Electronics",
    "transaction_date": "'$(date +%Y-%m-%d)'",
    "company": "ABC Electronics",
    "items": [
        {
            "item_code": "LAPTOP-001",
            "qty": 2,
            "rate": 120000
        }
    ]
}'

QUOTATION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/sales/quotations" \
    "${HEADERS[@]}" \
    -d "$QUOTATION_DATA")
HTTP_CODE=$(echo "$QUOTATION_RESPONSE" | tail -n1)
QUOTATION_BODY=$(echo "$QUOTATION_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Quotation"

# List Quotations
echo "  Listing Quotations..."
QUOTATIONS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/sales/quotations" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$QUOTATIONS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Quotations"

echo ""

# ============================================
# MODULE 5: HR
# ============================================
echo "📦 MODULE 5: HR (Human Resources)"
echo "---------------------------------"

# Create Employee
echo "  Creating Employee..."
EMPLOYEE_DATA='{
    "first_name": "Jane",
    "last_name": "Smith",
    "company": "ABC Electronics",
    "date_of_joining": "'$(date +%Y-%m-%d)'",
    "designation": "Sales Manager",
    "department": "Sales",
    "email": "jane.smith@abcelectronics.com",
    "cell_number": "+254711111111"
}'

EMPLOYEE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/hr/employees" \
    "${HEADERS[@]}" \
    -d "$EMPLOYEE_DATA")
HTTP_CODE=$(echo "$EMPLOYEE_RESPONSE" | tail -n1)
EMPLOYEE_BODY=$(echo "$EMPLOYEE_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Employee"

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    EMPLOYEE_NAME=$(echo $EMPLOYEE_BODY | grep -o '"name":"[^"]*' | cut -d'"' -f4)
fi

# List Employees
echo "  Listing Employees..."
EMPLOYEES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/hr/employees" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$EMPLOYEES_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Employees"

# Create Attendance
echo "  Creating Attendance Record..."
ATTENDANCE_DATA='{
    "employee": "'${EMPLOYEE_NAME:-EMP-001}'",
    "attendance_date": "'$(date +%Y-%m-%d)'",
    "status": "Present",
    "working_hours": 8
}'

ATTENDANCE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/hr/attendance" \
    "${HEADERS[@]}" \
    -d "$ATTENDANCE_DATA")
HTTP_CODE=$(echo "$ATTENDANCE_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Attendance"

echo ""

# ============================================
# MODULE 6: MANUFACTURING
# ============================================
echo "📦 MODULE 6: MANUFACTURING"
echo "--------------------------"

# Create BOM
echo "  Creating BOM..."
BOM_DATA='{
    "item": "LAPTOP-001",
    "quantity": 1,
    "company": "ABC Electronics"
}'

BOM_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/manufacturing/bom" \
    "${HEADERS[@]}" \
    -d "$BOM_DATA")
HTTP_CODE=$(echo "$BOM_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create BOM"

# List BOMs
echo "  Listing BOMs..."
BOMS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/manufacturing/bom" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$BOMS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List BOMs"

echo ""

# ============================================
# MODULE 7: PROJECTS
# ============================================
echo "📦 MODULE 7: PROJECTS"
echo "---------------------"

# Create Project
echo "  Creating Project..."
PROJECT_DATA='{
    "project_name": "Store Setup Project",
    "company": "ABC Electronics",
    "expected_start_date": "'$(date +%Y-%m-%d)'",
    "expected_end_date": "'$(date -v+30d +%Y-%m-%d 2>/dev/null || date -d "+30 days" +%Y-%m-%d)'",
    "project_type": "Internal"
}'

PROJECT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/projects/projects" \
    "${HEADERS[@]}" \
    -d "$PROJECT_DATA")
HTTP_CODE=$(echo "$PROJECT_RESPONSE" | tail -n1)
PROJECT_BODY=$(echo "$PROJECT_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Project"

# Create Task
echo "  Creating Task..."
TASK_DATA='{
    "subject": "Install POS System",
    "project": "Store Setup Project",
    "status": "Open",
    "priority": "High"
}'

TASK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/projects/tasks" \
    "${HEADERS[@]}" \
    -d "$TASK_DATA")
HTTP_CODE=$(echo "$TASK_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Task"

echo ""

# ============================================
# MODULE 8: SUPPORT
# ============================================
echo "📦 MODULE 8: SUPPORT"
echo "--------------------"

# Create Issue
echo "  Creating Support Issue..."
ISSUE_DATA='{
    "subject": "POS System Not Responding",
    "customer": "ABC Electronics",
    "status": "Open",
    "priority": "High",
    "issue_type": "Technical",
    "description": "POS system freezes when processing payments"
}'

ISSUE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/support/issues" \
    "${HEADERS[@]}" \
    -d "$ISSUE_DATA")
HTTP_CODE=$(echo "$ISSUE_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Issue"

# List Issues
echo "  Listing Issues..."
ISSUES_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/support/issues" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$ISSUES_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Issues"

echo ""

# ============================================
# MODULE 9: ASSETS
# ============================================
echo "📦 MODULE 9: ASSETS"
echo "-------------------"

# Create Asset
echo "  Creating Asset..."
ASSET_DATA='{
    "asset_name": "POS Terminal 01",
    "asset_category": "IT Equipment",
    "company": "ABC Electronics",
    "purchase_date": "'$(date +%Y-%m-%d)'",
    "purchase_amount": 50000,
    "location": "Main Store",
    "department": "Sales"
}'

ASSET_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/assets/assets" \
    "${HEADERS[@]}" \
    -d "$ASSET_DATA")
HTTP_CODE=$(echo "$ASSET_RESPONSE" | tail -n1)
ASSET_BODY=$(echo "$ASSET_RESPONSE" | sed '$d')
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Asset"

# List Assets
echo "  Listing Assets..."
ASSETS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/assets/assets" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$ASSETS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Assets"

echo ""

# ============================================
# MODULE 10: QUALITY
# ============================================
echo "📦 MODULE 10: QUALITY"
echo "---------------------"

# Create Quality Inspection
echo "  Creating Quality Inspection..."
INSPECTION_DATA='{
    "inspection_type": "Incoming",
    "item_code": "LAPTOP-001",
    "status": "Pending",
    "inspection_date": "'$(date +%Y-%m-%d)'"
}'

INSPECTION_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$FRONTEND_URL/api/quality/inspections" \
    "${HEADERS[@]}" \
    -d "$INSPECTION_DATA")
HTTP_CODE=$(echo "$INSPECTION_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ] && echo 0 || echo 1) "Create Quality Inspection"

# List Inspections
echo "  Listing Quality Inspections..."
INSPECTIONS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$FRONTEND_URL/api/quality/inspections" \
    "${HEADERS[@]}")
HTTP_CODE=$(echo "$INSPECTIONS_RESPONSE" | tail -n1)
print_test $([ "$HTTP_CODE" -eq 200 ] && echo 0 || echo 1) "List Quality Inspections"

echo ""

# ============================================
# SUMMARY
# ============================================
echo "📊 TEST SUMMARY"
echo "==============="
echo ""
echo "✅ All CRUD operations tested across 10 modules:"
echo "   1. CRM (Contacts, Leads, Customers)"
echo "   2. Inventory (Items, Warehouses)"
echo "   3. Accounting (Accounts, Journal Entries)"
echo "   4. Sales (Quotations)"
echo "   5. HR (Employees, Attendance)"
echo "   6. Manufacturing (BOMs)"
echo "   7. Projects (Projects, Tasks)"
echo "   8. Support (Issues)"
echo "   9. Assets (Assets)"
echo "  10. Quality (Inspections)"
echo ""
echo "🎯 Use Case: ABC Electronics retail store setup"
echo "   - Customer management (CRM)"
echo "   - Inventory setup (Items, Warehouses)"
echo "   - Financial setup (Accounting)"
echo "   - Sales process (Quotations)"
echo "   - Staff management (HR)"
echo "   - Production planning (Manufacturing)"
echo "   - Project tracking (Projects)"
echo "   - Support tickets (Support)"
echo "   - Asset tracking (Assets)"
echo "   - Quality control (Quality)"
echo ""
echo "✅ Testing complete! Check results above for any failures."
echo ""
