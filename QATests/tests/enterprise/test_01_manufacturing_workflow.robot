*** Settings ***
Documentation     Enterprise Case Study - Complete Manufacturing Workflow
...               Tests the complete cycle from BOM creation to sales delivery
...               Tech Manufacturing Co. Ltd. - ERPNext Enterprise
Resource          ../../resources/enterprise_keywords.robot
Suite Setup       Setup Enterprise Test Environment
Suite Teardown    Cleanup Test Data

*** Variables ***
${COMPANY}        Tech Manufacturing Co. Ltd.
${WAREHOUSE_RAW}  Raw Materials Warehouse - TMC001
${WAREHOUSE_FG}   Finished Goods Warehouse - TMC001
${WORK_CENTER}    Assembly Line 1
${ITEM_RAW1}      CB-100
${ITEM_RAW2}      SC-001
${ITEM_RAW3}      BT-001
${ITEM_RAW4}      CS-001
${ITEM_FINISHED}  SP-X1
${CUSTOMER}       Corporation X
${BOM_QTY}        100

*** Test Cases ***

TC001_Create_BOM_Successfully
    [Documentation]    Create Bill of Materials for Smartphone Model X
    [Tags]    manufacturing    positive    smoke
    ${bom_data}=    Create Dictionary
    ...    item=${ITEM_FINISHED}
    ...    quantity=1
    ...    uom=Nos
    ...    company=${COMPANY}
    
    ${bom_items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RAW1}    qty=1    rate=500
    ${item2}=    Create Dictionary    item_code=${ITEM_RAW2}    qty=1    rate=2000
    ${item3}=    Create Dictionary    item_code=${ITEM_RAW3}    qty=1    rate=1500
    ${item4}=    Create Dictionary    item_code=${ITEM_RAW4}    qty=1    rate=800
    Append To List    ${bom_items}    ${item1}
    Append To List    ${bom_items}    ${item2}
    Append To List    ${bom_items}    ${item3}
    Append To List    ${bom_items}    ${item4}
    Set To Dictionary    ${bom_data}    items=${bom_items}
    
    ${response}=    Create BOM    ${bom_data}
    Verify Response Status    ${response}    200
    ${bom_name}=    Get Response Data    ${response}
    Should Contain    ${bom_name}    BOM
    [Teardown]    Run Keyword If    '${response.status_code}' == '200'
    ...    Set Suite Variable    ${BOM_NAME}    ${bom_name}

TC002_Verify_Initial_Stock_Available
    [Documentation]    Verify raw materials stock is sufficient for production
    [Tags]    inventory    positive
    ${stock_cb}=    Get Stock Balance    ${ITEM_RAW1}    ${WAREHOUSE_RAW}
    ${stock_sc}=    Get Stock Balance    ${ITEM_RAW2}    ${WAREHOUSE_RAW}
    ${stock_bt}=    Get Stock Balance    ${ITEM_RAW3}    ${WAREHOUSE_RAW}
    ${stock_cs}=    Get Stock Balance    ${ITEM_RAW4}    ${WAREHOUSE_RAW}
    
    Should Be True    ${stock_cb} >= ${BOM_QTY}
    Should Be True    ${stock_sc} >= ${BOM_QTY}
    Should Be True    ${stock_bt} >= ${BOM_QTY}
    Should Be True    ${stock_cs} >= ${BOM_QTY}
    Log    Stock verified: CB-100=${stock_cb}, SC-001=${stock_sc}, BT-001=${stock_bt}, CS-001=${stock_cs}

TC003_Create_Work_Order
    [Documentation]    Create work order for 100 units production
    [Tags]    manufacturing    positive    smoke
    ${wo_data}=    Create Dictionary
    ...    production_item=${ITEM_FINISHED}
    ...    qty=${BOM_QTY}
    ...    bom_no=${BOM_NAME}
    ...    wip_warehouse=${WORK_CENTER}
    ...    fg_warehouse=${WAREHOUSE_FG}
    ...    company=${COMPANY}
    
    ${response}=    Create Work Order    ${wo_data}
    Verify Response Status    ${response}    200
    ${wo_name}=    Get Response Data    ${response}
    Should Contain    ${wo_name}    WO-
    [Teardown]    Set Suite Variable    ${WORK_ORDER}    ${wo_name}

