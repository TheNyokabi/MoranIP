import { apiClient } from './client';

export interface Permission {
    id: string;
    permission_code: string;
    code: string;
    module: string;
    resource: string;
    action: string;
    description: string;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PermissionCheckResult {
    [permission: string]: boolean;
}

/**
 * Get current user's permissions
 */
export async function getMyPermissions(): Promise<string[]> {
    const response = await apiClient.get<string[]>('/api/v1/permissions/me');
    return response.data;
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(permission: string): Promise<boolean> {
    const permissions = await getMyPermissions();
    return permissions.includes(permission);
}

/**
 * Batch check multiple permissions
 */
export async function checkPermissions(permissions: string[]): Promise<PermissionCheckResult> {
    const response = await apiClient.post<{ results: PermissionCheckResult }>(
        '/api/v1/permissions/check',
        { permissions }
    );
    return response.data.results;
}

/**
 * Get all available permissions
 */
export async function getAllPermissions(params?: {
    module?: string;
    resource?: string;
    action?: string;
    risk_level?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<Permission[]> {
    const response = await apiClient.get<Permission[]>('/api/v1/permissions', { params });
    return response.data;
}

/**
 * Get permissions by module
 */
export async function getModulePermissions(module: string): Promise<Permission[]> {
    const response = await apiClient.get<{ permissions: Permission[] }>(
        `/api/v1/permissions/modules/${module}`
    );
    return response.data.permissions;
}

/**
 * Get all modules with permission counts
 */
export async function getModules(): Promise<Array<{ module: string; module_name: string; permission_count: number }>> {
    const response = await apiClient.get<Array<{ module: string; module_name: string; permission_count: number }>>(
        '/api/v1/permissions/modules'
    );
    return response.data;
}
