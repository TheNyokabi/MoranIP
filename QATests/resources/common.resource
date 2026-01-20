*** Settings ***
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem

*** Variables ***
${API_URL}    %{API_URL}
${ADMIN_EMAIL}    admin@moran.com
${ADMIN_PASSWORD}    admin123
${TENANT_ID}      f83650c4-ca25-48ce-9d5e-eb5a4d9b166e  # Replace dynamically if possible, or use one seeded

*** Keywords ***
Create API Session
    [Documentation]    Creates a session for API requests
    Create Session    alias=moran_api    url=${API_URL}    verify=${False}

Get Tenant ID
    [Arguments]    ${token}
    [Documentation]    Parses token or response to find tenant ID. For now hardcoded or passed.
    Return From Keyword    fake-id 

Check Response Status
    [Arguments]    ${response}    ${expected_status}
    Should Be Equal As Strings    ${response.status_code}    ${expected_status}
