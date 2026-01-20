*** Settings ***
Documentation     Enterprise Case Study - Reusable Keywords
...               Keywords for testing Enterprise workflows
Library           RequestsLibrary
Library           Collections
Library           String
Library           DateTime
Library           OperatingSystem

*** Variables ***
${PLATFORM_URL}    http://localhost:9000
${TENANT_ID}       ${EMPTY}  # Set via variable file or command line
${ACCESS_TOKEN}    ${EMPTY}  # Set via variable file or command line

*** Keywords ***
Setup Enterprise Test Environment
    [Documentation]    Enterprise workflows are optional; skip unless explicitly enabled.
    ${run}=    Get Environment Variable    RUN_ENTERPRISE    false
    Run Keyword If    '${run}' != 'true'
    ...    Skip    Skipping enterprise suites (set RUN_ENTERPRISE=true to enable).

    ${platform_url}=    Get Environment Variable    API_URL    ${PLATFORM_URL}
    Set Suite Variable    ${PLATFORM_URL}    ${platform_url}

    # If enabled, these suites require explicit tenant+token wiring.
    Should Not Be Empty    ${TENANT_ID}       msg=Enterprise suite requires TENANT_ID
    Should Not Be Empty    ${ACCESS_TOKEN}    msg=Enterprise suite requires ACCESS_TOKEN
    Create Session    platform    ${PLATFORM_URL}
    ${headers}=    Create Dictionary    Authorization=Bearer ${ACCESS_TOKEN}    Content-Type=application/json
    Set Suite Variable    ${HEADERS}    ${headers}

Setup Platform Session
    [Documentation]    Setup API session with authentication
    Create Session    platform    ${PLATFORM_URL}
    ${headers}=    Create Dictionary    Authorization=Bearer ${ACCESS_TOKEN}    Content-Type=application/json
    Set Suite Variable    ${HEADERS}    ${headers}

Cleanup Test Data
    [Documentation]    Default enterprise suite teardown (no-op unless explicitly implemented).
    RequestsLibrary.Delete All Sessions

Verify Response Status
    [Documentation]    Verify API response status code
    [Arguments]    ${response}    ${expected_status}=200
    Should Be Equal As Numbers    ${response.status_code}    ${expected_status}
    ...    Expected status ${expected_status} but got ${response.status_code}. Response: ${response.text}

Get Response Data
    [Documentation]    Extract data from API response
    [Arguments]    ${response}
    ${json}=    Evaluate    json.loads('''${response.text}''')    json
    ${has_data}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${json}    data
    Return From Keyword If    ${has_data}    ${json}[data]
    Return From Keyword If    ${has_data} == False    ${json}
    [Return]    ${json}

Create BOM
    [Documentation]    Create Bill of Materials
    [Arguments]    ${bom_data}
    ${response}=    Post Request    platform    /api/tenants/${TENANT_ID}/erpnext/resource/BOM
    ...    headers=${HEADERS}    json=${bom_data}
    [Return]    ${response}

Create Work Order
    [Documentation]    Create Work Order for production
    [Arguments]    ${wo_data}
    ${response}=    Post Request    platform    /api/tenants/${TENANT_ID}/erpnext/resource/Work Order
    ...    headers=${HEADERS}    json=${wo_data}
    [Return]    ${response}

Get Stock Balance
    [Documentation]    Get stock balance for item in warehouse
    [Arguments]    ${item_code}    ${warehouse}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/pos/items/${item_code}/stock?warehouse=${warehouse}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    ${qty}=    Get From Dictionary    ${data}    qty
    [Return]    ${qty}

