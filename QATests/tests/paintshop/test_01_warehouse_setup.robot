*** Settings ***
Documentation     ERPNext Paint Shop PoS - Warehouse and Item Setup Tests
...               Test Design Techniques:
...               - Equivalence Partitioning (valid/invalid warehouse types)
...               - Boundary Value Analysis (stock quantities)
...               - State Transition Testing (stock entry lifecycle)

Resource          ../../resources/erpnext_paintshop_keywords.robot
Suite Setup       Setup Platform Session
Suite Teardown    Delete All Sessions

*** Test Cases ***
# ==================== POSITIVE TESTS ====================

TC001_Create_Main_Warehouse_Successfully
    [Documentation]    Verify warehouse creation for paint shop
    [Tags]    positive    smoke    warehouse
    # Use unique warehouse name to avoid conflicts
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_name}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${response}=    Create Warehouse    ${unique_name}    ${WAREHOUSE_ABBR}
    Verify Response Status    ${response}    200
    ${data}=    Get Response Data    ${response}
    ${created_name}=    Get From Dictionary    ${data}    warehouse_name
    Should Be Equal    ${created_name}    ${unique_name}
    [Teardown]    Run Keyword If    '${response.status_code}' == '200'    
    ...    Cleanup Test Data    Warehouse    ${created_name}

TC002_Create_Paint_Items_Successfully
    [Documentation]    Verify paint item creation with proper attributes
    [Tags]    positive    smoke    items
    # Create Red Paint (use unique name to avoid conflicts)
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_red}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${unique_blue}=    Set Variable    ${ITEM_BLUE_PAINT}-${uuid}
    ${unique_white}=    Set Variable    ${ITEM_WHITE_PAINT}-${uuid}
    
    ${response}=    Create Item    ${unique_red}    Red Paint 5L    Nos    Products
    Verify Response Status    ${response}    200
    ${data}=    Get Response Data    ${response}
    ${item_code}=    Get From Dictionary    ${data}    item_code
    Should Be Equal    ${item_code}    ${unique_red}
    ${is_stock}=    Get From Dictionary    ${data}    is_stock_item
    Should Be Equal    ${is_stock}    ${1}
    
    # Create Blue Paint
    ${response}=    Create Item    ${unique_blue}    Blue Paint 5L    Nos    Products
    Verify Response Status    ${response}    200
    
    # Create White Paint
    ${response}=    Create Item    ${unique_white}    White Paint 10L    Nos    Products
    Verify Response Status    ${response}    200
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_red}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_blue}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_white}

TC003_Add_Initial_Stock_Successfully
    [Documentation]    Verify adding initial stock to warehouse
    [Tags]    positive    stock    warehouse
    # Prerequisites - use unique names
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    
    # Add stock - use full warehouse name from creation response
    ${response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    100    500
    Verify Response Status    ${response}    200
    
    # Submit stock entry
    ${data}=    Get Response Data    ${response}
    ${has_name}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${data}    name
    ${stock_entry_name}=    Run Keyword If    ${has_name}    Get From Dictionary    ${data}    name
    ...    ELSE    Set Variable    ${EMPTY}
    
    IF    '${stock_entry_name}' == '${EMPTY}'
        Fail    Stock Entry creation did not return a document name; cannot submit.
    END
    ${submit_response}=    Submit ERPNext Document    Stock Entry    ${stock_entry_name}
    Verify Response Status    ${submit_response}    200
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Stock Entry    ${stock_entry_name}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

TC004_Verify_Stock_Balance_Via_Bin_API
    [Documentation]    Verify stock balance query via Bin API
    [Tags]    positive    stock    bin
    # Prerequisites - use unique names
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    Verify Response Status    ${item_resp}    200
    ${stock_response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    50    500
    Verify Response Status    ${stock_response}    200
    ${stock_data}=    Get Response Data    ${stock_response}
    ${has_name}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${stock_data}    name
    ${stock_entry_name}=    Run Keyword If    ${has_name}    Get From Dictionary    ${stock_data}    name
    ...    ELSE    Set Variable    ${EMPTY}
    
    IF    '${stock_entry_name}' == '${EMPTY}'
        Fail    Stock Entry creation did not return a document name; cannot submit.
    END
    ${submit_response}=    Submit ERPNext Document    Stock Entry    ${stock_entry_name}
    Verify Response Status    ${submit_response}    200
    
    # Get stock balance - use warehouse name from response
    ${response}=    Get Stock Balance    ${unique_item}    ${warehouse_name_full}
    Verify Response Status    ${response}    200
    ${balance_data}=    Get Response Data    ${response}
    ${has_message}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${balance_data}    message
    ${balance}=    Run Keyword If    ${has_message}    Get From Dictionary    ${balance_data}    message
    ...    ELSE    Set Variable    ${balance_data}
    ${balance_num}=    Convert To Number    ${balance}
    Should Be Equal As Numbers    ${balance_num}    50
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Stock Entry    ${stock_entry_name}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

TC005_Create_Multiple_Warehouses
    [Documentation]    Verify creating multiple warehouses for different locations
    [Tags]    positive    warehouse
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${warehouse1_name}=    Set Variable    Main Paint Store - MPS ${uuid}
    ${warehouse2_name}=    Set Variable    Branch Store - BS ${uuid}
    ${response1}=    Create Warehouse    ${warehouse1_name}    MPS
    Verify Response Status    ${response1}    200
    ${data1}=    Get Response Data    ${response1}
    ${warehouse1_full}=    Get From Dictionary    ${data1}    name
    
    ${response2}=    Create Warehouse    ${warehouse2_name}    BS
    Verify Response Status    ${response2}    200
    ${data2}=    Get Response Data    ${response2}
    ${warehouse2_full}=    Get From Dictionary    ${data2}    name
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse1_full}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse2_full}

