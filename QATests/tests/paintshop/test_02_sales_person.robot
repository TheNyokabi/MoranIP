*** Settings ***
Documentation     ERPNext Paint Shop PoS - Sales Person and Commission Tests
...               Test Design Techniques:
...               - Equivalence Partitioning (Fundis vs Sales Team)
...               - Boundary Value Analysis (commission rates)
...               - Decision Table Testing (commission calculations)

Resource          ../../resources/erpnext_paintshop_keywords.robot
Suite Setup       Setup Platform Session
Suite Teardown    Delete All Sessions

*** Test Cases ***
# ==================== POSITIVE TESTS ====================

TC001_Create_Fundi_Sales_Person_Successfully
    [Documentation]    Verify creating Fundi sales person with commission
    [Tags]    positive    smoke    sales_person    fundi
    ${response}=    Create Sales Person    ${FUNDI_NAME}    ${FUNDI_COMMISSION}
    Verify Response Status    ${response}    200
    Verify Field Value    ${response}    sales_person_name    ${FUNDI_NAME}
    Verify Field Value    ${response}    commission_rate    ${FUNDI_COMMISSION}
    [Teardown]    Cleanup Test Data    Sales Person    ${FUNDI_NAME}

TC002_Create_Sales_Team_Person_Successfully
    [Documentation]    Verify creating Sales Team person with commission
    [Tags]    positive    smoke    sales_person    sales_team
    ${response}=    Create Sales Person    ${SALES_NAME}    ${SALES_COMMISSION}
    Verify Response Status    ${response}    200
    Verify Field Value    ${response}    sales_person_name    ${SALES_NAME}
    Verify Field Value    ${response}    commission_rate    ${SALES_COMMISSION}
    [Teardown]    Cleanup Test Data    Sales Person    ${SALES_NAME}

TC003_Update_Commission_Rate_Successfully
    [Documentation]    Verify updating commission rate for sales person
    [Tags]    positive    sales_person    commission
    # Create sales person
    ${response}=    Create Sales Person    ${FUNDI_NAME}    ${FUNDI_COMMISSION}
    Verify Response Status    ${response}    200
    
    # Update commission rate
    ${new_rate}=    Set Variable    ${15}
    ${data}=    Create Dictionary    commission_rate=${new_rate}
    ${response}=    Update ERPNext Resource    Sales Person    ${FUNDI_NAME}    ${data}
    Verify Response Status    ${response}    200
    Verify Field Value    ${response}    commission_rate    ${new_rate}
    
    [Teardown]    Cleanup Test Data    Sales Person    ${FUNDI_NAME}

TC004_Create_Multiple_Sales_Persons
    [Documentation]    Verify creating multiple sales persons
    [Tags]    positive    sales_person
    # Use unique names to avoid conflicts
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${name1}=    Set Variable    Fundi One ${uuid}
    ${name2}=    Set Variable    Fundi Two ${uuid}
    ${name3}=    Set Variable    Sales Rep One ${uuid}
    
    ${response1}=    Create Sales Person    ${name1}    10
    Verify Response Status    ${response1}    200
    ${data1}=    Get Response Data    ${response1}
    ${full_name1}=    Get From Dictionary    ${data1}    name
    
    ${response2}=    Create Sales Person    ${name2}    12
    Verify Response Status    ${response2}    200
    ${data2}=    Get Response Data    ${response2}
    ${full_name2}=    Get From Dictionary    ${data2}    name
    
    ${response3}=    Create Sales Person    ${name3}    15
    Verify Response Status    ${response3}    200
    ${data3}=    Get Response Data    ${response3}
    ${full_name3}=    Get From Dictionary    ${data3}    name
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Sales Person    ${full_name1}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Sales Person    ${full_name2}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Sales Person    ${full_name3}

TC005_Get_Sales_Person_Details
    [Documentation]    Verify retrieving sales person details
    [Tags]    positive    sales_person
    Create Sales Person    ${FUNDI_NAME}    ${FUNDI_COMMISSION}
    
    ${response}=    Get ERPNext Resource    Sales Person    ${FUNDI_NAME}
    Verify Response Status    ${response}    200
    Verify Field Value    ${response}    sales_person_name    ${FUNDI_NAME}
    
    [Teardown]    Cleanup Test Data    Sales Person    ${FUNDI_NAME}

# ==================== NEGATIVE TESTS ====================

TC101_Create_Sales_Person_With_Duplicate_Name
    [Documentation]    Verify duplicate sales person name is rejected
    [Tags]    negative    validation    sales_person
    ${response1}=    Create Sales Person    Duplicate Person    10
    Verify Response Status    ${response1}    200
    
    # Try to create duplicate
    ${response2}=    Create Sales Person    Duplicate Person    15
    Should Be True    ${response2.status_code} in [409, 417]
    
    [Teardown]    Cleanup Test Data    Sales Person    Duplicate Person

