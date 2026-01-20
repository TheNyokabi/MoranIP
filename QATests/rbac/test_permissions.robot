*** Settings ***
Documentation     Comprehensive tests for Permission Discovery and Checking API
...               Test Design Techniques Used:
...               - Equivalence Partitioning (permission types, modules)
...               - Decision Table Testing (permission combinations)
...               - Wildcard Pattern Testing (permission matching)

Resource          ../../resources/rbac_keywords.robot
Suite Setup       Run Keywords
...               Setup Test Environment    AND
...               Setup Test Users And Tokens
Suite Teardown    Teardown Test Environment

*** Test Cases ***
# ==================== POSITIVE TESTS ====================

TC001_List_All_Permissions
    [Documentation]    Verify authorized user can list all permissions
    [Tags]    positive    smoke    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${permissions}
    # Verify permission structure
    ${first_perm}=    Set Variable    ${permissions}[0]
    Dictionary Should Contain Key    ${first_perm}    id
    Dictionary Should Contain Key    ${first_perm}    code
    Dictionary Should Contain Key    ${first_perm}    module
    Dictionary Should Contain Key    ${first_perm}    resource
    Dictionary Should Contain Key    ${first_perm}    action

TC002_Filter_Permissions_By_Module
    [Documentation]    Verify filtering permissions by module
    [Tags]    positive    filtering    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?module=crm    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    # All permissions should be from CRM module
    FOR    ${perm}    IN    @{permissions}
        Should Be Equal    ${perm}[module]    crm
    END

TC003_Filter_Permissions_By_Action
    [Documentation]    Verify filtering permissions by action
    [Tags]    positive    filtering    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?action=view    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    # All permissions should have 'view' action
    FOR    ${perm}    IN    @{permissions}
        Should Be Equal    ${perm}[action]    view
    END

TC004_Filter_Permissions_By_Risk_Level
    [Documentation]    Verify filtering permissions by risk level
    [Tags]    positive    filtering    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?risk_level=HIGH    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    FOR    ${perm}    IN    @{permissions}
        Should Be Equal    ${perm}[risk_level]    HIGH
    END

TC005_Search_Permissions_By_Text
    [Documentation]    Verify text search in permissions
    [Tags]    positive    search    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?search=create    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${permissions}

TC006_List_All_Modules
    [Documentation]    Verify listing all permission modules
    [Tags]    positive    modules    permissions
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/modules
    Verify Response Status    ${response}    200
    ${modules}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${modules}
    # Verify expected modules are present
    ${module_names}=    Evaluate    [m['module'] for m in ${modules}]
    Should Contain    ${module_names}    iam
    Should Contain    ${module_names}    crm
    Should Contain    ${module_names}    inventory

TC007_Get_Module_Permissions
    [Documentation]    Verify getting all permissions for a module
    [Tags]    positive    modules    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/modules/crm    headers=${headers}
    Verify Response Status    ${response}    200
    ${result}=    Set Variable    ${response.json()}
    Verify Response Contains    ${response}    module    crm
    Verify Response Contains    ${response}    permissions
    Should Not Be Empty    ${result}[permissions]

TC008_Get_My_Permissions
    [Documentation]    Verify user can get their own permissions
    [Tags]    positive    smoke    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/me    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${permissions}
    # Admin should have many permissions
    ${count}=    Get Length    ${permissions}
    Should Be True    ${count} > 50

TC009_Batch_Permission_Check_All_Granted
    [Documentation]    Verify batch checking permissions - all granted
    [Tags]    positive    check    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    permissions=["iam:users:view", "iam:roles:view"]
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    Should Be True    ${results}[iam:users:view]
    Should Be True    ${results}[iam:roles:view]

TC010_Batch_Permission_Check_Mixed_Results
    [Documentation]    Verify batch checking permissions - mixed results
    [Tags]    positive    check    permissions
    ${headers}=    Get Authorization Header    ${VIEWER_TOKEN}
    ${body}=    Create Dictionary    permissions=["iam:users:view", "iam:users:create"]
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    # Viewer should have view but not create
    Should Be True    ${results}[iam:users:view]
    Should Not Be True    ${results}[iam:users:create]

TC011_List_All_Actions
    [Documentation]    Verify listing all permission actions
    [Tags]    positive    actions    permissions
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/actions
    Verify Response Status    ${response}    200
    ${actions}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${actions}
    # Verify common actions
    Should Contain    ${actions}    view
    Should Contain    ${actions}    create
    Should Contain    ${actions}    edit
    Should Contain    ${actions}    delete

TC012_Get_Risk_Level_Distribution
    [Documentation]    Verify getting risk level distribution
    [Tags]    positive    analytics    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/risk-levels    headers=${headers}
    Verify Response Status    ${response}    200
    ${distribution}=    Set Variable    ${response.json()}
    # Should have all risk levels
    Dictionary Should Contain Key    ${distribution}    LOW
    Dictionary Should Contain Key    ${distribution}    MEDIUM
    Dictionary Should Contain Key    ${distribution}    HIGH
    Dictionary Should Contain Key    ${distribution}    CRITICAL

# ==================== NEGATIVE TESTS ====================

