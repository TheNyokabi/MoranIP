*** Settings ***
Documentation     Enterprise Case Study - HR Payroll Workflow
...               Complete monthly payroll processing with attendance and statutory deductions
Resource          ../../resources/enterprise_keywords.robot
Suite Setup       Setup Enterprise Test Environment
Suite Teardown    Cleanup Test Data

*** Variables ***
${EMPLOYEE_JOHN}     John Doe
${EMPLOYEE_JANE}     Jane Smith
${DEPARTMENT_MFG}    Manufacturing
${DEPARTMENT_SALES}  Sales & Marketing

*** Test Cases ***

TC001_Import_Attendance_Records
    [Documentation]    Import monthly attendance data
    [Tags]    hr    positive    smoke
    ${attendance_data}=    Create List
    # Create attendance for 20 working days
    FOR    ${day}    IN RANGE    1    21
        ${att_record_john}=    Create Dictionary
        ...    employee=${EMPLOYEE_JOHN}
        ...    attendance_date=2024-01-${day}
        ...    status=Present
        ...    working_hours=8
        Append To List    ${attendance_data}    ${att_record_john}
        
        ${att_record_jane}=    Create Dictionary
        ...    employee=${EMPLOYEE_JANE}
        ...    attendance_date=2024-01-${day}
        ...    status=Present
        ...    working_hours=8
        Append To List    ${attendance_data}    ${att_record_jane}
    END
    
    # Add leave for John (3 days)
    ${leave_record}=    Create Dictionary
    ...    employee=${EMPLOYEE_JOHN}
    ...    attendance_date=2024-01-22
    ...    status=On Leave
    ...    leave_type=Annual Leave
    Append To List    ${attendance_data}    ${leave_record}
    
    ${response}=    Import Attendance Records    ${attendance_data}
    Verify Response Status    ${response}    200
    Log    Attendance records imported successfully

TC002_Process_Leave_Applications
    [Documentation]    Process and approve leave applications
    [Tags]    hr    positive
    ${leave_app}=    Create Dictionary
    ...    employee=${EMPLOYEE_JOHN}
    ...    leave_type=Annual Leave
    ...    from_date=2024-01-22
    ...    to_date=2024-01-24
    ...    reason=Personal
    
    ${response}=    Create Leave Application    ${leave_app}
    Verify Response Status    ${response}    200
    
    # Approve leave
    ${approve_response}=    Approve Leave Application    ${leave_app}[leave_application_name]
    Verify Response Status    ${approve_response}    200
    
    # Verify leave balance updated
    ${balance}=    Get Leave Balance    ${EMPLOYEE_JOHN}    Annual Leave
    Should Be True    ${balance} < 21    # Assuming 21 days annual leave, 3 used

TC003_Calculate_Overtime
    [Documentation]    Calculate and approve overtime hours
    [Tags]    hr    positive
    ${overtime_data}=    Create Dictionary
    ...    employee=${EMPLOYEE_JOHN}
    ...    overtime_date=2024-01-15
    ...    hours=2
    ...    rate=1500
    
    ${response}=    Record Overtime    ${overtime_data}
    Verify Response Status    ${response}    200
    
    # Approve overtime
    ${approve_response}=    Approve Overtime    ${overtime_data}[overtime_entry_name]
    Verify Response Status    ${approve_response}    200
    
    ${overtime_pay}=    Calculate Overtime Pay    ${EMPLOYEE_JOHN}    2024-01
    Should Be Equal    ${overtime_pay}    3000.0    # 2 hours * 1500

TC004_Process_Monthly_Payroll
    [Documentation]    Process payroll for all employees
    [Tags]    hr    accounting    positive    smoke
    ${payroll_data}=    Create Dictionary
    ...    payroll_period=2024-01
    ...    start_date=2024-01-01
    ...    end_date=2024-01-31
    
    ${response}=    Process Payroll    ${payroll_data}
    Verify Response Status    ${response}    200
    ${payroll_name}=    Get Response Data    ${response}
    
    # Verify payroll calculations
    ${payroll_details}=    Get Payroll Details    ${payroll_name}
    ${total_employees}=    Get Length    ${payroll_details}[employees]
    Should Be True    ${total_employees} >= 2
    
    # Verify John's payslip
    ${john_payslip}=    Get Employee Payslip    ${payroll_name}    ${EMPLOYEE_JOHN}
    ${net_pay}=    Get From Dictionary    ${john_payslip}    net_pay
    Should Be True    ${net_pay} > 0
    
    [Teardown]    Set Suite Variable    ${PAYROLL_NAME}    ${payroll_name}

TC005_Create_Payroll_Journal_Entry
    [Documentation]    Create accounting journal entry for payroll
    [Tags]    hr    accounting    positive
    ${je_data}=    Create Dictionary
    ...    payroll_entry=${PAYROLL_NAME}
    ...    entry_type=Payroll Entry
    ...    posting_date=2024-01-31
    
    ${response}=    Create Payroll Journal Entry    ${je_data}
    Verify Response Status    ${response}    200
    ${je_name}=    Get Response Data    ${response}
    
    # Verify GL entries created
    ${gl_entries}=    Get GL Entries For Journal Entry    ${je_name}
    Should Not Be Empty    ${gl_entries}
    
    # Verify debit (Expense) = credit (Payables + Bank)
    ${debit_total}=    Calculate GL Debit Total    ${gl_entries}
    ${credit_total}=    Calculate GL Credit Total    ${gl_entries}
    Should Be Equal    ${debit_total}    ${credit_total}
    [Teardown]    Set Suite Variable    ${JOURNAL_ENTRY}    ${je_name}

