/**
 * HR Module API Client
 * Uses new /api/hr path structure
 */

import { apiFetch } from './core';

export interface Employee {
    name: string;
    first_name: string;
    last_name: string;
    employee_name: string;
    company: string;
    date_of_joining: string;
    designation?: string;
    department?: string;
    status: string;
    email?: string;
    cell_number?: string;
}

export interface Department {
    name: string;
    department_name: string;
    company: string;
    is_group: number;
    parent_department?: string;
}

export interface Designation {
    name: string;
    designation_name: string;
    description?: string;
}

export interface Attendance {
    name: string;
    employee: string;
    attendance_date: string;
    status: 'Present' | 'Absent' | 'Half Day' | 'Work From Home';
    working_hours?: number;
    leave_type?: string;
}

export interface LeaveApplication {
    name: string;
    employee: string;
    leave_type: string;
    from_date: string;
    to_date: string;
    half_day?: number;
    half_day_date?: string;
    status: string;
    docstatus: number;
}

export interface SalaryStructure {
    name: string;
    company: string;
    employee?: string;
    from_date: string;
    base: number;
    total_earning: number;
    total_deduction: number;
    net_pay: number;
}

export const hrApi = {
    // Employees
    listEmployees: (): Promise<{ data: Employee[] }> =>
        apiFetch('/api/hr/employees'),

    createEmployee: (data: Partial<Employee>): Promise<{ data: Employee }> =>
        apiFetch('/api/hr/employees', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getEmployee: (employeeId: string): Promise<{ data: Employee }> =>
        apiFetch(`/api/hr/employees/${employeeId}`),

    updateEmployee: (employeeId: string, data: Partial<Employee>): Promise<{ data: Employee }> =>
        apiFetch(`/api/hr/employees/${employeeId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Departments
    listDepartments: (): Promise<{ data: Department[] }> =>
        apiFetch('/api/hr/departments'),

    createDepartment: (data: Partial<Department>): Promise<{ data: Department }> =>
        apiFetch('/api/hr/departments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDepartment: (departmentName: string): Promise<{ data: Department }> =>
        apiFetch(`/api/hr/departments/${departmentName}`),

    updateDepartment: (departmentName: string, data: Partial<Department>): Promise<{ data: Department }> =>
        apiFetch(`/api/hr/departments/${departmentName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Designations
    listDesignations: (): Promise<{ data: Designation[] }> =>
        apiFetch('/api/hr/designations'),

    createDesignation: (data: Partial<Designation>): Promise<{ data: Designation }> =>
        apiFetch('/api/hr/designations', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDesignation: (designationName: string): Promise<{ data: Designation }> =>
        apiFetch(`/api/hr/designations/${designationName}`),

    updateDesignation: (designationName: string, data: Partial<Designation>): Promise<{ data: Designation }> =>
        apiFetch(`/api/hr/designations/${designationName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Attendance
    listAttendance: (): Promise<{ data: Attendance[] }> =>
        apiFetch('/api/hr/attendance'),

    createAttendance: (data: Partial<Attendance>): Promise<{ data: Attendance }> =>
        apiFetch('/api/hr/attendance', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Leave Applications
    listLeaveApplications: (): Promise<{ data: LeaveApplication[] }> =>
        apiFetch('/api/hr/leave-applications'),

    createLeaveApplication: (data: Partial<LeaveApplication>): Promise<{ data: LeaveApplication }> =>
        apiFetch('/api/hr/leave-applications', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Salary Structures
    listSalaryStructures: (): Promise<{ data: SalaryStructure[] }> =>
        apiFetch('/api/hr/salary-structures'),

    createSalaryStructure: (data: Partial<SalaryStructure>): Promise<{ data: SalaryStructure }> =>
        apiFetch('/api/hr/salary-structures', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};