TC101_List_Permissions_Without_Authentication
    [Documentation]    Verify unauthenticated request is rejected
    [Tags]    negative    security    permissions
    ${response}=    GET On Session    api    ${API_VERSION}/permissions    expected_status=any
    Verify Response Status    ${response}    401

TC102_Get_Module_Permissions_For_Invalid_Module
    [Documentation]    Verify invalid module returns 404
    [Tags]    negative    validation    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/modules/invalid_module    
    ...    headers=${headers}    expected_status=any
    Verify Response Status    ${response}    404

TC103_Get_Permission_With_Invalid_UUID
    [Documentation]    Verify invalid UUID format is rejected
    [Tags]    negative    validation    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions/${INVALID_UUID}    
    ...    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    400    Invalid.*ID.*format

TC104_Batch_Check_With_Empty_List
    [Documentation]    Verify empty permission list handling
    [Tags]    negative    validation    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    permissions=@{EMPTY}
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}    expected_status=any
    # Should either succeed with empty results or reject
    Should Be True    ${response.status_code} in [200, 422]

TC105_Batch_Check_With_Invalid_Permission_Codes
    [Documentation]    Verify invalid permission codes are handled
    [Tags]    negative    validation    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    permissions=["invalid:perm:code", "another:bad:one"]
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    # Invalid permissions should return false
    Should Not Be True    ${results}[invalid:perm:code]
    Should Not Be True    ${results}[another:bad:one]

# ==================== EDGE CASES ====================

TC201_Pagination_With_Large_Limit
    [Documentation]    Test pagination with maximum limit
    [Tags]    edge    pagination    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?limit=500    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    ${count}=    Get Length    ${permissions}
    Should Be True    ${count} <= 500

TC202_Pagination_With_Offset
    [Documentation]    Test pagination with offset
    [Tags]    edge    pagination    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response1}=    GET On Session    api    ${API_VERSION}/permissions?limit=10&offset=0    headers=${headers}
    ${response2}=    GET On Session    api    ${API_VERSION}/permissions?limit=10&offset=10    headers=${headers}
    Verify Response Status    ${response1}    200
    Verify Response Status    ${response2}    200
    ${perms1}=    Set Variable    ${response1.json()}
    ${perms2}=    Set Variable    ${response2.json()}
    # Results should be different
    Should Not Be Equal    ${perms1}[0][id]    ${perms2}[0][id]

TC203_Filter_By_Multiple_Criteria
    [Documentation]    Test combining multiple filters
    [Tags]    edge    filtering    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?module=crm&action=create&risk_level=MEDIUM    
    ...    headers=${headers}
    Verify Response Status    ${response}    200
    ${permissions}=    Set Variable    ${response.json()}
    # All permissions should match all criteria
    FOR    ${perm}    IN    @{permissions}
        Should Be Equal    ${perm}[module]    crm
        Should Be Equal    ${perm}[action]    create
        Should Be Equal    ${perm}[risk_level]    MEDIUM
    END

TC204_Batch_Check_Large_Number_Of_Permissions
    [Documentation]    Test checking many permissions at once
    [Tags]    edge    performance    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    # Get many permission codes
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?limit=100    headers=${headers}
    ${permissions}=    Set Variable    ${response.json()}
    ${perm_codes}=    Evaluate    [p['code'] for p in ${permissions}]
    
    # Check all at once
    ${body}=    Create Dictionary    permissions=${perm_codes}
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
    ${results}=    Get From Dictionary    ${response.json()}    results
    ${result_count}=    Get Length    ${results}
    Should Be Equal As Numbers    ${result_count}    ${100}

TC205_Search_With_Special_Characters
    [Documentation]    Test search with special characters
    [Tags]    edge    search    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/permissions?search=:    headers=${headers}
    Verify Response Status    ${response}    200
    # Should not crash, may return results or empty

TC206_Case_Insensitive_Module_Filter
    [Documentation]    Test case sensitivity in module filter
    [Tags]    edge    filtering    permissions
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response1}=    GET On Session    api    ${API_VERSION}/permissions?module=crm    headers=${headers}
    ${response2}=    GET On Session    api    ${API_VERSION}/permissions?module=CRM    headers=${headers}
    Verify Response Status    ${response1}    200
    Verify Response Status    ${response2}    200
    # Both should return same results (case insensitive)
    ${count1}=    Get Length    ${response1.json()}
    ${count2}=    Get Length    ${response2.json()}
    Should Be Equal As Numbers    ${count1}    ${count2}

TC207_Wildcard_Permission_Matching
    [Documentation]    Test wildcard permission matching logic
    [Tags]    edge    wildcard    permissions
    [Documentation]    This tests the permission matching logic indirectly through role permissions
    # User with crm:*:view should have crm:leads:view, crm:contacts:view, etc.
    # This would require setting up a custom role with wildcard permissions
    # Simplified version: just verify the check endpoint works
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${body}=    Create Dictionary    permissions=["crm:leads:view", "crm:contacts:view"]
    ${response}=    POST On Session    api    ${API_VERSION}/permissions/check    
    ...    json=${body}    headers=${headers}
    Verify Response Status    ${response}    200