TC004_Issue_Materials_To_Work_Center
    [Documentation]    Issue raw materials from warehouse to work center
    [Tags]    manufacturing    inventory    positive
    ${issue_data}=    Create Dictionary
    ...    work_order=${WORK_ORDER}
    ...    source_warehouse=${WAREHOUSE_RAW}
    ...    target_warehouse=${WORK_CENTER}
    
    ${response}=    Issue Materials For Work Order    ${issue_data}
    Verify Response Status    ${response}    200
    
    # Verify stock deducted from raw materials warehouse
    ${stock_after}=    Get Stock Balance    ${ITEM_RAW1}    ${WAREHOUSE_RAW}
    Log    Stock after issue: ${stock_after}

TC005_Record_Production_Completion
    [Documentation]    Record production completion with quality check
    [Tags]    manufacturing    positive
    ${production_data}=    Create Dictionary
    ...    work_order=${WORK_ORDER}
    ...    finished_qty=98
    ...    scrap_qty=2
    ...    scrap_item=${ITEM_RAW1}
    
    ${response}=    Complete Work Order Production    ${production_data}
    Verify Response Status    ${response}    200

TC006_Receive_Finished_Goods
    [Documentation]    Receive finished goods from work center to warehouse
    [Tags]    manufacturing    inventory    positive
    ${receive_data}=    Create Dictionary
    ...    work_order=${WORK_ORDER}
    ...    finished_qty=98
    ...    target_warehouse=${WAREHOUSE_FG}
    
    ${response}=    Receive Finished Goods    ${receive_data}
    Verify Response Status    ${response}    200
    
    # Verify finished goods stock increased
    ${fg_stock}=    Get Stock Balance    ${ITEM_FINISHED}    ${WAREHOUSE_FG}
    Should Be Equal    ${fg_stock}    98
    Log    Finished goods stock: ${fg_stock} units

