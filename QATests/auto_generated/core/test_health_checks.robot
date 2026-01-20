*** Settings ***
Documentation    Auto-generated test for /health endpoint
Resource         ../../resources/common.resource
Library          RequestsLibrary

Suite Setup      Create Session    api    ${BASE_URL}
Suite Teardown   Delete All Sessions

*** Variables ***
${BASE_URL}    http://localhost:9000

*** Test Cases ***
Backend Health Check
    [Tags]    smoke    auto-generated    health    core-infrastructure
    [Documentation]    Test GET /health endpoint - verifies backend API is running
    
    # Execute
    ${response}=    GET On Session    api    /health
    ...    expected_status=200
    
    # Verify
    Should Be Equal As Strings    ${response.json()['status']}    healthy
    Log    Backend API is healthy

ERPNext Connectivity Check
    [Tags]    smoke    auto-generated    erpnext    core-infrastructure
    [Documentation]    Test ERPNext ping endpoint - verifies ERPNext integration
    
    # Execute
    ${headers}=    Create Dictionary    X-Frappe-Site-Name=moran.localhost
    ${response}=    GET    http://localhost:9010/api/method/ping
    ...    headers=${headers}
    
    # Verify
    Status Should Be    200    ${response}
    Should Be Equal As Strings    ${response.json()['message']}    pong
    Log    ERPNext is responding correctly