# ==================== NEGATIVE TESTS ====================

TC101_Create_Warehouse_With_Duplicate_Name
    [Documentation]    Verify duplicate warehouse name is rejected
    [Tags]    negative    validation    warehouse
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${warehouse_name}=    Set Variable    Test Warehouse ${uuid}
    ${response1}=    Create Warehouse    ${warehouse_name}    TW
    Verify Response Status    ${response1}    200
    ${data1}=    Get Response Data    ${response1}
    ${warehouse_full}=    Get From Dictionary    ${data1}    name
    
    # Try to create duplicate (same name)
    ${response2}=    Create Warehouse    ${warehouse_name}    TW
    Should Be True    ${response2.status_code} in [409, 417]
    
    [Teardown]    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_full}

TC102_Create_Item_With_Missing_Required_Fields
    [Documentation]    Verify item creation fails with missing fields
    [Tags]    negative    validation    items
    ${data}=    Create Dictionary    doctype=Item
    ${response}=    Create ERPNext Resource    Item    ${data}
    Should Be True    ${response.status_code} in [400, 417, 422]

TC103_Add_Stock_To_Non_Existent_Warehouse
    [Documentation]    Verify stock entry fails for non-existent warehouse
    [Tags]    negative    validation    stock
    Create Item    ${ITEM_RED_PAINT}    Red Paint 5L
    
    ${response}=    Create Stock Entry    ${ITEM_RED_PAINT}    Non-Existent Warehouse    100    500
    Should Be True    ${response.status_code} in [400, 404, 417]
    
    [Teardown]    Cleanup Test Data    Item    ${ITEM_RED_PAINT}

