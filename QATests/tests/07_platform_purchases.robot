*** Settings ***
Documentation     Platform Backend - Purchase Management API Tests
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
${BASE_URL}            http://localhost:9000
${TEST_SUPPLIER_ID}    ${EMPTY}
${TEST_PO_ID}          ${EMPTY}
${PLATFORM_TOKEN}      ${EMPTY}

*** Test Cases ***
Create Supplier Via Purchase API
    [Documentation]    Test POST /purchases/suppliers with database verification
    [Tags]    purchases    suppliers    create    critical
    
    ${timestamp}=    Get Current Date    result_format=%H%M%S
    ${supplier_name}=    Set Variable    Platform Supplier ${timestamp}
    
    # Login and get token
    ${token}=    Login As User    ${OWNER_EMAIL}    ${OWNER_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${PLATFORM_TOKEN}    ${token}
    ${headers}=    Get Authorization Header    ${token}
    
    # Create supplier
    ${supplier_data}=    Create Dictionary
    ...    name=${supplier_name}
    ...    supplier_group=Raw Material
    ...    country=Kenya
    ...    currency=KES
    
    ${response}=    POST On Session    api    /purchases/suppliers    
    ...    headers=${headers}    json=${supplier_data}    expected_status=any
    Should Be True    ${response.status_code} in [200, 201]
    
    ${result}=    Set Variable    ${response.json()}
    ${supplier_id}=    Get From Dictionary    ${result}    id
    Set Suite Variable    ${TEST_SUPPLIER_ID}    ${supplier_id}
    
    # Verify in ERPNext database
    ${db_result}=    Query ERPNext Database    SELECT supplier_name FROM tabSupplier WHERE supplier_name='${supplier_name}'
    Should Contain    ${db_result}    ${supplier_name}

List Suppliers Via Purchase API
    [Documentation]    Test GET /purchases/suppliers
    [Tags]    purchases    suppliers    list
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${response}=    GET On Session    api    /purchases/suppliers    headers=${headers}    expected_status=200
    
    ${suppliers}=    Get From Dictionary    ${response.json()}    suppliers
    ${api_count}=    Get Length    ${suppliers}
    Log    Found ${api_count} suppliers via API

Get Supplier Via Purchase API
    [Documentation]    Test GET /purchases/suppliers/{id}
    [Tags]    purchases    suppliers    get
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${response}=    GET On Session    api    /purchases/suppliers/${TEST_SUPPLIER_ID}    
    ...    headers=${headers}    expected_status=200
    
    ${supplier}=    Set Variable    ${response.json()}
    Log    Retrieved supplier: ${supplier}

Create Purchase Order Via Purchase API
    [Documentation]    Test POST /purchases/orders
    [Tags]    purchases    orders    create
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${today}=    Get Current Date    result_format=%Y-%m-%d
    
    # First create a test item for the PO
    ${timestamp}=    Get Current Date    result_format=%Y%m%d%H%M%S
    ${item_code}=    Set Variable    PO-ITEM-${timestamp}
    ${item_data}=    Create Dictionary
    ...    item_code=${item_code}
    ...    item_name=PO Test Item
    ...    item_group=Products
    ...    stock_uom=Nos
    
    POST On Session    api    /inventory/items    headers=${headers}    json=${item_data}    expected_status=any
    
    # Create purchase order
    ${po_data}=    Create Dictionary
    ...    supplier_id=${TEST_SUPPLIER_ID}
    ...    order_date=${today}
    ...    currency=KES
    
    ${items}=    Create List
    ${item}=    Create Dictionary
    ...    item_code=${item_code}
    ...    qty=${50}
    ...    rate=${100}
    ...    uom=Nos
    Append To List    ${items}    ${item}
    Set To Dictionary    ${po_data}    items=${items}
    
    ${response}=    POST On Session    api    /purchases/orders    
    ...    headers=${headers}    json=${po_data}    expected_status=any
    Should Be True    ${response.status_code} in [200, 201]
    
    ${result}=    Set Variable    ${response.json()}
    ${po_id}=    Get From Dictionary    ${result}    id
    Set Suite Variable    ${TEST_PO_ID}    ${po_id}
    
    # Verify in database
    ${db_result}=    Query ERPNext Database    SELECT supplier FROM \`tabPurchase Order\` WHERE name='${po_id}'
    Should Not Be Empty    ${db_result}

List Purchase Orders Via Purchase API
    [Documentation]    Test GET /purchases/orders
    [Tags]    purchases    orders    list
    
    ${headers}=    Get Authorization Header    ${PLATFORM_TOKEN}
    ${response}=    GET On Session    api    /purchases/orders    headers=${headers}    expected_status=200
    
    ${orders}=    Get From Dictionary    ${response.json()}    orders
    ${api_count}=    Get Length    ${orders}
    Log    Found ${api_count} purchase orders via API

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
