*** Settings ***
Documentation     API Documentation Validation Tests
Resource          ../resources/rbac_keywords.robot
Library           RequestsLibrary
Library           Collections
Library           OperatingSystem
Suite Setup       Setup Platform Test Environment
Suite Teardown    Teardown Test Environment

*** Variables ***
${BASE_URL}    http://localhost:9000

*** Test Cases ***
Verify OpenAPI Documentation Endpoint Accessible
    [Documentation]    Check that /docs endpoint is accessible
    [Tags]    documentation    smoke
    
    ${response}=    GET On Session    api    /docs    expected_status=200
    Should Contain    ${response.text}    Swagger UI
    Log    API documentation is accessible

Verify OpenAPI JSON Schema Exists
    [Documentation]    Validate OpenAPI JSON schema is complete
    [Tags]    documentation    critical
    
    ${response}=    GET On Session    api    /openapi.json    expected_status=200
    ${schema}=    Set Variable    ${response.json()}
    
    # Verify required top-level fields
    Dictionary Should Contain Key    ${schema}    openapi
    Dictionary Should Contain Key    ${schema}    info
    Dictionary Should Contain Key    ${schema}    paths
    Log    OpenAPI schema structure is valid

Verify Inventory Endpoints Documented
    [Documentation]    Ensure all inventory endpoints are in OpenAPI spec
    [Tags]    documentation    inventory
    
    ${response}=    GET On Session    api    /openapi.json    expected_status=200
    ${schema}=    Set Variable    ${response.json()}
    ${paths}=    Get From Dictionary    ${schema}    paths
    
    # Check inventory endpoints (inventory router is mounted under /api)
    Dictionary Should Contain Key    ${paths}    /api/inventory/items
    Dictionary Should Contain Key    ${paths}    /api/inventory/items/{item_code}
    Dictionary Should Contain Key    ${paths}    /api/inventory/warehouses
    Log    All inventory endpoints are documented

Verify Purchase Endpoints Documented
    [Documentation]    Ensure all purchase endpoints are in OpenAPI spec
    [Tags]    documentation    purchases
    
    ${response}=    GET On Session    api    /openapi.json    expected_status=200
    ${schema}=    Set Variable    ${response.json()}
    ${paths}=    Get From Dictionary    ${schema}    paths
    
    # Check purchase endpoints
    Dictionary Should Contain Key    ${paths}    /purchases/suppliers
    Dictionary Should Contain Key    ${paths}    /purchases/orders
    Dictionary Should Contain Key    ${paths}    /purchases/receipts
    Dictionary Should Contain Key    ${paths}    /purchases/invoices
    Log    All purchase endpoints are documented

Verify Endpoints Have Descriptions
    [Documentation]    Ensure all endpoints have proper descriptions
    [Tags]    documentation    quality
    
    ${response}=    GET On Session    api    /openapi.json    expected_status=200
    ${schema}=    Set Variable    ${response.json()}
    ${paths}=    Get From Dictionary    ${schema}    paths
    
    # Check a sample of critical endpoints
    @{critical_endpoints}=    Create List    /api/inventory/items    /purchases/suppliers    /purchases/orders
    
    FOR    ${endpoint}    IN    @{critical_endpoints}
        ${endpoint_spec}=    Get From Dictionary    ${paths}    ${endpoint}
        ${methods}=    Get Dictionary Keys    ${endpoint_spec}
        FOR    ${method}    IN    @{methods}
            ${method_spec}=    Get From Dictionary    ${endpoint_spec}    ${method}
            Dictionary Should Contain Key    ${method_spec}    summary    
            ...    msg=Missing summary for ${method} ${endpoint}
        END
    END
    Log    Critical endpoints have proper descriptions

*** Keywords ***
Setup Platform Test Environment
    [Documentation]    Initialize test environment using API_URL when provided.
    ${base}=    Get Environment Variable    API_URL    ${BASE_URL}
    Set Suite Variable    ${BASE_URL}    ${base}
    Create Session    api    ${BASE_URL}    verify=False
    Set Suite Variable    ${HEADERS}    {"Content-Type": "application/json"}

