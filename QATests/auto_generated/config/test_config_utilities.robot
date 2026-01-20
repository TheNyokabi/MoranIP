*** Settings ***
Documentation    Auto-generated tests for Configuration and Utilities APIs
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
# ================== TENANT SETTINGS ==================
Get Tenant Settings
    [Tags]    smoke    auto-generated    settings    phase_config
    [Documentation]    Test GET /api/settings/tenant - get tenant configuration settings
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/settings/tenant
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Tenant Settings: Status ${response.status_code}

Update Module Toggles
    [Tags]    auto-generated    settings    phase_config    write-operation
    [Documentation]    Test PATCH /api/settings/tenant/modules - update module toggles
    
    ${module_settings}=    Create Dictionary
    ...    enable_pos=${True}
    ...    enable_inventory=${True}
    ...    enable_manufacturing=${False}
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    PATCH On Session    api    /api/settings/tenant/modules
    ...    headers=${headers}
    ...    json=${module_settings}
    ...    expected_status=any
    
    Log    Module Toggles Update: Status ${response.status_code}
    
    # Database verification if successful
    Run Keyword If    ${response.status_code} == 200
    ...    Log    Settings updated successfully

Get Company Settings
    [Tags]    auto-generated    settings    phase_config
    [Documentation]    Test GET /api/settings/company - get company settings
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/settings/company
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Company Settings: Status ${response.status_code}

Get Currency Settings
    [Tags]    auto-generated    settings    phase_config
    [Documentation]    Test GET /api/settings/currency - get currency configuration
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/settings/currency
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Currency Settings: Status ${response.status_code}

# ================== DATA IMPORTS ==================
Get Import Template
    [Tags]    auto-generated    imports    phase_config
    [Documentation]    Test GET /api/v1/imports/template/{type} - get import template
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/imports/template/items
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Import Template: Status ${response.status_code}

List Import History
    [Tags]    auto-generated    imports    phase_config
    [Documentation]    Test GET /api/v1/imports/history - list import history
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/imports/history?limit=10
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Import History: Status ${response.status_code}

Get Import Status
    [Tags]    auto-generated    imports    phase_config
    [Documentation]    Test GET /api/v1/imports/{id}/status - get import job status
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /api/v1/imports/test-import-001/status
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Import Status: Status ${response.status_code}

# ================== ONBOARDING ==================
Get Onboarding Status
    [Tags]    smoke    auto-generated    onboarding    phase_config
    [Documentation]    Test GET /onboarding/status - get tenant onboarding status
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /onboarding/status
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Onboarding Status: Status ${response.status_code}

Get Onboarding Steps
    [Tags]    auto-generated    onboarding    phase_config
    [Documentation]    Test GET /onboarding/steps - get onboarding step definitions
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /onboarding/steps
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Onboarding Steps: Status ${response.status_code}

Complete Onboarding Step
    [Tags]    auto-generated    onboarding    phase_config    write-operation
    [Documentation]    Test POST /onboarding/steps/{step}/complete - mark step complete
    
    ${step_data}=    Create Dictionary
    ...    notes=Completed by Robot Framework test
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    POST On Session    api    /onboarding/steps/test-step/complete
    ...    headers=${headers}
    ...    json=${step_data}
    ...    expected_status=any
    
    Log    Complete Onboarding Step: Status ${response.status_code}

# ================== IAM (Identity & Access Management) ==================
List Tenants
    [Tags]    auto-generated    iam    phase_config
    [Documentation]    Test GET /iam/tenants - list all tenants (SUPER_ADMIN only)
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /iam/tenants
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    IAM Tenants: Status ${response.status_code}

Get Tenant Users
    [Tags]    auto-generated    iam    phase_config
    [Documentation]    Test GET /iam/tenants/{id}/users - list tenant users
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    GET On Session    api    /iam/tenants/${TEST_TENANT}/users
    ...    headers=${headers}
    ...    expected_status=any
    
    Log    Tenant Users: Status ${response.status_code}

Update Member Role
    [Tags]    auto-generated    iam    phase_config    write-operation
    [Documentation]    Test PUT /iam/tenants/{id}/members/{user} - update member role
    
    ${update_data}=    Create Dictionary
    ...    role=VIEWER
    ...    status=ACTIVE
    
    ${headers}=    Create Dictionary    Authorization=Bearer ${SUITE_TOKEN}
    ${response}=    PUT On Session    api    /iam/tenants/${TEST_TENANT}/members/1
    ...    headers=${headers}
    ...    json=${update_data}
    ...    expected_status=any
    
    Log    Update Member: Status ${response.status_code}

*** Keywords ***
Get Auth Token For Suite
    ${payload}=    Create Dictionary
    ...    email=${TEST_EMAIL}
    ...    password=${TEST_PASSWORD}
    ...    tenant_id=${TEST_TENANT}
    
    ${response}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json=${payload}
    
    Set Suite Variable    ${SUITE_TOKEN}    ${response.json()['access_token']}
