#!/bin/bash
# End-to-End Test Configuration
# Contains all test data in human-readable format

# ==================== Environment Configuration ====================
export BASE_URL="${BASE_URL:-http://localhost:9000}"
export API_BASE="${API_BASE:-${BASE_URL}/api}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:4000}"
export ERPNEXT_BASE="${ERPNEXT_BASE:-http://localhost:8080}"

# Platform Admin Credentials (for tenant creation)
export PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-admin@example.com}"
export PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-password}"

# Test Execution Settings
export SKIP_STOCK_VALIDATION="${SKIP_STOCK_VALIDATION:-false}"
export TEST_TIMEOUT="${TEST_TIMEOUT:-300}"  # 5 minutes per phase
export MAX_RETRIES="${MAX_RETRIES:-3}"
export PROVISIONING_WAIT_TIME="${PROVISIONING_WAIT_TIME:-600}"  # Wait up to 10 minutes for provisioning

# ==================== Test Tenant Configuration ====================
export TENANT_NAME="TechMart Electronics"
export TENANT_CATEGORY="Retail"
export TENANT_COUNTRY_CODE="KE"
export TENANT_ENGINE="erpnext"
export TENANT_DESCRIPTION="End-to-end test workspace for POS system validation"

# ==================== Admin User Configuration ====================
# Using .example.com domain (RFC 2606 reserved for documentation/testing)
export ADMIN_EMAIL="admin@techmart.example.com"
export ADMIN_NAME="John Admin"
export ADMIN_PASSWORD="SecurePass123!"

# ==================== Workspace Members Configuration ====================
# Cashier 1
export CASHIER1_EMAIL="cashier1@techmart.example.com"
export CASHIER1_NAME="Alice Cashier"
export CASHIER1_PASSWORD="Cashier123!"
export CASHIER1_ROLE="CASHIER"

# Cashier 2
export CASHIER2_EMAIL="cashier2@techmart.example.com"
export CASHIER2_NAME="Bob Cashier"
export CASHIER2_PASSWORD="Cashier123!"
export CASHIER2_ROLE="CASHIER"

# Manager
export MANAGER_EMAIL="manager@techmart.example.com"
export MANAGER_NAME="Carol Manager"
export MANAGER_PASSWORD="Manager123!"
export MANAGER_ROLE="MANAGER"

# ==================== Warehouse Configuration ====================
# Main Store
export WAREHOUSE_MAIN_NAME="Main Store"
export WAREHOUSE_MAIN_TYPE="Stores"
export WAREHOUSE_MAIN_LOCATION="Nairobi CBD"
export WAREHOUSE_MAIN_ACCOUNT="Stock In Hand - Main Store"

# Branch A
export WAREHOUSE_BRANCH_A_NAME="Branch A"
export WAREHOUSE_BRANCH_A_TYPE="Stores"
export WAREHOUSE_BRANCH_A_LOCATION="Westlands"
export WAREHOUSE_BRANCH_A_ACCOUNT="Stock In Hand - Branch A"

# Branch B
export WAREHOUSE_BRANCH_B_NAME="Branch B"
export WAREHOUSE_BRANCH_B_TYPE="Stores"
export WAREHOUSE_BRANCH_B_LOCATION="Karen"
export WAREHOUSE_BRANCH_B_ACCOUNT="Stock In Hand - Branch B"

# ==================== Item Configuration ====================
# iPhone 15 Pro
export ITEM_IPHONE_CODE="PHN-IPH-15"
export ITEM_IPHONE_NAME="iPhone 15 Pro"
export ITEM_IPHONE_GROUP="Electronics"
export ITEM_IPHONE_UOM="Nos"
export ITEM_IPHONE_STANDARD_RATE="150000.00"
export ITEM_IPHONE_VAT_RATE="16"
export ITEM_IPHONE_DESCRIPTION="Apple iPhone 15 Pro 256GB"
export ITEM_IPHONE_PURCHASE_RATE="130000.00"  # Cost price for stock entry

# MacBook Air M2
export ITEM_MACBOOK_CODE="LAP-MAC-14"
export ITEM_MACBOOK_NAME="MacBook Air M2"
export ITEM_MACBOOK_GROUP="Electronics"
export ITEM_MACBOOK_UOM="Nos"
export ITEM_MACBOOK_STANDARD_RATE="180000.00"
export ITEM_MACBOOK_VAT_RATE="16"
export ITEM_MACBOOK_DESCRIPTION="Apple MacBook Air 13\" M2"
export ITEM_MACBOOK_PURCHASE_RATE="160000.00"

# iPad Pro 11"
export ITEM_IPAD_CODE="TAB-IPD-11"
export ITEM_IPAD_NAME="iPad Pro 11\""
export ITEM_IPAD_GROUP="Electronics"
export ITEM_IPAD_UOM="Nos"
export ITEM_IPAD_STANDARD_RATE="120000.00"
export ITEM_IPAD_VAT_RATE="16"
export ITEM_IPAD_DESCRIPTION="Apple iPad Pro 11\" 256GB"
export ITEM_IPAD_PURCHASE_RATE="100000.00"

# ==================== Stock Entry Configuration ====================
# Main Store Stock
export STOCK_MAIN_IPHONE_QTY="10"
export STOCK_MAIN_MACBOOK_QTY="5"
export STOCK_MAIN_IPAD_QTY="8"
export STOCK_MAIN_EXPENSE_ACCOUNT="Stock Expenses - Main Store"

