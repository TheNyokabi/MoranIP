*** Settings ***
Library    RequestsLibrary
Library    Collections
Library    String
Library    DateTime
Resource   ../erpnext_paintshop_keywords.robot

*** Variables ***
${PAINT_API_PREFIX}    /api/paint

*** Keywords ***
Calculate Paint Formula Via Backend
    [Arguments]    ${color_code}    ${quantity_liters}
    [Documentation]    Call BFF paint formulation endpoint and return the normalized JSON.
    ${body}=    Create Dictionary    color_code=${color_code}    quantity_liters=${quantity_liters}    customer=Walk-in Customer
    ${headers}=    Copy Dictionary    ${HEADERS}
    Run Keyword If    '${TRACE_ID}' != '${EMPTY}'    Set To Dictionary    ${headers}    X-Trace-Id=${TRACE_ID}
    ${resp}=    POST On Session    platform    ${PAINT_API_PREFIX}/calculate-formula    json=${body}    headers=${headers}    expected_status=any
    Should Be Equal As Numbers    ${resp.status_code}    200
    ${data}=    Set Variable    ${resp.json()}
    [Return]    ${data}

Create Color Code Via Backend
    [Arguments]    ${color_code}    ${color_system}=CUSTOM    ${hex_code}=${EMPTY}
    ${body}=    Create Dictionary    id=${color_code}    color_system=${color_system}
    Run Keyword If    '${hex_code}' != '${EMPTY}'    Set To Dictionary    ${body}    hex_code=${hex_code}
    ${headers}=    Copy Dictionary    ${HEADERS}
    ${resp}=    POST On Session    platform    ${PAINT_API_PREFIX}/color-codes    json=${body}    headers=${headers}    expected_status=any
    [Return]    ${resp}

Create Tint Formula Via Backend
    [Arguments]    ${color_code}    ${base_item_code}    ${output_volume_ml}    ${components}
    [Documentation]    Create a tint formula and return response JSON.
    ${body}=    Create Dictionary
    ...    color_code_id=${color_code}
    ...    base_paint_item=${base_item_code}
    ...    output_volume_ml=${output_volume_ml}
    ...    components=${components}
    ${headers}=    Copy Dictionary    ${HEADERS}
    ${resp}=    POST On Session    platform    ${PAINT_API_PREFIX}/formulas    json=${body}    headers=${headers}    expected_status=any
    Should Be True    ${resp.status_code} in [200, 201]
    [Return]    ${resp.json()}
