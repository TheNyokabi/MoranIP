/**
 * Asset Management Module API Client
 * Uses new /api/assets path structure
 */

import { apiFetch } from '../api';

export interface Asset {
    name: string;
    asset_name: string;
    asset_category: string;
    company: string;
    purchase_date?: string;
    purchase_amount: number;
    current_value?: number;
    status: string;
    location?: string;
    department?: string;
}

export interface AssetMaintenance {
    name: string;
    asset_name: string;
    asset: string;
    maintenance_type: string;
    maintenance_status: string;
    completion_date?: string;
    next_due_date?: string;
    assign_to?: string;
}

export const assetsApi = {
    // Assets
    listAssets: (): Promise<{ data: Asset[] }> =>
        apiFetch('/api/assets/assets'),

    createAsset: (data: Partial<Asset>): Promise<{ data: Asset }> =>
        apiFetch('/api/assets/assets', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getAsset: (assetName: string): Promise<{ data: Asset }> =>
        apiFetch(`/api/assets/assets/${assetName}`),

    updateAsset: (assetName: string, data: Partial<Asset>): Promise<{ data: Asset }> =>
        apiFetch(`/api/assets/assets/${assetName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Asset Maintenance
    listMaintenance: (): Promise<{ data: AssetMaintenance[] }> =>
        apiFetch('/api/assets/maintenance'),

    createMaintenance: (data: Partial<AssetMaintenance>): Promise<{ data: AssetMaintenance }> =>
        apiFetch('/api/assets/maintenance', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getMaintenance: (maintenanceName: string): Promise<{ data: AssetMaintenance }> =>
        apiFetch(`/api/assets/maintenance/${maintenanceName}`),

    updateMaintenance: (maintenanceName: string, data: Partial<AssetMaintenance>): Promise<{ data: AssetMaintenance }> =>
        apiFetch(`/api/assets/maintenance/${maintenanceName}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};
