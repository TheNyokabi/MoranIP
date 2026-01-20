*** Settings ***
Resource   bdd_steps.resource
Resource   backend_keywords.resource
Resource   engine_keywords.resource
Resource   reporting_keywords.resource
Resource   ../erpnext_paintshop_keywords.robot
Library    RequestsLibrary
Library    Collections
Library    String
Library    DateTime
Library    OperatingSystem

*** Variables ***
${WAREHOUSE}              ${EMPTY}
${WAREHOUSE_ABBR}         MPS
${COMPANY_NAME}           ${EMPTY}
${COMPANY_CURRENCY}       ${EMPTY}
${CUSTOMER}               Direct Customer 001
${POSTING_DATE}           ${EMPTY}
${DIFFERENCE_ACCOUNT}     ${EMPTY}
${COST_CENTER}            ${EMPTY}

# Deterministic test SKUs
${BASE_PAINT_ITEM}        BASE-WHITE-1L
${PIGMENT_BLUE}           PIG-BLUE-ML
${PIGMENT_RED}            PIG-RED-ML

*** Keywords ***
Suite Setup - Paint POS BDD
    [Documentation]    Auth + tenant-scoped headers via existing paintshop keywords.
    Setup Platform Session For ERPNext Tenant    admin@moran.com    admin123
    Select ERPNext Default Company

Select ERPNext Default Company
    [Documentation]    Detect a valid Company in the selected ERPNext tenant and set ${COMPANY} for downstream ERPNext document creation.
    ${resp}=    Get ERPNext Resource    Company
    Should Be Equal As Numbers    ${resp.status_code}    200
    ${companies}=    Get Response Data    ${resp}
    ${count}=    Get Length    ${companies}
    Should Be True    ${count} > 0
    ${first}=    Get From List    ${companies}    0
    ${company_name}=    Get From Dictionary    ${first}    name
    Set Suite Variable    ${COMPANY}         ${company_name}
    Set Suite Variable    ${COMPANY_NAME}    ${company_name}

Setup Platform Session For ERPNext Tenant
    [Arguments]    ${email}    ${password}
    [Documentation]    Login globally, select an ERPNext tenant, then get a tenant-scoped token.
    ${platform_url}=    Get Environment Variable    API_URL    ${PLATFORM_URL}
    Create Session    platform    ${platform_url}    verify=False

    ${auth_headers}=    Create Dictionary    Content-Type=application/json
    ${login_body}=      Create Dictionary    email=${email}    password=${password}
    ${login_resp}=      POST On Session    platform    /api/auth/login    json=${login_body}    headers=${auth_headers}    expected_status=any
    Should Be Equal As Numbers    ${login_resp.status_code}    200

    ${login_data}=      Set Variable    ${login_resp.json()}
    ${tenants}=         Get From Dictionary    ${login_data}    tenants
    ${tenant_id}=      Set Variable    ${EMPTY}
    ${access_token}=   Set Variable    ${EMPTY}
    FOR    ${t}    IN    @{tenants}
        ${engine}=    Get From Dictionary    ${t}    engine
        IF    '${engine}' != 'erpnext'
            Continue For Loop
        END

        ${candidate_tenant_id}=    Get From Dictionary    ${t}    id
        ${tenant_login_body}=      Create Dictionary    email=${email}    password=${password}    tenant_id=${candidate_tenant_id}
        ${candidate_resp}=         POST On Session    platform    /api/auth/v1/login-with-tenant
        ...    json=${tenant_login_body}    headers=${auth_headers}    expected_status=any

        IF    ${candidate_resp.status_code} == 200
            ${token_data}=    Set Variable    ${candidate_resp.json()}
            ${access_token}=  Get From Dictionary    ${token_data}    access_token
            ${tenant_id}=     Set Variable    ${candidate_tenant_id}
            Exit For Loop
        END
    END
    Should Not Be Empty    ${tenant_id}
    Should Not Be Empty    ${access_token}

    ${headers}=    Create Dictionary
    ...    X-Tenant-ID=${tenant_id}
    ...    Content-Type=application/json
    ...    Authorization=Bearer ${access_token}

    Set Suite Variable    ${PAINTSHOP_TENANT_ID}    ${tenant_id}
    Set Suite Variable    ${PLATFORM_TOKEN}         ${access_token}
    Set Suite Variable    ${HEADERS}                ${headers}

