*** Settings ***
Documentation     Enterprise Case Study - Projects Workflow
...               Complete project delivery from initiation to completion with budget tracking
Resource          ../../resources/enterprise_keywords.robot
Suite Setup       Setup Enterprise Test Environment
Suite Teardown    Cleanup Test Data

*** Variables ***
${PROJECT_NAME}        Smartwatch Development
${PROJECT_TYPE}        R&D
${PROJECT_BUDGET}      5000000
${PROJECT_MANAGER}     John Doe
${TASK_1}              Market Research
${TASK_2}              Design & Prototyping
${TASK_3}              Testing
${TASK_4}              Production Setup

*** Test Cases ***

TC001_Create_Project
    [Documentation]    Create R&D project with budget and timeline
    [Tags]    projects    positive    smoke
    ${project_data}=    Create Dictionary
    ...    project_name=${PROJECT_NAME}
    ...    project_type=${PROJECT_TYPE}
    ...    budget=${PROJECT_BUDGET}
    ...    start_date=2024-01-01
    ...    end_date=2024-07-01
    ...    project_manager=${PROJECT_MANAGER}
    ...    company=Tech Manufacturing Co. Ltd.
    
    ${response}=    Create Project    ${project_data}
    Verify Response Status    ${response}    200
    ${project_name}=    Get Response Data    ${response}
    [Teardown]    Set Suite Variable    ${PROJECT_ID}    ${project_name}

TC002_Assign_Project_Team
    [Documentation]    Assign team members to project
    [Tags]    projects    hr    positive
    ${team_members}=    Create List
    ...    Engineer 1
    ...    Engineer 2
    ...    Designer 1
    ...    Tester 1
    ...    ${PROJECT_MANAGER}
    
    ${response}=    Assign Project Team    ${PROJECT_ID}    ${team_members}
    Verify Response Status    ${response}    200
    
    # Verify team assigned
    ${project_details}=    Get Project    ${PROJECT_ID}
    ${team}=    Get From Dictionary    ${project_details}    team_members
    ${team_count}=    Get Length    ${team}
    Should Be Equal    ${team_count}    5

TC003_Create_Project_Tasks
    [Documentation]    Create tasks with dependencies and budgets
    [Tags]    projects    positive
    ${tasks}=    Create List
    
    # Task 1: Market Research
    ${task1}=    Create Dictionary
    ...    subject=${TASK_1}
    ...    start_date=2024-01-01
    ...    end_date=2024-01-14
    ...    assignee=Engineer 1
    ...    budget=200000
    ...    priority=High
    Append To List    ${tasks}    ${task1}
    
    # Task 2: Design & Prototyping
    ${task2}=    Create Dictionary
    ...    subject=${TASK_2}
    ...    start_date=2024-01-15
    ...    end_date=2024-03-11
    ...    assignees=${Engineer 1, Engineer 2, Designer 1}
    ...    budget=3000000
    ...    priority=High
    ...    depends_on=${TASK_1}
    Append To List    ${tasks}    ${task2}
    
    # Task 3: Testing
    ${task3}=    Create Dictionary
    ...    subject=${TASK_3}
    ...    start_date=2024-03-12
    ...    end_date=2024-04-08
    ...    assignees=${Tester 1, Engineer 1}
    ...    budget=1000000
    ...    priority=Medium
    ...    depends_on=${TASK_2}
    Append To List    ${tasks}    ${task3}
    
    # Task 4: Production Setup
    ${task4}=    Create Dictionary
    ...    subject=${TASK_4}
    ...    start_date=2024-04-09
    ...    end_date=2024-05-06
    ...    assignee=Engineer 2
    ...    budget=800000
    ...    priority=High
    ...    depends_on=${TASK_3}
    Append To List    ${tasks}    ${task4}
    
    ${response}=    Create Project Tasks    ${PROJECT_ID}    ${tasks}
    Verify Response Status    ${response}    200
    
    # Verify tasks created
    ${project_tasks}=    Get Project Tasks    ${PROJECT_ID}
    ${task_count}=    Get Length    ${project_tasks}
    Should Be Equal    ${task_count}    4

