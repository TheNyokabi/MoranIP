*** Settings ***
Documentation     UI Verification for New Action Dashboard
Library           Browser
Library           OperatingSystem

*** Variables ***
${BASE_URL}       %{FRONTEND_URL}
${ADMIN_EMAIL}    admin@moran.com
${ADMIN_PASS}     admin123

*** Test Cases ***
Verify Recent Dashboard Changes
    [Documentation]    Verify the new dashboard UI elements and navigation
    Should Not Be Empty    ${BASE_URL}    msg=FRONTEND_URL env var is required (e.g., http://frontend:4000 in Docker)
    New Browser    chromium    headless=True
    New Context    viewport={'width': 1280, 'height': 720}
    
    # Login
    New Page       ${BASE_URL}/login
    Wait For Elements State    css=[data-testid="login-email"]    visible    timeout=15s
    Fill Text      css=[data-testid="login-email"]       ${ADMIN_EMAIL}
    Fill Text      css=[data-testid="login-password"]    ${ADMIN_PASS}
    Click          css=[data-testid="login-submit"]
    
    Get Url        contains    /dashboard
    Wait For Elements State    css=[data-testid="workspace-search"]    visible    timeout=30s
    Wait For Elements State    css=[data-testid="workspace-card"] >> nth=0      visible    timeout=30s

    [Teardown]    Close Browser
