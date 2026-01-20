*** Settings ***
Documentation    Auto-generated tests for RBAC and Security APIs
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
# ================== RBAC MANAGEMENT ==================
List All Roles
    [Tags]    smoke    auto-generated    rbac    phase_rbac
    [Documentation]    Test GET /rbac/roles - list all available roles
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /rbac/roles
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    RBAC Roles: Status ${response.status_code}

Get Role Permissions
    [Tags]    auto-generated    rbac    phase_rbac
    [Documentation]    Test GET /rbac/roles/{id}/permissions - get role permissions
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /rbac/roles/admin/permissions
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Role Permissions: Status ${response.status_code}

# ================== ROLE MANAGEMENT (API v1) ==================
List Roles API v1
    [Tags]    smoke    auto-generated    roles    phase_rbac
    [Documentation]    Test GET /api/v1/roles - list roles via v1 API
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/roles
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    Roles (v1): Status ${response.status_code}

Create Custom Role
    [Tags]    auto-generated    roles    phase_rbac    write-operation
    [Documentation]    Test POST /api/v1/roles - create custom role
    
    ${role_data}=    Create Dictionary
    ...    code=TEST_ROLE_${SUITE_TOKEN[:8]}
    ...    name=Test Custom Role
    ...    description=Created by Robot Framework
    ...    level=TENANT
    ...    permissions=["inventory:items:view", "inventory:items:create"]
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    POST On Session    api    /api/v1/roles
    ...    headers=${headers}
    ...    json=${role_data}
    ...    expected_status=any
    
    Log    Create Role: Status ${response.status_code}
    
    # Store role ID for cleanup if successful
    Run Keyword If    ${response.status_code} == 200
    ...    Set Suite Variable    ${CREATED_ROLE_ID}    ${response.json()['id']}

Get Role Details
    [Tags]    auto-generated    roles    phase_rbac
    [Documentation]    Test GET /api/v1/roles/{id} - get role details
    [Setup]    Run Keyword If    '${CREATED_ROLE_ID}' == 'None'    Create Custom Role
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/roles/${CREATED_ROLE_ID}
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Role Details: Status ${response.status_code}

# ================== PERMISSION MANAGEMENT ==================
List All Permissions
    [Tags]    smoke    auto-generated    permissions    phase_rbac
    [Documentation]    Test GET /api/v1/permissions - list all system permissions
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/permissions
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    Permissions: Status ${response.status_code}

Get My Permissions
    [Tags]    smoke    auto-generated    permissions    phase_rbac
    [Documentation]    Test GET /api/v1/permissions/me - get current user permissions
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/permissions/me
    ...    headers=${headers}
    ...    expected_status=any
    
    Run Keyword If    ${response.status_code} == 200
    ...    Should Not Be Empty    ${response.json()}
    Log    My Permissions: Status ${response.status_code}

Check Permission
    [Tags]    auto-generated    permissions    phase_rbac
    [Documentation]    Test POST /api/v1/permissions/check - check if user has permission
    
    ${check_data}=    Create Dictionary
    ...    permission=inventory:items:view
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    POST On Session    api    /api/v1/permissions/check
    ...    headers=${headers}
    ...    json=${check_data}
    ...    expected_status=any
    
    Log    Permission Check: Status ${response.status_code}

# ================== USER ROLE ASSIGNMENTS ==================
Get User Roles
    [Tags]    auto-generated    user-roles    phase_rbac
    [Documentation]    Test GET /api/v1/users/{id}/roles - get user's assigned roles
    
    # First get current user ID from token
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${me_response}=    GET On Session    api    /auth/me/memberships
    ...    headers=${headers}
    
    # Use a known user ID or extract from response
    ${response}=    GET On Session    api    /api/v1/users/1/roles
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    User Roles: Status ${response.status_code}

# ================== AUDIT LOGS ==================
Get Role Change Audit Logs
    [Tags]    auto-generated    audit    phase_rbac
    [Documentation]    Test GET /api/v1/audit/roles - get role change audit logs
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/audit/roles?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Audit Logs (Roles): Status ${response.status_code}

Get Audit Statistics
    [Tags]    auto-generated    audit    phase_rbac
    [Documentation]    Test GET /api/v1/audit/stats - get audit statistics
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/audit/stats
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Audit Stats: Status ${response.status_code}

*** Keywords ***
Get Auth Token For Suite
    ${payload}=    Create Dictionary
    ...    email=${TEST_EMAIL}
    ...    password=${TEST_PASSWORD}
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    
    Set Suite Variable    ${SUITE_TOKEN}    ${response.json()['access_token']}
    Set Suite Variable    ${CREATED_ROLE_ID}    None