TC004_Record_Timesheets
    [Documentation]    Record daily timesheets for team members
    [Tags]    projects    hr    positive
    ${timesheet_data}=    Create List
    
    # Week 1 timesheets
    FOR    ${day}    IN RANGE    1    8
        ${ts_john}=    Create Dictionary
        ...    employee=${PROJECT_MANAGER}
        ...    project=${PROJECT_ID}
        ...    task=${TASK_1}
        ...    date=2024-01-${day}
        ...    hours=8
        ...    activity_type=Development
        Append To List    ${timesheet_data}    ${ts_john}
        
        ${ts_eng1}=    Create Dictionary
        ...    employee=Engineer 1
        ...    project=${PROJECT_ID}
        ...    task=${TASK_1}
        ...    date=2024-01-${day}
        ...    hours=8
        ...    activity_type=Research
        Append To List    ${timesheet_data}    ${ts_eng1}
    END
    
    ${response}=    Submit Timesheets    ${timesheet_data}
    Verify Response Status    ${response}    200
    
    # Verify timesheets recorded
    ${timesheet_summary}=    Get Project Timesheet Summary    ${PROJECT_ID}    2024-01
    ${total_hours}=    Get From Dictionary    ${timesheet_summary}    total_hours
    Should Be True    ${total_hours} > 0

TC005_Track_Project_Expenses
    [Documentation]    Record project expenses
    [Tags]    projects    accounting    positive
    ${expenses}=    Create List
    
    ${expense1}=    Create Dictionary
    ...    project=${PROJECT_ID}
    ...    task=${TASK_2}
    ...    expense_type=Materials
    ...    amount=500000
    ...    description=Circuit boards and sensors
    Append To List    ${expenses}    ${expense1}
    
    ${expense2}=    Create Dictionary
    ...    project=${PROJECT_ID}
    ...    task=${TASK_2}
    ...    expense_type=External Services
    ...    amount=200000
    ...    description=Consulting services
    Append To List    ${expenses}    ${expense2}
    
    ${expense3}=    Create Dictionary
    ...    project=${PROJECT_ID}
    ...    task=${TASK_3}
    ...    expense_type=Travel
    ...    amount=50000
    ...    description=Supplier visits
    Append To List    ${expenses}    ${expense3}
    
    FOR    ${expense}    IN    @{expenses}
        ${response}=    Record Project Expense    ${expense}
        Verify Response Status    ${response}    200
    END
    
    # Verify expenses recorded
    ${project_expenses}=    Get Project Expenses    ${PROJECT_ID}
    ${expense_count}=    Get Length    ${project_expenses}
    Should Be Equal    ${expense_count}    3

TC006_Monitor_Budget_Vs_Actual
    [Documentation]    Monitor project budget vs actual costs
    [Tags]    projects    reporting    positive
    ${budget_report}=    Get Project Budget Report    ${PROJECT_ID}
    
    ${budget}=    Get From Dictionary    ${budget_report}    budget
    ${actual}=    Get From Dictionary    ${budget_report}    actual_cost
    ${remaining}=    Get From Dictionary    ${budget_report}    remaining_budget
    ${variance_percent}=    Get From Dictionary    ${budget_report}    variance_percent
    
    Should Be Equal    ${budget}    ${PROJECT_BUDGET}
    Should Be True    ${actual} > 0
    Should Be True    ${remaining} >= 0
    # Variance should be within ±5%
    Should Be True    abs(${variance_percent}) <= 5
    Log    Budget: ${budget}, Actual: ${actual}, Remaining: ${remaining}, Variance: ${variance_percent}%

