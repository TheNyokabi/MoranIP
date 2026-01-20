*** Settings ***
Documentation     Enterprise Case Study - CRM Lead to Cash Workflow
...               Complete sales cycle from lead capture to payment receipt
Resource          ../../resources/enterprise_keywords.robot
Suite Setup       Setup Enterprise Test Environment
Suite Teardown    Cleanup Test Data

*** Variables ***
${LEAD_COMPANY}        Corporation X
${LEAD_CONTACT}        Mr. James Mwangi
${LEAD_EMAIL}          james@corpx.co.ke
${LEAD_VALUE}          15000000
${CUSTOMER_NAME}       Corporation X
${OPPORTUNITY_NAME}    Corporation X - Enterprise Solution

*** Test Cases ***

TC001_Capture_Lead
    [Documentation]    Capture lead from trade show
    [Tags]    crm    positive    smoke
    ${lead_data}=    Create Dictionary
    ...    company_name=${LEAD_COMPANY}
    ...    contact_person=${LEAD_CONTACT}
    ...    email=${LEAD_EMAIL}
    ...    phone=+254 712 000 000
    ...    source=Trade Show
    ...    industry=Telecommunications
    ...    requirement=Enterprise Solution - 500 units
    
    ${response}=    Create Lead    ${lead_data}
    Verify Response Status    ${response}    200
    ${lead_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${LEAD_NAME}    ${lead_name}

TC002_Qualify_Lead
    [Documentation]    Qualify lead using BANT criteria
    [Tags]    crm    positive
    ${qualification_data}=    Create Dictionary
    ...    lead=${LEAD_NAME}
    ...    budget=Confirmed
    ...    authority=Decision Maker
    ...    need=High
    ...    timeline=Q1 next year
    ...    qualification_score=90
    
    ${response}=    Qualify Lead    ${qualification_data}
    Verify Response Status    ${response}    200
    
    # Verify lead status updated
    ${lead_details}=    Get Lead    ${LEAD_NAME}
    ${status}=    Get From Dictionary    ${lead_details}    status
    Should Be Equal    ${status}    Qualified

TC003_Convert_Lead_To_Opportunity
    [Documentation]    Convert qualified lead to opportunity
    [Tags]    crm    positive    smoke
    ${opp_data}=    Create Dictionary
    ...    lead=${LEAD_NAME}
    ...    opportunity_name=${OPPORTUNITY_NAME}
    ...    value=${LEAD_VALUE}
    ...    stage=Needs Analysis
    ...    probability=60
    ...    expected_close_date=2024-04-01
    ...    sales_person=Jane Smith
    
    ${response}=    Convert Lead To Opportunity    ${opp_data}
    Verify Response Status    ${response}    200
    ${opp_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${OPPORTUNITY_NAME}    ${opp_name}

TC004_Develop_Opportunity
    [Documentation]    Track opportunity development activities
    [Tags]    crm    positive
    # Add activities
    ${activity1}=    Create Dictionary
    ...    opportunity=${OPPORTUNITY_NAME}
    ...    type=Meeting
    ...    subject=Requirements Gathering
    ...    date=2024-01-10
    ${response1}=    Add Opportunity Activity    ${activity1}
    Verify Response Status    ${response1}    200
    
    ${activity2}=    Create Dictionary
    ...    opportunity=${OPPORTUNITY_NAME}
    ...    type=Call
    ...    subject=Product Presentation
    ...    date=2024-01-15
    ${response2}=    Add Opportunity Activity    ${activity2}
    Verify Response Status    ${response2}    200
    
    # Update stage and probability
    ${update_data}=    Create Dictionary
    ...    stage=Proposal
    ...    probability=75
    ${response3}=    Update Opportunity    ${OPPORTUNITY_NAME}    ${update_data}
    Verify Response Status    ${response3}    200

TC005_Create_Quotation
    [Documentation]    Create quotation from opportunity
    [Tags]    crm    sales    positive    smoke
    ${quotation_data}=    Create Dictionary
    ...    opportunity=${OPPORTUNITY_NAME}
    ...    customer=${CUSTOMER_NAME}
    ...    valid_until=2024-02-15
    ...    items=${ITEM_FINISHED}
    ...    qty=500
    ...    rate=25000
    ...    payment_terms=Net 30
    ...    advance_percent=10
    
    ${response}=    Create Quotation From Opportunity    ${quotation_data}
    Verify Response Status    ${response}    200
    ${quotation_name}=    Get Response Data    ${response}
    
    # Verify quotation totals
    ${quotation_details}=    Get Quotation    ${quotation_name}
    ${grand_total}=    Get From Dictionary    ${quotation_details}    grand_total
    Should Be Equal    ${grand_total}    17400000.0    # 500 * 25000 * 1.16 (with VAT) + support
    [Teardown]    Set Suite Variable    ${QUOTATION_NAME}    ${quotation_name}

TC006_Customer_Accepts_Create_Sales_Order
    [Documentation]    Customer accepts quotation, create sales order
    [Tags]    crm    sales    positive
    ${response}=    Create Sales Order From Quotation    ${QUOTATION_NAME}
    Verify Response Status    ${response}    200
    ${so_name}=    Get Response Data    ${response}
    
    # Verify opportunity status updated to Won
    ${opp_details}=    Get Opportunity    ${OPPORTUNITY_NAME}
    ${status}=    Get From Dictionary    ${opp_details}    status
    Should Be Equal    ${status}    Won
    [Teardown]    Set Suite Variable    ${SALES_ORDER}    ${so_name}

TC007_Create_Delivery_Note
    [Documentation]    Create delivery note and update inventory
    [Tags]    sales    inventory    positive
    ${dn_data}=    Create Dictionary
    ...    sales_order=${SALES_ORDER}
    ...    warehouse=${WAREHOUSE_FG}
    
    ${response}=    Create Delivery Note    ${dn_data}
    Verify Response Status    ${response}    200
    ${dn_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${DELIVERY_NOTE}    ${dn_name}

TC008_Create_Sales_Invoice
    [Documentation]    Create sales invoice from delivery note
    [Tags]    accounting    positive    smoke
    ${invoice_data}=    Create Dictionary
    ...    delivery_note=${DELIVERY_NOTE}
    ...    customer=${CUSTOMER_NAME}
    ...    payment_terms=Net 30
    
    ${response}=    Create Sales Invoice From Delivery Note    ${invoice_data}
    Verify Response Status    ${response}    200
    ${invoice_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${SALES_INVOICE}    ${invoice_name}

TC009_Receive_Advance_Payment
    [Documentation]    Record 10% advance payment
    [Tags]    accounting    positive
    ${advance_amount}=    Evaluate    17400000 * 0.1
    ${payment_data}=    Create Dictionary
    ...    invoice=${SALES_INVOICE}
    ...    amount=${advance_amount}
    ...    mode=Bank Transfer
    ...    reference=ADV-001
    ...    is_advance=Yes
    
    ${response}=    Record Payment    ${payment_data}
    Verify Response Status    ${response}    200
    
    # Verify outstanding updated
    ${invoice_details}=    Get Sales Invoice    ${SALES_INVOICE}
    ${outstanding}=    Get From Dictionary    ${invoice_details}    outstanding_amount
    ${expected_outstanding}=    Evaluate    17400000 - ${advance_amount}
    Should Be Equal    ${outstanding}    ${expected_outstanding}

TC010_Receive_Final_Payment
    [Documentation]    Receive final payment after 30 days
    [Tags]    accounting    positive
    ${final_amount}=    Evaluate    17400000 * 0.9
    ${payment_data}=    Create Dictionary
    ...    invoice=${SALES_INVOICE}
    ...    amount=${final_amount}
    ...    mode=Bank Transfer
    ...    reference=FINAL-001
    
    ${response}=    Record Payment    ${payment_data}
    Verify Response Status    ${response}    200
    
    # Verify invoice fully paid
    ${invoice_details}=    Get Sales Invoice    ${SALES_INVOICE}
    ${outstanding}=    Get From Dictionary    ${invoice_details}    outstanding_amount
    Should Be Equal    ${outstanding}    0.0
    ${status}=    Get From Dictionary    ${invoice_details}    status
    Should Be Equal    ${status}    Paid

TC011_Create_Support_Ticket
    [Documentation]    Create post-sales support ticket
    [Tags]    crm    positive
    ${ticket_data}=    Create Dictionary
    ...    customer=${CUSTOMER_NAME}
    ...    subject=Installation Scheduling
    ...    priority=Medium
    ...    issue_type=Support
    
    ${response}=    Create Support Ticket    ${ticket_data}
    Verify Response Status    ${response}    200
    ${ticket_name}=    Get Response Data    ${response}
    
    # Verify ticket linked to customer and opportunity
    ${ticket_details}=    Get Support Ticket    ${ticket_name}
    ${customer}=    Get From Dictionary    ${ticket_details}    customer
    Should Be Equal    ${customer}    ${CUSTOMER_NAME}

*** Keywords ***
Create Lead
    [Arguments]    ${lead_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/leads
    ...    headers=${HEADERS}    json=${lead_data}
    [Return]    ${response}

Qualify Lead
    [Arguments]    ${qualification_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/leads/${qualification_data}[lead]/qualify
    ...    headers=${HEADERS}    json=${qualification_data}
    [Return]    ${response}

Get Lead
    [Arguments]    ${lead_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/leads/${lead_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Convert Lead To Opportunity
    [Arguments]    ${opp_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/leads/${opp_data}[lead]/convert-to-opportunity
    ...    headers=${HEADERS}    json=${opp_data}
    [Return]    ${response}

Add Opportunity Activity
    [Arguments]    ${activity_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/opportunities/${activity_data}[opportunity]/activities
    ...    headers=${HEADERS}    json=${activity_data}
    [Return]    ${response}

Update Opportunity
    [Arguments]    ${opp_name}    ${update_data}
    ${response}=    Put Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/opportunities/${opp_name}
    ...    headers=${HEADERS}    json=${update_data}
    [Return]    ${response}

Get Opportunity
    [Arguments]    ${opp_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/opportunities/${opp_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Create Quotation From Opportunity
    [Arguments]    ${quotation_data}
    ${items}=    Create List
    ${item}=    Create Dictionary    item_code=${quotation_data}[items]    qty=${quotation_data}[qty]    rate=${quotation_data}[rate]
    Append To List    ${items}    ${item}
    ${quote_payload}=    Create Dictionary
    ...    opportunity=${quotation_data}[opportunity]
    ...    customer=${quotation_data}[customer]
    ...    items=${items}
    ...    valid_until=${quotation_data}[valid_until]
    ...    payment_terms=${quotation_data}[payment_terms]
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/quotations
    ...    headers=${HEADERS}    json=${quote_payload}
    [Return]    ${response}

Get Quotation
    [Arguments]    ${quotation_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/quotations/${quotation_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Create Sales Order From Quotation
    [Arguments]    ${quotation_name}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/quotations/${quotation_name}/create-sales-order
    ...    headers=${HEADERS}
    [Return]    ${response}

Create Support Ticket
    [Arguments]    ${ticket_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/support-tickets
    ...    headers=${HEADERS}    json=${ticket_data}
    [Return]    ${response}

Get Support Ticket
    [Arguments]    ${ticket_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/crm/support-tickets/${ticket_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}
