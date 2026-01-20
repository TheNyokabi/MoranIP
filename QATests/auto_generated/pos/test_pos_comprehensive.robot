*** Settings ***
Documentation    Auto-generated tests for POS (Point of Sale) APIs
Resource         ../../resources/common.resource
Resource         ../../resources/db_verification.robot
Library          RequestsLibrary
Library          Collections
Library          String

Suite Setup      Run Keywords
...              Create Session    api    ${BASE_URL}    AND
...              Get Auth Token For Suite
Suite Teardown   Delete All Sessions

*** Variables ***
${BASE_URL}         http://localhost:9000
${TEST_EMAIL}       admin@moranerp.com
${TEST_PASSWORD}    admin123
${TEST_TENANT}      TEN-KE-26-Z11N5

*** Test Cases ***
# ============= CORE POS =============
List POS Items
    [Tags]    smoke    auto-generated    pos    phase_pos
    [Documentation]    Test GET /pos/items - list items available for POS
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /pos/items?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    POS Items: Status ${response.status_code}

List POS Profiles
    [Tags]    smoke    auto-generated    pos    phase_pos
    [Documentation]    Test GET /pos/profiles - list POS profiles
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /pos/profiles
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    POS Profiles: Status ${response.status_code}

# ============= QUICK ACTIONS =============
Search POS Items
    [Tags]    auto-generated    pos    quick-actions    phase_pos
    [Documentation]    Test GET /pos/quick-actions/search - search for items
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /pos/quick-actions/search?q=test&limit=5
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Quick Search: Status ${response.status_code}

Get Recent Customers
    [Tags]    auto-generated    pos    quick-actions    phase_pos
    [Documentation]    Test GET /pos/quick-actions/recent-customers - get recent customers
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /pos/quick-actions/recent-customers?limit=5
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Recent Customers: Status ${response.status_code}

# ============= LOYALTY =============
Get Customer Loyalty Points
    [Tags]    auto-generated    pos    loyalty    phase_pos
    [Documentation]    Test GET /api/pos/loyalty/customer/{customer}/points - get loyalty points
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/loyalty/customer/CUST-001/points
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Customer Points: Status ${response.status_code}

Calculate Loyalty Points
    [Tags]    auto-generated    pos    loyalty    phase_pos
    [Documentation]    Test POST /api/pos/loyalty/calculate-points - calculate points for purchase
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${payload}=    Create Dictionary
    ...    purchase_amount=${100.00}
    ...    customer=CUST-001
    ...    is_birthday=${False}
    
    ${response}=    POST On Session    api    /api/pos/loyalty/calculate-points
    ...    headers=${headers}
    ...    json=${payload}
    ...    expected_status=any
    
    Log    Points Calculation: Status ${response.status_code}

# ============= LAYAWAY =============
Get Layaway Status
    [Tags]    auto-generated    pos    layaway    phase_pos
    [Documentation]    Test GET /api/pos/layaway/{id} - get layaway status
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/layaway/LAY-001
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Layaway Status: Status ${response.status_code}

# ============= RECEIPTS =============
Get Receipt
    [Tags]    auto-generated    pos    receipts    phase_pos
    [Documentation]    Test GET /api/pos/invoices/{id}/receipt - get receipt HTML
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/invoices/INV-001/receipt?format=html
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Receipt: Status ${response.status_code}

Get Thermal Receipt
    [Tags]    auto-generated    pos    receipts    phase_pos
    [Documentation]    Test GET /api/pos/invoices/{id}/receipt/thermal - get thermal receipt
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/invoices/INV-001/receipt/thermal
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Thermal Receipt: Status ${response.status_code}

# ============= OFFLINE SYNC =============
Get Sync Status
    [Tags]    auto-generated    pos    sync    phase_pos
    [Documentation]    Test GET /api/pos/sync/status - get offline sync status
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/sync/status
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Sync Status: Status ${response.status_code}

Get Pending Transactions
    [Tags]    auto-generated    pos    sync    phase_pos
    [Documentation]    Test GET /api/pos/sync/pending - get pending offline transactions
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/sync/pending
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Pending Transactions: Status ${response.status_code}

# ============= ANALYTICS =============
Get Daily Sales Analytics
    [Tags]    auto-generated    pos    analytics    phase_pos
    [Documentation]    Test GET /api/pos/analytics/daily - get daily sales analytics
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/analytics/daily
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Daily Analytics: Status ${response.status_code}

Get Product Performance
    [Tags]    auto-generated    pos    analytics    phase_pos
    [Documentation]    Test GET /api/pos/analytics/products - get product performance
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/analytics/products?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Product Performance: Status ${response.status_code}

Get Staff Performance
    [Tags]    auto-generated    pos    analytics    phase_pos
    [Documentation]    Test GET /api/pos/analytics/staff - get staff performance
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/analytics/staff
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Staff Performance: Status ${response.status_code}

Get Customer Insights
    [Tags]    auto-generated    pos    analytics    phase_pos
    [Documentation]    Test GET /api/pos/analytics/customers - get customer insights
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/pos/analytics/customers?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Customer Insights: Status ${response.status_code}

*** Keywords ***
Get Auth Token For Suite
    ${payload}=    Create Dictionary
    ...    email=${TEST_EMAIL}
    ...    password=${TEST_PASSWORD}
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    
    Set Suite Variable    ${SUITE_TOKEN}    ${response.json()['access_token']}
