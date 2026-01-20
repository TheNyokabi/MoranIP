*** Settings ***
Documentation     Comprehensive tests for Role Management API
...               Test Design Techniques Used:
...               - Equivalence Partitioning (valid/invalid inputs)
...               - Boundary Value Analysis (edge cases)
...               - State Transition Testing (role lifecycle)
...               - Error Guessing (security scenarios)

Resource          ../resources/rbac_keywords.robot
Suite Setup       Run Keywords
...               Setup Test Environment    AND
...               Setup Test Users And Tokens
Suite Teardown    Teardown Test Environment

*** Variables ***
${TEST_ROLE_CODE}         TEST_SALES_MGR
${TEST_ROLE_NAME}         Test Sales Manager
${TEST_ROLE_DESC}         Test role for sales management

*** Test Cases ***
# ==================== POSITIVE TESTS ====================

TC001_List_Roles_Successfully
    [Documentation]    Verify authorized user can list all roles
    [Tags]    positive    smoke    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles    headers=${headers}
    Verify Response Status    ${response}    200
    ${roles}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${roles}
    # Verify system roles are present
    ${role_codes}=    Evaluate    [r['code'] for r in ${roles}]
    Should Contain    ${role_codes}    OWNER
    Should Contain    ${role_codes}    ADMIN
    Should Contain    ${role_codes}    MANAGER

TC002_Get_Role_By_ID_Successfully
    [Documentation]    Verify authorized user can get role details
    [Tags]    positive    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    # First get list to find a role ID
    ${response}=    GET On Session    api    ${API_VERSION}/roles    headers=${headers}
    ${roles}=    Set Variable    ${response.json()}
    ${role_id}=    Get From Dictionary    ${roles}[0]    id
    
    # Get specific role
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${role_id}    headers=${headers}
    Verify Response Status    ${response}    200
    ${role}=    Set Variable    ${response.json()}
    Verify Response Contains    ${response}    id    ${role_id}
    Verify Response Contains    ${response}    permissions
    Should Be True    isinstance(${role}['permissions'], list)

TC003_Create_Custom_Role_Successfully
    [Documentation]    Verify admin can create custom role
    [Tags]    positive    roles    crud
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    ${TEST_ROLE_CODE}    ${TEST_ROLE_NAME}    ${TEST_ROLE_DESC}
    Verify UUID Format    ${role_id}
    # Verify role was created
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${role_id}    headers=${headers}
    Verify Response Status    ${response}    200
    Verify Response Contains    ${response}    code    ${TEST_ROLE_CODE}
    Verify Response Contains    ${response}    name    ${TEST_ROLE_NAME}
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC004_Update_Custom_Role_Successfully
    [Documentation]    Verify admin can update custom role
    [Tags]    positive    roles    crud
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    UPDATE_TEST    Update Test Role
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${new_name}=    Set Variable    Updated Role Name
    ${new_desc}=    Set Variable    Updated description
    ${body}=    Create Dictionary    name=${new_name}    description=${new_desc}
    
    ${response}=    PUT On Session    api    ${API_VERSION}/roles/${role_id}    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
    Verify Response Contains    ${response}    name    ${new_name}
    Verify Response Contains    ${response}    description    ${new_desc}
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC005_Delete_Custom_Role_Successfully
    [Documentation]    Verify admin can delete unassigned custom role
    [Tags]    positive    roles    crud
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    DELETE_TEST    Delete Test Role
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    ${response}=    DELETE On Session    api    ${API_VERSION}/roles/${role_id}    headers=${headers}
    Verify Response Status    ${response}    204
    
    # Verify role is deleted
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${role_id}    
    ...    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    404

TC006_Add_Permissions_To_Role_Successfully
    [Documentation]    Verify admin can add permissions to custom role
    [Tags]    positive    roles    permissions
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    PERM_TEST    Permission Test Role
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Get some permission IDs
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?limit=5    headers=${headers}
    ${permissions}=    Set Variable    ${response.json()}
    ${perm_ids}=    Evaluate    [p['id'] for p in ${permissions}[:2]]
    
    # Add permissions to role
    ${body}=    Create Dictionary    permission_ids=${perm_ids}
    ${response}=    POST On Session    api    ${API_VERSION}/roles/${role_id}/permissions    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    201
    ${result}=    Set Variable    ${response.json()}
    Should Be Equal As Numbers    ${result}[added_count]    2
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC007_Remove_Permission_From_Role_Successfully
    [Documentation]    Verify admin can remove permission from custom role
    [Tags]    positive    roles    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    # Get a permission ID
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?limit=1    headers=${headers}
    ${perm_id}=    Set Variable    ${response.json()}[0][id]
    
    # Create role with permission
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    REM_PERM_TEST    Remove Perm Test    ${EMPTY}    ${perm_id}
    
    # Remove permission
    ${response}=    DELETE On Session    api    ${API_VERSION}/roles/${role_id}/permissions/${perm_id}    
    ...    headers=${headers}
    Verify Response Status    ${response}    204
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