Ensure Paint POS Prerequisites
    [Documentation]    Make sure core ERPNext prerequisites exist (items, customer, and usable company/warehouse context).
    Ensure ERPNext Item Exists    ${BASE_PAINT_ITEM}    Base Paint White 1L    Paints
    Ensure ERPNext Item Exists    ${PIGMENT_BLUE}       Pigment Blue (ml)      Pigments
    Ensure ERPNext Item Exists    ${PIGMENT_RED}        Pigment Red (ml)       Pigments

    Select ERPNext Defaults From Item    ${BASE_PAINT_ITEM}
    Ensure ERPNext Warehouse Doc Exists    ${WAREHOUSE}
    Select ERPNext Company Currency
    Select ERPNext Posting Date
    Select ERPNext Stock Reconciliation Defaults
    Ensure ERPNext Customer Exists    ${CUSTOMER}

    # Ensure deterministic unit prices used by /api/paint/calculate-formula
    Ensure ERPNext Item Has Rates    ${BASE_PAINT_ITEM}    100
    Ensure ERPNext Item Has Rates    ${PIGMENT_BLUE}       10
    Ensure ERPNext Item Has Rates    ${PIGMENT_RED}        12

Select ERPNext Stock Reconciliation Defaults
    [Documentation]    Pick a usable leaf Account (Asset/Liability) and Cost Center for Stock Reconciliation submissions.
    ${account_filters}=    Evaluate    __import__('json').dumps([['Account','company','=','${COMPANY}'],['Account','is_group','=',0],['Account','root_type','in',['Asset','Liability']]])    json
    ${acc_resp}=    Get ERPNext Resource    Account    filters=${account_filters}
    Should Be Equal As Numbers    ${acc_resp.status_code}    200
    ${accounts}=    Get Response Data    ${acc_resp}
    ${acc_count}=    Get Length    ${accounts}
    Should Be True    ${acc_count} > 0
    ${acc_first}=    Get From List    ${accounts}    0
    ${acc_name}=    Get From Dictionary    ${acc_first}    name
    Set Suite Variable    ${DIFFERENCE_ACCOUNT}    ${acc_name}

    ${cc_filters}=    Evaluate    __import__('json').dumps([["Cost Center","company","=","${COMPANY}"],["Cost Center","is_group","=",0]])    json
    ${cc_resp}=    Get ERPNext Resource    Cost Center    filters=${cc_filters}
    Return From Keyword If    ${cc_resp.status_code} != 200
    ${ccs}=    Get Response Data    ${cc_resp}
    ${cc_count}=    Get Length    ${ccs}
    Return From Keyword If    ${cc_count} == 0
    ${cc_first}=    Get From List    ${ccs}    0
    ${cc_name}=    Get From Dictionary    ${cc_first}    name
    Set Suite Variable    ${COST_CENTER}    ${cc_name}

Ensure Paint POS Stock Available
    [Documentation]    Best-effort attempt to seed stock. If this fails, engine/proxy permissions are likely misconfigured.
    Set Stock Level Via Reconciliation    ${BASE_PAINT_ITEM}    ${WAREHOUSE}    500    100
    Set Stock Level Via Reconciliation    ${PIGMENT_BLUE}       ${WAREHOUSE}    500    10
    Set Stock Level Via Reconciliation    ${PIGMENT_RED}        ${WAREHOUSE}    500    12

