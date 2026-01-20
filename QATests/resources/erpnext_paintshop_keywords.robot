*** Settings ***
Documentation     MoranERP Platform - ERPNext Paint Shop PoS Keywords
...               Platform Architecture:
...               - MoranERP Platform (port 8000): Handles users, tenants, authentication
...               - ERPNext Engine (port 8080): Business logic, accessed via platform proxy
...               - Requests go through: /erpnext/resource/* with X-Tenant-ID header

Library           RequestsLibrary
Library           Collections
Library           String
Library           DateTime
Library           OperatingSystem

*** Variables ***
# Platform Configuration (use Docker service name for container networking)
${PLATFORM_URL}          http://localhost:9000
${TENANT_ID}             demo-erpnext
${PLATFORM_TOKEN}        ${EMPTY}

# Optional: force posting_date into an active fiscal year during E2E runs.
${POSTING_DATE}          ${EMPTY}

# Paint Shop Tenant Credentials (created via seed_iam or API)
${PAINTSHOP_ADMIN_EMAIL}     admin@moran.com
${PAINTSHOP_ADMIN_PASSWORD}  admin123
${PAINTSHOP_TENANT_ID}       ${EMPTY}

# Test Data - Paint Shop
${WAREHOUSE_NAME}        Main Paint Store - MPS
${WAREHOUSE_ABBR}        MPS
${COMPANY}               Paint Shop Ltd

# Test Items
${ITEM_RED_PAINT}        PAINT-RED-5L
${ITEM_BLUE_PAINT}       PAINT-BLUE-5L
${ITEM_WHITE_PAINT}      PAINT-WHITE-10L

# Sales Persons
${FUNDI_REF_CODE}        FND-123
${FUNDI_NAME}            John Fundi
${FUNDI_COMMISSION}      10

${SALES_REF_CODE}        SLS-456
${SALES_NAME}            Jane Sales
${SALES_COMMISSION}      15

# Payment Methods
${PAYMENT_CASH}          Cash
${PAYMENT_MPESA}         Mpesa
${PAYMENT_PESALINK}      Pesalink

# Test Customers
${CUSTOMER_DIRECT}       Direct Customer 001
${CUSTOMER_FUNDI}        Fundi Customer 001
${CUSTOMER_SALES}        Sales Team Customer 001

*** Keywords ***
Setup Platform Session
    [Documentation]    Initialize MoranERP Platform session with authentication
    ${platform_url}=    Get Environment Variable    API_URL    ${PLATFORM_URL}
    Create Session    platform    ${platform_url}    verify=False
    # First, authenticate to get a JWT token
    ${auth_headers}=    Create Dictionary    Content-Type=application/json
    ${auth_body}=    Create Dictionary
    ...    email=${PAINTSHOP_ADMIN_EMAIL}
    ...    password=${PAINTSHOP_ADMIN_PASSWORD}
    ${login_resp}=    POST On Session    platform    /api/auth/login    
    ...    json=${auth_body}    headers=${auth_headers}    expected_status=any
    Should Be Equal As Numbers    ${login_resp.status_code}    200
    ...    msg=Login failed: ${login_resp.status_code} ${login_resp.text}
    # Get tenant ID from response and login with tenant to get scoped token
    ${login_data}=    Set Variable    ${login_resp.json()}
    ${tenants}=    Get From Dictionary    ${login_data}    tenants
    ${tenant_id}=    Set Variable    ${EMPTY}
    ${access_token}=    Set Variable    ${EMPTY}
    FOR    ${t}    IN    @{tenants}
        ${engine}=    Get From Dictionary    ${t}    engine
        IF    '${engine}' != 'erpnext'
            Continue For Loop
        END
        ${candidate_tenant_id}=    Get From Dictionary    ${t}    id
        ${tenant_login_body}=      Create Dictionary
        ...    email=${PAINTSHOP_ADMIN_EMAIL}
        ...    password=${PAINTSHOP_ADMIN_PASSWORD}
        ...    tenant_id=${candidate_tenant_id}
        ${candidate_resp}=    POST On Session    platform    /api/auth/v1/login-with-tenant
        ...    json=${tenant_login_body}    headers=${auth_headers}    expected_status=any
        IF    ${candidate_resp.status_code} == 200
            ${token_data}=    Set Variable    ${candidate_resp.json()}
            ${access_token}=    Get From Dictionary    ${token_data}    access_token
            ${tenant_id}=     Set Variable    ${candidate_tenant_id}
            Exit For Loop
        END
    END
    Run Keyword If    '${tenant_id}' == '${EMPTY}'
    ...    Fail    No accessible ERPNext tenant found for ${PAINTSHOP_ADMIN_EMAIL}.

    Set Suite Variable    ${PAINTSHOP_TENANT_ID}    ${tenant_id}
    Set Suite Variable    ${PLATFORM_TOKEN}         ${access_token}
    ${headers}=    Create Dictionary
    ...    X-Tenant-ID=${tenant_id}
    ...    Content-Type=application/json
    ...    Authorization=Bearer ${access_token}
    Set Suite Variable    ${HEADERS}    ${headers}

Get ERPNext Resource
    [Arguments]    ${doctype}    ${name}=${EMPTY}    ${filters}=${EMPTY}    ${fields}=${EMPTY}
    [Documentation]    Get ERPNext resource via platform proxy
    ${endpoint}=    Set Variable If    '${name}' != '${EMPTY}'    
    ...    /erpnext/resource/${doctype}/${name}
    ...    /erpnext/resource/${doctype}
    ${params}=    Create Dictionary
    Run Keyword If    '${filters}' != '${EMPTY}'    Set To Dictionary    ${params}    filters=${filters}
    Run Keyword If    '${fields}' != '${EMPTY}'    Set To Dictionary    ${params}    fields=${fields}
    ${response}=    GET On Session    platform    ${endpoint}    
    ...    headers=${HEADERS}    params=${params}    expected_status=any
    [Return]    ${response}

Create ERPNext Resource
    [Arguments]    ${doctype}    ${data}
    [Documentation]    Create ERPNext resource via platform proxy
    ${response}=    POST On Session    platform    /erpnext/resource/${doctype}    
    ...    json=${data}    headers=${HEADERS}    expected_status=any
    [Return]    ${response}

Update ERPNext Resource
    [Arguments]    ${doctype}    ${name}    ${data}
    [Documentation]    Update ERPNext resource via platform proxy
    ${response}=    PUT On Session    platform    /erpnext/resource/${doctype}/${name}    
    ...    json=${data}    headers=${HEADERS}    expected_status=any
    [Return]    ${response}

Delete ERPNext Resource
    [Arguments]    ${doctype}    ${name}
    [Documentation]    Delete ERPNext resource via platform proxy
    ${response}=    DELETE On Session    platform    /erpnext/resource/${doctype}/${name}    
    ...    headers=${HEADERS}    expected_status=any
    [Return]    ${response}

Call ERPNext Method
    [Arguments]    ${method_path}    ${params}=${EMPTY}
    [Documentation]    Call ERPNext RPC method via platform proxy
    ${has_params}=    Run Keyword And Return Status    Should Not Be Equal    ${params}    ${EMPTY}
    IF    ${has_params}
        ${data}=    Set Variable    ${params}
    ELSE
        ${data}=    Create Dictionary
    END
    ${response}=    POST On Session    platform    /erpnext/method/${method_path}    
    ...    json=${data}    headers=${HEADERS}    expected_status=any
    [Return]    ${response}

Submit ERPNext Document
    [Arguments]    ${doctype}    ${name}
    [Documentation]    Submit ERPNext document (set docstatus=1)
    ${data}=    Create Dictionary    docstatus=${1}
    ${response}=    Update ERPNext Resource    ${doctype}    ${name}    ${data}
    [Return]    ${response}

Create Warehouse
    [Arguments]    ${warehouse_name}    ${warehouse_abbr}=${EMPTY}    ${company}=${COMPANY}
    [Documentation]    Create warehouse for paint shop
    ${abbr}=    Set Variable If    '${warehouse_abbr}' == '${EMPTY}'    ${warehouse_name[:3]}    ${warehouse_abbr}
    ${data}=    Create Dictionary
    ...    doctype=Warehouse
    ...    warehouse_name=${warehouse_name}
    ...    abbr=${abbr}
    ...    company=${company}
    ...    is_group=${0}
    ${response}=    Create ERPNext Resource    Warehouse    ${data}
    [Return]    ${response}

Create Item
    [Arguments]    ${item_code}    ${item_name}    ${stock_uom}=Nos    ${item_group}=Products
    [Documentation]    Create paint item
    ${data}=    Create Dictionary
    ...    doctype=Item
    ...    item_code=${item_code}
    ...    item_name=${item_name}
    ...    stock_uom=${stock_uom}
    ...    item_group=${item_group}
    ...    is_stock_item=${1}
    ...    maintain_stock=${1}
    ...    is_sales_item=${1}
    ...    is_purchase_item=${1}
    ${response}=    Create ERPNext Resource    Item    ${data}
    [Return]    ${response}

Create Stock Entry
    [Arguments]    ${item_code}    ${warehouse}    ${qty}    ${rate}
    [Documentation]    Create stock entry to add initial stock
    ...    Note: warehouse should be the full ERPNext warehouse name (may include company suffix)
    ...    For Material Receipt, prefer setting only t_warehouse.
    ${items}=    Create List
    ${item_dict}=    Create Dictionary
    ...    item_code=${item_code}
    ...    t_warehouse=${warehouse}
    ...    qty=${qty}
    ...    basic_rate=${rate}
    ...    valuation_rate=${rate}
    ...    allow_zero_valuation_rate=${1}
    Append To List    ${items}    ${item_dict}
    
    ${data}=    Create Dictionary
    ...    doctype=Stock Entry
    ...    purpose=Material Receipt
    ...    stock_entry_type=Material Receipt
    ...    to_warehouse=${warehouse}
    ...    company=${COMPANY}
    ...    items=${items}
    Run Keyword If    '${POSTING_DATE}' != '${EMPTY}'    Set To Dictionary    ${data}    posting_date=${POSTING_DATE}
    ${response}=    Create ERPNext Resource    Stock Entry    ${data}
    [Return]    ${response}

Get Stock Balance
    [Arguments]    ${item_code}    ${warehouse}
    [Documentation]    Get current stock balance for item in warehouse
    ...    Returns response with stock balance in data.message or data field
    ${params}=    Create Dictionary    item_code=${item_code}    warehouse=${warehouse}
    ${response}=    Call ERPNext Method    erpnext.stock.utils.get_stock_balance    ${params}
    [Return]    ${response}

Create Sales Person
    [Arguments]    ${sales_person_name}    ${commission_rate}    ${employee}=${EMPTY}
    [Documentation]    Create sales person with commission rate
    ${data}=    Create Dictionary
    ...    doctype=Sales Person
    ...    sales_person_name=${sales_person_name}
    ...    commission_rate=${commission_rate}
    ...    is_group=${0}
    Run Keyword If    '${employee}' != '${EMPTY}'    Set To Dictionary    ${data}    employee=${employee}
    ${response}=    Create ERPNext Resource    Sales Person    ${data}
    [Return]    ${response}

Create Customer
    [Arguments]    ${customer_name}    ${customer_type}=Individual
    [Documentation]    Create customer
    ${data}=    Create Dictionary
    ...    doctype=Customer
    ...    customer_name=${customer_name}
    ...    customer_type=${customer_type}
    ...    customer_group=Individual
    ...    territory=All Territories
    ${response}=    Create ERPNext Resource    Customer    ${data}
    [Return]    ${response}

Create Sales Invoice
    [Arguments]    ${customer}    ${items}    ${warehouse}=${WAREHOUSE_NAME}    
    ...    ${referral_code}=${EMPTY}    ${sales_team}=@{EMPTY}    ${payments}=@{EMPTY}
    [Documentation]    Create POS Sales Invoice
    # Ensure stock is always deducted from the intended warehouse.
    # Some ERPNext setups/fixtures set item.warehouse via POS Profile defaults (e.g. "%s - ADMWOR").
    FOR    ${row}    IN    @{items}
        Set To Dictionary    ${row}    warehouse=${warehouse}
    END

    # Ensure POS invoices have a payment row; otherwise submit will fail.
    ${payment_count}=    Get Length    ${payments}
    IF    ${payment_count} == 0
        ${total}=    Set Variable    0
        FOR    ${row}    IN    @{items}
            ${qty}=    Get From Dictionary    ${row}    qty
            ${rate}=    Get From Dictionary    ${row}    rate
            ${line}=    Evaluate    float(${qty}) * float(${rate})
            ${total}=    Evaluate    ${total} + ${line}
        END
        ${p}=    Create Dictionary    mode_of_payment=${PAYMENT_CASH}    amount=${total}
        ${payments}=    Create List    ${p}
    END

    ${data}=    Create Dictionary
    ...    doctype=Sales Invoice
    ...    customer=${customer}
    ...    company=${COMPANY}
    ...    is_pos=${1}
    ...    update_stock=${1}
    ...    items=${items}
    ...    set_warehouse=${warehouse}

    # Avoid missing exchange-rate errors by pinning invoice currency to the company's default.
    Run Keyword If    '${COMPANY_CURRENCY}' != '${EMPTY}'
    ...    Set To Dictionary    ${data}    currency=${COMPANY_CURRENCY}    conversion_rate=${1}
    
    Run Keyword If    '${referral_code}' != '${EMPTY}'    
    ...    Set To Dictionary    ${data}    custom_referral_code=${referral_code}
    Run Keyword If    ${sales_team}    Set To Dictionary    ${data}    sales_team=${sales_team}
    Run Keyword If    ${payments}    Set To Dictionary    ${data}    payments=${payments}
    
    ${response}=    Create ERPNext Resource    Sales Invoice    ${data}
    [Return]    ${response}

Create Payment Entry
    [Arguments]    ${party}    ${paid_amount}    ${payment_type}=Receive    
    ...    ${mode_of_payment}=${PAYMENT_CASH}    ${party_type}=Customer
    [Documentation]    Create payment entry for reconciliation
    ${data}=    Create Dictionary
    ...    doctype=Payment Entry
    ...    payment_type=${payment_type}
    ...    party_type=${party_type}
    ...    party=${party}
    ...    paid_amount=${paid_amount}
    ...    received_amount=${paid_amount}
    ...    mode_of_payment=${mode_of_payment}
    ...    company=${COMPANY}
    ${response}=    Create ERPNext Resource    Payment Entry    ${data}
    [Return]    ${response}

Verify Response Status
    [Arguments]    ${response}    ${expected_status}
    [Documentation]    Verify HTTP response status code
    Should Be Equal As Numbers    ${response.status_code}    ${expected_status}
    ...    msg=Expected ${expected_status} but got ${response.status_code}. Response: ${response.text}

Get Response Data
    [Arguments]    ${response}
    [Documentation]    Extract data from response, handling both {"data": {...}} and direct response formats
    ${json}=    Set Variable    ${response.json()}
    ${is_dict}=    Evaluate    isinstance($json, dict)
    Return From Keyword If    not ${is_dict}    ${json}
    ${has_data}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${json}    data
    ${data}=    Run Keyword If    ${has_data}    Get From Dictionary    ${json}    data
    ...    ELSE    Set Variable    ${json}
    [Return]    ${data}

Verify Field Value
    [Arguments]    ${response}    ${field}    ${expected_value}
    [Documentation]    Verify field value in response
    ${data}=    Get Response Data    ${response}
    ${actual_value}=    Get From Dictionary    ${data}    ${field}
    ${expected_is_num}=    Run Keyword And Return Status    Convert To Number    ${expected_value}
    ${actual_is_num}=      Run Keyword And Return Status    Convert To Number    ${actual_value}
    IF    ${expected_is_num} and ${actual_is_num}
        ${expected_num}=    Convert To Number    ${expected_value}
        ${actual_num}=      Convert To Number    ${actual_value}
        Should Be Equal As Numbers    ${actual_num}    ${expected_num}
    ELSE
        Should Be Equal    ${actual_value}    ${expected_value}
    END

Calculate Total Sales
    [Arguments]    ${from_date}    ${to_date}
    [Documentation]    Calculate total sales for date range
    ${filters}=    Create Dictionary    posting_date=["between", ["${from_date}", "${to_date}"]]    docstatus=${1}
    ${response}=    Get ERPNext Resource    Sales Invoice    filters=${filters}
    [Return]    ${response}

Get Commission Report
    [Arguments]    ${sales_person}    ${from_date}    ${to_date}
    [Documentation]    Get commission report for sales person
    ${params}=    Create Dictionary    
    ...    sales_person=${sales_person}    
    ...    from_date=${from_date}    
    ...    to_date=${to_date}
    ${response}=    Call ERPNext Method    
    ...    erpnext.selling.report.sales_person_commission_summary.sales_person_commission_summary.execute
    ...    ${params}
    [Return]    ${response}

Cleanup Test Data
    [Arguments]    ${doctype}    ${name}
    [Documentation]    Clean up test data (best effort, doesn't fail if already deleted)
    ${response}=    Delete ERPNext Resource    ${doctype}    ${name}
    Run Keyword If    ${response.status_code} not in [200, 204, 404]
    ...    Log    Cleanup failed for ${doctype}/${name}: ${response.status_code} - ${response.text}    WARN

Check Platform Health
    [Documentation]    Verify platform is accessible
    ${response}=    GET On Session    platform    /health    expected_status=any
    Should Be Equal As Numbers    ${response.status_code}    200
    ${health}=    Set Variable    ${response.json()}
    Log    Platform Status: ${health}[status]
    [Return]    ${health}
