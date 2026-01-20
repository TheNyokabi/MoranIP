*** Settings ***
Documentation    Auto-generated tests for ERPNext Resource API
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
${TEST_PASSWORD}    admin123${TEST_TENANT}      TEN-KE-26-Z11N5
${TEST_ITEM_CODE}   ROBOT-TEST-ITEM-001

*** Test Cases ***
List ERPNext Items
    [Tags]    smoke    auto-generated    erpnext    phase_erp
    [Documentation]    Test GET /erpnext/resource/Item - list items from ERPNext
    
    # Execute
    ${headers}=    Create Dictionary   Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /erpnext/resource/Item?limit=5
    ...    headers=${headers}
    ...    expected_status=200
    
    # Verify response
    Should Not Be Empty    ${response.json()}
    
    # Verify structure of first item if exists
    ${item_count}=    Get Length    ${response.json()}
    Run Keyword If    ${item_count} > 0    Verify Item Structure    ${response.json()[0]}
    
    Log    Successfully retrieved ${item_count} items from ERPNext
    
    # Database verification
    ${db_count}=    Get Item Count In ERPNext
    Should Be True    ${db_count} >= ${item_count}
    Log    Database verification passed: ${db_count} items in ERPNext database

Create ERPNext Item
    [Tags]    auto-generated    erpnext    phase_erp    write-operation
    [Documentation]    Test POST /erpnext/resource/Item - create new item in ERPNext
    
    # Prepare test data
    ${item_data}=    Create Dictionary
    ...    item_code=${TEST_ITEM_CODE}
    ...    item_name=Robot Test Product
    ...    item_group=Products
    ...    stock_uom=Nos
    ...    standard_rate=99.99
    
    # Execute
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    POST On Session    api    /erpnext/resource/Item
    ...    headers=${headers}
    ...    json=${item_data}
    ...    expected_status=200
    
    # Verify response
    Dictionary Should Contain Key    ${response.json()}    item_code
    Should Be Equal As Strings    ${response.json()['item_code']}    ${TEST_ITEM_CODE}
    
    Log    Successfully created item: ${TEST_ITEM_CODE}
    
    # Database verification
    ${item_name}    ${rate}    ${uom}=    Verify Item Exists In ERPNext    ${TEST_ITEM_CODE}
    Should Be Equal As Strings    ${item_name}    Robot Test Product
    Should Be Equal As Numbers    ${rate}    99.99
    Log    Database verification passed: Item created in ERPNext database

Get ERPNext Item
    [Tags]    auto-generated    erpnext    phase_erp
    [Documentation]    Test GET /erpnext/resource/Item/{name} - get specific item
    [Setup]    Run Keyword If Test Failed    Create ERPNext Item
    
    # Execute
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /erpnext/resource/Item/${TEST_ITEM_CODE}
    ...    headers=${headers}
    ...    expected_status=200
    
    # Verify
    Should Be Equal As Strings    ${response.json()['item_code']}    ${TEST_ITEM_CODE}
    Should Be Equal As Strings    ${response.json()['item_name']}    Robot Test Product
    
    Log    Successfully retrieved item: ${TEST_ITEM_CODE}

Update ERPNext Item
    [Tags]    auto-generated    erpnext    phase_erp    write-operation
    [Documentation]    Test PUT /erpnext/resource/Item/{name} - update item
    [Setup]    Run Keyword If Test Failed    Create ERPNext Item
    
    # Prepare update data
    ${update_data}=    Create Dictionary
    ...    standard_rate=149.99
    ...    description=Updated by Robot Framework test
    
    # Execute
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    PUT On Session    api    /erpnext/resource/Item/${TEST_ITEM_CODE}
    ...    headers=${headers}
    ...    json=${update_data}
    ...    expected_status=200
    
    # Verify
    Should Be Equal As Numbers    ${response.json()['standard_rate']}    149.99
    
    # Database verification
    ${item_name}    ${rate}    ${uom}=    Verify Item Exists In ERPNext    ${TEST_ITEM_CODE}
    Should Be Equal As Numbers    ${rate}    149.99
    Log    Database verification passed: Item updated in ERPNext

Delete ERPNext Item
    [Tags]    auto-generated    erpnext    phase_erp    write-operation    cleanup
    [Documentation]    Test DELETE /erpnext/resource/Item/{name} - delete item
    
    # Execute
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    DELETE On Session    api    /erpnext/resource/Item/${TEST_ITEM_CODE}
    ...    headers=${headers}
    ...    expected_status=200
    
    Log    Successfully deleted item: ${TEST_ITEM_CODE}
    
    # Verify item no longer exists
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    Run Keyword And Expect Error    *
    ...    GET On Session    api    /erpnext/resource/Item/${TEST_ITEM_CODE}
    ...    headers=${headers}
    ...    expected_status=404

*** Keywords ***
Get Auth Token For Suite
    ${payload}=    Create Dictionary
    ...    email=${TEST_EMAIL}
    ...    password=${TEST_PASSWORD}
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    
    Set Suite Variable    ${SUITE_TOKEN}    ${response.json()['access_token']}

Verify Item Structure
    [Arguments]    ${item}
    [Documentation]    Verify ERPNext item has expected structure
    Dictionary Should Contain Key    ${item}    item_code
    Dictionary Should Contain Key    ${item}    item_name
    Dictionary Should Contain Key    ${item}    item_group
    Log    Item structure is valid