TC007_Complete_Project_Tasks
    [Documentation]    Mark all tasks as completed
    [Tags]    projects    positive
    ${tasks}=    Get Project Tasks    ${PROJECT_ID}
    
    FOR    ${task}    IN    @{tasks}
        ${task_name}=    Get From Dictionary    ${task}    name
        ${response}=    Complete Task    ${task_name}
        Verify Response Status    ${response}    200
    END
    
    # Verify all tasks completed
    ${project_tasks}=    Get Project Tasks    ${PROJECT_ID}
    FOR    ${task}    IN    @{project_tasks}
        ${status}=    Get From Dictionary    ${task}    status
        Should Be Equal    ${status}    Completed
    END

TC008_Close_Project
    [Documentation]    Finalize and close project
    [Tags]    projects    positive    smoke
    ${response}=    Close Project    ${PROJECT_ID}
    Verify Response Status    ${response}    200
    
    # Verify project status
    ${project_details}=    Get Project    ${PROJECT_ID}
    ${status}=    Get From Dictionary    ${project_details}    status
    Should Be Equal    ${status}    Completed

TC009_Generate_Project_Reports
    [Documentation]    Generate project profitability and utilization reports
    [Tags]    projects    reporting    positive
    ${profitability}=    Get Project Profitability    ${PROJECT_ID}
    ${budget}=    Get From Dictionary    ${profitability}    budget
    ${actual_cost}=    Get From Dictionary    ${profitability}    actual_cost
    ${savings}=    Get From Dictionary    ${profitability}    savings
    
    Should Be Equal    ${budget}    ${PROJECT_BUDGET}
    Should Be True    ${actual_cost} <= ${budget}
    Should Be True    ${savings} >= 0
    
    ${utilization}=    Get Resource Utilization Report    ${PROJECT_ID}
    Should Not Be Empty    ${utilization}
    
    ${timeline}=    Get Task Completion Timeline    ${PROJECT_ID}
    Should Not Be Empty    ${timeline}

*** Keywords ***
Create Project
    [Arguments]    ${project_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects
    ...    headers=${HEADERS}    json=${project_data}
    [Return]    ${response}

Assign Project Team
    [Arguments]    ${project_id}    ${team_members}
    ${team_data}=    Create Dictionary    team_members=${team_members}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/assign-team
    ...    headers=${HEADERS}    json=${team_data}
    [Return]    ${response}

Get Project
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Create Project Tasks
    [Arguments]    ${project_id}    ${tasks}
    ${task_data}=    Create Dictionary    tasks=${tasks}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/tasks
    ...    headers=${HEADERS}    json=${task_data}
    [Return]    ${response}

Get Project Tasks
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/tasks
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Submit Timesheets
    [Arguments]    ${timesheet_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/timesheets
    ...    headers=${HEADERS}    json=${timesheet_data}
    [Return]    ${response}

Get Project Timesheet Summary
    [Arguments]    ${project_id}    ${month}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/timesheet-summary?month=${month}
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Record Project Expense
    [Arguments]    ${expense_data}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${expense_data}[project]/expenses
    ...    headers=${HEADERS}    json=${expense_data}
    [Return]    ${response}

Get Project Expenses
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/expenses
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Project Budget Report
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/budget-report
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Complete Task
    [Arguments]    ${task_name}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/tasks/${task_name}/complete
    ...    headers=${HEADERS}
    [Return]    ${response}

Close Project
    [Arguments]    ${project_id}
    ${response}=    Post Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/close
    ...    headers=${HEADERS}
    [Return]    ${response}

Get Project Profitability
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/profitability
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Resource Utilization Report
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/resource-utilization
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}

Get Task Completion Timeline
    [Arguments]    ${project_id}
    ${response}=    Get Request    platform
    ...    /api/tenants/${TENANT_ID}/erp/projects/projects/${project_id}/task-timeline
    ...    headers=${HEADERS}
    ${data}=    Get Response Data    ${response}
    [Return]    ${data}
