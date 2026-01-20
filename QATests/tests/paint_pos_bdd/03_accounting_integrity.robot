*** Settings ***
Documentation     Paint Shop + PoS (Engine) - Accounting & Financial Integrity (BDD)
...               Scope: balanced GL entries and voucher linkage.
Resource          ../../resources/paint_pos_bdd/paint_pos_suite.resource
Suite Setup       Run Keywords    Suite Setup - Paint POS BDD    AND    Ensure Paint POS Prerequisites    AND    Ensure Paint POS Stock Available
Test Setup        Start Trace Context

*** Test Cases ***
Scenario: Revenue posting creates balanced journal entries
    [Tags]    smoke    bdd    accounting    positive
    ${test_case_id}=    Set Variable    PAINT-BDD-ACC-001

    ${items}=    Build Invoice Items    ${BASE_PAINT_ITEM}    1    100
    ${invoice}=    Create And Submit Sales Invoice    ${CUSTOMER}    ${WAREHOUSE}    ${items}

    ${balanced}=    Verify GL Entries Balanced For Voucher    ${invoice}
    Should Be True    ${balanced}

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Refund and reversal handling (placeholder contract)
    [Tags]    bdd    accounting    recovery    known-gap
    ${test_case_id}=    Set Variable    PAINT-BDD-ACC-002

    # ERPNext credit note / return invoice flow is environment-specific; keep as a runnable placeholder.
    Log    Refund workflow not standardized in this environment yet.

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    FAIL    FAIL    FAIL
