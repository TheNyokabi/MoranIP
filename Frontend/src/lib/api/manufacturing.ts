/**
 * Manufacturing Module API Client
 * Uses new /api/manufacturing path structure
 */

import { apiFetch } from '../api';

export interface WorkCenter {
    name: string;
    workstation_name: string;
    company: string;
    production_capacity?: number;
    status: string;
}

export interface BOM {
    name: string;
    item: string;
    item_name: string;
    quantity: number;
    company: string;
    is_active: number;
    is_default: number;
    docstatus: number;
}

export interface WorkOrder {
    name: string;
    production_item: string;
    item_name: string;
    qty: number;
    company: string;
    bom_no?: string;
    status: string;
    docstatus: number;
}

export interface ProductionPlan {
    name: string;
    company: string;
    get_items_from: string;
    status: string;
    docstatus: number;
}

export const manufacturingApi = {
    // Work Centers
    listWorkCenters: (): Promise<{ data: WorkCenter[] }> =>
        apiFetch('/api/manufacturing/work-centers'),

    createWorkCenter: (data: Partial<WorkCenter>): Promise<{ data: WorkCenter }> =>
        apiFetch('/api/manufacturing/work-centers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getWorkCenter: (workCenterName: string): Promise<{ data: WorkCenter }> =>
        apiFetch(`/api/manufacturing/work-centers/${workCenterName}`),

    updateWorkCenter: (workCenterName: string, data: Partial<WorkCenter>): Promise<{ data: WorkCenter }> =>
        apiFetch(`/api/manufacturing/work-centers/${workCenterName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // BOMs
    listBOMs: (): Promise<{ data: BOM[] }> =>
        apiFetch('/api/manufacturing/bom'),

    createBOM: (data: Partial<BOM>): Promise<{ data: BOM }> =>
        apiFetch('/api/manufacturing/bom', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getBOM: (bomName: string): Promise<{ data: BOM }> =>
        apiFetch(`/api/manufacturing/bom/${bomName}`),

    updateBOM: (bomName: string, data: Partial<BOM>): Promise<{ data: BOM }> =>
        apiFetch(`/api/manufacturing/bom/${bomName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Work Orders
    listWorkOrders: (): Promise<{ data: WorkOrder[] }> =>
        apiFetch('/api/manufacturing/work-orders'),

    createWorkOrder: (data: Partial<WorkOrder>): Promise<{ data: WorkOrder }> =>
        apiFetch('/api/manufacturing/work-orders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getWorkOrder: (workOrderId: string): Promise<{ data: WorkOrder }> =>
        apiFetch(`/api/manufacturing/work-orders/${workOrderId}`),

    updateWorkOrder: (workOrderId: string, data: Partial<WorkOrder>): Promise<{ data: WorkOrder }> =>
        apiFetch(`/api/manufacturing/work-orders/${workOrderId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Production Plans
    listProductionPlans: (): Promise<{ data: ProductionPlan[] }> =>
        apiFetch('/api/manufacturing/production-plans'),

    createProductionPlan: (data: Partial<ProductionPlan>): Promise<{ data: ProductionPlan }> =>
        apiFetch('/api/manufacturing/production-plans', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};