Select ERPNext Defaults From Item
    [Arguments]    ${item_code}
    [Documentation]    Derive a working ${COMPANY} and ${WAREHOUSE} from ERPNext Item Defaults to avoid hard-coded tenant-specific values.
    ${resp}=    Get ERPNext Resource    Item    ${item_code}
    Should Be Equal As Numbers    ${resp.status_code}    200
    ${item}=    Get Response Data    ${resp}
    ${defaults}=    Get From Dictionary    ${item}    item_defaults
    ${count}=    Get Length    ${defaults}
    Should Be True    ${count} > 0
    ${first}=    Get From List    ${defaults}    0
    ${company}=    Get From Dictionary    ${first}    company
    ${warehouse}=    Get From Dictionary    ${first}    default_warehouse
    Set Suite Variable    ${COMPANY}         ${company}
    Set Suite Variable    ${COMPANY_NAME}    ${company}
    Set Suite Variable    ${WAREHOUSE}       ${warehouse}

Select ERPNext Company Currency
    [Documentation]    Set ${COMPANY_CURRENCY} from ERPNext Company defaults to avoid exchange-rate validation errors.
    Return From Keyword If    '${COMPANY}' == '${EMPTY}'
    ${resp}=    Get ERPNext Resource    Company    ${COMPANY}
    Return From Keyword If    ${resp.status_code} != 200
    ${company}=    Get Response Data    ${resp}
    ${currency}=    Get From Dictionary    ${company}    default_currency
    Set Suite Variable    ${COMPANY_CURRENCY}    ${currency}

Ensure ERPNext Warehouse Doc Exists
    [Arguments]    ${warehouse_docname}
    ${resp}=    Get ERPNext Resource    Warehouse    ${warehouse_docname}
    Should Be Equal As Numbers    ${resp.status_code}    200

Select ERPNext Posting Date
    [Documentation]    Set ${POSTING_DATE} to a date within an existing Fiscal Year to avoid ERPNext FiscalYearError during document submission.
    ${list_resp}=    Get ERPNext Resource    Fiscal Year
    Should Be Equal As Numbers    ${list_resp.status_code}    200
    ${fys}=    Get Response Data    ${list_resp}
    ${count}=    Get Length    ${fys}
    IF    ${count} == 0
        # Some fresh ERPNext sites don't have Fiscal Years configured.
        ${year}=    Get Current Date    result_format=%Y
        ${start}=    Set Variable    ${year}-01-01
        ${end}=      Set Variable    ${year}-12-31
        ${fy}=    Create Dictionary
        ...    doctype=Fiscal Year
        ...    year=${year}
        ...    year_start_date=${start}
        ...    year_end_date=${end}
        ${create}=    Create ERPNext Resource    Fiscal Year    ${fy}
        Should Be True    ${create.status_code} in [200, 201, 409]

        ${list_resp}=    Get ERPNext Resource    Fiscal Year
        Should Be Equal As Numbers    ${list_resp.status_code}    200
        ${fys}=    Get Response Data    ${list_resp}
        ${count}=    Get Length    ${fys}
    END
    Should Be True    ${count} > 0
    ${first}=    Get From List    ${fys}    0
    ${fy_name}=    Get From Dictionary    ${first}    name
    ${fy_resp}=    Get ERPNext Resource    Fiscal Year    ${fy_name}
    Should Be Equal As Numbers    ${fy_resp.status_code}    200
    ${fy}=    Get Response Data    ${fy_resp}
    ${start}=    Get From Dictionary    ${fy}    year_start_date
    Set Suite Variable    ${POSTING_DATE}    ${start}

Ensure ERPNext Warehouse Exists
    [Arguments]    ${warehouse_name}    ${warehouse_abbr}
    ${resp}=    Get ERPNext Resource    Warehouse    ${warehouse_name}
    Return From Keyword If    ${resp.status_code} == 200
    ${create}=    Create Warehouse    ${warehouse_name}    ${warehouse_abbr}
    # If it already exists or cannot be created due to environment constraints, continue.
    Should Be True    ${create.status_code} in [200, 409, 417, 422]

