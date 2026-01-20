*** Settings ***
Documentation     Common keywords and variables for RBAC testing
Library           RequestsLibrary
Library           Collections
Library           String
Library           DateTime
Library           OperatingSystem

*** Variables ***
# API Configuration (use Docker service name for container networking)
${BASE_URL}           http://localhost:9000
${API_VERSION}        /api/v1
${AUTH_ENDPOINT}      /api/auth/v1/login-with-tenant

# Test Users
${SUPER_ADMIN_EMAIL}      superadmin@moranerp.com
${SUPER_ADMIN_PASSWORD}   SuperAdmin123!
${OWNER_EMAIL}            owner@tenant1.com
${OWNER_PASSWORD}         Owner123!
${ADMIN_EMAIL}            admin@tenant1.com
${ADMIN_PASSWORD}         Admin123!
${MANAGER_EMAIL}          manager@tenant1.com
${MANAGER_PASSWORD}       Manager123!
${STAFF_EMAIL}            staff@tenant1.com
${STAFF_PASSWORD}         Staff123!
${VIEWER_EMAIL}           viewer@tenant1.com
${VIEWER_PASSWORD}        Viewer123!

# Test Tenant
${TEST_TENANT_ID}         ${EMPTY}
${TEST_TENANT_NAME}       Test Tenant 1

# Tokens
${SUPER_ADMIN_TOKEN}      ${EMPTY}
${OWNER_TOKEN}            ${EMPTY}
${ADMIN_TOKEN}            ${EMPTY}
${MANAGER_TOKEN}          ${EMPTY}
${STAFF_TOKEN}            ${EMPTY}
${VIEWER_TOKEN}           ${EMPTY}

# Test Data
${VALID_UUID_PATTERN}     ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
${INVALID_UUID}           not-a-valid-uuid
${NON_EXISTENT_UUID}      00000000-0000-0000-0000-000000000000

*** Keywords ***
Setup Test Environment
    [Documentation]    Initialize test environment and create session
    Create Session    api    ${BASE_URL}    verify=False
    Set Suite Variable    ${HEADERS}    {"Content-Type": "application/json"}

Teardown Test Environment
    [Documentation]    Clean up test environment
    Delete All Sessions

Login As User
    [Arguments]    ${email}    ${password}    ${tenant_id}=${EMPTY}
    [Documentation]    Login and return access token
    ${body}=    Create Dictionary    email=${email}    password=${password}
    Run Keyword If    '${tenant_id}' != '${EMPTY}'    Set To Dictionary    ${body}    tenant_id=${tenant_id}
    ${response}=    POST On Session    api    ${AUTH_ENDPOINT}    json=${body}    expected_status=any
    Should Be Equal As Numbers    ${response.status_code}    200
    ${token}=    Get From Dictionary    ${response.json()}    access_token
    [Return]    ${token}

Get Authorization Header
    [Arguments]    ${token}
    [Documentation]    Create authorization header with token
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}    Content-Type=application/json
    [Return]    ${headers}

