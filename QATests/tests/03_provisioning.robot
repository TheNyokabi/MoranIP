*** Settings ***
Documentation     IAM Provisioning Flows (Create Tenant, Invite)
Resource          ../resources/common.resource
Library           String
Suite Setup       Create API Session

*** Test Cases ***
Create New Tenant
    [Documentation]    Verify creating a new tenant works
    ${random_suffix}=    Generate Random String    4    [NUMBERS]
    ${tenant_name}=      Set Variable    Robot Tenant ${random_suffix}
    ${admin_email}=      Set Variable    admin${random_suffix}@robot.com
    
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    name=${tenant_name}    country_code=KE    admin_email=${admin_email}    admin_name=Robot Admin    admin_password=robotpass
    
    ${resp}=       POST On Session      moran_api    /iam/tenants    json=${body}    headers=${headers}    expected_status=200
    
    Dictionary Should Contain Key    ${resp.json()}    message
    Should Be Equal As Strings       ${resp.json()['message']}    Tenant created successfully
    
    ${tenant_data}=    Get From Dictionary    ${resp.json()}    tenant
    Set Suite Variable    ${NEW_TENANT_ID}    ${tenant_data['id']}
    Log    Created Tenant: ${NEW_TENANT_ID}

Invite New User To Tenant
    [Documentation]    Verify inviting a new user
    ${random_suffix}=    Generate Random String    4    [NUMBERS]
    ${new_email}=        Set Variable    newuser${random_suffix}@robot.com
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    email=${new_email}    role=MEMBER
    
    ${resp}=       POST On Session      moran_api    /iam/tenants/${NEW_TENANT_ID}/invite    json=${body}    headers=${headers}    expected_status=200
    
    Dictionary Should Contain Key    ${resp.json()}    code
    Should Be Equal As Strings       ${resp.json()['code']}    INVITED_NEW

Invite Existing User To Tenant
    [Documentation]    Verify inviting an existing user (the admin we just created)
    # The admin${suffix} created in previous test is an existing user.
    # But wait, checking logic... "User is already a member..." if INVITED or MEMBER.
    # The admin created is ALREADY a member (owner). So expect "User is already a member..."
    
    # Let's try inviting the MAIN admin (admin@moran.com) who is NOT in this new tenant.
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${body}=       Create Dictionary    email=${ADMIN_EMAIL}    role=ADMIN
    
    ${resp}=       POST On Session      moran_api    /iam/tenants/${NEW_TENANT_ID}/invite    json=${body}    headers=${headers}    expected_status=200
    
    Dictionary Should Contain Key    ${resp.json()}    code
    Should Be Equal As Strings       ${resp.json()['code']}    INVITED_EXISTING
