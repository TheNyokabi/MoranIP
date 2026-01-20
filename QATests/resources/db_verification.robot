*** Settings ***
Documentation    Database verification keywords for API tests
Library          DatabaseLibrary
Library          Collections
Library          String

*** Variables ***
${POSTGRES_HOST}     localhost
${POSTGRES_PORT}     5432
${POSTGRES_DB}       morandb
${POSTGRES_USER}     morandb_user
${POSTGRES_PASSWORD}    password123

${MARIADB_HOST}      localhost
${MARIADB_PORT}      3306


${MARIADB_DB}        _d3b78a7b48c87726
${MARIADB_USER}      root
${MARIADB_PASSWORD}  admin

*** Keywords ***
Connect To PostgreSQL
    [Documentation]    Connect to MoranERP PostgreSQL database
    Connect To Database    psycopg2
    ...    database=${POSTGRES_DB}
    ...    user=${POSTGRES_USER}
    ...    password=${POSTGRES_PASSWORD}
    ...    host=${POSTGRES_HOST}
    ...    port=${POSTGRES_PORT}
    Log    Connected to PostgreSQL database

Disconnect From PostgreSQL
    [Documentation]    Disconnect from PostgreSQL
    Disconnect From Database

Connect To MariaDB
    [Documentation]    Connect to ERPNext MariaDB database
    Connect To Database    pymysql
    ...    database=${MARIADB_DB}
    ...    user=${MARIADB_USER}
    ...    password=${MARIADB_PASSWORD}
    ...    host=${MARIADB_HOST}
    ...    port=${MARIADB_PORT}
    Log    Connected to MariaDB database

Disconnect From MariaDB
    [Documentation]    Disconnect from MariaDB
    Disconnect From Database

# ============================================
# PostgreSQL Verification Keywords
# ============================================

Verify User Exists In PostgreSQL
    [Arguments]    ${email}
    [Documentation]    Verify user exists in PostgreSQL and return user ID
    Connect To PostgreSQL
    ${result}=    Query    SELECT id, email, full_name FROM users WHERE email='${email}'
    Should Not Be Empty    ${result}    User ${email} not found in PostgreSQL
    ${user_id}=    Set Variable    ${result[0][0]}
    Log    User found: ID=${user_id}, Email=${result[0][1]}, Name=${result[0][2]}
    Disconnect From PostgreSQL
    [Return]    ${user_id}

Verify Tenant Membership
    [Arguments]    ${user_id}    ${tenant_id}
    [Documentation]    Verify user has active membership in tenant
    Connect To PostgreSQL
    ${result}=    Query    
    ...    SELECT status, role FROM tenant_memberships 
    ...    WHERE user_id='${user_id}' AND tenant_id='${tenant_id}'
    Should Not Be Empty    ${result}    Membership not found for user ${user_id} in tenant ${tenant_id}
    ${status}=    Set Variable    ${result[0][0]}
    ${role}=    Set Variable    ${result[0][1]}
    Log    Membership found: Status=${status}, Role=${role}
    Disconnect From PostgreSQL
    [Return]    ${status}    ${role}

Verify Tenant Exists
    [Arguments]    ${tenant_code}
    [Documentation]    Verify tenant exists and return tenant ID
    Connect To PostgreSQL
    ${result}=    Query    SELECT id, name, engine FROM tenants WHERE tenant_code='${tenant_code}'
    Should Not Be Empty    ${result}    Tenant ${tenant_code} not found
    ${tenant_id}=    Set Variable    ${result[0][0]}
    Log    Tenant found: ID=${tenant_id}, Name=${result[0][1]}, Engine=${result[0][2]}
    Disconnect From PostgreSQL
    [Return]    ${tenant_id}

Get User Role Count
    [Arguments]    ${user_id}
    [Documentation]    Count number of roles assigned to user
    Connect To PostgreSQL
    ${result}=    Query    SELECT COUNT(*) FROM user_roles WHERE user_id='${user_id}' AND is_active=true
    ${count}=    Set Variable    ${result[0][0]}
    Log    User ${user_id} has ${count} active roles
    Disconnect From PostgreSQL
    [Return]    ${count}

# ============================================
# MariaDB/ERPNext Verification Keywords
# ============================================

