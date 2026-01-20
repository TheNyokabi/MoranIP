*** Settings ***
Documentation     Frontend UI Tests - Inventory Management
Library           Browser
Library           OperatingSystem
Library           DateTime
Force Tags        legacy
Suite Setup       Open Browser And Login
Suite Teardown    Close Browser

*** Variables ***
${FRONTEND_URL}    http://localhost:3000
${EMAIL}           admin@test.com
${PASSWORD}        testpass123

*** Keywords ***
Open Browser And Login
    ${run_legacy}=    Get Environment Variable    RUN_LEGACY_UI    false
    Run Keyword If    '${run_legacy}' != 'true'
    ...    Skip    Skipping legacy UI suite (set RUN_LEGACY_UI=true to enable).

    ${base}=    Get Environment Variable    FRONTEND_URL    ${FRONTEND_URL}
    Set Suite Variable    ${FRONTEND_URL}    ${base}

    New Browser    chromium    headless=True
    New Context    viewport={'width': 1920, 'height': 1080}
    New Page       ${FRONTEND_URL}/auth/login
    
    # Login
    Fill Text      input[type="email"]       ${EMAIL}
    Fill Text      input[type="password"]    ${PASSWORD}
    Click          button:has-text("Login")
    
    # Wait for dashboard
    Wait For Elements State    text=Dashboard    visible    timeout=10s

Navigate To Items Page
    Click    text=Inventory
    Click    text=Items
    Wait For Elements State    h1:has-text("Items")    visible

Navigate To Warehouses Page
    Click    text=Inventory
    Click    text=Warehouses
    Wait For Elements State    h1:has-text("Warehouses")    visible

*** Test Cases ***
TC001_Verify Items Page Loads
    [Documentation]    Verify items list page loads successfully
    [Tags]    ui    inventory    smoke
    
    Navigate To Items Page
    
    # Verify page elements
    Get Element    h1:has-text("Items")
    Get Element    button:has-text("New Item")
    Get Element    input[placeholder*="Search"]
    Get Element    table

TC002_Create New Item
    [Documentation]    Test creating a new item through UI
    [Tags]    ui    inventory    crud
    
    Navigate To Items Page
    Click    button:has-text("New Item")
    
    # Wait for form
    Wait For Elements State    h1:has-text("New Item")    visible
    
    # Fill form
    ${timestamp}=    Get Time    epoch
    Fill Text    input[id="item_code"]        ITEM-UI-${timestamp}
    Fill Text    input[id="item_name"]        UI Test Item ${timestamp}
    Fill Text    input[id="item_group"]       Products
    Fill Text    input[id="stock_uom"]        Nos
    Fill Text    input[id="standard_rate"]    99.99
    Fill Text    textarea[id="description"]   Created via UI test
    
    # Submit
    Click    button:has-text("Create Item")
    
    # Verify redirect to items list
    Wait For Elements State    h1:has-text("Items")    visible    timeout=5s
    
    # Verify item appears in list
    Get Text    table >> text=ITEM-UI-${timestamp}

TC003_Search Items
    [Documentation]    Test search functionality
    [Tags]    ui    inventory    search
    
    Navigate To Items Page
    
    # Search for item
    Fill Text    input[placeholder*="Search"]    UI Test
    
    # Verify filtered results
    ${rows}=    Get Element Count    table tbody tr
    Should Be True    ${rows} > 0

TC004_View Item Details
    [Documentation]    Test viewing item details
    [Tags]    ui    inventory    view
    
    Navigate To Items Page
    
    # Click on first item
    Click    table tbody tr:first-child
    
    # Verify detail page
    Wait For Elements State    text=Item Name    visible
    Get Element    button:has-text("Edit")
    Get Element    button:has-text("Delete")

TC005_Edit Item
    [Documentation]    Test editing an item
    [Tags]    ui    inventory    crud
    
    Navigate To Items Page
    Click    table tbody tr:first-child
    
    # Enter edit mode
    Click    button:has-text("Edit")
    
    # Modify field
    Fill Text    input[value*=""]    Updated via UI test
    
    # Save
    Click    button:has-text("Save")
    
    # Verify success
    Wait For Elements State    button:has-text("Edit")    visible

TC006_Verify Warehouses Page Loads
    [Documentation]    Verify warehouses list page loads
    [Tags]    ui    inventory    smoke
    
    Navigate To Warehouses Page
    
    # Verify page elements
    Get Element    h1:has-text("Warehouses")
    Get Element    button:has-text("New Warehouse")
    Get Element    input[placeholder*="Search"]

TC007_Create New Warehouse
    [Documentation]    Test creating a warehouse through UI
    [Tags]    ui    inventory    crud
    
    Navigate To Warehouses Page
    Click    button:has-text("New Warehouse")
    
    # Fill form
    ${timestamp}=    Get Time    epoch
    Fill Text    input[id="warehouse_name"]    WH-UI-${timestamp}
    Fill Text    input[id="company"]           Test Company
    Fill Text    input[id="warehouse_type"]    Transit
    
    # Submit
    Click    button:has-text("Create Warehouse")
    
    # Verify redirect
    Wait For Elements State    h1:has-text("Warehouses")    visible

TC008_Verify Loading States
    [Documentation]    Verify loading states display correctly
    [Tags]    ui    ux
    
    Navigate To Items Page
    
    # Should show loading initially (if slow)
    # Then show content
    Wait For Elements State    table    visible    timeout=10s

TC009_Verify Error Handling
    [Documentation]    Test error handling for invalid data
    [Tags]    ui    error
    
    Navigate To Items Page
    Click    button:has-text("New Item")
    
    # Try to submit empty form
    Click    button:has-text("Create Item")
    
    # Form validation should prevent submission
    # (HTML5 required fields)
    Get Element    input[required]:invalid

TC010_Verify Navigation
    [Documentation]    Test navigation between pages
    [Tags]    ui    navigation
    
    Navigate To Items Page
    Get Element    h1:has-text("Items")
    
    Navigate To Warehouses Page
    Get Element    h1:has-text("Warehouses")
    
    # Navigate back
    Go Back
    Get Element    h1:has-text("Items")
