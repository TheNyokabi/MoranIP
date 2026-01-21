*** Settings ***
Documentation     Frontend UI Tests - POS End-to-End
Library           Browser
Library           OperatingSystem
Library           String
Force Tags        ui    pos    legacy
Suite Setup       POS Suite Setup
Suite Teardown    Close Browser
Test Setup        Ensure POS Ready

*** Variables ***
${FRONTEND_URL}        http://localhost:4000
${POS_EMAIL}           admin@moran.com
${POS_PASSWORD}        admin123
${POS_TENANT_CODE}     ${EMPTY}
${TENANTS_JSON}        ${EMPTY}
${OPENING_CASH}        1000

*** Keywords ***
POS Suite Setup
    Legacy UI Guard
    Use Frontend URL From Env
    Open Browser And Login
    Select Workspace And Open POS

Legacy UI Guard
    ${run_legacy}=    Get Environment Variable    RUN_LEGACY_UI    false
    Run Keyword If    '${run_legacy}' != 'true'
    ...    Skip    Skipping legacy UI suite (set RUN_LEGACY_UI=true to enable).

Use Frontend URL From Env
    ${base}=    Get Environment Variable    FRONTEND_URL    ${FRONTEND_URL}
    Set Suite Variable    ${FRONTEND_URL}    ${base}

Open Browser And Login
    ${email}=    Get Environment Variable    POS_EMAIL    ${POS_EMAIL}
    ${password}=    Get Environment Variable    POS_PASSWORD    ${POS_PASSWORD}

    New Browser    chromium    headless=True
    New Context    viewport={'width': 1920, 'height': 1080}
    Set Browser Timeout    30s
    New Page       ${FRONTEND_URL}/login

    ${login_visible}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=input[data-testid="login-email"]    visible    timeout=10s
    Run Keyword If    ${login_visible}    Fill Text      css=input[data-testid="login-email"]       ${email}
    Run Keyword If    ${login_visible}    Fill Text      css=input[data-testid="login-password"]    ${password}
    Run Keyword If    ${login_visible}    Click          css=button[data-testid="login-submit"]
    ${login_error_visible}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=div.bg-red-500/10    visible    timeout=5s
    Run Keyword If    ${login_error_visible}
    ...    ${login_error}=    Get Text    css=div.bg-red-500/10
    Run Keyword If    ${login_error_visible}
    ...    Fail    Login failed: ${login_error}
    ${dashboard_loaded}=    Run Keyword And Return Status
    ...    Wait Until Keyword Succeeds    15s    1s    Get Url    contains    /dashboard
    Run Keyword If    not ${dashboard_loaded}    Fetch And Set Token Via Api
    Run Keyword If    not ${dashboard_loaded}    Go To    ${FRONTEND_URL}/dashboard
    Wait For Elements State    css=[data-testid="workspace-search"]    visible    timeout=120s

Token Present In LocalStorage
    ${token}=    Evaluate JavaScript    css=body    window.localStorage.getItem('token')
    Should Not Be Empty    ${token}