Verify Item Exists In ERPNext
    [Arguments]    ${item_code}
    [Documentation]    Verify item exists in ERPNext and return details
    Connect To MariaDB
    ${result}=    Query    SELECT item_name, standard_rate, stock_uom FROM \`tabItem\` WHERE item_code='${item_code}'
    Should Not Be Empty    ${result}    Item ${item_code} not found in ERPNext
    ${item_name}=    Set Variable    ${result[0][0]}
    ${rate}=    Set Variable    ${result[0][1]}
    ${uom}=    Set Variable    ${result[0][2]}
    Log    Item found: Name=${item_name}, Rate=${rate}, UOM=${uom}
    Disconnect From MariaDB
    [Return]    ${item_name}    ${rate}    ${uom}

Verify Warehouse Exists In ERPNext
    [Arguments]    ${warehouse_code}
    [Documentation]    Verify warehouse exists in ERPNext
    Connect To MariaDB
    ${result}=    Query    SELECT name, warehouse_name FROM \`tabWarehouse\` WHERE warehouse_code='${warehouse_code}'
    Should Not Be Empty    ${result}    Warehouse ${warehouse_code} not found in ERPNext
    ${name}=    Set Variable    ${result[0][0]}
    ${warehouse_name}=    Set Variable    ${result[0][1]}
    Log    Warehouse found: Name=${name}, Warehouse Name=${warehouse_name}
    Disconnect From MariaDB
    [Return]    ${name}

Verify Stock Ledger Entry
    [Arguments]    ${item_code}    ${voucher_type}
    [Documentation]    Verify stock ledger entry exists for item
    Connect To MariaDB
    ${result}=    Query    
    ...    SELECT actual_qty, warehouse FROM \`tabStock Ledger Entry\` 
    ...    WHERE item_code='${item_code}' AND voucher_type='${voucher_type}'
    ...    ORDER BY creation DESC LIMIT 1
    Should Not Be Empty    ${result}    No stock ledger entry found for ${item_code}
    ${qty}=    Set Variable    ${result[0][0]}
    ${warehouse}=    Set Variable    ${result[0][1]}
    Log    Stock ledger entry: Qty=${qty}, Warehouse=${warehouse}
    Disconnect From MariaDB
    [Return]    ${qty}    ${warehouse}

Get Item Count In ERPNext
    [Documentation]    Get total count of items in ERPNext
    Connect To MariaDB
    ${result}=    Query    SELECT COUNT(*) FROM \`tabItem\`
    ${count}=    Set Variable    ${result[0][0]}
    Log    Total items in ERPNext: ${count}
    Disconnect From MariaDB
    [Return]    ${count}

Verify POS Invoice Exists
    [Arguments]    ${invoice_name}
    [Documentation]    Verify POS invoice exists and return details
    Connect To MariaDB
    ${result}=    Query    
    ...    SELECT customer, grand_total, status FROM \`tabPOS Invoice\` 
    ...    WHERE name='${invoice_name}'
    Should Not Be Empty    ${result}    POS Invoice ${invoice_name} not found
    ${customer}=    Set Variable    ${result[0][0]}
    ${total}=    Set Variable    ${result[0][1]}
    ${status}=    Set Variable    ${result[0][2]}
    Log    POS Invoice: Customer=${customer}, Total=${total}, Status=${status}
    Disconnect From MariaDB
    [Return]    ${customer}    ${total}    ${status}

# ============================================
# Cleanup Keywords
# ============================================

Delete Test User From PostgreSQL
    [Arguments]    ${email}
    [Documentation]    Delete test user from PostgreSQL (use cautiously!)
    Connect To PostgreSQL
    Execute Sql String    DELETE FROM tenant_memberships WHERE user_id IN (SELECT id FROM users WHERE email='${email}')
    Execute Sql String    DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email='${email}')
    Execute Sql String    DELETE FROM users WHERE email='${email}'
    Disconnect From PostgreSQL
    Log    Deleted test user: ${email}

Delete Test Item From ERPNext
    [Arguments]    ${item_code}
    [Documentation]    Delete test item from ERPNext (use cautiously!)
    Connect To MariaDB
    Execute Sql String    DELETE FROM \`tabItem\` WHERE item_code='${item_code}'
    Disconnect From MariaDB
    Log    Deleted test item: ${item_code}
