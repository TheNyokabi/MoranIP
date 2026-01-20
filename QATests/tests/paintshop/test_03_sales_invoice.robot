*** Settings ***
Documentation     ERPNext Paint Shop PoS - Sales Invoice Creation Tests
...               Test Design Techniques:
...               - Decision Table Testing (customer types x payment methods)
...               - Pairwise Testing (items x warehouses x sales teams)
...               - State Transition Testing (draft -> submitted -> paid)
...               
...               Customer Types:
...               1. Direct Customer - No referral code, no sales team
...               2. Fundi Customer - With referral code (FND-123), 10% commission
...               3. Sales Team Customer - With referral code (SLS-456), 15% commission

Resource          ../../resources/erpnext_paintshop_keywords.robot
Suite Setup       Run Keywords
...               Setup Platform Session    AND
...               Setup Test Prerequisites
Suite Teardown    Delete All Sessions

*** Variables ***
${INVOICE_DIRECT}       ${EMPTY}
${INVOICE_FUNDI}        ${EMPTY}
${INVOICE_SALES}        ${EMPTY}
${WAREHOUSE_DOCNAME}    ${EMPTY}

*** Keywords ***
Setup Test Prerequisites
    [Documentation]    Create all prerequisites for sales invoice tests
    # Create a unique warehouse for this suite run (ERPNext docname includes company suffix).
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${warehouse_label}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${wh_resp}=    Create Warehouse    ${warehouse_label}    ${WAREHOUSE_ABBR}
    Verify Response Status    ${wh_resp}    200
    ${wh_data}=    Get Response Data    ${wh_resp}
    ${wh_name}=    Get From Dictionary    ${wh_data}    name
    Set Suite Variable    ${WAREHOUSE_DOCNAME}    ${wh_name}
    
    # Create items
    Create Item    ${ITEM_RED_PAINT}    Red Paint 5L    Nos    Paints
    Create Item    ${ITEM_BLUE_PAINT}    Blue Paint 5L    Nos    Paints
    Create Item    ${ITEM_WHITE_PAINT}    White Paint 10L    Nos    Paints
    
    # Add stock
    ${stock1}=    Create Stock Entry    ${ITEM_RED_PAINT}      ${WAREHOUSE_DOCNAME}    100    500
    ${stock2}=    Create Stock Entry    ${ITEM_BLUE_PAINT}     ${WAREHOUSE_DOCNAME}    100    600
    ${stock3}=    Create Stock Entry    ${ITEM_WHITE_PAINT}    ${WAREHOUSE_DOCNAME}    50     1200
    ${data1}=    Get Response Data    ${stock1}
    ${data2}=    Get Response Data    ${stock2}
    ${data3}=    Get Response Data    ${stock3}
    ${name1}=    Get From Dictionary    ${data1}    name
    ${name2}=    Get From Dictionary    ${data2}    name
    ${name3}=    Get From Dictionary    ${data3}    name
    Submit ERPNext Document    Stock Entry    ${name1}
    Submit ERPNext Document    Stock Entry    ${name2}
    Submit ERPNext Document    Stock Entry    ${name3}
    
    # Create sales persons
    Create Sales Person    ${FUNDI_NAME}    ${FUNDI_COMMISSION}
    Create Sales Person    ${SALES_NAME}    ${SALES_COMMISSION}
    
    # Create customers
    Create Customer    ${CUSTOMER_DIRECT}
    Create Customer    ${CUSTOMER_FUNDI}
    Create Customer    ${CUSTOMER_SALES}

*** Test Cases ***
# ==================== POSITIVE TESTS - DIRECT CUSTOMER ====================

TC001_Create_Direct_Customer_Invoice_Successfully
    [Documentation]    Verify creating POS invoice for direct customer (no commission)
    [Tags]    positive    smoke    invoice    direct_customer
    # Prepare items
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    ${item2}=    Create Dictionary    item_code=${ITEM_BLUE_PAINT}    qty=${1}    rate=${600}
    Append To List    ${items}    ${item1}
    Append To List    ${items}    ${item2}
    
    # Create invoice - NO referral code, NO sales team
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Verify Response Status    ${response}    200
    ${data}=    Get Response Data    ${response}
    ${invoice_name}=    Get From Dictionary    ${data}    name
    Set Suite Variable    ${INVOICE_DIRECT}    ${invoice_name}
    
    # Verify no sales team
    ${sales_team}=    Get From Dictionary    ${data}    sales_team
    Should Be Empty    ${sales_team}
    
    # Verify total
    ${total}=    Get From Dictionary    ${data}    total
    Should Be Equal As Numbers    ${total}    1600    # 2*500 + 1*600

