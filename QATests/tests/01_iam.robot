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
    # Save a tenant_id that can successfully mint a scoped token.
    ${tenant_id}=    Set Variable    ${EMPTY}
    FOR    ${t}    IN    @{tenants}
        ${candidate_tenant_id}=    Get From Dictionary    ${t}    id
        ${tenant_login_body}=    Create Dictionary
        ...    email=${ADMIN_EMAIL}
        ...    password=${ADMIN_PASSWORD}
        ...    tenant_id=${candidate_tenant_id}
        ${candidate_resp}=    POST On Session    moran_api    /api/auth/v1/login-with-tenant
        ...    json=${tenant_login_body}    headers=${headers}    expected_status=any
        IF    ${candidate_resp.status_code} == 200
            ${tenant_id}=    Set Variable    ${candidate_tenant_id}
            Exit For Loop
        END
    END
    Run Keyword If    '${tenant_id}' == '${EMPTY}'
    ...    Fail    No tenant_id from /api/auth/login could mint a scoped token (login-with-tenant never returned 200).
    Set Suite Variable    ${TEST_TENANT_ID}    ${tenant_id}

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

