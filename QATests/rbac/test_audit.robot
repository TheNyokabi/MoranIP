*** Settings ***
Documentation     Comprehensive tests for Audit Log API
...               Test Design Techniques Used:
...               - Temporal Testing (date range filtering)
...               - Data-Driven Testing (various audit actions)
...               - Analytics Testing (statistics and aggregations)

Resource          ../../resources/rbac_keywords.robot
Suite Setup       Run Keywords
...               Setup Test Environment    AND
...               Setup Test Users And Tokens
Suite Teardown    Teardown Test Environment

*** Test Cases ***
# ==================== POSITIVE TESTS ====================

TC001_Get_Role_Audit_Logs
    [Documentation]    Verify authorized user can view role audit logs
    [Tags]    positive    smoke    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    # May be empty if no role changes yet
    Should Be True    isinstance(${logs}, list)

TC002_Get_Permission_Audit_Logs
    [Documentation]    Verify authorized user can view permission audit logs
    [Tags]    positive    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/permissions    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    Should Be True    isinstance(${logs}, list)

TC003_Filter_Audit_By_Action
    [Documentation]    Verify filtering audit logs by action type
    [Tags]    positive    filtering    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?action=ROLE_ASSIGNED    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    # All logs should have ROLE_ASSIGNED action
    FOR    ${log}    IN    @{logs}
        Should Be Equal    ${log}[action]    ROLE_ASSIGNED
    END

TC004_Filter_Audit_By_Date_Range
    [Documentation]    Verify filtering audit logs by date range
    [Tags]    positive    filtering    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${start_date}=    Evaluate    (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()    datetime
    ${end_date}=    Get Current Date    result_format=%Y-%m-%dT%H:%M:%S
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?start_date=${start_date}&end_date=${end_date}    
    ...    headers=${headers}
    Verify Response Status    ${response}    200

TC005_Get_Audit_Statistics
    [Documentation]    Verify getting audit statistics
    [Tags]    positive    analytics    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/stats    headers=${headers}
    Verify Response Status    ${response}    200
    ${stats}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${stats}    total_count
    Dictionary Should Contain Key    ${stats}    action_distribution
    Dictionary Should Contain Key    ${stats}    top_users

TC006_List_Audit_Actions
    [Documentation]    Verify listing all audit action types
    [Tags]    positive    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/actions    headers=${headers}
    Verify Response Status    ${response}    200
    ${actions}=    Set Variable    ${response.json()}
    Should Be True    isinstance(${actions}, list)

TC007_Audit_Log_Contains_Required_Fields
    [Documentation]    Verify audit log entries have required fields
    [Tags]    positive    validation    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?limit=1    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    Run Keyword If    ${logs}    Verify Audit Log Structure    ${logs}[0]

TC008_Pagination_In_Audit_Logs
    [Documentation]    Verify pagination works in audit logs
    [Tags]    positive    pagination    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?limit=5    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    ${count}=    Get Length    ${logs}
    Should Be True    ${count} <= 5

# ==================== NEGATIVE TESTS ====================

TC101_Get_Audit_Without_Permission
    [Documentation]    Verify user without permission cannot view audit logs
    [Tags]    negative    security    audit
    ${headers}=    Get Authorization Header    ${VIEWER_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles    
    ...    headers=${headers}    expected_status=any
    # Viewer should not have iam:audit:view permission
    Should Be True    ${response.status_code} in [403, 401]

TC102_Get_Audit_Without_Authentication
    [Documentation]    Verify unauthenticated request is rejected
    [Tags]    negative    security    audit
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles    expected_status=any
    Verify Response Status    ${response}    401

TC103_Filter_By_Invalid_Date_Format
    [Documentation]    Verify invalid date format is rejected
    [Tags]    negative    validation    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?start_date=invalid-date    
    ...    headers=${headers}    expected_status=any
    Should Be True    ${response.status_code} in [400, 422]

TC104_Filter_By_Invalid_UUID
    [Documentation]    Verify invalid UUID in filter is rejected
    [Tags]    negative    validation    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?user_id=${INVALID_UUID}    
    ...    headers=${headers}    expected_status=any
    Verify Error Response    ${response}    400    Invalid.*ID.*format

# ==================== EDGE CASES ====================

TC201_Audit_With_Future_Date_Range
    [Documentation]    Test filtering with future dates
    [Tags]    edge    validation    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${future_date}=    Evaluate    (datetime.datetime.now() + datetime.timedelta(days=30)).isoformat()    datetime
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?start_date=${future_date}    
    ...    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    # Should return empty list
    Should Be Empty    ${logs}

TC202_Audit_With_Reversed_Date_Range
    [Documentation]    Test with end_date before start_date
    [Tags]    edge    validation    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${start_date}=    Get Current Date    result_format=%Y-%m-%dT%H:%M:%S
    ${end_date}=    Evaluate    (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()    datetime
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?start_date=${start_date}&end_date=${end_date}    
    ...    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    # Should return empty or handle gracefully
    Should Be True    isinstance(${logs}, list)

TC203_Large_Pagination_Limit
    [Documentation]    Test with maximum pagination limit
    [Tags]    edge    pagination    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?limit=500    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    ${count}=    Get Length    ${logs}
    Should Be True    ${count} <= 500

TC204_Audit_Statistics_With_Date_Range
    [Documentation]    Test statistics with specific date range
    [Tags]    edge    analytics    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${start_date}=    Evaluate    (datetime.datetime.now() - datetime.timedelta(days=30)).isoformat()    datetime
    ${response}=    GET On Session    api    ${API_VERSION}/audit/stats?start_date=${start_date}    
    ...    headers=${headers}
    Verify Response Status    ${response}    200
    ${stats}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${stats}    date_range

TC205_Filter_By_Multiple_Criteria
    [Documentation]    Test combining multiple filters
    [Tags]    edge    filtering    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${start_date}=    Evaluate    (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()    datetime
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?action=ROLE_ASSIGNED&start_date=${start_date}&limit=10    
    ...    headers=${headers}
    Verify Response Status    ${response}    200

TC206_Audit_Log_Ordering
    [Documentation]    Verify audit logs are ordered by date (newest first)
    [Tags]    edge    ordering    audit
    ${headers}=    Get Authorization Header    ${ADMIN_TOKEN}
    ${response}=    GET On Session    api    ${API_VERSION}/audit/roles?limit=10    headers=${headers}
    Verify Response Status    ${response}    200
    ${logs}=    Set Variable    ${response.json()}
    Run Keyword If    len(${logs}) > 1    Verify Logs Are Ordered    ${logs}

*** Keywords ***
Verify Audit Log Structure
    [Arguments]    ${log}
    [Documentation]    Verify audit log has required fields
    Dictionary Should Contain Key    ${log}    id
    Dictionary Should Contain Key    ${log}    action
    Dictionary Should Contain Key    ${log}    created_at
    Dictionary Should Contain Key    ${log}    tenant_id

Verify Logs Are Ordered
    [Arguments]    ${logs}
    [Documentation]    Verify logs are in descending order by created_at
    ${first_date}=    Set Variable    ${logs}[0][created_at]
    ${second_date}=    Set Variable    ${logs}[1][created_at]
    # First should be more recent than second
    Should Be True    '${first_date}' >= '${second_date}'