TC104_Add_Negative_Stock_Quantity
    [Documentation]    Verify negative stock quantity is rejected
    [Tags]    negative    validation    stock
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    
    ${response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    -10    500
    Should Be True    ${response.status_code} in [400, 417, 422]
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

TC105_Get_Stock_Balance_For_Non_Existent_Item
    [Documentation]    Verify stock balance query for non-existent item
    [Tags]    negative    validation    stock
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    
    ${response}=    Get Stock Balance    NON-EXISTENT-ITEM-${uuid}    ${warehouse_name_full}
    # Stock balance for non-existent item should return 0 or error
    IF    ${response.status_code} == 200
        ${balance_data}=    Get Response Data    ${response}
        ${is_dict}=    Evaluate    isinstance($balance_data, dict)
        IF    ${is_dict}
            ${has_message}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${balance_data}    message
            ${balance}=    Run Keyword If    ${has_message}    Get From Dictionary    ${balance_data}    message
            ...    ELSE    Set Variable    ${balance_data}
        ELSE
            ${balance}=    Set Variable    ${balance_data}
        END
        ${balance_num}=    Convert To Number    ${balance}
        Should Be Equal As Numbers    ${balance_num}    0
    ELSE
        Should Be True    ${response.status_code} in [400, 404, 417]
    END
    
    [Teardown]    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

# ==================== EDGE CASES ====================

TC201_Create_Warehouse_With_Very_Long_Name
    [Documentation]    Boundary Value Analysis - Test maximum warehouse name length
    [Tags]    edge    validation    warehouse
    ${long_name}=    Generate Random String    140    [LETTERS]
    ${response}=    Create Warehouse    ${long_name}    LNG
    # Should either succeed or fail with validation error
    Should Be True    ${response.status_code} in [200, 417, 422, 500]
    Run Keyword If    ${response.status_code} == 200    
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${long_name}

TC202_Add_Zero_Stock_Quantity
    [Documentation]    Boundary Value Analysis - Test zero stock quantity
    [Tags]    edge    validation    stock
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    
    ${response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    0    500
    # Should either succeed or reject
    Should Be True    ${response.status_code} in [200, 417, 422]
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

TC203_Add_Very_Large_Stock_Quantity
    [Documentation]    Boundary Value Analysis - Test maximum stock quantity
    [Tags]    edge    performance    stock
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    
    ${response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    999999    500
    # Very large quantities might fail validation, accept either success or validation error
    Should Be True    ${response.status_code} in [200, 417, 422]
    
    [Teardown]    Run Keywords
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}

TC204_Create_Item_With_Special_Characters_In_Code
    [Documentation]    Test item code with special characters
    [Tags]    edge    validation    items
    ${response}=    Create Item    PAINT-RED@5L    Red Paint Special
    # Should either succeed or fail with validation error
    Should Be True    ${response.status_code} in [200, 417, 422]
    Run Keyword If    ${response.status_code} == 200    
    ...    Cleanup Test Data    Item    PAINT-RED@5L

TC205_Query_Stock_Balance_Multiple_Times
    [Documentation]    Test concurrent stock balance queries
    [Tags]    edge    performance    stock
    ${uuid}=    Evaluate    str(uuid.uuid4())[:8]    modules=uuid
    ${unique_warehouse}=    Set Variable    ${WAREHOUSE_NAME} ${uuid}
    ${unique_item}=    Set Variable    ${ITEM_RED_PAINT}-${uuid}
    ${stock_entry_name}=    Set Variable    ${EMPTY}
    ${warehouse_resp}=    Create Warehouse    ${unique_warehouse}    ${WAREHOUSE_ABBR}
    ${warehouse_data}=    Get Response Data    ${warehouse_resp}
    ${warehouse_name_full}=    Get From Dictionary    ${warehouse_data}    name
    ${item_resp}=    Create Item    ${unique_item}    Red Paint 5L
    ${stock_response}=    Create Stock Entry    ${unique_item}    ${warehouse_name_full}    100    500
    Verify Response Status    ${stock_response}    200
    ${stock_data}=    Get Response Data    ${stock_response}
    # Stock Entry name might be in 'name' field
    ${has_name}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${stock_data}    name
    ${stock_entry_name}=    Run Keyword If    ${has_name}    Get From Dictionary    ${stock_data}    name
    ...    ELSE    Set Variable    ${EMPTY}
    IF    '${stock_entry_name}' != '${EMPTY}'
        Submit ERPNext Document    Stock Entry    ${stock_entry_name}

        FOR    ${i}    IN RANGE    5
            ${response}=    Get Stock Balance    ${unique_item}    ${warehouse_name_full}
            Verify Response Status    ${response}    200

            ${balance_data}=    Get Response Data    ${response}
            ${is_dict}=    Evaluate    isinstance($balance_data, dict)
            IF    ${is_dict}
                ${has_message}=    Run Keyword And Return Status    Dictionary Should Contain Key    ${balance_data}    message
                ${balance}=    Run Keyword If    ${has_message}    Get From Dictionary    ${balance_data}    message
                ...    ELSE    Set Variable    ${balance_data}
            ELSE
                ${balance}=    Set Variable    ${balance_data}
            END
            Should Be Equal As Numbers    ${balance}    100
        END
    END
    
    [Teardown]    Run Keywords
    ...    Run Keyword If    '${stock_entry_name}' != '${EMPTY}'    Run Keyword And Ignore Error    Cleanup Test Data    Stock Entry    ${stock_entry_name}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Item    ${unique_item}    AND
    ...    Run Keyword And Ignore Error    Cleanup Test Data    Warehouse    ${warehouse_name_full}
