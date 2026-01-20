*** Settings ***
Documentation     Platform Backend - Inventory Management API Tests
Resource          ../resources/rbac_keywords.robot
Library           RequestsLibrary
Library           Collections
Library           String
Library           DateTime
Library           Process
Library           OperatingSystem
Suite Setup       Setup Platform Test Environment
Suite Teardown    Teardown Test Environment

*** Variables ***
${BASE_URL}               http://localhost:9000
${TEST_ITEM_CODE}         ${EMPTY}
${TEST_WAREHOUSE_NAME}    ${EMPTY}
${PLATFORM_TOKEN}         ${EMPTY}

*** Test Cases ***
Health Check
    [Documentation]    Verify backend is running
    [Tags]    health    smoke
    ${response}=    GET On Session    api    /health    expected_status=200
    Log    Backend is healthy

Create Item Via Inventory API
    [Documentation]    Test POST /inventory/items with database verification
    [Tags]    inventory    items    create    critical
    
    ${timestamp}=    Get Current Date    result_format=%Y%m%d%H%M%S
    ${item_code}=    Set Variable    TEST-PLATFORM-${timestamp}
    Set Suite Variable    ${TEST_ITEM_CODE}    ${item_code}
    
    # Login and get token
    ${token}=    Login As User    ${OWNER_EMAIL}    ${OWNER_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${PLATFORM_TOKEN}    ${token}
    ${headers}=    Get Authorization Header    ${token}
    
    # Create item
    ${item_data}=    Create Dictionary
    ...    item_code=${item_code}
    ...    item_name=Platform Test Item
    ...    item_group=Products
    ...    stock_uom=Nos
    ...    standard_rate=${100}
    
    ${response}=    POST On Session    api    /inventory/items    
    ...    headers=${headers}    json=${item_data}    expected_status=any
    Should Be True    ${response.status_code} in [200, 201]
    
    # Verify in ERPNext database
    ${db_result}=    Query ERPNext Database    SELECT item_name FROM tabItem WHERE item_code='${item_code}'
    Should Contain    ${db_result}    Platform Test Item

List Items Via Inventory API
    [Documentation]    Test GET /inventory/items
    [Tags]    inventory    items    list
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${response}=    GET On Session    api    /inventory/items    headers=${headers}    expected_status=200
    
    ${items}=    Get From Dictionary    ${response.json()}    items
    ${api_count}=    Get Length    ${items}
    Log    Found ${api_count} items via API

Update Item Via Inventory API
    [Documentation]    Test PUT /inventory/items/{code}
    [Tags]    inventory    items    update
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${update_data}=    Create Dictionary    standard_rate=${150}
    
    ${response}=    PUT On Session    api    /inventory/items/${TEST_ITEM_CODE}    
    ...    headers=${headers}    json=${update_data}    expected_status=200
    
    # Verify update in database
    ${db_result}=    Query ERPNext Database    SELECT standard_rate FROM tabItem WHERE item_code='${TEST_ITEM_CODE}'
    Should Contain    ${db_result}    150

Create Warehouse Via Inventory API
    [Documentation]    Test POST /inventory/warehouses
    [Tags]    inventory    warehouses    create
    
    ${timestamp}=    Get Current Date    result_format=%H%M%S
    ${warehouse_name}=    Set Variable    Platform WH ${timestamp}
    Set Suite Variable    ${TEST_WAREHOUSE_NAME}    ${warehouse_name}
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${warehouse_data}=    Create Dictionary
    ...    warehouse_name=${warehouse_name}
    ...    company=Paint Shop Ltd
    
    ${response}=    POST On Session    api    /inventory/warehouses    
    ...    headers=${headers}    json=${warehouse_data}    expected_status=any
    Should Be True    ${response.status_code} in [200, 201]
    
    # Verify in database
    ${db_result}=    Query ERPNext Database    SELECT warehouse_name FROM tabWarehouse WHERE warehouse_name='${warehouse_name}'
    Should Contain    ${db_result}    ${warehouse_name}

List Warehouses Via Inventory API
    [Documentation]    Test GET /inventory/warehouses
    [Tags]    inventory    warehouses    list
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${response}=    GET On Session    api    /inventory/warehouses    headers=${headers}    expected_status=200
    
    ${warehouses}=    Get From Dictionary    ${response.json()}    warehouses
    ${api_count}=    Get Length    ${warehouses}
    Log    Found ${api_count} warehouses via API

*** Keywords ***
Setup Platform Test Environment
    [Documentation]    These tests require Docker access for DB verification; skip unless explicitly enabled.
    ${run}=    Get Environment Variable    RUN_PLATFORM_DB_TESTS    false
    Run Keyword If    '${run}' != 'true'
    ...    Skip    Skipping platform DB-verified suite (set RUN_PLATFORM_DB_TESTS=true to enable).

    ${base}=    Get Environment Variable    API_URL    ${BASE_URL}
    Set Suite Variable    ${BASE_URL}    ${base}
    Create Session    api    ${BASE_URL}    verify=False
    Set Suite Variable    ${HEADERS}    {"Content-Type": "application/json"}

Query ERPNext Database
    [Arguments]    ${sql}
    [Documentation]    Execute SQL query on ERPNext database via docker exec
    ${result}=    Run Process    docker    exec    moran-mariadb    mysql    -u    root    -padmin    
    ...    _d3b78a7b48c87726    -e    ${sql}    --batch    --skip-column-names
    Should Be Equal As Numbers    ${result.rc}    0    msg=Database query failed: ${result.stderr}
    [Return]    ${result.stdout}
