*** Settings ***
Documentation     Paint Shop + PoS (BFF) - Color Mixing & Pricing (BDD)
...               Scope: Backend formulation calculation and API contract validation.
Resource          ../../resources/paint_pos_bdd/paint_pos_suite.resource
Suite Setup       Run Keywords    Suite Setup - Paint POS BDD    AND    Ensure Paint POS Prerequisites
Test Setup        Start Trace Context

*** Test Cases ***
Scenario: Successful PoS formulation calculation with valid color mix
    [Tags]    smoke    bdd    paint    formulation    positive
    ${test_case_id}=    Set Variable    PAINT-BDD-001

    Given a valid color code and batch size is provided    RAL-5015    2
    @{pigments}=    Create List    ${PIGMENT_BLUE}    ${PIGMENT_RED}

    # Create a deterministic formula for this color
    Create Deterministic Tint Formula    ${COLOR_CODE}

    When the paint formula is calculated    ${COLOR_CODE}    ${QTY_LITERS}

    # Expected cost uses Item valuation_rate/standard_rate from ERPNext.
    # Our stock receipts set rates (base=100, blue=10, red=12). Calculation uses liters.
    # Base cost: 2L * 100 = 200
    # Pigments per 1L: blue=50ml -> 0.05L, red=25ml -> 0.025L
    # For 2L: blue=0.1L*10=1, red=0.05L*12=0.6 => total 201.6
    Then the Backend should calculate the correct color formulation    ${BASE_PAINT_ITEM}
    And the Backend should return correct pricing and tax    201.6

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Unsupported color code returns safe empty formulation
    [Tags]    bdd    paint    formulation    negative
    ${test_case_id}=    Set Variable    PAINT-BDD-002

    Given a valid color code and batch size is provided    UNSUPPORTED-XYZ    1
    When the paint formula is calculated    ${COLOR_CODE}    ${QTY_LITERS}

    # Current implementation returns UNKNOWN base paint and formula_version=0 instead of error.
    ${base}=    Get From Dictionary    ${FORMULA_RESP}    base_paint
    Should Be Equal    ${base}[item_code]    UNKNOWN
    Should Be Equal As Numbers    ${FORMULA_RESP}[formula_version]    0
    Should Be Equal As Numbers    ${FORMULA_RESP}[total_estimated_cost]    0

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS

Scenario: Rounding edge case for pigment quantities
    [Tags]    bdd    paint    formulation    edge
    ${test_case_id}=    Set Variable    PAINT-BDD-003

    ${color}=    Set Variable    EDGE-ROUND-333
    Given a valid color code and batch size is provided    ${color}    1.3333

    # Create a formula with non-round output volume
    ${components}=    Create List
    ${c1}=    Create Dictionary    tint_item_code=${PIGMENT_BLUE}    quantity_per_unit=17    unit_of_measure=ml
    Append To List    ${components}    ${c1}

    ${cc_resp}=    Create Color Code Via Backend    ${color}    CUSTOM
    IF    ${cc_resp.status_code} not in [201, 409]
        Log    Color code pre-create failed (${cc_resp.status_code}): ${cc_resp.text}    WARN
        ${_}=    Calculate Paint Formula Via Backend    ${color}    0.001
    END
    ${formula}=    Create Tint Formula Via Backend    ${color}    ${BASE_PAINT_ITEM}    333    ${components}

    When the paint formula is calculated    ${color}    ${QTY_LITERS}

    # Assert backend rounds tint quantities to 4 decimals (liters)
    ${tints}=    Get From Dictionary    ${FORMULA_RESP}    tints
    ${first}=    Set Variable    ${tints}[0]
    ${qty}=    Get From Dictionary    ${first}    quantity
    ${as_str}=    Convert To String    ${qty}
    Should Match Regexp    ${as_str}    ^[0-9]+(\\.[0-9]{1,4})?$

    Record Evaluation Contract    ${test_case_id}
    ...    PASS    PASS    PASS
    ...    PASS    PASS    PASS
