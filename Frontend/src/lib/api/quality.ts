/**
 * Quality Management Module API Client
 * Uses new /api/quality path structure
 */

import { apiFetch } from '../api';

export interface QualityInspection {
    name: string;
    inspection_type: string;
    reference_type?: string;
    reference_name?: string;
    item_code?: string;
    item_name?: string;
    status: string;
    inspection_date?: string;
    submitted_by?: string;
    submitted_at?: string;
}

export interface QualityTest {
    name: string;
    test_name: string;
    test_description?: string;
    item_group?: string;
    quality_test_template?: string;
}

export const qualityApi = {
    // Quality Inspections
    listInspections: (): Promise<{ data: QualityInspection[] }> =>
        apiFetch('/api/quality/inspections'),

    createInspection: (data: Partial<QualityInspection>): Promise<{ data: QualityInspection }> =>
        apiFetch('/api/quality/inspections', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getInspection: (inspectionName: string): Promise<{ data: QualityInspection }> =>
        apiFetch(`/api/quality/inspections/${inspectionName}`),

    updateInspection: (inspectionName: string, data: Partial<QualityInspection>): Promise<{ data: QualityInspection }> =>
        apiFetch(`/api/quality/inspections/${inspectionName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Quality Tests
    listTests: (): Promise<{ data: QualityTest[] }> =>
        apiFetch('/api/quality/tests'),

    createTest: (data: Partial<QualityTest>): Promise<{ data: QualityTest }> =>
        apiFetch('/api/quality/tests', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getTest: (testName: string): Promise<{ data: QualityTest }> =>
        apiFetch(`/api/quality/tests/${testName}`),

    updateTest: (testName: string, data: Partial<QualityTest>): Promise<{ data: QualityTest }> =>
        apiFetch(`/api/quality/tests/${testName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};
