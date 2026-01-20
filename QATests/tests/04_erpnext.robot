*** Settings ***
Documentation     ERPNext Multi-Engine Support & Full API Verification
Resource          ../resources/common.resource
Library           String
Library           OperatingSystem
Suite Setup       Suite Setup - ERPNext Contract

*** Variables ***
${TOKEN}          ${EMPTY}

*** Keywords ***
Suite Setup - ERPNext Contract
    [Documentation]    This suite provisions tenants and runs full proxy contract checks; keep it opt-in.
    ${run}=    Get Environment Variable    RUN_ERPNEXT_CONTRACT    false
    Run Keyword If    '${run}' != 'true'
    ...    Skip    Skipping ERPNext contract/provisioning suite (set RUN_ERPNEXT_CONTRACT=true to enable).
    Create API Session

*** Test Cases ***
Create ERPNext Tenant
    [Documentation]    Create a tenant mapped to 'erpnext' engine
    ${random_suffix}=    Generate Random String    4    [NUMBERS]
    ${tenant_name}=      Set Variable    ERPNext Tenant ${random_suffix}
    ${admin_email}=      Set Variable    erpadmin${random_suffix}@robot.com
    
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    name=${tenant_name}    country_code=KE    admin_email=${admin_email}    admin_name=ERP Admin    admin_password=robotpass    engine=erpnext
    
    ${resp}=       POST On Session      moran_api    /iam/tenants    json=${body}    headers=${headers}    expected_status=200
    
    ${tenant_id}=  Get From Dictionary    ${resp.json()['tenant']}    id
    Set Suite Variable    ${ERP_TENANT_ID}    ${tenant_id}
    Set Suite Variable    ${ERP_ADMIN_EMAIL}    ${admin_email}

Login And Get Token
    [Documentation]    Get Token for subsequent calls
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${creds}=      Create Dictionary    email=${ERP_ADMIN_EMAIL}    password=robotpass
    ${body}=       Create Dictionary    creds=${creds}
    
    ${resp_login}=      POST On Session      moran_api    /auth/v1/login-with-tenant    json=${body}    headers=${headers}    expected_status=200
    ${token}=           Get From Dictionary    ${resp_login.json()}    access_token
    Set Suite Variable    ${TOKEN}    ${token}

Verify Domain Router (Engine Switching)
    [Documentation]    Call generic /erp/partners path
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${resp}=            GET On Session    moran_api    /erp/partners    headers=${auth_header}    expected_status=200
    ${first_partner}=   Get From List     ${resp.json()}    0
    Dictionary Should Contain Key    ${first_partner}    source
    Should Be Equal As Strings       ${first_partner['source']}    erpnext

Verify List Resources (GET)
    [Documentation]    GET /erpnext/resource/Customer
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${resp}=            GET On Session    moran_api    /erpnext/resource/Customer    headers=${auth_header}    expected_status=200
    # Adapter unwraps 'data', so valid response IS the list
    ${data}=            Set Variable    ${resp.json()}
    Should Not Be Empty    ${data}

Verify Create Resource (POST)
    [Documentation]    POST /erpnext/resource/Customer
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${body}=            Create Dictionary    customer_name=Robot Customer    customer_type=Company
    
    ${resp}=            POST On Session   moran_api    /erpnext/resource/Customer    json=${body}    headers=${auth_header}    expected_status=200
    # Adapter unwraps 'data', response IS the dict
    ${data}=            Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data['customer_name']}    Robot Customer
    Set Suite Variable    ${NEW_DOC_NAME}    ${data['name']}

Verify Read Resource Detail (GET)
    [Documentation]    GET /erpnext/resource/Customer/{name}
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${resp}=            GET On Session    moran_api    /erpnext/resource/Customer/${NEW_DOC_NAME}    headers=${auth_header}    expected_status=200
    ${data}=            Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data['name']}    ${NEW_DOC_NAME}

Verify Update Resource (PUT)
    [Documentation]    PUT /erpnext/resource/Customer/{name}
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${body}=            Create Dictionary    customer_name=Updated Robot Customer
    
    ${resp}=            PUT On Session    moran_api    /erpnext/resource/Customer/${NEW_DOC_NAME}    json=${body}    headers=${auth_header}    expected_status=200
    ${data}=            Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data['customer_name']}    Updated Robot Customer

Verify RPC Method (POST)
    [Documentation]    POST /erpnext/method/ping
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${resp}=            POST On Session   moran_api    /erpnext/method/ping    headers=${auth_header}    expected_status=200
    # Response is "pong" string
    ${data}=            Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data}    pong

Verify Delete Resource (DELETE)
    [Documentation]    DELETE /erpnext/resource/Customer/{name}
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${resp}=            DELETE On Session    moran_api    /erpnext/resource/Customer/${NEW_DOC_NAME}    headers=${auth_header}    expected_status=200
    ${data}=            Set Variable    ${resp.json()}
    Should Be Equal As Strings    ${data}    ok

# --- Edge Cases ---

Verify 404 Not Found
    [Documentation]    GET /erpnext/resource/Customer/MISSING_DOC
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    POST On Session     moran_api    /erpnext/resource/Customer/MISSING_DOC    headers=${auth_header}    expected_status=405
    # Wait, GET not POST for Read
    GET On Session      moran_api    /erpnext/resource/Customer/MISSING_DOC    headers=${auth_header}    expected_status=404

Verify 500 Server Error
    [Documentation]    GET /erpnext/resource/Customer/ERROR_500
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    GET On Session      moran_api    /erpnext/resource/Customer/ERROR_500    headers=${auth_header}    expected_status=500

Verify 409 Conflict
    [Documentation]    PUT /erpnext/resource/Customer/LOCKED_DOC
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    ${body}=            Create Dictionary    customer_name=Hack
    PUT On Session      moran_api    /erpnext/resource/Customer/LOCKED_DOC    json=${body}    headers=${auth_header}    expected_status=409

Verify 403 Forbidden Delete
    [Documentation]    DELETE /erpnext/resource/Customer/PROTECTED_DOC
    ${auth_header}=     Create Dictionary    Authorization=Bearer ${TOKEN}
    DELETE On Session   moran_api    /erpnext/resource/Customer/PROTECTED_DOC    headers=${auth_header}    expected_status=403