Issue Materials For Work Order
    [Documentation]    Issue materials from warehouse to work center
    [Arguments]    ${issue_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erpnext/resource/Work Order/${issue_data}[work_order]/issue_materials
    ...    headers=${HEADERS}    json=${issue_data}
    [Return]    ${response}

Complete Work Order Production
    [Documentation]    Record production completion for work order
    [Arguments]    ${production_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erpnext/resource/Work Order/${production_data}[work_order]/complete_production
    ...    headers=${HEADERS}    json=${production_data}
    [Return]    ${response}

Receive Finished Goods
    [Documentation]    Receive finished goods from work center
    [Arguments]    ${receive_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erpnext/resource/Work Order/${receive_data}[work_order]/receive_finished_goods
    ...    headers=${HEADERS}    json=${receive_data}
    [Return]    ${response}

Create Sales Order
    [Documentation]    Create Sales Order
    [Arguments]    ${so_data}
    ${items}=    Create List
    ${item}=    Create Dictionary    item_code=${so_data}[items]    qty=${so_data}[qty]    rate=${so_data}[rate]
    Append To List    ${items}    ${item}
    ${so_payload}=    Create Dictionary
    ...    customer=${so_data}[customer]
    ...    items=${items}
    ...    delivery_date=${so_data}[delivery_date]
    ${response}=    Post Request    platform    /api/tenants/${TENANT_ID}/erpnext/resource/Sales Order
    ...    headers=${HEADERS}    json=${so_payload}
    [Return]    ${response}

Create Delivery Note
    [Documentation]    Create Delivery Note from Sales Order
    [Arguments]    ${dn_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erpnext/resource/Delivery Note
    ...    headers=${HEADERS}    json=${dn_data}
    [Return]    ${response}

Create Sales Invoice From Delivery Note
    [Documentation]    Create Sales Invoice from Delivery Note
    [Arguments]    ${invoice_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/sales-invoices
    ...    headers=${HEADERS}    json=${invoice_data}
    [Return]    ${response}

Get Sales Invoice
    [Documentation]    Get Sales Invoice details
    [Arguments]    ${invoice_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/sales-invoices/${invoice_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Record Payment
    [Documentation]    Record payment for invoice
    [Arguments]    ${payment_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/payment-entries
    ...    headers=${HEADERS}    json=${payment_data}
    [Return]    ${response}

Get GL Entries For Invoice
    [Documentation]    Get GL entries for a sales invoice
    [Arguments]    ${invoice_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/gl-entries?voucher_no=${invoice_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Calculate GL Debit Total
    [Documentation]    Calculate total debits from GL entries
    [Arguments]    ${gl_entries}
    ${total}=    Set Variable    ${0}
    FOR    ${entry}    IN    @{gl_entries}
        ${debit}=    Get From Dictionary    ${entry}    debit
        ${total}=    Evaluate    ${total} + ${debit}
    END
    [Return]    ${total}

Calculate GL Credit Total
    [Documentation]    Calculate total credits from GL entries
    [Arguments]    ${gl_entries}
    ${total}=    Set Variable    ${0}
    FOR    ${entry}    IN    @{gl_entries}
        ${credit}=    Get From Dictionary    ${entry}    credit
        ${total}=    Evaluate    ${total} + ${credit}
    END
    [Return]    ${total}

Get Production Cost Report
    [Documentation]    Get production cost report for work order
    [Arguments]    ${work_order}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/manufacturing/work-orders/${work_order}/cost-report
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Sales Profitability
    [Documentation]    Get sales profitability report for invoice
    [Arguments]    ${invoice_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/sales-invoices/${invoice_name}/profitability
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Verify Tenant Exists
    [Documentation]    Verify tenant exists in system
    [Arguments]    ${tenant_id}
    ${response}=    Get Request    platform    /api/iam/tenants/${tenant_id}    headers=${HEADERS}
    Verify Response Status    ${response}    200

Verify Company Exists
    [Documentation]    Verify company exists in ERPNext
    [Arguments]    ${company_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erpnext/resource/Company/${company_name}
    ...    headers=${HEADERS}
    Verify Response Status    ${response}    200

Verify Warehouses Exist
    [Documentation]    Verify warehouses exist
    [Arguments]    @{warehouse_names}
    FOR    ${wh}    IN    @{warehouse_names}
        ${response}=    Get Request    platform
        ...    /api/tenants/${TENANT_ID}/erp/inventory/warehouses/${wh}
        ...    headers=${HEADERS}
        Verify Response Status    ${response}    200
    END

Verify Items Exist
    [Documentation]    Verify items exist
    [Arguments]    @{item_codes}
    FOR    ${item}    IN    @{item_codes}
        ${response}=    Get Request    platform
        ...    /api/tenants/${TENANT_ID}/erp/inventory/items/${item}
        ...    headers=${HEADERS}
        Verify Response Status    ${response}    200
    END

Delete All HTTP Sessions
    [Documentation]    Clean up HTTP sessions
    RequestsLibrary.Delete All Sessions
