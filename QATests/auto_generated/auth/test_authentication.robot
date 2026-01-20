*** Settings ***
Documentation    Auto-generated test for authentication endpoints
Resource         ../../resources/common.resource
Resource         ../../resources/db_verification.robot
Library          RequestsLibrary
Library          Collections

Suite Setup      Create Session    api    ${BASE_URL}
Suite Teardown   Delete All Sessions

*** Variables ***
${BASE_URL}         http://localhost:9000
${TEST_EMAIL}       admin@moranerp.com
${TEST_PASSWORD}    admin123
${TEST_TENANT}      TEN-KE-26-Z11N5

*** Test Cases ***
Login With Tenant
    [Tags]    smoke    auto-generated    authentication    phase_core
    [Documentation]    Test POST /auth/v1/login-with-tenant - authenticate user and select tenant
    
    # Execute
    ${payload}=    Create Dictionary    
    ...    email=${TEST_EMAIL}    
    ...    password=${TEST_PASSWORD}    
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    ...    expected_status=200
    
    # Verify response structure
    Dictionary Should Contain Key    ${response.json()}    access_token
    Dictionary Should Contain Key    ${response.json()}    token_type
    Dictionary Should Contain Key    ${response.json()}    tenant
    
    Should Be Equal As Strings    ${response.json()['token_type']}    Bearer
    Should Not Be Empty    ${response.json()['access_token']}
    
    # Store token for other tests
    Set Suite Variable    ${AUTH_TOKEN}    ${response.json()['access_token']}
    
    Log    Successfully authenticated and received token
    
    # Database verification
    ${user_id}=    Verify User Exists In PostgreSQL    ${TEST_EMAIL}
    ${status}    ${role}=    Verify Tenant Membership    ${user_id}    ${TEST_TENANT}
    Should Be Equal As Strings    ${status}    ACTIVE
    Log    Database verification passed: User has ACTIVE membership with role ${role}

Get User Memberships
    [Tags]    smoke    auto-generated    authentication    phase_core
    [Documentation]    Test GET /auth/me/memberships - retrieve user's tenant memberships
    [Setup]    Run Keyword If    '${AUTH_TOKEN}' == 'None'    Login With Tenant
    
    # Execute
    ${headers}=    Create Dictionary    Authorization=Bearer ${AUTH_TOKEN}
    ${response}=    GET On Session    api    /auth/me/memberships
    ...    headers=${headers}
    ...    expected_status=200
    
    # Verify
    Should Not Be Empty    ${response.json()}
    Length Should Be At Least    ${response.json()}    1
    
    # Check membership structure
    Dictionary Should Contain Key    ${response.json()[0]}    id
    Dictionary Should Contain Key    ${response.json()[0]}    name
    Dictionary Should Contain Key    ${response.json()[0]}    code
    Dictionary Should Contain Key    ${response.json()[0]}    role
    
    Log    Successfully retrieved ${response.json().__len__()} membership(s)
