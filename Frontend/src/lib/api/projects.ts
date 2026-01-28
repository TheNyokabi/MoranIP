/**
 * Projects Module API Client
 * Uses new /api/projects path structure
 */

import { apiFetch } from './core';

export interface Project {
    name: string;
    project_name: string;
    status: 'Open' | 'Completed' | 'Cancelled';
    company: string;
    expected_start_date?: string;
    expected_end_date?: string;
    actual_start_date?: string;
    actual_end_date?: string;
    project_type?: string;
    priority?: string;
}

export interface ProjectTemplate {
    name: string;
    project_template_name: string;
    project_type?: string;
    tasks: Array<{
        subject: string;
        description?: string;
        start_day?: number;
        duration?: number;
    }>;
}

export interface Task {
    name: string;
    subject: string;
    project?: string;
    status: 'Open' | 'Working' | 'Pending Review' | 'Overdue' | 'Completed' | 'Cancelled';
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    assigned_to?: string;
    expected_start_date?: string;
    expected_end_date?: string;
    actual_start_date?: string;
    actual_end_date?: string;
    progress?: number;
}

export interface Timesheet {
    name: string;
    employee: string;
    start_date: string;
    end_date: string;
    total_hours: number;
    status: string;
    docstatus: number;
    time_logs: Array<{
        activity_type: string;
        hours: number;
        description?: string;
    }>;
}

export const projectsApi = {
    // Projects
    listProjects: (): Promise<{ data: Project[] }> =>
        apiFetch('/api/projects/projects'),

    createProject: (data: Partial<Project>): Promise<{ data: Project }> =>
        apiFetch('/api/projects/projects', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getProject: (projectName: string): Promise<{ data: Project }> =>
        apiFetch(`/api/projects/projects/${projectName}`),

    updateProject: (projectName: string, data: Partial<Project>): Promise<{ data: Project }> =>
        apiFetch(`/api/projects/projects/${projectName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Project Templates
    listTemplates: (): Promise<{ data: ProjectTemplate[] }> =>
        apiFetch('/api/projects/templates'),

    createTemplate: (data: Partial<ProjectTemplate>): Promise<{ data: ProjectTemplate }> =>
        apiFetch('/api/projects/templates', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTemplate: (templateName: string): Promise<{ data: ProjectTemplate }> =>
        apiFetch(`/api/projects/templates/${templateName}`),

    updateTemplate: (templateName: string, data: Partial<ProjectTemplate>): Promise<{ data: ProjectTemplate }> =>
        apiFetch(`/api/projects/templates/${templateName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Tasks
    listTasks: (): Promise<{ data: Task[] }> =>
        apiFetch('/api/projects/tasks'),

    createTask: (data: Partial<Task>): Promise<{ data: Task }> =>
        apiFetch('/api/projects/tasks', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTask: (taskName: string): Promise<{ data: Task }> =>
        apiFetch(`/api/projects/tasks/${taskName}`),

    updateTask: (taskName: string, data: Partial<Task>): Promise<{ data: Task }> =>
        apiFetch(`/api/projects/tasks/${taskName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Timesheets
    listTimesheets: (): Promise<{ data: Timesheet[] }> =>
        apiFetch('/api/projects/timesheets'),

    createTimesheet: (data: Partial<Timesheet>): Promise<{ data: Timesheet }> =>
        apiFetch('/api/projects/timesheets', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTimesheet: (timesheetName: string): Promise<{ data: Timesheet }> =>
        apiFetch(`/api/projects/timesheets/${timesheetName}`),
};
