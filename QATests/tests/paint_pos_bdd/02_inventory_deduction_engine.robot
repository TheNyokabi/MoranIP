*** Settings ***
Documentation     Paint Shop + PoS (Engine) - Inventory Deduction (BDD)
...               Scope: stock deductions, no negative inventory, idempotency on submit.
Resource          ../../resources/paint_pos_bdd/paint_pos_suite.resource
Suite Setup       Run Keywords    Suite Setup - Paint POS BDD    AND    Ensure Paint POS Prerequisites    AND    Ensure Paint POS Stock Available
Test Setup        Start Trace Context

*** Test Cases ***
Scenario: Base paint stock reduction after PoS sale
    [Tags]    smoke    bdd    inventory    positive
    ${test_case_id}=    Set Variable    PAINT-BDD-INV-001

    ${before}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}

    ${items}=    Build Invoice Items    ${BASE_PAINT_ITEM}    2    100
    ${invoice}=    Create And Submit Sales Invoice    ${CUSTOMER}    ${WAREHOUSE}    ${items}

    ${after}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}
    Should Be True    ${after} <= ${before} - 2

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Pigment stock reduction after PoS sale
    [Tags]    bdd    inventory    positive
    ${test_case_id}=    Set Variable    PAINT-BDD-INV-002

    ${before_blue}=    Get Stock Balance Via Engine    ${PIGMENT_BLUE}    ${WAREHOUSE}

    ${items}=    Build Invoice Items    ${PIGMENT_BLUE}    5    10
    ${invoice}=    Create And Submit Sales Invoice    ${CUSTOMER}    ${WAREHOUSE}    ${items}

    ${after_blue}=    Get Stock Balance Via Engine    ${PIGMENT_BLUE}    ${WAREHOUSE}
    Should Be True    ${after_blue} <= ${before_blue} - 5

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Insufficient inventory handling prevents negative stock
    [Tags]    bdd    inventory    negative
    ${test_case_id}=    Set Variable    PAINT-BDD-INV-003

    ${before}=    Get Stock Balance Via Engine    ${PIGMENT_RED}    ${WAREHOUSE}

    # Attempt an unreasonably large sale; creation may succeed but submit should fail.
    ${items}=    Build Invoice Items    ${PIGMENT_RED}    999999    12
    ${resp}=    Create Sales Invoice    ${CUSTOMER}    ${items}    ${WAREHOUSE}
    # Accept either immediate failure or draft creation.
    Should Be True    ${resp.status_code} in [200, 417, 422]

    # If invoice created, try submit and accept failure.
    IF    ${resp.status_code} == 200
        ${data}=    Get Response Data    ${resp}
        ${name}=    Get From Dictionary    ${data}    name
        ${submit}=    Submit ERPNext Document    Sales Invoice    ${name}
        Should Be True    ${submit.status_code} in [200, 417, 422]
    END

    ${after}=    Get Stock Balance Via Engine    ${PIGMENT_RED}    ${WAREHOUSE}
    Should Be True    ${after} >= 0
    # On failure, stock should not decrease to negative.
    Should Be True    ${after} <= ${before}

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Idempotent submit does not double-deduct stock
    [Tags]    bdd    inventory    idempotency
    ${test_case_id}=    Set Variable    PAINT-BDD-INV-004

    ${before}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}
    ${items}=    Build Invoice Items    ${BASE_PAINT_ITEM}    1    100
    ${resp}=    Create Sales Invoice    ${CUSTOMER}    ${items}    ${WAREHOUSE}
    Verify Response Status    ${resp}    200
    ${data}=    Get Response Data    ${resp}
    ${invoice}=    Get From Dictionary    ${data}    name

    ${submit1}=    Submit ERPNext Document    Sales Invoice    ${invoice}
    Should Be True    ${submit1.status_code} in [200, 417, 422]
    ${mid}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}

    # Second submit attempt: should not change stock further.
    ${submit2}=    Submit ERPNext Document    Sales Invoice    ${invoice}
    Should Be True    ${submit2.status_code} in [200, 417, 422]
    ${after}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}

    Should Be Equal As Numbers    ${after}    ${mid}
    Should Be True    ${after} <= ${before} - 1

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS
