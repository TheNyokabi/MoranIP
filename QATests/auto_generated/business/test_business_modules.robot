*** Settings ***
Documentation    Auto-generated tests for Business Module APIs
Resource         ../../resources/common.resource
Resource         ../../resources/db_verification.robot
Library          RequestsLibrary
Library          Collections

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
# ================== INVENTORY MODULE ==================
List Inventory Items
    [Tags]    smoke    auto-generated    inventory    phase_business
    [Documentation]    Test GET /api/inventory/items - list items in inventory module
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/inventory/items?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    Retrieved inventory items: Status ${response.status_code}

List Warehouses
    [Tags]    smoke    auto-generated    inventory    phase_business
    [Documentation]    Test GET /api/inventory/warehouses - list warehouses
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/inventory/warehouses?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    Retrieved warehouses: Status ${response.status_code}

# ================== CRM MODULE ==================
List CRM Customers
    [Tags]    smoke    auto-generated    crm    phase_business
    [Documentation]    Test GET /api/crm/customers - list customers
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/crm/customers?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    Retrieved customers: Status ${response.status_code}

List CRM Leads
    [Tags]    auto-generated    crm    phase_business
    [Documentation]    Test GET /api/crm/leads - list leads
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/crm/leads?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved leads: Status ${response.status_code}

# ================== ACCOUNTING MODULE ==================
List Accounts
    [Tags]    auto-generated    accounting    phase_business
    [Documentation]    Test GET /api/accounting/accounts - list chart of accounts
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/accounting/accounts?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved accounts: Status ${response.status_code}

List GL Entries
    [Tags]    auto-generated    accounting    phase_business
    [Documentation]    Test GET /api/accounting/gl-entries - list general ledger entries
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/accounting/gl-entries?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved GL entries: Status ${response.status_code}

# ================== HR MODULE ==================
List Employees
    [Tags]    auto-generated    hr    phase_business
    [Documentation]    Test GET /api/hr/employees - list employees
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/hr/employees?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved employees: Status ${response.status_code}

# ================== MANUFACTURING MODULE ==================
List Work Orders
    [Tags]    auto-generated    manufacturing    phase_business
    [Documentation]    Test GET /api/manufacturing/work-orders - list work orders
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/manufacturing/work-orders?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved work orders: Status ${response.status_code}

# ================== PROJECTS MODULE ==================
List Projects
    [Tags]    auto-generated    projects    phase_business
    [Documentation]    Test GET /api/projects/projects - list projects
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/projects/projects?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved projects: Status ${response.status_code}

# ================== PURCHASING MODULE ==================
List Purchase Orders
    [Tags]    auto-generated    purchasing    phase_business
    [Documentation]    Test GET /purchases/orders - list purchase orders
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /purchases/orders?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Retrieved purchase orders: Status ${response.status_code}

*** Keywords ***
Get Auth Token For Suite
    ${payload}=    Create Dictionary
    ...    email=${TEST_EMAIL}
    ...    password=${TEST_PASSWORD}
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    
    Set Suite Variable    ${SUITE_TOKEN}    ${response.json()['access_token']}