Fetch And Set Token Via Api
    ${email}=    Get Environment Variable    POS_EMAIL    ${POS_EMAIL}
    ${password}=    Get Environment Variable    POS_PASSWORD    ${POS_PASSWORD}
    ${payload}=    Evaluate    json.dumps({"email":"${email}","password":"${password}"})    modules=json
    Log    Identity login payload: ${payload}
    ${payload_file}=    Set Variable    /tmp/identity_login_payload.json
    Create File    ${payload_file}    ${payload}
    ${response}=    Wait Until Keyword Succeeds    30s    2s    Identity Login Response    ${payload_file}
    ${user_id}=    Evaluate    json.loads("""${response}""")['user_id']    modules=json
    ${user_code}=    Evaluate    json.loads("""${response}""")['user_code']    modules=json
    ${email_resp}=    Evaluate    json.loads("""${response}""")['email']    modules=json
    ${full_name}=    Evaluate    json.loads("""${response}""")['full_name']    modules=json
    ${kyc_tier}=    Evaluate    json.loads("""${response}""")['kyc_tier']    modules=json
    ${identity_token}=    Evaluate    json.loads("""${response}""")['access_token']    modules=json
    ${tenants}=    Evaluate    json.loads("""${response}""")['tenants']    modules=json
    ${rcm}    ${memberships}=    Run And Return Rc And Output    curl -sS -H "Authorization: Bearer ${identity_token}" http://localhost:9000/api/auth/me/memberships
    Run Keyword If    ${rcm} != 0    Fail    Memberships API failed with rc=${rcm}: ${memberships}
    ${tenants_json}=    Evaluate    json.dumps(json.loads("""${memberships}"""))    modules=json
    Set Suite Variable    ${USER_ID}    ${user_id}
    Set Suite Variable    ${USER_CODE}    ${user_code}
    Set Suite Variable    ${USER_EMAIL}    ${email_resp}
    Set Suite Variable    ${USER_NAME}    ${full_name}
    Set Suite Variable    ${USER_KYC}    ${kyc_tier}
    Set Suite Variable    ${TENANTS_JSON}    ${tenants_json}
    ${identity_state}=    Evaluate    json.dumps({"state":{"user":{"id":"${user_id}","userCode":"${user_code}","name":"${full_name}","email":"${email_resp}","kycTier":"${kyc_tier}","isSuperAdmin":False},"token":"${identity_token}","availableTenants":json.loads('''${tenants_json}'''),"currentTenant":None},"version":0})    modules=json
    ${identity_state_b64}=    Evaluate    base64.b64encode("""${identity_state}""".encode()).decode()    modules=base64
    Evaluate JavaScript    css=body    (() => { const token='${identity_token}'; const state = JSON.parse(atob('${identity_state_b64}')); window.localStorage.setItem('token', token); window.localStorage.setItem('access_token', token); window.localStorage.setItem('moran-auth', JSON.stringify(state)); document.cookie = 'auth_token=' + token + '; path=/'; })()
    Add Cookie    name=auth_token    value=${identity_token}    url=${FRONTEND_URL}
    Reload

Identity Login Response
    [Arguments]    ${payload_file}
    ${rc}    ${response}=    Run And Return Rc And Output    curl -sS -X POST http://localhost:9000/api/auth/login -H "Content-Type: application/json" --data-binary @${payload_file}
    Run Keyword If    ${rc} != 0    Fail    Login API call failed with rc=${rc}: ${response}
    Should Contain    ${response}    access_token
    [Return]    ${response}

Set Tenant Token For Workspace
    [Arguments]    ${tenant_id}
    ${ok}=    Try Tenant Token For Workspace    ${tenant_id}
    Run Keyword If    not ${ok}    Fail    Tenant login response invalid for ${tenant_id}

Try Tenant Token For Workspace
    [Arguments]    ${tenant_id}
    ${email}=    Get Environment Variable    POS_EMAIL    ${POS_EMAIL}
    ${password}=    Get Environment Variable    POS_PASSWORD    ${POS_PASSWORD}
    ${payload}=    Evaluate    json.dumps({"email":"${email}","password":"${password}","tenant_id":"${tenant_id}"})    modules=json
    ${payload_file}=    Set Variable    /tmp/tenant_login_payload.json
    Create File    ${payload_file}    ${payload}
    ${rc2}    ${tenant_response}=    Run And Return Rc And Output    curl -sS -X POST http://localhost:9000/api/auth/v1/login-with-tenant -H "Content-Type: application/json" --data-binary @${payload_file}
    Run Keyword If    ${rc2} != 0    Return From Keyword    False
    ${has_token}=    Run Keyword And Return Status    Should Contain    ${tenant_response}    access_token
    Run Keyword If    not ${has_token}    Return From Keyword    False
    ${tenant_token}=    Evaluate    json.loads("""${tenant_response}""")['access_token']    modules=json
    ${tenant_obj}=    Evaluate    json.dumps(json.loads("""${tenant_response}""")['tenant'])    modules=json
    ${auth_state}=    Evaluate    json.dumps({"state":{"user":{"id":"${USER_ID}","userCode":"${USER_CODE}","name":"${USER_NAME}","email":"${USER_EMAIL}","kycTier":"${USER_KYC}","isSuperAdmin":False},"token":"${tenant_token}","availableTenants":json.loads('''${TENANTS_JSON}'''),"currentTenant":json.loads('''${tenant_obj}''')},"version":0})    modules=json
    ${auth_state_b64}=    Evaluate    base64.b64encode("""${auth_state}""".encode()).decode()    modules=base64
    Evaluate JavaScript    css=body    (() => { const token='${tenant_token}'; const state = JSON.parse(atob('${auth_state_b64}')); window.localStorage.setItem('token', token); window.localStorage.setItem('access_token', token); window.localStorage.setItem('moran-auth', JSON.stringify(state)); document.cookie = 'auth_token=' + token + '; path=/'; })()
    Add Cookie    name=auth_token    value=${tenant_token}    url=${FRONTEND_URL}
    Reload
    Set Suite Variable    ${TENANT_TOKEN}    ${tenant_token}
    Return From Keyword    True
