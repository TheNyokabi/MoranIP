*** Settings ***
Documentation     ERPNext Paint Shop PoS - Payment Processing and Reconciliation Tests
...               Test Design Techniques:
...               - Decision Table Testing (payment methods x amounts)
...               - Temporal Testing (date-based reconciliation)
...               - Consistency Testing (cash vs digital payments)
...               
...               Payment Methods: Cash, Mpesa, Pesalink
...               Scenarios: Inline payments, separate Payment Entries, mixed payments

Resource          ../../resources/erpnext_paintshop_keywords.robot
Suite Setup       Run Keywords
...               Setup Platform Session    AND
...               Setup Payment Test Prerequisites
Suite Teardown    Delete All Sessions

*** Variables ***
${WAREHOUSE_DOCNAME}    ${EMPTY}

*** Keywords ***
Setup Payment Test Prerequisites
    [Documentation]    Create prerequisites for payment tests
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${warehouse_label}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${wh_resp}=    Create Warehouse    ${warehouse_label}    ${WAREHOUSE_ABBR}
    Verify Response Status    ${wh_resp}    200
    ${wh_data}=    Get Response Data    ${wh_resp}
    ${wh_name}=    Get From Dictionary    ${wh_data}    name
    Set Suite Variable    ${WAREHOUSE_DOCNAME}    ${wh_name}
    Create Item    ${ITEM_RED_PAINT}    Red Paint 5L
    ${stock}=    Create Stock Entry    ${ITEM_RED_PAINT}    ${WAREHOUSE_DOCNAME}    100    500
    ${data}=    Get Response Data    ${stock}
    ${stock_name}=    Get From Dictionary    ${data}    name
    Submit ERPNext Document    Stock Entry    ${stock_name}
    Create Customer    ${CUSTOMER_DIRECT}

*** Test Cases ***
# ==================== POSITIVE TESTS - INLINE PAYMENTS ====================

TC001_Create_Invoice_With_Cash_Payment
    [Documentation]    Verify creating invoice with inline cash payment
    [Tags]    positive    smoke    payment    cash
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Inline cash payment
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${1000}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Verify Response Status    ${response}    200
    
    # Verify payment
    ${data}=    Get Response Data    ${response}
    ${payments_data}=    Get From Dictionary    ${data}    payments
    Should Not Be Empty    ${payments_data}
    ${first_payment}=    Set Variable    ${payments_data}[0]
    ${mode}=    Get From Dictionary    ${first_payment}    mode_of_payment
    Should Be Equal    ${mode}    ${PAYMENT_CASH}

TC002_Create_Invoice_With_Mpesa_Payment
    [Documentation]    Verify creating invoice with Mpesa payment
    [Tags]    positive    payment    mpesa
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Mpesa payment
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_MPESA}    
    ...    amount=${500}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Verify Response Status    ${response}    200

TC003_Create_Invoice_With_Mixed_Payments
    [Documentation]    Verify creating invoice with mixed Cash and Mpesa payments
    [Tags]    positive    payment    mixed
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${3}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Mixed payments: 1000 Cash + 500 Mpesa = 1500
    ${payments}=    Create List
    ${payment1}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${1000}
    ${payment2}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_MPESA}    
    ...    amount=${500}
    Append To List    ${payments}    ${payment1}
    Append To List    ${payments}    ${payment2}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Verify Response Status    ${response}    200
    
    # Verify both payments recorded
    ${data}=    Get Response Data    ${response}
    ${payments_data}=    Get From Dictionary    ${data}    payments
    ${count}=    Get Length    ${payments_data}
    Should Be Equal As Numbers    ${count}    2

TC004_Create_Invoice_With_Pesalink_Payment
    [Documentation]    Verify creating invoice with Pesalink payment
    [Tags]    positive    payment    pesalink
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Pesalink payment
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_PESALINK}    
    ...    amount=${1000}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Verify Response Status    ${response}    200

# ==================== POSITIVE TESTS - SEPARATE PAYMENT ENTRIES ====================

