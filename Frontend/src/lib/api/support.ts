/**
 * Support/Help Desk Module API Client
 * Uses new /api/support path structure
 */

import { apiFetch } from './core';

export interface Issue {
    name: string;
    subject: string;
    customer?: string;
    raised_by?: string;
    status: 'Open' | 'Replied' | 'On Hold' | 'Resolved' | 'Closed';
    priority?: string;
    issue_type?: string;
    description?: string;
    resolution_details?: string;
    opening_date?: string;
    opening_time?: string;
    resolution_time?: string;
}

export const supportApi = {
    // Issues
    listIssues: (): Promise<{ data: Issue[] }> =>
        apiFetch('/api/support/issues'),

    createIssue: (data: Partial<Issue>): Promise<{ data: Issue }> =>
        apiFetch('/api/support/issues', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getIssue: (issueName: string): Promise<{ data: Issue }> =>
        apiFetch(`/api/support/issues/${issueName}`),

    updateIssue: (issueName: string, data: Partial<Issue>): Promise<{ data: Issue }> =>
        apiFetch(`/api/support/issues/${issueName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};