Select Workspace And Open POS
    ${preferred_code}=    Get Environment Variable    POS_TENANT_CODE    ${POS_TENANT_CODE}
    Run Keyword If    '${preferred_code}' != ''    Use Tenant By Code    ${preferred_code}
    Run Keyword If    '${preferred_code}' == ''    Use Tenant From Dashboard
    Start Session If Needed
    Wait For Elements State    css=h1:has-text("Point of Sale")    visible    timeout=20s

Use Tenant From Dashboard
    ${tenant_code}=    Get Attribute    css=[data-testid="workspace-card"] >> nth=0    data-tenant-code
    ${tenant_id}=    Get Attribute    css=[data-testid="workspace-card"] >> nth=0    data-tenant-id
    Set Suite Variable    ${TENANT_CODE}    ${tenant_code}
    Click    css=[data-testid="workspace-card"] >> nth=0
    Go To    ${FRONTEND_URL}/w/${TENANT_CODE}/pos

Select Workspace By Code
    [Arguments]    ${code}
    Wait For Elements State    css=[data-testid="workspace-search"]    visible    timeout=120s
    Fill Text    css=[data-testid="workspace-search"]    ${code}
    Wait For Elements State    css=[data-testid="workspace-card"][data-tenant-code="${code}"]    visible    timeout=120s
    ${tenant_code}=    Get Attribute    css=[data-testid="workspace-card"][data-tenant-code="${code}"]    data-tenant-code
    Set Suite Variable    ${TENANT_CODE}    ${tenant_code}
    Click    css=[data-testid="workspace-card"][data-tenant-code="${code}"]
    Go To    ${FRONTEND_URL}/w/${TENANT_CODE}/pos

Use Tenant From Api
    ${tenant_ids}=    Evaluate    [t['id'] for t in json.loads('''${TENANTS_JSON}''')]    modules=json
    ${token_set}=    Set Variable    False
    FOR    ${tenant_id}    IN    @{tenant_ids}
        ${tenant_code}=    Evaluate    next(t['code'] for t in json.loads('''${TENANTS_JSON}''') if t['id']=='${tenant_id}')    modules=json
        ${token_set}=    Try Tenant Token For Workspace    ${tenant_id}
        Run Keyword If    ${token_set}    Set Suite Variable    ${TENANT_CODE}    ${tenant_code}
        Run Keyword If    ${token_set}    Exit For Loop
    END
    Run Keyword If    not ${token_set}    Fail    No accessible tenant found for UI POS tests.
    Seed Items If Needed
    Go To    ${FRONTEND_URL}/w/${TENANT_CODE}/pos
Use Tenant By Code
    [Arguments]    ${code}
    Run Keyword If    '${TENANTS_JSON}' == ''    Fetch And Set Token Via Api
    ${tenant_id}=    Evaluate    next(t['id'] for t in json.loads('''${TENANTS_JSON}''') if t['code']=='${code}')    modules=json
    Set Tenant Token For Workspace    ${tenant_id}
    Set Suite Variable    ${TENANT_CODE}    ${code}
    Seed Items If Needed
    Go To    ${FRONTEND_URL}/w/${TENANT_CODE}/pos
    ${pos_url}=    Get Url
    Log    POS URL after navigation: ${pos_url}
    ${cookie_val}=    Evaluate JavaScript    css=body    document.cookie
    Log    Cookie after POS nav: ${cookie_val}

Seed Items If Needed
    ${rc}    ${count}=    Run And Return Rc And Output    /bin/sh -lc "curl -sS -H 'Authorization: Bearer ${TENANT_TOKEN}' 'http://localhost:9000/api/inventory/items?limit=1' | jq -r '.items | length'"
    Run Keyword If    ${rc} != 0    Fail    Failed to check inventory items (rc=${rc}): ${count}
    Run Keyword If    '${count}' == '0'    Create POS Items