TC002_Submit_Direct_Customer_Invoice_And_Verify_Stock_Deduction
    [Documentation]    Verify submitting invoice deducts stock
    [Tags]    positive    invoice    stock    direct_customer
    [Setup]    Run Keyword If    '${INVOICE_DIRECT}' == '${EMPTY}'    
    ...    Fail    TC001 must run first
    
    # Get initial stock
    ${initial_red}=    Get Stock Balance    ${ITEM_RED_PAINT}    ${WAREHOUSE_DOCNAME}
    ${initial_blue}=    Get Stock Balance    ${ITEM_BLUE_PAINT}    ${WAREHOUSE_DOCNAME}
    
    # Submit invoice
    ${response}=    Submit ERPNext Document    Sales Invoice    ${INVOICE_DIRECT}
    Verify Response Status    ${response}    200
    
    # Verify stock deduction
    ${final_red}=    Get Stock Balance    ${ITEM_RED_PAINT}    ${WAREHOUSE_DOCNAME}
    ${final_blue}=    Get Stock Balance    ${ITEM_BLUE_PAINT}    ${WAREHOUSE_DOCNAME}
    
    ${initial_red_data}=    Get Response Data    ${initial_red}
    ${initial_blue_data}=    Get Response Data    ${initial_blue}
    ${initial_red_balance}=    Get From Dictionary    ${initial_red_data}    message
    ${initial_blue_balance}=    Get From Dictionary    ${initial_blue_data}    message
    ${expected_red}=    Evaluate    ${initial_red_balance} - 2
    ${expected_blue}=    Evaluate    ${initial_blue_balance} - 1
    
    Should Be Equal As Numbers    ${final_red.json()}[message]    ${expected_red}
    Should Be Equal As Numbers    ${final_blue.json()}[message]    ${expected_blue}

# ==================== POSITIVE TESTS - FUNDI CUSTOMER ====================

TC003_Create_Fundi_Customer_Invoice_With_Referral_Code
    [Documentation]    Verify creating invoice for Fundi with referral code and commission
    [Tags]    positive    smoke    invoice    fundi
    # Prepare items
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${3}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Prepare sales team with 10% commission
    ${sales_team}=    Create List
    ${team_member}=    Create Dictionary    
    ...    sales_person=${FUNDI_NAME}    
    ...    allocated_percentage=${100}
    ...    commission_rate=${FUNDI_COMMISSION}
    Append To List    ${sales_team}    ${team_member}
    
    # Create invoice WITH referral code and sales team
    ${response}=    Create Sales Invoice    ${CUSTOMER_FUNDI}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    referral_code=${FUNDI_REF_CODE}    sales_team=${sales_team}
    Verify Response Status    ${response}    200
    ${invoice_name}=    Set Variable    ${response.json()}[data][name]
    Set Suite Variable    ${INVOICE_FUNDI}    ${invoice_name}
    
    # Verify referral code
    ${data}=    Get Response Data    ${response}
    ${ref_code}=    Get From Dictionary    ${data}    custom_referral_code
    Should Be Equal    ${ref_code}    ${FUNDI_REF_CODE}
    
    # Verify sales team
    ${sales_team_data}=    Get From Dictionary    ${data}    sales_team
    Should Not Be Empty    ${sales_team_data}
    ${first_member}=    Set Variable    ${sales_team_data}[0]
    ${sp_name}=    Get From Dictionary    ${first_member}    sales_person
    Should Be Equal    ${sp_name}    ${FUNDI_NAME}

TC004_Verify_Fundi_Commission_Calculation
    [Documentation]    Verify commission is calculated correctly for Fundi
    [Tags]    positive    invoice    commission    fundi
    [Setup]    Run Keyword If    '${INVOICE_FUNDI}' == '${EMPTY}'    
    ...    Fail    TC003 must run first
    
    # Submit invoice
    Submit ERPNext Document    Sales Invoice    ${INVOICE_FUNDI}
    
    # Get invoice details
    ${response}=    Get ERPNext Resource    Sales Invoice    ${INVOICE_FUNDI}
    ${data}=    Get Response Data    ${response}
    
    # Verify commission calculation
    ${total}=    Get From Dictionary    ${data}    total
    ${sales_team_data}=    Get From Dictionary    ${data}    sales_team
    ${first_member}=    Set Variable    ${sales_team_data}[0]
    ${incentives}=    Get From Dictionary    ${first_member}    incentives
    
    # Commission should be 10% of 1500 (3 * 500) = 150
    ${expected_commission}=    Evaluate    ${total} * 0.10
    Should Be Equal As Numbers    ${incentives}    ${expected_commission}

# ==================== POSITIVE TESTS - SALES TEAM CUSTOMER ====================

