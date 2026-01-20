*** Settings ***
Documentation     IAM / Authentication Verification Suite
Resource          ../resources/common.resource
Suite Setup       Create API Session

*** Test Cases ***
Verify Global Login Success
    [Documentation]    Verify valid credentials return user info and tenants
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    email=${ADMIN_EMAIL}    password=${ADMIN_PASSWORD}
    ${resp}=       POST On Session      moran_api    /api/auth/login    json=${body}    headers=${headers}    expected_status=200
    Dictionary Should Contain Key    ${resp.json()}    user_code
    Dictionary Should Contain Key    ${resp.json()}    tenants
    ${tenants}=    Get From Dictionary    ${resp.json()}    tenants
    Should Not Be Empty    ${tenants}
    # Save Tenant ID for next tests ?? ideally we parse it
    ${first_tenant}=   Get From List   ${tenants}    0
    Set Suite Variable    ${TEST_TENANT_ID}    ${first_tenant['id']}

Verify Global Login Failure
    [Documentation]    Verify invalid password returns 401
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    email=${ADMIN_EMAIL}    password=wrongpass
    ${resp}=       POST On Session      moran_api    /api/auth/login    json=${body}    headers=${headers}    expected_status=401

Verify Tenant Token Issuance
    [Documentation]    Verify getting a scoped token for a specific tenant
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    email=${ADMIN_EMAIL}    password=${ADMIN_PASSWORD}    tenant_id=${TEST_TENANT_ID}
    ${resp}=       POST On Session      moran_api    /api/auth/v1/login-with-tenant    json=${body}    headers=${headers}    expected_status=200
    Dictionary Should Contain Key    ${resp.json()}    access_token
    ${token}=      Get From Dictionary    ${resp.json()}    access_token
    Set Suite Variable    ${ACCESS_TOKEN}    ${token}

