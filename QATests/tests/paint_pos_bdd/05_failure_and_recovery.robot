*** Settings ***
Documentation     Paint Shop + PoS - Failure & Recovery Scenarios (BDD)
...               Scope: engine failures, rollback expectations, retry/idempotency behavior.
Resource          ../../resources/paint_pos_bdd/paint_pos_suite.resource
Suite Setup       Run Keywords    Suite Setup - Paint POS BDD    AND    Ensure Paint POS Prerequisites    AND    Ensure Paint POS Stock Available
Test Setup        Start Trace Context

*** Test Cases ***
Scenario: Engine inventory failure does not corrupt stock state
    [Tags]    bdd    recovery    inventory    negative
    ${test_case_id}=    Set Variable    PAINT-BDD-REC-001

    ${before}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}

    # Create a draft invoice with absurd qty; submit should fail or be rejected.
    ${items}=    Build Invoice Items    ${BASE_PAINT_ITEM}    999999    100
    ${resp}=    Create Sales Invoice    ${CUSTOMER}    ${items}    ${WAREHOUSE}
    Should Be True    ${resp.status_code} in [200, 417, 422]

    IF    ${resp.status_code} == 200
        ${data}=    Get Response Data    ${resp}
        ${name}=    Get From Dictionary    ${data}    name
        ${submit}=    Submit ERPNext Document    Sales Invoice    ${name}
        Should Be True    ${submit.status_code} in [200, 417, 422]
    END

    ${after}=    Get Stock Balance Via Engine    ${BASE_PAINT_ITEM}    ${WAREHOUSE}
    Should Be True    ${after} >= 0
    Should Be True    ${after} <= ${before}

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Retry with idempotency keys (platform-level placeholder)
    [Tags]    bdd    recovery    idempotency    known-gap
    ${test_case_id}=    Set Variable    PAINT-BDD-REC-002

    Log    Platform-wide idempotency key header is not standardized across endpoints yet.

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    FAIL    FAIL    FAIL