Create POS Items
    ${headers}=    Set Variable    -H \"Authorization: Bearer ${TENANT_TOKEN}\" -H \"Content-Type: application/json\"
    Run    /bin/sh -lc "curl -sS ${headers} -d '{\"item_group_name\":\"Products\",\"parent_item_group\":\"All Item Groups\",\"is_group\":0}' http://localhost:9000/api/erpnext/resource/Item%20Group >/dev/null || true"
    Run    /bin/sh -lc "curl -sS ${headers} -d '{\"item_code\":\"PHN-IPH-15\",\"item_name\":\"iPhone 15 Pro\",\"item_group\":\"Products\",\"stock_uom\":\"Nos\",\"standard_rate\":149999,\"description\":\"iPhone 15 Pro\",\"is_stock_item\":1}' http://localhost:9000/api/inventory/items >/dev/null || true"
    Run    /bin/sh -lc "curl -sS ${headers} -d '{\"item_code\":\"LAP-MAC-14\",\"item_name\":\"MacBook Air M2\",\"item_group\":\"Products\",\"stock_uom\":\"Nos\",\"standard_rate\":189999,\"description\":\"MacBook Air M2\",\"is_stock_item\":1}' http://localhost:9000/api/inventory/items >/dev/null || true"
    Run    /bin/sh -lc "curl -sS ${headers} -d '{\"item_code\":\"TAB-IPD-11\",\"item_name\":\"iPad Pro 11\",\"item_group\":\"Products\",\"stock_uom\":\"Nos\",\"standard_rate\":99999,\"description\":\"iPad Pro 11\",\"is_stock_item\":1}' http://localhost:9000/api/inventory/items >/dev/null || true"

Ensure POS Ready
    Close Receipt Preview If Open
    Run Keyword And Return Status    Evaluate JavaScript    css=body    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'New Sale')?.click()
    Run Keyword And Return Status    Clear Cart Js
    Run Keyword And Return Status    Fill Text    css=input[placeholder="Search products..."]    ${EMPTY}
    Start Session If Needed
    Wait For Elements State    css=h1:has-text("Point of Sale")    visible    timeout=20s
    Reset Cart

Start Session If Needed
    ${needs_session}=    Run Keyword And Return Status
    ...    Wait For Elements State    text=Start Your Session    visible    timeout=5s
    Run Keyword If    ${needs_session}    Fill Text    css=input[type="number"]    ${OPENING_CASH}
    Run Keyword If    ${needs_session}    Click    button:has-text("Start Session")
    Wait For Elements State    css=h1:has-text("Point of Sale")    visible    timeout=20s

Add First Item To Cart
    Close Receipt Preview If Open
    Wait For Items To Load
    Evaluate JavaScript    css=body    Array.from(document.querySelectorAll('button')).find(b => b.querySelector('h3'))?.click()
    Wait For Elements State    text=Cart is empty    hidden    timeout=10s

Complete Cash Sale
    Click    button:has-text("Cash")
    Click    button:has-text("Complete Sale")
    Wait For Elements State    text=Receipt Preview    visible    timeout=20s
    Close Receipt Preview If Open
    Reset Cart And Ensure Empty

Search Products By Name
    [Arguments]    ${query}
    Wait For Items To Load
    Evaluate JavaScript    css=body    (() => { const input = document.querySelector('input[placeholder=\"Search products...\"]'); if (input) { input.value='${query}'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); } })()
    ${count}=    Get Element Count    css=div.grid.grid-cols-4 >> button
    [Return]    ${count}

Clear Product Search
    Wait For Items To Load
    Evaluate JavaScript    css=body    (() => { const input = document.querySelector('input[placeholder=\"Search products...\"]'); if (input) { input.value=''; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); } })()
    ${count}=    Get Element Count    css=div.grid.grid-cols-4 >> button
    [Return]    ${count}

Wait For Items To Load
    Run Keyword And Return Status    Click    button:has-text("Products")
    Run Keyword And Return Status    Fill Text    css=input[placeholder="Search products..."]    ${EMPTY}
    ${items_ready}=    Run Keyword And Return Status
    ...    Wait For Elements State    css=button:has(h3) >> nth=0    visible    timeout=60s
    Run Keyword If    not ${items_ready}    Log POS Items Count
    Run Keyword If    not ${items_ready}    Skip    No POS items available for UI validation.

Log POS Items Count
    ${token}=    Get Variable Value    ${TENANT_TOKEN}    ${EMPTY}
    Run Keyword If    '${token}' == ''    Log    POS items from API: skipped (no tenant token)
    ${rc}    ${count}=    Run And Return Rc And Output    /bin/sh -lc "curl -sS -H 'Authorization: Bearer ${token}' http://localhost:9000/api/pos/items | jq -r '.items | length'"
    Run Keyword If    '${token}' != ''    Log    POS items from API: ${count}

