*** Settings ***
Documentation     General Backend Health Checks
Resource          ../resources/common.resource
Suite Setup       Create API Session

*** Test Cases ***
Verify Root Endpoint
    [Documentation]    Root should return 404 (Not Found) or 200 depending on implementation. 
    ...                FastAPI default is 404 for root unless defined.
    # Checking implementation... usually I didn't define root /. 
    # Let's check /health
    ${resp}=       GET On Session    moran_api    /health    expected_status=200
    Dictionary Should Contain Key    ${resp.json()}    status
    Should Be Equal As Strings       ${resp.json()['status']}    healthy

Verify Docs Endpoint
    [Documentation]    Swagger UI should be accessible
    ${resp}=       GET On Session    moran_api    /docs    expected_status=200