# Branch A Stock
export STOCK_BRANCH_A_IPHONE_QTY="5"
export STOCK_BRANCH_A_MACBOOK_QTY="3"
export STOCK_BRANCH_A_IPAD_QTY="4"
export STOCK_BRANCH_A_EXPENSE_ACCOUNT="Stock Expenses - Branch A"

# Branch B Stock
export STOCK_BRANCH_B_IPHONE_QTY="3"
export STOCK_BRANCH_B_MACBOOK_QTY="2"
export STOCK_BRANCH_B_IPAD_QTY="3"
export STOCK_BRANCH_B_EXPENSE_ACCOUNT="Stock Expenses - Branch B"

# ==================== Chart of Accounts Expected Accounts ====================
# These accounts should be created during provisioning
export ACCOUNT_STOCK_MAIN="Stock In Hand - Main Store"
export ACCOUNT_STOCK_BRANCH_A="Stock In Hand - Branch A"
export ACCOUNT_STOCK_BRANCH_B="Stock In Hand - Branch B"
export ACCOUNT_EXPENSE_MAIN="Stock Expenses - Main Store"
export ACCOUNT_EXPENSE_BRANCH_A="Stock Expenses - Branch A"
export ACCOUNT_EXPENSE_BRANCH_B="Stock Expenses - Branch B"
export ACCOUNT_SALES="Sales"
export ACCOUNT_VAT_OUTPUT="VAT Output - 16%"
export ACCOUNT_CASH="Cash"
export ACCOUNT_MPESA="M-Pesa"
export ACCOUNT_COGS="Cost of Goods Sold"

# ==================== POS Profile Configuration ====================
export POS_PROFILE_NAME="Main Store POS"
export POS_PROFILE_WAREHOUSE="Main Store"
export POS_PAYMENT_MODE_CASH="Cash"
export POS_PAYMENT_MODE_MPESA="M-Pesa"
export POS_DEFAULT_CUSTOMER="Walk-in Customer"

# ==================== POS Invoice Test Data ====================
# Invoice Items
export INVOICE_ITEM1_CODE="${ITEM_IPHONE_CODE}"
export INVOICE_ITEM1_QTY="2"
export INVOICE_ITEM1_RATE="${ITEM_IPHONE_STANDARD_RATE}"

export INVOICE_ITEM2_CODE="${ITEM_IPAD_CODE}"
export INVOICE_ITEM2_QTY="1"
export INVOICE_ITEM2_RATE="${ITEM_IPAD_STANDARD_RATE}"

# Payment Allocation
export INVOICE_PAYMENT_CASH_AMOUNT="200000.00"
export INVOICE_PAYMENT_MPESA_AMOUNT="287200.00"

# Expected Values
export INVOICE_SUBTOTAL="420000.00"
export INVOICE_VAT="67200.00"
export INVOICE_GRAND_TOTAL="487200.00"

# Expected Stock After Sale (Main Store)
export EXPECTED_STOCK_IPHONE_AFTER="8"
export EXPECTED_STOCK_IPAD_AFTER="7"
export EXPECTED_STOCK_MACBOOK_AFTER="5"

# Expected GL Entry Amounts
export GL_CUSTOMER_DEBIT="487200.00"
export GL_SALES_CREDIT="420000.00"
export GL_VAT_CREDIT="67200.00"
export GL_STOCK_CREDIT="260000.00"  # COGS: 2×130000 + 1×100000
export GL_COGS_DEBIT="260000.00"
export GL_CASH_DEBIT="200000.00"
export GL_MPESA_DEBIT="287200.00"

# ==================== Dashboard Expected Values ====================
export DASHBOARD_TOTAL_SALES="${INVOICE_SUBTOTAL}"
export DASHBOARD_TOTAL_VAT="${INVOICE_VAT}"
export DASHBOARD_TOTAL_REVENUE="${INVOICE_GRAND_TOTAL}"
export DASHBOARD_TOTAL_TRANSACTIONS="1"
export DASHBOARD_CASH_PAYMENTS="${INVOICE_PAYMENT_CASH_AMOUNT}"
export DASHBOARD_MPESA_PAYMENTS="${INVOICE_PAYMENT_MPESA_AMOUNT}"

# ==================== Test Output Configuration ====================
export TEST_OUTPUT_DIR="${TEST_OUTPUT_DIR:-./test_output}"
export TEST_LOG_FILE="${TEST_OUTPUT_DIR}/test_e2e.log"
export TEST_REPORT_JSON="${TEST_OUTPUT_DIR}/test_report.json"
export TEST_REPORT_HTML="${TEST_OUTPUT_DIR}/test_report.html"
export TOKEN_FILE="${TEST_OUTPUT_DIR}/.test_token"

# Create output directory
mkdir -p "${TEST_OUTPUT_DIR}"

# ==================== Helper Functions ====================
log_config() {
    echo "=== Test Configuration ===" | tee -a "${TEST_LOG_FILE}"
    echo "BASE_URL: ${BASE_URL}" | tee -a "${TEST_LOG_FILE}"
    echo "API_BASE: ${API_BASE}" | tee -a "${TEST_LOG_FILE}"
    echo "TENANT_NAME: ${TENANT_NAME}" | tee -a "${TEST_LOG_FILE}"
    echo "TEST_OUTPUT_DIR: ${TEST_OUTPUT_DIR}" | tee -a "${TEST_LOG_FILE}"
    echo "" | tee -a "${TEST_LOG_FILE}"
}