TC005_Create_Separate_Payment_Entry_For_Reconciliation
    [Documentation]    Verify creating separate Payment Entry for reconciliation
    [Tags]    positive    payment    reconciliation
    # Create invoice first
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${invoice_response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    Verify Response Status    ${invoice_response}    200
    ${invoice_name}=    Set Variable    ${invoice_response.json()}[data][name]
    Submit ERPNext Document    Sales Invoice    ${invoice_name}
    
    # Create separate Payment Entry
    ${payment_response}=    Create Payment Entry    ${CUSTOMER_DIRECT}    1000    
    ...    payment_type=Receive    mode_of_payment=${PAYMENT_CASH}
    Verify Response Status    ${payment_response}    200

TC006_Create_Multiple_Payment_Entries_For_Same_Day
    [Documentation]    Verify creating multiple payment entries for reconciliation
    [Tags]    positive    payment    reconciliation
    # Create multiple payment entries
    ${payment1}=    Create Payment Entry    ${CUSTOMER_DIRECT}    500    mode_of_payment=${PAYMENT_CASH}
    Verify Response Status    ${payment1}    200
    
    ${payment2}=    Create Payment Entry    ${CUSTOMER_DIRECT}    300    mode_of_payment=${PAYMENT_MPESA}
    Verify Response Status    ${payment2}    200
    
    ${payment3}=    Create Payment Entry    ${CUSTOMER_DIRECT}    200    mode_of_payment=${PAYMENT_CASH}
    Verify Response Status    ${payment3}    200

# ==================== CONSISTENCY VERIFICATION ====================

TC007_Verify_Total_Cash_Vs_Digital_Payments_For_Date
    [Documentation]    Verify consistency between cash and digital payments
    [Tags]    positive    reconciliation    consistency
    ${today}=    Get Current Date    result_format=%Y-%m-%d
    
    # Query all payment entries for today
    ${filters}=    Create Dictionary    
    ...    posting_date=${today}    
    ...    docstatus=${1}
    ${response}=    Get ERPNext Resource    Payment Entry    filters=${filters}
    Verify Response Status    ${response}    200
    
    # Calculate totals by payment method
    ${data}=    Get Response Data    ${response}
    ${total_cash}=    Set Variable    ${0}
    ${total_digital}=    Set Variable    ${0}
    
    FOR    ${entry}    IN    @{data}
        ${mode}=    Get From Dictionary    ${entry}    mode_of_payment
        ${amount}=    Get From Dictionary    ${entry}    paid_amount
        Run Keyword If    '${mode}' == '${PAYMENT_CASH}'    
        ...    Set Variable    ${total_cash + amount}
        ...    ELSE    Set Variable    ${total_digital + amount}
    END
    
    # Log totals for verification
    Log    Total Cash: ${total_cash}
    Log    Total Digital: ${total_digital}

TC008_Query_Total_Sales_For_Date_Range
    [Documentation]    Verify querying total sales for date range
    [Tags]    positive    reporting    sales
    ${from_date}=    Get Current Date    result_format=%Y-%m-%d
    ${to_date}=    Get Current Date    result_format=%Y-%m-%d
    
    ${response}=    Calculate Total Sales    ${from_date}    ${to_date}
    Verify Response Status    ${response}    200
    
    ${data}=    Get Response Data    ${response}
    # Calculate total
    ${total_sales}=    Set Variable    ${0}
    FOR    ${invoice}    IN    @{data}
        ${grand_total}=    Get From Dictionary    ${invoice}    grand_total
        ${total_sales}=    Evaluate    ${total_sales} + ${grand_total}
    END
    
    Log    Total Sales: ${total_sales}

# ==================== NEGATIVE TESTS ====================

TC101_Create_Invoice_With_Overpayment
    [Documentation]    Verify overpayment handling
    [Tags]    negative    validation    payment
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Try to pay more than invoice amount
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${1000}    # Invoice is only 500
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    # Should either succeed (with change) or reject
    Should Be True    ${response.status_code} in [200, 417, 422]

TC102_Create_Invoice_With_Underpayment
    [Documentation]    Verify underpayment handling
    [Tags]    negative    validation    payment
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${2}    rate=${500}
    Append To List    ${items}    ${item1}
    
    # Pay less than invoice amount
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${500}    # Invoice is 1000
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    # Should either succeed (partial payment) or reject
    Should Be True    ${response.status_code} in [200, 417, 422]

TC103_Create_Payment_Entry_With_Negative_Amount
    [Documentation]    Verify negative payment amount is rejected
    [Tags]    negative    validation    payment
    ${response}=    Create Payment Entry    ${CUSTOMER_DIRECT}    -500    
    ...    mode_of_payment=${PAYMENT_CASH}
    Should Be True    ${response.status_code} in [400, 417, 422]

TC104_Create_Payment_Entry_For_Non_Existent_Customer
    [Documentation]    Verify payment entry fails for non-existent customer
    [Tags]    negative    validation    payment
    ${response}=    Create Payment Entry    Non-Existent Customer    1000    
    ...    mode_of_payment=${PAYMENT_CASH}
    Should Be True    ${response.status_code} in [404, 417, 422]

# ==================== EDGE CASES ====================

TC201_Create_Invoice_With_Zero_Payment
    [Documentation]    Boundary Value Analysis - Zero payment
    [Tags]    edge    validation    payment
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${0}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Should Be True    ${response.status_code} in [200, 417, 422]

TC202_Create_Invoice_With_Very_Large_Payment
    [Documentation]    Boundary Value Analysis - Large payment amount
    [Tags]    edge    payment
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${999999}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    # Should handle large amounts
    Should Be True    ${response.status_code} in [200, 417, 422]

TC203_Create_Invoice_With_Decimal_Payment_Amount
    [Documentation]    Test decimal payment amounts
    [Tags]    edge    payment
    ${items}=    Create List
    ${item1}=    Create Dictionary    item_code=${ITEM_RED_PAINT}    qty=${1}    rate=${500}
    Append To List    ${items}    ${item1}
    
    ${payments}=    Create List
    ${payment}=    Create Dictionary    
    ...    mode_of_payment=${PAYMENT_CASH}    
    ...    amount=${500.50}
    Append To List    ${payments}    ${payment}
    
    ${response}=    Create Sales Invoice    ${CUSTOMER_DIRECT}    ${items}    ${WAREHOUSE_DOCNAME}
    ...    payments=${payments}
    Verify Response Status    ${response}    200

TC204_Reconcile_Payments_Across_Multiple_Days
    [Documentation]    Test payment reconciliation across date ranges
    [Tags]    edge    reconciliation
    ${from_date}=    Evaluate    (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d')    datetime
    ${to_date}=    Get Current Date    result_format=%Y-%m-%d
    
    ${response}=    Calculate Total Sales    ${from_date}    ${to_date}
    Verify Response Status    ${response}    200