# ==================== NEGATIVE TESTS ====================

TC101_List_Roles_Without_Authentication
    [Documentation]    Verify unauthenticated request is rejected
    [Tags]    negative    security    roles
    ${response}=    GET On Session    api    ${API_VERSION}/roles    expected_status=any
    Verify Response Status    ${response}    401

TC102_List_Roles_Without_Permission
    [Documentation]    Verify user without permission cannot list roles
    [Tags]    negative    security    roles
    ${headers}=    Get Authorization Header    ${VIEWER_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles    
    ...    headers=${headers}    expected_status=any
    # Viewer should not have iam:roles:view permission
    Should Be True    ${response.status_code} in [403, 401]

TC103_Get_Role_With_Invalid_UUID
    [Documentation]    Verify invalid UUID format is rejected
    [Tags]    negative    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${INVALID_UUID}    
    ...    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    400    Invalid.*ID.*format

TC104_Get_Non_Existent_Role
    [Documentation]    Verify non-existent role returns 404
    [Tags]    negative    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${NON_EXISTENT_UUID}    
    ...    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    404

TC105_Create_Role_With_Duplicate_Code
    [Documentation]    Verify duplicate role code is rejected
    [Tags]    negative    validation    roles
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    DUP_CODE_TEST    Duplicate Code Test
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Try to create another role with same code
    ${body}=    Create Dictionary    code=DUP_CODE_TEST    name=Another Role
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    409    already exists
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC106_Create_Role_With_Missing_Required_Fields
    [Documentation]    Verify missing required fields are rejected
    [Tags]    negative    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Missing 'name' field
    ${body}=    Create Dictionary    code=MISSING_NAME
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    422

TC107_Update_System_Role
    [Documentation]    Verify system roles cannot be modified
    [Tags]    negative    security    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    # Get ADMIN role (system role)
    ${response}=    GET On Session    api    ${API_VERSION}/roles    headers=${headers}
    ${roles}=    Set Variable    ${response.json()}
    ${admin_role}=    Evaluate    [r for r in ${roles} if r['code'] == 'ADMIN'][0]
    ${admin_role_id}=    Get From Dictionary    ${admin_role}    id
    
    # Try to update system role
    ${body}=    Create Dictionary    name=Modified Admin
    ${response}=    PUT On Session    api    ${API_VERSION}/roles/${admin_role_id}    
    ...    json=${body}    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    403    Cannot modify system roles

TC108_Delete_System_Role
    [Documentation]    Verify system roles cannot be deleted
    [Tags]    negative    security    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles    headers=${headers}
    ${roles}=    Set Variable    ${response.json()}
    ${owner_role}=    Evaluate    [r for r in ${roles} if r['code'] == 'OWNER'][0]
    ${owner_role_id}=    Get From Dictionary    ${owner_role}    id
    
    ${response}=    DELETE On Session    api    ${API_VERSION}/roles/${owner_role_id}    
    ...    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    403    Cannot delete system roles

TC109_Delete_Role_Assigned_To_Users
    [Documentation]    Verify cannot delete role assigned to users
    [Tags]    negative    validation    roles
    # This test assumes ADMIN role is assigned to test admin user
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/roles    headers=${headers}
    ${roles}=    Set Variable    ${response.json()}
    ${admin_role}=    Evaluate    [r for r in ${roles} if r['code'] == 'ADMIN'][0]
    ${admin_role_id}=    Get From Dictionary    ${admin_role}    id
    
    ${response}=    DELETE On Session    api    ${API_VERSION}/roles/${admin_role_id}    
    ...    headers=${headers}    expected_status=any
    # Should fail because it's either system role or assigned to users
    Should Be True    ${response.status_code} in [403, 409]

TC110_Add_Invalid_Permission_To_Role
    [Documentation]    Verify invalid permission ID is handled gracefully
    [Tags]    negative    validation    roles
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    INV_PERM_TEST    Invalid Perm Test
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Try to add invalid permission
    ${body}=    Create Dictionary    permission_ids=["${INVALID_UUID}"]
    ${response}=    POST On Session    api    ${API_VERSION}/roles/${role_id}/permissions    
    ...    json=${body}    headers=${headers}    expected_status=any
    # Should succeed but with 0 added
    Verify Response Status    ${response}    201
    ${result}=    Set Variable    ${response.json()}
    Should Be Equal As Numbers    ${result}[added_count]    0
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

# ==================== EDGE CASES ====================

TC201_Create_Role_With_Very_Long_Name
    [Documentation]    Boundary Value Analysis - Test maximum name length
    [Tags]    edge    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${long_name}=    Generate Random String    255    [LETTERS]
    ${body}=    Create Dictionary    code=LONG_NAME_TEST    name=${long_name}
    
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    # Should either succeed or fail with validation error
    Should Be True    ${response.status_code} in [201, 422]

TC202_Create_Role_With_Empty_String_Name
    [Documentation]    Boundary Value Analysis - Test minimum name length
    [Tags]    edge    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    code=EMPTY_NAME    name=${EMPTY}
    
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    422

TC203_Create_Role_With_Special_Characters
    [Documentation]    Test role code with special characters
    [Tags]    edge    validation    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    code=TEST@#$%    name=Special Chars Role
    
    ${response}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    # Should either succeed or fail with validation error
    Should Be True    ${response.status_code} in [201, 422]

TC204_List_Roles_With_Pagination
    [Documentation]    Test pagination parameters
    [Tags]    edge    pagination    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Test with limit
    ${response}=    GET On Session    api    ${API_VERSION}/roles?limit=2    headers=${headers}
    Verify Response Status    ${response}    200
    ${roles}=    Set Variable    ${response.json()}
    ${count}=    Get Length    ${roles}
    Should Be True    ${count} <= 2

TC205_Add_Large_Number_Of_Permissions_To_Role
    [Documentation]    Test adding many permissions at once
    [Tags]    edge    performance    roles
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    MANY_PERMS    Many Permissions Role
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Get many permission IDs
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?limit=50    headers=${headers}
    ${permissions}=    Set Variable    ${response.json()}
    ${perm_ids}=    Evaluate    [p['id'] for p in ${permissions}]
    
    # Add all permissions
    ${body}=    Create Dictionary    permission_ids=${perm_ids}
    ${response}=    POST On Session    api    ${API_VERSION}/roles/${role_id}/permissions    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    201
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC206_Concurrent_Role_Creation
    [Documentation]    Test race condition handling - simplified test for concurrent role creation
    [Tags]    edge    concurrency    roles
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${code}=    Set Variable    CONCURRENT_TEST
    
    # Create first role
    ${body}=    Create Dictionary    code=${code}    name=Concurrent Test 1
    ${response1}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body}    headers=${headers}    expected_status=any
    
    # Try to create duplicate immediately
    ${body2}=    Create Dictionary    code=${code}    name=Concurrent Test 2
    ${response2}=    POST On Session    api    ${API_VERSION}/roles    
    ...    json=${body2}    headers=${headers}    expected_status=any
    
    # One should succeed, one should fail
    ${status_codes}=    Create List    ${response1.status_code}    ${response2.status_code}
    Should Contain    ${status_codes}    ${201}
    Should Contain    ${status_codes}    ${409}
    
    # Cleanup
    Run Keyword If    ${response1.status_code} == 201    
    ...    Delete Test Role    ${ADMIN_TOKEN}    ${response1.json()}[id]

TC207_Role_With_No_Permissions
    [Documentation]    Test role with zero permissions
    [Tags]    edge    validation    roles
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    NO_PERMS    No Permissions Role
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Verify role has no permissions
    ${response}=    GET On Session    api    ${API_VERSION}/roles/${role_id}/permissions    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    Should Be Empty    ${permissions}
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}

TC208_Update_Role_With_Null_Values
    [Documentation]    Test updating role with null/empty values
    [Tags]    edge    validation    roles
    ${role_id}=    Create Test Role    ${ADMIN_TOKEN}    NULL_TEST    Null Test Role    Initial Description
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    
    # Try to update with null description
    ${body}=    Create Dictionary    description=${None}
    ${response}=    PUT On Session    api    ${API_VERSION}/roles/${role_id}    
    ...    json=${body}    headers=${headers}    expected_status=any
    # Should either accept null or reject
    Should Be True    ${response.status_code} in [200, 422]
    [Teardown]    Delete Test Role    ${ADMIN_TOKEN}    ${role_id}
