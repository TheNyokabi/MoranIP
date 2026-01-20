#!/usr/bin/env python3
"""
Generate Robot Framework tests from successful API tests
Usage: python generate_robot_test.py --endpoint <endpoint> --method <method> --name <test_name>
"""

import argparse
import json
from pathlib import Path
from datetime import datetime

ROBOT_TEMPLATE = '''*** Settings ***
Documentation    {documentation}
Resource         ../../resources/common.resource
Library          RequestsLibrary
Library          Collections
Library          String

Suite Setup      Create Session    api    ${{BASE_URL}}
Suite Teardown   Delete All Sessions

*** Variables ***
${{BASE_URL}}         http://localhost:9000
${{TEST_EMAIL}}       admin@moranerp.com
${{TEST_PASSWORD}}    admin123
${{TEST_TENANT}}      TEN-KE-26-Z11N5

*** Test Cases ***
{test_name}
    [Tags]    {tags}
    [Documentation]    {test_documentation}
    
    # Get authentication token
    ${{auth_response}}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json={{"email": "${{TEST_EMAIL}}", "password": "${{TEST_PASSWORD}}", "tenant_id": "${{TEST_TENANT}}"}}
    ...    expected_status=200
    ${{token}}=    Get From Dictionary    ${{auth_response.json()}}    access_token
    
    # Execute test
    ${{headers}}=    Create Dictionary    Authorization=Bearer ${{token}}
    ${{response}}=    {method} On Session    api    {endpoint}
    ...    headers=${{headers}}
{request_body}    ...    expected_status={expected_status}
    
    # Verify response
    {assertions}
    
{db_verification}

*** Keywords ***
Get Auth Token
    ${{response}}=    POST On Session    api    /auth/v1/login-with-tenant
    ...    json={{"email": "${{TEST_EMAIL}}", "password": "${{TEST_PASSWORD}}", "tenant_id": "${{TEST_TENANT}}"}}
    ${{token}}=    Get From Dictionary    ${{response.json()}}    access_token
    [Return]    ${{token}}
'''

def generate_test(endpoint, method, test_name, category, request_data=None, expected_status=200, 
                  assertions=None, db_verification=None):
    """Generate Robot Framework test file"""
    
    # Determine tags based on category and endpoint
    tags = ['smoke', 'auto-generated', category]
    if 'auth' in endpoint.lower():
        tags.append('authentication')
    if method in ['POST', 'PUT', 'DELETE']:
        tags.append('write-operation')
    
    # Format tags
    tags_str = '    '.join(tags)
    
    # Build request body if provided
    request_body_str = ''
    if request_data:
        request_body_str = f'    ...    json={json.dumps(request_data)}\n'
    
    # Build assertions
    assertions_str = 'Should Be Equal As Numbers    ${response.status_code}    ' + str(expected_status)
    if assertions:
        assertions_str = '\n    '.join(assertions)
    
    # Build database verification
    db_verification_str = ''
    if db_verification:
        db_verification_str = f'\n*** Keywords ***\n{db_verification}'
    
    # Fill template
    test_content = ROBOT_TEMPLATE.format(
        documentation=f'Auto-generated test for {endpoint}',
        test_name=test_name.replace(' ', ' '),
        tags=tags_str,
        test_documentation=f'Test {method} {endpoint}',
        method=method,
        endpoint=endpoint,
        request_body=request_body_str,
        expected_status=expected_status,
        assertions=assertions_str,
        db_verification=db_verification_str
    )
    
    return test_content

def save_test_file(content, category, filename):
    """Save generated test to appropriate directory"""
    base_dir = Path(__file__).parent.parent / 'QATests' / 'auto_generated'
    category_dir = base_dir / category
    category_dir.mkdir(parents=True, exist_ok=True)
    
    filepath = category_dir / filename
    filepath.write_text(content)
    print(f"✅ Generated test: {filepath}")
    return filepath

def main():
    parser = argparse.ArgumentParser(description='Generate Robot Framework tests')
    parser.add_argument('--endpoint', required=True, help='API endpoint')
    parser.add_argument('--method', required=True, choices=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    parser.add_argument('--name', required=True, help='Test name')
    parser.add_argument('--category', required=True, help='Test category (auth, iam, erpnext, etc)')
    parser.add_argument('--data', help='Request data as JSON string')
    parser.add_argument('--status', type=int, default=200, help='Expected status code')
    
    args = parser.parse_args()
    
    request_data = json.loads(args.data) if args.data else None
    
    # Generate test content
    content = generate_test(
        endpoint=args.endpoint,
        method=args.method,
        test_name=args.name,
        category=args.category,
        request_data=request_data,
        expected_status=args.status
    )
    
    # Save to file
    filename = f"test_{args.name.lower().replace(' ', '_')}.robot"
    save_test_file(content, args.category, filename)

if __name__ == '__main__':
    main()
