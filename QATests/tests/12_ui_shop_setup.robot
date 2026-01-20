*** Settings ***
Documentation     UI E2E: Select ERPNext workspace, set up shop basics (warehouse, item, stock entry)
Library           Browser
Library           RequestsLibrary
Library           OperatingSystem
Library           String
Library           Collections
Suite Setup       Open Browser And Login
Suite Teardown    Close Browser

*** Variables ***
${ADMIN_EMAIL}        admin@moran.com
${ADMIN_PASSWORD}     admin123
${BROWSER}            chromium
${HEADLESS}           True

*** Keywords ***
Get Required Env
    [Arguments]    ${name}
    ${value}=    Get Environment Variable    ${name}
    Should Not Be Empty    ${value}    msg=Required environment variable not set: ${name}
    RETURN    ${value}

Open Browser And Login
    ${FRONTEND_URL}=    Get Required Env    FRONTEND_URL

    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': 1440, 'height': 900}
    New Page       ${FRONTEND_URL}/login

    Wait For Elements State    css=[data-testid="login-email"]    visible    timeout=15s
    Fill Text      css=[data-testid="login-email"]       ${ADMIN_EMAIL}
    Fill Text      css=[data-testid="login-password"]    ${ADMIN_PASSWORD}
    Click          css=[data-testid="login-submit"]

    # After login we may land on:
    # - workspace dashboard (workspace-card list)
    # - directly inside a tenant-scoped UI (nav visible)
    ${has_workspace}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=[data-testid="workspace-card"]    visible    timeout=45s
    IF    not ${has_workspace}
        ${has_nav}=    Run Keyword And Return Status
        ...    Wait For Elements State    css=[data-testid="nav-inventory"]    visible    timeout=45s
        Run Keyword If    not ${has_nav}
        ...    Fail    Login did not reach workspace list or tenant UI within timeout.

        # If we're already inside a tenant UI, derive tenant id from JWT for API calls.
        ${token}=      Get Browser Access Token
        ${tenant_id}=  Decode JWT Claim    ${token}    tenant_id
        Set Suite Variable    ${TENANT_ID}    ${tenant_id}
    END

Select Online ERPNext Workspace
    # If we're already inside a tenant workspace, nothing to do.
    ${already_in_tenant}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=[data-testid="nav-inventory"]    visible    timeout=2s
    Return From Keyword If    ${already_in_tenant}

    ${selector}=    Set Variable    css=[data-testid="workspace-card"][data-engine="erpnext"][data-engine-status="online"]
    ${count}=       Get Element Count    ${selector}
    Should Be True  ${count} > 0    msg=No online ERPNext workspaces found on dashboard

    # Capture tenant metadata for API calls if needed
    ${tenant_id}=   Get Attribute    ${selector}    data-tenant-id
    Set Suite Variable    ${TENANT_ID}    ${tenant_id}

    Click           ${selector}

    # Wait until tenant sidebar is visible (means we're in /w/[tenantSlug])
    Wait For Elements State    css=[data-testid="nav-inventory"]    visible    timeout=30s

Decode JWT Claim
    [Arguments]    ${jwt}    ${claim}
    ${parts}=    Split String    ${jwt}    .
    ${payload_b64}=    Get From List    ${parts}    1
    ${payload_json}=    Evaluate
    ...    __import__('json').loads(__import__('base64').urlsafe_b64decode(('${payload_b64}' + '===').encode('utf-8')).decode('utf-8'))
    ${value}=    Get From Dictionary    ${payload_json}    ${claim}
    RETURN    ${value}

Get Browser Access Token
    ${token}=    Evaluate Javascript    return window.localStorage.getItem('access_token') || window.localStorage.getItem('token') || window.localStorage.getItem('moran_auth_token')
    Should Not Be Empty    ${token}    msg=Could not read access token from browser localStorage
    RETURN    ${token}

API Session With Browser Token
    ${API_URL}=    Get Required Env    API_URL
    ${token}=      Get Browser Access Token

    Create Session    alias=moran_api_ui    url=${API_URL}    verify=${False}
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}    X-Tenant-ID=${TENANT_ID}
    Set Suite Variable    ${API_HEADERS}    ${headers}