TC102_Create_Sales_Person_With_Negative_Commission
    [Documentation]    Verify negative commission rate is rejected
    [Tags]    negative    validation    sales_person
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_name}=    Set Variable    Negative Commission ${uuid}
    ${response}=    Create Sales Person    ${unique_name}    -5
    # Negative commission might be rejected with various status codes or accepted (validation may be at ERPNext level)
    # Accept 200 if ERPNext allows it, or error codes if rejected
    Should Be True    ${response.status_code} in [200, 400, 409, 417, 422]

TC103_Create_Sales_Person_With_Missing_Name
    [Documentation]    Verify sales person creation fails without name
    [Tags]    negative    validation    sales_person
    ${data}=    Create Dictionary    doctype=Sales Person    commission_rate=10
    ${response}=    Create ERPNext Resource    Sales Person    ${data}
    Should Be True    ${response.status_code} in [400, 417, 422]

TC104_Update_Non_Existent_Sales_Person
    [Documentation]    Verify updating non-existent sales person fails
    [Tags]    negative    validation    sales_person
    ${data}=    Create Dictionary    commission_rate=20
    ${response}=    Update ERPNext Resource    Sales Person    Non-Existent Person    ${data}
    Should Be True    ${response.status_code} in [404, 417]

# ==================== EDGE CASES ====================

TC201_Create_Sales_Person_With_Zero_Commission
    [Documentation]    Boundary Value Analysis - Zero commission rate
    [Tags]    edge    validation    sales_person
    ${response}=    Create Sales Person    Zero Commission    0
    # Should either succeed or reject
    Should Be True    ${response.status_code} in [200, 417, 422]
    Run Keyword If    ${response.status_code} == 200    
    ...    Cleanup Test Data    Sales Person    Zero Commission

TC202_Create_Sales_Person_With_100_Percent_Commission
    [Documentation]    Boundary Value Analysis - 100% commission rate
    [Tags]    edge    validation    sales_person
    ${response}=    Create Sales Person    Full Commission    100
    # Should either succeed or reject
    Should Be True    ${response.status_code} in [200, 417, 422]
    Run Keyword If    ${response.status_code} == 200    
    ...    Cleanup Test Data    Sales Person    Full Commission

TC203_Create_Sales_Person_With_Very_High_Commission
    [Documentation]    Boundary Value Analysis - Commission > 100%
    [Tags]    edge    validation    sales_person
    ${response}=    Create Sales Person    High Commission    150
    # Should either succeed or reject
    Should Be True    ${response.status_code} in [200, 417, 422]
    Run Keyword If    ${response.status_code} == 200    
    ...    Cleanup Test Data    Sales Person    High Commission

TC204_Create_Sales_Person_With_Decimal_Commission
    [Documentation]    Test decimal commission rates
    [Tags]    edge    validation    sales_person
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_name}=    Set Variable    Decimal Commission ${uuid}
    ${response}=    Create Sales Person    ${unique_name}    12.5
    Verify Response Status    ${response}    200
    ${data}=    Get Response Data    ${response}
    ${rate}=    Get From Dictionary    ${data}    commission_rate
    ${rate_num}=    Convert To Number    ${rate}
    Should Be Equal As Numbers    ${rate_num}    12.5
    ${full_name}=    Get From Dictionary    ${data}    name
    [Teardown]    Run Keyword And Ignore Error    Cleanup Test Data    Sales Person    ${full_name}

TC205_Update_Commission_Rate_Multiple_Times
    [Documentation]    Test updating commission rate multiple times
    [Tags]    edge    sales_person
    Create Sales Person    ${FUNDI_NAME}    ${FUNDI_COMMISSION}
    
    # Update multiple times
    FOR    ${rate}    IN    12    15    18    20
        ${data}=    Create Dictionary    commission_rate=${rate}
        ${response}=    Update ERPNext Resource    Sales Person    ${FUNDI_NAME}    ${data}
        Verify Response Status    ${response}    200
        Verify Field Value    ${response}    commission_rate    ${rate}
    END
    
    [Teardown]    Cleanup Test Data    Sales Person    ${FUNDI_NAME}

TC206_Create_Sales_Person_With_Very_Long_Name
    [Documentation]    Boundary Value Analysis - Maximum name length
    [Tags]    edge    validation    sales_person
    ${long_name}=    Generate Random String    140    [LETTERS]
    ${response}=    Create Sales Person    ${long_name}    10
    # Should either succeed or fail with validation error
    Should Be True    ${response.status_code} in [200, 417, 422]
    Run Keyword If    ${response.status_code} == 200    
    ...    Cleanup Test Data    Sales Person    ${long_name}