Ensure ERPNext Item Exists
    [Arguments]    ${item_code}    ${item_name}    ${item_group}
    ${resp}=    Get ERPNext Resource    Item    ${item_code}
    Return From Keyword If    ${resp.status_code} == 200
    ${create}=    Create Item    ${item_code}    ${item_name}    Nos    ${item_group}
    IF    ${create.status_code} not in [200, 409]
        ${create}=    Create Item    ${item_code}    ${item_name}    Nos    Products
    END

    ${verify}=    Get ERPNext Resource    Item    ${item_code}
    Run Keyword If    ${verify.status_code} != 200
    ...    Fail    Required ERPNext Item '${item_code}' is missing; create returned ${create.status_code}.

Ensure ERPNext Customer Exists
    [Arguments]    ${customer_name}
    ${filters}=    Evaluate    __import__('json').dumps([["Customer","customer_name","=","${customer_name}"]])    json
    ${resp}=    Get ERPNext Resource    Customer    filters=${filters}
    IF    ${resp.status_code} == 200
        ${data}=    Get Response Data    ${resp}
        ${count}=    Get Length    ${data}
        Run Keyword If    ${count} > 0    Return From Keyword
    END
    ${create}=    Create Customer    ${customer_name}
    Should Be True    ${create.status_code} in [200, 409, 417, 422]

Ensure ERPNext Item Has Rates
    [Arguments]    ${item_code}    ${rate}
    ${verify}=    Get ERPNext Resource    Item    ${item_code}
    Run Keyword If    ${verify.status_code} != 200
    ...    Fail    Cannot set rates for missing ERPNext Item '${item_code}'.
    ${data}=    Create Dictionary    standard_rate=${rate}    valuation_rate=${rate}
    ${resp}=    Update ERPNext Resource    Item    ${item_code}    ${data}
    # Some ERPNext setups may prevent updating valuation_rate directly; standard_rate is sufficient.
    Should Be True    ${resp.status_code} in [200, 417, 422]

Create Deterministic Tint Formula
    [Arguments]    ${color_code}
    [Documentation]    Create a formula with known costs and rounding behavior.
    # Formula produces 1000ml; components in ml per 1000ml.
    ${components}=    Create List
    ${c1}=    Create Dictionary    tint_item_code=${PIGMENT_BLUE}    quantity_per_unit=50    unit_of_measure=ml
    ${c2}=    Create Dictionary    tint_item_code=${PIGMENT_RED}     quantity_per_unit=25    unit_of_measure=ml
    Append To List    ${components}    ${c1}
    Append To List    ${components}    ${c2}

    # Ensure the color code exists.
    # If /color-codes returns unexpected errors in a given env, fall back to calculate-formula
    # which auto-creates the color code row when missing.
    ${cc_resp}=    Create Color Code Via Backend    ${color_code}    CUSTOM
    IF    ${cc_resp.status_code} not in [201, 409]
        Log    Color code pre-create failed (${cc_resp.status_code}): ${cc_resp.text}    WARN
        # Auto-create color code via calculate-formula (returns 200 even when no formula exists).
        ${_}=    Calculate Paint Formula Via Backend    ${color_code}    0.001
    END

    ${formula}=    Create Tint Formula Via Backend    ${color_code}    ${BASE_PAINT_ITEM}    1000    ${components}
    Dictionary Should Contain Key    ${formula}    id

Build Invoice Items
    [Arguments]    @{item_specs}
    [Documentation]    Build ERPNext items list from flat triples: item_code, qty, rate (repeatable).
    ${items}=    Create List
    ${specs}=    Set Variable    ${item_specs}
    ${n}=    Get Length    ${specs}
    Should Be True    ${n} % 3 == 0
    FOR    ${i}    IN RANGE    0    ${n}    3
        ${i1}=    Evaluate    ${i} + 1
        ${i2}=    Evaluate    ${i} + 2
        ${item_code}=    Get From List    ${specs}    ${i}
        ${qty}=          Get From List    ${specs}    ${i1}
        ${rate}=         Get From List    ${specs}    ${i2}
        ${d}=            Create Dictionary    item_code=${item_code}    qty=${qty}    rate=${rate}
        Append To List   ${items}    ${d}
    END
    [Return]    ${items}