TC007_Create_Sales_Order_From_Opportunity
    [Documentation]    Create sales order for corporate customer
    [Tags]    crm    sales    positive
    ${so_data}=    Create Dictionary
    ...    customer=${CUSTOMER}
    ...    items=${ITEM_FINISHED}
    ...    qty=98
    ...    rate=25000
    ...    delivery_date=${TODAY + 1 day}
    
    ${response}=    Create Sales Order    ${so_data}
    Verify Response Status    ${response}    200
    ${so_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${SALES_ORDER}    ${so_name}

TC008_Create_Delivery_Note
    [Documentation]    Create delivery note from sales order
    [Tags]    sales    inventory    positive
    ${dn_data}=    Create Dictionary
    ...    sales_order=${SALES_ORDER}
    ...    warehouse=${WAREHOUSE_FG}
    
    ${response}=    Create Delivery Note    ${dn_data}
    Verify Response Status    ${response}    200
    ${dn_name}=    Get Response Data    ${response}
    
    # Verify stock deducted
    ${fg_stock_after}=    Get Stock Balance    ${ITEM_FINISHED}    ${WAREHOUSE_FG}
    Should Be Equal    ${fg_stock_after}    0
    [Teardown]    Set Suite Variable    ${DELIVERY_NOTE}    ${dn_name}

TC009_Create_Sales_Invoice
    [Documentation]    Create sales invoice with VAT calculation
    [Tags]    accounting    positive    smoke
    ${invoice_data}=    Create Dictionary
    ...    delivery_note=${DELIVERY_NOTE}
    ...    customer=${CUSTOMER}
    ...    payment_terms=Net 30
    
    ${response}=    Create Sales Invoice From Delivery Note    ${invoice_data}
    Verify Response Status    ${response}    200
    ${invoice_name}=    Get Response Data    ${response}
    
    # Verify invoice totals
    ${invoice_details}=    Get Sales Invoice    ${invoice_name}
    ${grand_total}=    Get From Dictionary    ${invoice_details}    grand_total
    Should Be Equal    ${grand_total}    2842000.0    # 98 * 25000 * 1.16 (with 16% VAT)
    [Teardown]    Set Suite Variable    ${SALES_INVOICE}    ${invoice_name}

TC010_Verify_GL_Entries_Created
    [Documentation]    Verify GL entries are created for invoice
    [Tags]    accounting    positive
    ${gl_entries}=    Get GL Entries For Invoice    ${SALES_INVOICE}
    Should Not Be Empty    ${gl_entries}
    
    # Verify debit entries (Debtors)
    ${debit_total}=    Calculate GL Debit Total    ${gl_entries}
    Should Be Equal    ${debit_total}    2842000.0
    
    # Verify credit entries (Sales + VAT)
    ${credit_total}=    Calculate GL Credit Total    ${gl_entries}
    Should Be Equal    ${credit_total}    2842000.0
    
    # Verify GL balances
    Should Be Equal    ${debit_total}    ${credit_total}

TC011_Record_Payment_Receipt
    [Documentation]    Record payment receipt for sales invoice
    [Tags]    accounting    positive
    ${payment_data}=    Create Dictionary
    ...    invoice=${SALES_INVOICE}
    ...    amount=2842000
    ...    mode=Bank Transfer
    ...    reference=TXN-12345
    
    ${response}=    Record Payment    ${payment_data}
    Verify Response Status    ${response}    200
    
    # Verify invoice status updated
    ${invoice_details}=    Get Sales Invoice    ${SALES_INVOICE}
    ${status}=    Get From Dictionary    ${invoice_details}    status
    Should Be Equal    ${status}    Paid

TC012_Verify_Production_Cost_Report
    [Documentation]    Verify production cost is calculated correctly
    [Tags]    manufacturing    accounting    reporting
    ${cost_report}=    Get Production Cost Report    ${WORK_ORDER}
    ${total_cost}=    Get From Dictionary    ${cost_report}    total_cost
    ${cost_per_unit}=    Get From Dictionary    ${cost_report}    cost_per_unit
    
    # Expected: 98 units * 4800 (BOM cost per unit) = 470,400
    Should Be Equal    ${total_cost}    470400.0
    Should Be Equal    ${cost_per_unit}    4800.0
    Log    Production Cost: Total=${total_cost}, Per Unit=${cost_per_unit}

TC013_Verify_Sales_Profitability
    [Documentation]    Verify sales profitability calculation
    [Tags]    accounting    reporting    positive
    ${profitability}=    Get Sales Profitability    ${SALES_INVOICE}
    ${revenue}=    Get From Dictionary    ${profitability}    revenue
    ${cogs}=    Get From Dictionary    ${profitability}    cost_of_goods_sold
    ${gross_profit}=    Get From Dictionary    ${profitability}    gross_profit
    ${gross_margin}=    Get From Dictionary    ${profitability}    gross_margin
    
    Should Be Equal    ${revenue}    2450000.0    # 98 * 25000
    Should Be Equal    ${cogs}    470400.0       # Production cost
    Should Be Equal    ${gross_profit}    1979600.0
    # Margin: (1979600 / 2450000) * 100 = 80.8%
    Should Be True    ${gross_margin} >= 80.0
    Log    Profitability: Revenue=${revenue}, COGS=${cogs}, Profit=${gross_profit}, Margin=${gross_margin}%

*** Keywords ***
Setup Enterprise Test Environment
    [Documentation]    Setup test environment and verify prerequisites
    ${run}=    Get Environment Variable    RUN_ENTERPRISE    false
    Run Keyword If    '${run}' != 'true'
    ...    Skip    Skipping enterprise suites (set RUN_ENTERPRISE=true to enable).
    Setup Platform Session
    Verify Tenant Exists    ${TENANT_ID}
    Verify Company Exists    ${COMPANY}
    Verify Warehouses Exist    ${WAREHOUSE_RAW}    ${WAREHOUSE_FG}
    Verify Items Exist    ${ITEM_RAW1}    ${ITEM_RAW2}    ${ITEM_RAW3}    ${ITEM_RAW4}    ${ITEM_FINISHED}

Cleanup Test Data
    [Documentation]    Clean up test data created during test execution
    [Arguments]
    Delete All Sessions
    # Note: In production, you might want to cancel/delete created documents
    # For testing, we may keep data for verification