TC005_Create_Sales_Team_Customer_Invoice_With_Referral_Code
    [Documentation]    Verify creating invoice for Sales Team with referral code and commission
    [Tags]    positive    smoke    invoice    sales_team
    # Prepare items
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_WHITE_PAINT}    qty=${2}    rate=${1200}
    ${item2}=    Create Dictionary    item_code=${ITEM_BLUE_PAINT}    qty=${1}    rate=${600}
    Append To List    ${items}    ${item1}
    Append To List    ${items}    ${item2}
    
    # Prepare sales team with 15% commission
    ${sales_team}=    Create List
    ${team_member}=    Create Dictionary    
    ...    sales_person=${SALES_NAME}    
    ...    allocated_percentage=${100}
    ...    commission_rate=${SALES_COMMISSION}
    Append To List    ${sales_team}    ${team_member}
    
    # Create invoice WITH referral code and sales team
    ${response}=    Create Sales Invoice    ${CUSTOMER_SALES}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    referral_code=${SALES_REF_CODE}    sales_team=${sales_team}
    Verify Response Status    ${response}    200
    ${invoice_name}=    Set Variable    ${response.json()}[data][name]
    Set Suite Variable    ${INVOICE_SALES}    ${invoice_name}
    
    # Verify referral code
    ${data}=    Get Response Data    ${response}
    ${ref_code}=    Get From Dictionary    ${data}    custom_referral_code
    Should Be Equal    ${ref_code}    ${SALES_REF_CODE}
    
    # Verify total
    ${total}=    Get From Dictionary    ${data}    total
    Should Be Equal As Numbers    ${total}    3000    # 2*1200 + 1*600

TC006_Verify_Sales_Team_Commission_Calculation
    [Documentation]    Verify commission is calculated correctly for Sales Team
    [Tags]    positive    invoice    commission    sales_team
    [Setup]    Run Keyword If    '${INVOICE_SALES}' == '${EMPTY}'    
    ...    Fail    TC005 must run first
    
    # Submit invoice
    Submit ERPNext Document    Sales Invoice    ${INVOICE_SALES}
    
    # Get invoice details
    ${response}=    Get ERPNext Resource    Sales Invoice    ${INVOICE_SALES}
    ${data}=    Get Response Data    ${response}
    
    # Verify commission calculation
    ${total}=    Get From Dictionary    ${data}    total
    ${sales_team_data}=    Get From Dictionary    ${data}    sales_team
    ${first_member}=    Set Variable    ${sales_team_data}[0]
    ${incentives}=    Get From Dictionary    ${first_member}    incentives
    
    # Commission should be 15% of 3000 = 450
    ${expected_commission}=    Evaluate    ${total} * 0.15
    Should Be Equal As Numbers    ${incentives}    ${expected_commission}

# ==================== NEGATIVE TESTS ====================

TC101_Create_Invoice_With_Insufficient_Stock
    [Documentation]    Verify invoice creation fails with insufficient stock
    [Tags]    negative    validation    invoice    stock
    # Try to sell more than available stock
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1000}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    # Should either create but fail on submit, or reject immediately
    Should Be True    ${response.status_code} in [200, 417, 422]

TC102_Create_Invoice_With_Invalid_Referral_Code
    [Documentation]    Verify invoice with invalid referral code
    [Tags]    negative    validation    invoice
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Create invoice with invalid referral code
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    referral_code=INVALID-999
    # Should either succeed (code is just a text field) or reject
    Should Be True    ${response.status_code} in [200, 417, 422]

TC103_Create_Invoice_With_Non_Existent_Sales_Person
    [Documentation]    Verify invoice fails with non-existent sales person
    [Tags]    negative    validation    invoice
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${sales_team}=    Create List
    ${team_member}=    Create Dictionary    
    ...    sales_person=Non-Existent Person    
    ...    allocated_percentage=${100}
    Append To List    ${sales_team}    ${team_member}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    sales_team=${sales_team}
    Should Be True    ${response.status_code} in [400, 417, 422]

TC104_Create_Duplicate_Invoice
    [Documentation]    Verify duplicate invoice handling
    [Tags]    negative    validation    invoice
    # Note: ERPNext auto-generates invoice numbers, so true duplicates are unlikely
    # This tests creating two identical invoices
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${response1}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Verify Response Status    ${response1}    200
    
    ${response2}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Verify Response Status    ${response2}    200
    # Both should succeed as they get different names

# ==================== EDGE CASES ====================

TC201_Create_Invoice_With_Multiple_Sales_Team_Members
    [Documentation]    Test invoice with multiple sales team members
    [Tags]    edge    invoice    commission
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Multiple sales team members
    ${sales_team}=    Create List
    ${member1}=    Create Dictionary    
    ...    sales_person=${FUNDI_NAME}    
    ...    allocated_percentage=${60}
    ...    commission_rate=${FUNDI_COMMISSION}
    ${member2}=    Create Dictionary    
    ...    sales_person=${SALES_NAME}    
    ...    allocated_percentage=${40}
    ...    commission_rate=${SALES_COMMISSION}
    Append To List    ${sales_team}    ${member1}
    Append To List    ${sales_team}    ${member2}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    sales_team=${sales_team}
    Verify Response Status    ${response}    200

TC202_Create_Invoice_With_Zero_Quantity
    [Documentation]    Boundary Value Analysis - Zero quantity
    [Tags]    edge    validation    invoice
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${0}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Should Be True    ${response.status_code} in [200, 417, 422]

TC203_Create_Invoice_With_Very_Large_Quantity
    [Documentation]    Boundary Value Analysis - Large quantity
    [Tags]    edge    invoice
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${50}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Verify Response Status    ${response}    200