TC006_Process_Salary_Payments
    [Documentation]    Process bank transfer for salaries
    [Tags]    accounting    positive
    ${payment_data}=    Create Dictionary
    ...    journal_entry=${JOURNAL_ENTRY}
    ...    payment_mode=Bank Transfer
    ...    account=Main Bank Account
    ...    reference=SAL-2024-01
    
    ${response}=    Process Salary Payments    ${payment_data}
    Verify Response Status    ${response}    200
    
    # Verify payments processed
    ${payments}=    Get Payment Entries For Payroll    ${PAYROLL_NAME}
    Should Not Be Empty    ${payments}

TC007_Remit_Statutory_Deductions
    [Documentation]    Process payments for NSSF, NHIF, PAYE
    [Tags]    accounting    compliance    positive
    ${statutory_data}=    Create Dictionary
    ...    payroll_entry=${PAYROLL_NAME}
    ...    nssf_amount=${NSSF_TOTAL}
    ...    nhif_amount=${NHIF_TOTAL}
    ...    paye_amount=${PAYE_TOTAL}
    
    ${response}=    Remit Statutory Deductions    ${statutory_data}
    Verify Response Status    ${response}    200
    
    Log    Statutory deductions remitted: NSSF=${NSSF_TOTAL}, NHIF=${NHIF_TOTAL}, PAYE=${PAYE_TOTAL}

TC008_Generate_Payroll_Reports
    [Documentation]    Generate payroll register and compliance reports
    [Tags]    hr    reporting    positive
    ${register}=    Get Payroll Register    ${PAYROLL_NAME}
    Should Not Be Empty    ${register}
    
    ${compliance}=    Get Statutory Compliance Report    2024-01
    Should Contain    ${compliance}    NSSF
    Should Contain    ${compliance}    NHIF
    Should Contain    ${compliance}    PAYE
    
    ${dept_cost}=    Get Department Cost Analysis    2024-01
    Should Not Be Empty    ${dept_cost}

*** Keywords ***
Import Attendance Records
    [Documentation]    Import attendance records
    [Arguments]    ${attendance_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/attendance/import
    ...    headers=${HEADERS}    json=${attendance_data}
    [Return]    ${response}

Create Leave Application
    [Arguments]    ${leave_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/leave-applications
    ...    headers=${HEADERS}    json=${leave_data}
    [Return]    ${response}

Approve Leave Application
    [Arguments]    ${leave_app_name}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/leave-applications/${leave_app_name}/approve
    ...    headers=${HEADERS}
    [Return]    ${response}

Get Leave Balance
    [Arguments]    ${employee}    ${leave_type}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/employees/${employee}/leave-balance?leave_type=${leave_type}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    ${balance}=    Get From Dictionary    ${data}    balance
    [Return]    ${balance}

Record Overtime
    [Arguments]    ${overtime_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/overtime
    ...    headers=${HEADERS}    json=${overtime_data}
    [Return]    ${response}

Approve Overtime
    [Arguments]    ${overtime_name}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/overtime/${overtime_name}/approve
    ...    headers=${HEADERS}
    [Return]    ${response}

Calculate Overtime Pay
    [Arguments]    ${employee}    ${month}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/employees/${employee}/overtime-pay?month=${month}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    ${total}=    Get From Dictionary    ${data}    total_overtime_pay
    [Return]    ${total}

Process Payroll
    [Arguments]    ${payroll_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/process
    ...    headers=${HEADERS}    json=${payroll_data}
    [Return]    ${response}

Get Payroll Details
    [Arguments]    ${payroll_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/${payroll_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Employee Payslip
    [Arguments]    ${payroll_name}    ${employee}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/${payroll_name}/payslip/${employee}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Create Payroll Journal Entry
    [Arguments]    ${je_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/journal-entries
    ...    headers=${HEADERS}    json=${je_data}
    [Return]    ${response}

Get GL Entries For Journal Entry
    [Arguments]    ${je_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/gl-entries?voucher_no=${je_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Process Salary Payments
    [Arguments]    ${payment_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/payment-entries
    ...    headers=${HEADERS}    json=${payment_data}
    [Return]    ${response}

Get Payment Entries For Payroll
    [Arguments]    ${payroll_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/payment-entries?linked_to=${payroll_name}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Remit Statutory Deductions
    [Arguments]    ${statutory_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/accounting/statutory-payments
    ...    headers=${HEADERS}    json=${statutory_data}
    [Return]    ${response}

Get Payroll Register
    [Arguments]    ${payroll_name}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/${payroll_name}/register
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Statutory Compliance Report
    [Arguments]    ${month}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/statutory-compliance?month=${month}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Department Cost Analysis
    [Arguments]    ${month}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/hr/payroll/department-costs?month=${month}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}
