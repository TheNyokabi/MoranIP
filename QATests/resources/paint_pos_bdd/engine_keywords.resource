*** Settings ***
Library    Collections
Library    String
Library    DateTime
Resource   ../erpnext_paintshop_keywords.robot

*** Keywords ***
Get Stock Balance Via Engine
    [Arguments]    ${item_code}    ${warehouse}
    [Documentation]    Return numeric stock balance for item/warehouse using ERPNext method.
    ${resp}=    Get Stock Balance    ${item_code}    ${warehouse}
    ${json}=    Set Variable    ${resp.json()}
    ${has_data}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${json}    data
    ${payload}=    Run Keyword If    ${has_data}    Get From Dictionary    ${json}    data
    ...    ELSE    Set Variable    ${json}
    ${has_message}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${payload}    message
    IF    ${has_message}
        ${balance}=    Get From Dictionary    ${payload}    message
    ELSE
        ${balance}=    Set Variable    ${payload}
    END
    [Return]    ${balance}

Create And Submit Stock Receipt
    [Arguments]    ${item_code}    ${warehouse}    ${qty}    ${rate}
    ${resp}=    Create Stock Entry    ${item_code}    ${warehouse}    ${qty}    ${rate}
    Verify Response Status    ${resp}    200
    ${data}=    Get Response Data    ${resp}
    ${name}=    Get From Dictionary    ${data}    name
    ${submit}=    Submit ERPNext Document    Stock Entry    ${name}
    Verify Response Status    ${submit}    200

Set Stock Level Via Reconciliation
    [Arguments]    ${item_code}    ${warehouse}    ${qty}    ${valuation_rate}
    [Documentation]    Seed deterministic stock using Stock Reconciliation (avoids source warehouse + negative stock issues).
    ${current}=    Get Stock Balance Via Engine    ${item_code}    ${warehouse}
    Return From Keyword If    ${current} >= ${qty}
    ${items}=    Create List
    ${row}=    Create Dictionary
    ...    item_code=${item_code}
    ...    warehouse=${warehouse}
    ...    qty=${qty}
    ...    valuation_rate=${valuation_rate}
    Append To List    ${items}    ${row}

    ${data}=    Create Dictionary
    ...    doctype=Stock Reconciliation
    ...    company=${COMPANY}
    ...    purpose=Stock Reconciliation
    ...    items=${items}
    Run Keyword If    '${POSTING_DATE}' != '${EMPTY}'    Set To Dictionary    ${data}    posting_date=${POSTING_DATE}
    Run Keyword If    '${DIFFERENCE_ACCOUNT}' != '${EMPTY}'    Set To Dictionary    ${data}    expense_account=${DIFFERENCE_ACCOUNT}
    Run Keyword If    '${COST_CENTER}' != '${EMPTY}'    Set To Dictionary    ${data}    cost_center=${COST_CENTER}

    ${resp}=    Create ERPNext Resource    Stock Reconciliation    ${data}
    Verify Response Status    ${resp}    200
    ${doc}=    Get Response Data    ${resp}
    ${name}=    Get From Dictionary    ${doc}    name
    ${submit}=    Submit ERPNext Document    Stock Reconciliation    ${name}
    Verify Response Status    ${submit}    200

    # Confirm stock actually landed where we expect it.
    ${after}=    Get Stock Balance Via Engine    ${item_code}    ${warehouse}
    Should Be True    ${after} >= ${qty}
    ...    msg=Stock reconciliation did not seed expected qty. item=${item_code} warehouse=${warehouse} expected>=${qty} actual=${after}

Create And Submit Sales Invoice
    [Arguments]    ${customer}    ${warehouse}    ${items}    ${payments}=@{EMPTY}
    ${resp}=    Create Sales Invoice    ${customer}    ${items}    ${warehouse}    payments=${payments}
    Verify Response Status    ${resp}    200
    ${data}=    Get Response Data    ${resp}
    ${invoice_name}=    Get From Dictionary    ${data}    name
    ${submit}=    Submit ERPNext Document    Sales Invoice    ${invoice_name}
    Verify Response Status    ${submit}    200
    [Return]    ${invoice_name}

Verify GL Entries Balanced For Voucher
    [Arguments]    ${voucher_no}
    [Documentation]    Verify debit == credit for all GL Entries tied to a voucher.
    ${filters}=    Evaluate    __import__('json').dumps([["GL Entry","voucher_no","=","${voucher_no}"]])    json
    ${fields}=    Evaluate    __import__('json').dumps(["debit","credit","debit_in_account_currency","credit_in_account_currency"])    json
    ${resp}=    Get ERPNext Resource    GL Entry    filters=${filters}    fields=${fields}
    Verify Response Status    ${resp}    200
    ${entries}=    Get Response Data    ${resp}
    ${total_debit}=    Set Variable    0
    ${total_credit}=    Set Variable    0
    FOR    ${e}    IN    @{entries}
        ${has_debit}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${e}    debit
        ${has_credit}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${e}    credit
        IF    ${has_debit}
            ${debit}=    Get From Dictionary    ${e}    debit
        ELSE
            ${debit}=    Get From Dictionary    ${e}    debit_in_account_currency
        END
        IF    ${has_credit}
            ${credit}=    Get From Dictionary    ${e}    credit
        ELSE
            ${credit}=    Get From Dictionary    ${e}    credit_in_account_currency
        END
        ${total_debit}=    Evaluate    ${total_debit} + float(${debit})
        ${total_credit}=    Evaluate    ${total_credit} + float(${credit})
    END
    ${balanced}=    Evaluate    abs(${total_debit} - ${total_credit}) < 0.01
    [Return]    ${balanced}

Verify Sales Invoice Exists
    [Arguments]    ${invoice_name}
    ${resp}=    Get ERPNext Resource    Sales Invoice    ${invoice_name}
    ${ok}=    Evaluate    ${resp.status_code} == 200
    [Return]    ${ok}