Setup Test Users And Tokens
    [Documentation]    Login all test users and store their tokens
    # Login as owner
    ${owner_token}=    Login As User    ${OWNER_EMAIL}    ${OWNER_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${OWNER_TOKEN}    ${owner_token}
    
    # Login as admin
    ${admin_token}=    Login As User    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${ADMIN_TOKEN}    ${admin_token}
    
    # Login as manager
    ${manager_token}=    Login As User    ${MANAGER_EMAIL}    ${MANAGER_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${MANAGER_TOKEN}    ${manager_token}
    
    # Login as staff
    ${staff_token}=    Login As User    ${STAFF_EMAIL}    ${STAFF_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${STAFF_TOKEN}    ${staff_token}
    
    # Login as viewer
    ${viewer_token}=    Login As User    ${VIEWER_EMAIL}    ${VIEWER_PASSWORD}    ${TEST_TENANT_ID}
    Set Suite Variable    ${VIEWER_TOKEN}    ${viewer_token}

Verify Response Status
    [Arguments]    ${response}    ${expected_status}
    [Documentation]    Verify HTTP response status code
    Should Be Equal As Numbers    ${response.status_code}    ${expected_status}
    ...    msg=Expected status ${expected_status} but got ${response.status_code}. Response: ${response.text}

Verify Response Contains
    [Arguments]    ${response}    ${key}    ${expected_value}=${EMPTY}
    [Documentation]    Verify response JSON contains key and optionally value
    ${json}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${json}    ${key}
    Run Keyword If    '${expected_value}' != '${EMPTY}'    Should Be Equal    ${json}[${key}]    ${expected_value}

Verify UUID Format
    [Arguments]    ${uuid_string}
    [Documentation]    Verify string is valid UUID format
    Should Match Regexp    ${uuid_string}    ${VALID_UUID_PATTERN}

Verify Error Response
    [Arguments]    ${response}    ${expected_status}    ${expected_detail_pattern}=${EMPTY}
    [Documentation]    Verify error response format and content
    Verify Response Status    ${response}    ${expected_status}
    ${json}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${json}    detail
    Run Keyword If    '${expected_detail_pattern}' != '${EMPTY}'    
    ...    Should Match Regexp    ${json}[detail]    ${expected_detail_pattern}

Generate Random Email
    [Documentation]    Generate random email for testing
    ${timestamp}=    Get Current Date    result_format=%Y%m%d%H%M%S
    ${random}=    Generate Random String    8    [LETTERS][NUMBERS]
    ${email}=    Set Variable    test_${timestamp}_${random}@test.com
    [Return]    ${email}

Generate Random String
    [Arguments]    ${length}=10    ${chars}=[LETTERS]
    [Documentation]    Generate random string
    ${result}=    Evaluate    ''.join(random.choice('${chars}'.replace('[LETTERS]', 'abcdefghijklmnopqrstuvwxyz').replace('[NUMBERS]', '0123456789')) for _ in range(${length}))    random
    [Return]    ${result}

Wait For Condition
    [Arguments]    ${keyword}    ${timeout}=10s    ${interval}=1s
    [Documentation]    Wait for a condition to be true
    Wait Until Keyword Succeeds    ${timeout}    ${interval}    ${keyword}

Create Test Role
    [Arguments]    ${token}    ${role_code}    ${role_name}    ${description}=${EMPTY}    ${permission_ids}=@{EMPTY}
    [Documentation]    Create a custom role and return role ID
    ${headers}=    Get Authorization Header    ${token}
    ${body}=    Create Dictionary    code=${role_code}    name=${role_name}
    Run Keyword If    '${description}' != '${EMPTY}'    Set To Dictionary    ${body}    description=${description}
    Run Keyword If    ${permission_ids}    Set To Dictionary    ${body}    permission_ids=${permission_ids}
    
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    201
    ${role_id}=    Get From Dictionary    ${response.json()}    id
    [Return]    ${role_id}

Delete Test Role
    [Arguments]    ${token}    ${role_id}
    [Documentation]    Delete a test role
    ${headers}=    Get Authorization Header    ${token}
    ${response}=    DELETE On Session    api    ${API_VERSION}/roles/${role_id}    
    ...    headers=${headers}    expected_status=any
    # Don't fail if already deleted
    Should Be True    ${response.status_code} in [204, 404]

Assign Role To User
    [Arguments]    ${token}    ${user_id}    ${role_id}    ${expires_at}=${EMPTY}
    [Documentation]    Assign role to user
    ${headers}=    Get Authorization Header    ${token}
    ${body}=    Create Dictionary    role_id=${role_id}
    Run Keyword If    '${expires_at}' != '${EMPTY}'    Set To Dictionary    ${body}    expires_at=${expires_at}
    
    ${response}=    POST On Session    api    ${API_VERSION}/users/${user_id}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    [Return]    ${response}

Revoke Role From User
    [Arguments]    ${token}    ${user_id}    ${role_id}
    [Documentation]    Revoke role from user
    ${headers}=    Get Authorization Header    ${token}
    ${response}=    DELETE On Session    api    ${API_VERSION}/users/${user_id}/roles/${role_id}    
    ...    headers=${headers}    expected_status=any
    [Return]    ${response}

Get User Permissions
    [Arguments]    ${token}    ${user_id}
    [Documentation]    Get user's effective permissions
    ${headers}=    Get Authorization Header    ${token}
    ${response}=    GET On Session    api    ${API_VERSION}/users/${user_id}/permissions    
    ...    headers=${headers}    expected_status=any
    [Return]    ${response}

Check Permissions Batch
    [Arguments]    ${token}    @{permissions}
    [Documentation]    Batch check permissions
    ${headers}=    Get Authorization Header    ${token}
    ${body}=    Create Dictionary    permissions=${permissions}
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}    expected_status=any
    [Return]    ${response}

Verify Permission Granted
    [Arguments]    ${token}    ${permission}
    [Documentation]    Verify user has specific permission
    ${response}=    Check Permissions Batch    ${token}    ${permission}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    ${has_permission}=    Get From Dictionary    ${results}    ${permission}
    Should Be True    ${has_permission}    msg=User should have permission ${permission}

Verify Permission Denied
    [Arguments]    ${token}    ${permission}
    [Documentation]    Verify user does NOT have specific permission
    ${response}=    Check Permissions Batch    ${token}    ${permission}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    ${has_permission}=    Get From Dictionary    ${results}    ${permission}
    Should Not Be True    ${has_permission}    msg=User should NOT have permission ${permission}
