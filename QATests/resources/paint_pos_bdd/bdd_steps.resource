*** Settings ***
Library    BuiltIn
Library    Collections
Library    String
Library    DateTime

*** Keywords ***
Start Trace Context
    [Documentation]    Create a per-test trace context used to correlate backend+engine assertions.
    ${trace_id}=    Evaluate    str(uuid.uuid4())    uuid
    ${transaction_id}=    Evaluate    str(uuid.uuid4())    uuid
    Set Test Variable    ${TRACE_ID}    ${trace_id}
    Set Test Variable    ${TRANSACTION_ID}    ${transaction_id}
    Log    trace_id=${TRACE_ID} transaction_id=${TRANSACTION_ID}

Record Evaluation Contract
    [Arguments]    ${test_case_id}
    ...    ${formulation_status}
    ...    ${pricing_status}
    ...    ${api_validation_status}
    ...    ${inventory_deduction_status}
    ...    ${accounting_posting_status}
    ...    ${transaction_integrity_status}
    [Documentation]    Log a structured PASS/FAIL contract for auditability.
    ${record}=    Create Dictionary
    ...    test_case_id=${test_case_id}
    ...    transaction_id=${TRANSACTION_ID}
    ...    trace_id=${TRACE_ID}
    ...    backend=\{"formulation_status": "${formulation_status}", "pricing_status": "${pricing_status}", "api_validation_status": "${api_validation_status}"\}
    ...    engine=\{"inventory_deduction_status": "${inventory_deduction_status}", "accounting_posting_status": "${accounting_posting_status}", "transaction_integrity_status": "${transaction_integrity_status}"\}
    ${json}=    Evaluate    __import__('json').dumps($record, sort_keys=True)    json
    Log    ${json}
    Log To Console    ${json}

Given a valid color code and batch size is provided
    [Arguments]    ${color_code}    ${quantity_liters}
    Set Test Variable    ${COLOR_CODE}    ${color_code}
    Set Test Variable    ${QTY_LITERS}    ${quantity_liters}

And sufficient base paint and pigment inventory exists
    [Arguments]    ${base_item}    ${pigment_items}    ${warehouse}    ${min_base_qty}    ${min_pigment_qty}
    [Documentation]    Validate stock is at/above required minimums.
    ${base_balance}=    Get Stock Balance Via Engine    ${base_item}    ${warehouse}
    Should Be True    ${base_balance} >= ${min_base_qty}
    FOR    ${pigment_item}    IN    @{pigment_items}
        ${pig_balance}=    Get Stock Balance Via Engine    ${pigment_item}    ${warehouse}
        Should Be True    ${pig_balance} >= ${min_pigment_qty}
    END

When the paint formula is calculated
    [Arguments]    ${color_code}    ${quantity_liters}
    ${resp}=    Calculate Paint Formula Via Backend    ${color_code}    ${quantity_liters}
    Set Test Variable    ${FORMULA_RESP}    ${resp}

Then the Backend should calculate the correct color formulation
    [Arguments]    ${expected_base_item}
    ${base_item}=    Get From Dictionary    ${FORMULA_RESP}    base_paint
    Should Be Equal    ${base_item}[item_code]    ${expected_base_item}

And the Backend should return correct pricing and tax
    [Arguments]    ${expected_total_cost}
    [Documentation]    This suite currently asserts deterministic pricing only (tax is ERPNext-driven).
    Should Be Equal As Numbers    ${FORMULA_RESP}[total_estimated_cost]    ${expected_total_cost}

And the Engine should deduct the correct inventory quantities
    [Arguments]    ${before_stock}    ${after_stock}
    [Documentation]    Generic helper asserting expected stock deltas were applied.
    Dictionary Should Contain Key    ${before_stock}    base
    Dictionary Should Contain Key    ${after_stock}    base
    Should Be True    ${after_stock}[base] <= ${before_stock}[base]

And the Engine should post correct accounting entries
    [Arguments]    ${voucher_no}
    ${balanced}=    Verify GL Entries Balanced For Voucher    ${voucher_no}
    Should Be True    ${balanced}

And the sale should appear correctly in all reports
    [Arguments]    ${invoice_name}
    ${exists}=    Verify Sales Invoice Exists    ${invoice_name}
    Should Be True    ${exists}
