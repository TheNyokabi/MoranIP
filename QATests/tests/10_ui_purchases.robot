*** Settings ***
Documentation     Frontend UI Tests - Purchase Management
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

Navigate To Suppliers Page
    Click    text=Purchases
    Click    text=Suppliers
    Wait For Elements State    h1:has-text("Suppliers")    visible

Navigate To Orders Page
    Click    text=Purchases
    Click    text=Orders
    Wait For Elements State    h1:has-text("Purchase Orders")    visible

*** Test Cases ***
TC001_Verify Suppliers Page Loads
    [Documentation]    Verify suppliers list page loads successfully
    [Tags]    ui    purchases    smoke
    
    Navigate To Suppliers Page
    
    # Verify page elements
    Get Element    h1:has-text("Suppliers")
    Get Element    button:has-text("New Supplier")
    Get Element    input[placeholder*="Search"]
    Get Element    table

TC002_Create New Supplier
    [Documentation]    Test creating a new supplier through UI
    [Tags]    ui    purchases    crud
    
    Navigate To Suppliers Page
    Click    button:has-text("New Supplier")
    
    # Wait for form
    Wait For Elements State    h1:has-text("New Supplier")    visible
    
    # Fill form
    ${timestamp}=    Get Time    epoch
    Fill Text    input[id="name"]              Supplier UI ${timestamp}
    Fill Text    input[id="supplier_group"]    Raw Material
    Fill Text    input[id="country"]           Kenya
    Fill Text    input[id="currency"]          KES
    Fill Text    input[id="tax_id"]            P05${timestamp}
    
    # Submit
    Click    button:has-text("Create Supplier")
    
    # Verify redirect
    Wait For Elements State    h1:has-text("Suppliers")    visible    timeout=5s
    
    # Verify supplier appears
    Get Text    table >> text=Supplier UI ${timestamp}

TC003_Search Suppliers
    [Documentation]    Test supplier search functionality
    [Tags]    ui    purchases    search
    
    Navigate To Suppliers Page
    
    # Search
    Fill Text    input[placeholder*="Search"]    Supplier UI
    
    # Verify results
    ${rows}=    Get Element Count    table tbody tr
    Should Be True    ${rows} > 0

TC004_Verify Purchase Orders Page
    [Documentation]    Verify purchase orders page loads
    [Tags]    ui    purchases    smoke
    
    Navigate To Orders Page
    
    # Verify page elements
    Get Element    h1:has-text("Purchase Orders")
    Get Element    button:has-text("New Purchase Order")
    Get Element    table

TC005_View Purchase Order Details
    [Documentation]    Test viewing order details
    [Tags]    ui    purchases    view
    
    Navigate To Orders Page
    
    # Click on first order (if exists)
    ${count}=    Get Element Count    table tbody tr
    Run Keyword If    ${count} > 0    Click    table tbody tr:first-child
    Run Keyword If    ${count} > 0    Wait For Elements State    text=Order ID    visible

TC006_Filter Purchase Orders
    [Documentation]    Test filtering purchase orders
    [Tags]    ui    purchases    filter
    
    Navigate To Orders Page
    
    # Use search/filter
    Fill Text    input[placeholder*="Search"]    PO
    
    # Verify table updates
    Wait For Elements State    table    visible

TC007_Verify Status Badges
    [Documentation]    Verify status badges display correctly
    [Tags]    ui    purchases    ux
    
    Navigate To Orders Page
    
    # Check for status badges
    ${badges}=    Get Element Count    span:has-text("Draft"), span:has-text("Submitted"), span:has-text("Cancelled")
    Log    Found ${badges} status badges

TC008_Verify Responsive Design
    [Documentation]    Test responsive design on different viewports
    [Tags]    ui    responsive
    
    # Desktop
    Set Viewport Size    1920    1080
    Navigate To Suppliers Page
    Get Element    table
    
    # Tablet
    Set Viewport Size    768    1024
    Get Element    h1:has-text("Suppliers")
    
    # Mobile
    Set Viewport Size    375    667
    Get Element    h1:has-text("Suppliers")

TC009_Verify Form Validation
    [Documentation]    Test form validation
    [Tags]    ui    validation
    
    Navigate To Suppliers Page
    Click    button:has-text("New Supplier")
    
    # Try to submit without required fields
    Click    button:has-text("Create Supplier")
    
    # Should show validation errors
    Get Element    input[required]:invalid

TC010_Verify Cancel Button
    [Documentation]    Test cancel button functionality
    [Tags]    ui    navigation
    
    Navigate To Suppliers Page
    Click    button:has-text("New Supplier")
    
    # Click cancel
    Click    button:has-text("Cancel")
    
    # Should return to list
    Wait For Elements State    h1:has-text("Suppliers")    visible