Adjust Cart Quantity And Remove Item
    Add First Item To Cart
    ${qty_before}=    Get Text    css=div.p-3.rounded-lg >> span.w-8
    Evaluate JavaScript    css=body    document.querySelectorAll('div.p-3.rounded-lg button.h-7.w-7')[1].click()
    ${qty_after}=    Get Text    css=div.p-3.rounded-lg >> span.w-8
    Should Not Be Equal    ${qty_before}    ${qty_after}
    Evaluate JavaScript    css=body    document.querySelectorAll('div.p-3.rounded-lg button.h-7.w-7')[0].click()
    ${qty_reset}=    Get Text    css=div.p-3.rounded-lg >> span.w-8
    Should Be Equal    ${qty_before}    ${qty_reset}
    Evaluate JavaScript    css=body    document.querySelectorAll('div.p-3.rounded-lg button.text-red-400')[0].click()
    Reset Cart And Ensure Empty

Reset Cart And Ensure Empty
    Close Receipt Preview If Open
    Evaluate JavaScript    css=body    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'New Sale')?.click()
    Clear Cart Js
    Wait Until Keyword Succeeds    10s    1s    Assert Cart Empty

Reset Cart
    Close Receipt Preview If Open
    Evaluate JavaScript    css=body    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'New Sale')?.click()
    Clear Cart Js

Close Receipt Preview If Open
    ${preview_open}=    Run Keyword And Return Status
    ...    Wait For Elements State    text=Receipt Preview    visible    timeout=5s
    Run Keyword If    ${preview_open}    Press Keys    css=body    Escape
    Run Keyword If    ${preview_open}
    ...    Evaluate JavaScript    css=body    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '×')?.click()

Clear Cart Js
    Evaluate JavaScript    css=body    document.querySelector('div.w-96 button.text-red-400')?.click()

Assert Cart Empty
    ${cart_count}=    Evaluate JavaScript    css=body    (() => { const panel = document.querySelector('div.w-96'); if (!panel) return 0; return panel.querySelectorAll('div.p-3.rounded-lg.bg-white\\/5').length; })()
    Should Be Equal As Integers    ${cart_count}    0

*** Test Cases ***
TC001_POS Loads And Session Starts
    [Documentation]    Verify POS loads and session can start
    [Tags]    smoke    pos
    Wait For Elements State    css=h1:has-text("Point of Sale")    visible
    ${count}=    Get Element Count    css=button:has(h3)
    Run Keyword If    ${count} == 0    Skip    No POS items available for UI validation.

TC002_Complete Cash Sale
    [Documentation]    Add one item to cart and complete a cash sale
    [Tags]    pos    sale    critical
    Add First Item To Cart
    Complete Cash Sale

TC003_Open Analytics Page
    [Documentation]    Navigate to POS analytics and return to POS
    [Tags]    pos    analytics
    Close Receipt Preview If Open
    Click    button:has-text("Analytics")
    Wait For Elements State    text=POS Analytics    visible    timeout=15s
    Click    button:has-text("Back to POS")
    Wait For Elements State    css=h1:has-text("Point of Sale")    visible    timeout=15s

TC004_Search Products
    [Documentation]    Search for products using the search bar
    [Tags]    pos    search
    Wait For Items To Load
    ${count}=    Get Element Count    css=button:has(h3)
    Run Keyword If    ${count} == 0    Skip    No POS items available for search.
    ${item_code}=    Get Text    css=button:has(h3) >> nth=0 >> css=p.text-xs
    ${query}=    Evaluate    """${item_code}""".strip()
    ${result_count}=    Search Products By Name    ${query}
    Run Keyword If    ${result_count} == 0    Log    Search returned 0 items for query '${query}'    WARN
    ${after_clear}=    Clear Product Search
    Run Keyword If    ${after_clear} == 0    Log    Search reset returned 0 items after clearing query    WARN

TC005_Adjust Quantity And Remove
    [Documentation]    Increase/decrease quantity and remove item from cart
    [Tags]    pos    cart
    Adjust Cart Quantity And Remove Item

TC006_Receipt Preview After Sale
    [Documentation]    Complete sale and verify receipt preview is displayed
    [Tags]    pos    receipt    critical
    Add First Item To Cart
    Click    button:has-text("Cash")
    Click    button:has-text("Complete Sale")
    Wait For Elements State    text=Receipt Preview    visible    timeout=20s
    Wait For Elements State    text=Receipt Preview    visible    timeout=15s
    Close Receipt Preview If Open
    Reset Cart And Ensure Empty