Create Warehouse Via UI
    [Arguments]    ${warehouse_base}

    Click    css=[data-testid="nav-inventory"]
    Wait For Elements State    css=[data-testid="inventory-tab-warehouses"]    visible    timeout=20s
    Click    css=[data-testid="inventory-tab-warehouses"]

    Wait For Elements State    css=[data-testid="inventory-open-add-warehouse"]    visible    timeout=20s
    Click    css=[data-testid="inventory-open-add-warehouse"]

    Wait For Elements State    css=[data-testid="inventory-warehouse-modal"]    visible    timeout=10s
    Fill Text    css=[data-testid="inventory-warehouse-name"]    ${warehouse_base}
    Click        css=[data-testid="inventory-warehouse-save"]

    # Warehouse docname may include company suffix; match contains
    ${card}=    Set Variable    css=[data-testid="inventory-warehouse-card"][data-warehouse-name*="${warehouse_base}"]
    Wait For Elements State    ${card}    visible    timeout=30s
    ${warehouse_name}=    Get Attribute    ${card}    data-warehouse-name
    Should Not Be Empty    ${warehouse_name}
    RETURN    ${warehouse_name}

Create Item Via UI
    [Arguments]    ${item_code}    ${item_name}    ${warehouse_name}

    Click    css=[data-testid="inventory-tab-items"]
    Wait For Elements State    css=[data-testid="inventory-open-add-item"]    visible    timeout=20s
    Click    css=[data-testid="inventory-open-add-item"]

    Wait For Elements State    css=[data-testid="inventory-item-modal"]    visible    timeout=10s
    Fill Text    css=[data-testid="inventory-item-code"]            ${item_code}
    Fill Text    css=[data-testid="inventory-item-name"]            ${item_name}
    Fill Text    css=[data-testid="inventory-item-group"]           Products
    Fill Text    css=[data-testid="inventory-item-uom"]             Nos
    Fill Text    css=[data-testid="inventory-item-selling-price"]   100

    # Select default warehouse
    Select Options By    css=[data-testid="inventory-item-default-warehouse"]    label    ${warehouse_name}

    Click    css=[data-testid="inventory-item-save"]

    # Verify item appears in list
    ${card}=    Set Variable    css=[data-testid="inventory-item-card"][data-item-code="${item_code}"]
    Wait For Elements State    ${card}    visible    timeout=30s

Create Stock Entry Via UI
    [Arguments]    ${item_code}    ${warehouse_name}

    Click    css=[data-testid="inventory-tab-stock-entries"]
    Wait For Elements State    css=[data-testid="inventory-open-new-stock-entry"]    visible    timeout=20s
    Click    css=[data-testid="inventory-open-new-stock-entry"]

    Wait For Elements State    css=[data-testid="inventory-stock-entry-modal"]    visible    timeout=10s

    Select Options By    css=[data-testid="inventory-stock-entry-type"]    value    Material Receipt
    Select Options By    css=[data-testid="inventory-stock-entry-item-0"]    value    ${item_code}
    Fill Text           css=[data-testid="inventory-stock-entry-qty-0"]     10
    Select Options By   css=[data-testid="inventory-stock-entry-warehouse-0"]    label    ${warehouse_name}

    Click    css=[data-testid="inventory-stock-entry-save"]
    Wait For Elements State    css=[data-testid="inventory-stock-entry-modal"]    hidden    timeout=60s

Verify Item Exists Via API
    [Arguments]    ${item_code}    ${expected_name}

    API Session With Browser Token
    ${resp}=    GET On Session    moran_api_ui    /erpnext/resource/Item/${item_code}    headers=${API_HEADERS}    expected_status=200
    Should Be Equal As Strings    ${resp.json()['item_code']}    ${item_code}
    Should Be Equal As Strings    ${resp.json()['item_name']}    ${expected_name}

*** Test Cases ***
TC001_Shop Setup Basics (ERPNext)
    [Tags]    ui    e2e    erpnext    smoke

    Select Online ERPNext Workspace

    ${suffix}=          Generate Random String    6    [NUMBERS]
    ${warehouse_base}=  Set Variable    Robot WH ${suffix}
    ${item_code}=       Set Variable    RB-ITEM-${suffix}
    ${item_name}=       Set Variable    Robot Item ${suffix}

    ${warehouse_name}=  Create Warehouse Via UI    ${warehouse_base}
    Create Item Via UI  ${item_code}    ${item_name}    ${warehouse_name}
    Create Stock Entry Via UI    ${item_code}    ${warehouse_name}

    Verify Item Exists Via API    ${item_code}    ${item_name}
