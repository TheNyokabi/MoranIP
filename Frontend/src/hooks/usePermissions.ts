import { useEffect } from 'react';
import { usePermissionsStore } from '@/store/permissions-store';
import { useAuthStore } from '@/store/auth-store';

/**
 * Hook to get current user's permissions
 */
export function usePermissions() {
    const { permissions, roles, isSuperAdmin, loading, error } = usePermissionsStore();
    const { user, token, isSuperAdmin: isSuperAdminFn } = useAuthStore();
    const isAuthenticated = Boolean(token);

    useEffect(() => {
        // Auto-load permissions from user object if available
        if (isAuthenticated && user) {
            const userAny = user as any;
            const userPermissions = Array.isArray(userAny?.permissions) ? userAny.permissions : [];
            const userRoles = Array.isArray(userAny?.roles) ? userAny.roles : [];
            const superAdmin = typeof userAny?.is_super_admin === 'boolean' ? userAny.is_super_admin : isSuperAdminFn();

            usePermissionsStore.getState().setPermissions(userPermissions);
            usePermissionsStore.getState().setRoles(userRoles);
            usePermissionsStore.getState().setIsSuperAdmin(superAdmin);
        } else {
            // Clear permissions when not authenticated
            usePermissionsStore.getState().clear();
        }
    }, [isAuthenticated, user, isSuperAdminFn]);

    return {
        permissions,
        roles,
        isSuperAdmin,
        loading,
        error,
    };
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: string): boolean {
    const hasPermission = usePermissionsStore((state) => state.hasPermission);
    return hasPermission(permission);
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: string[]): boolean {
    const hasAnyPermission = usePermissionsStore((state) => state.hasAnyPermission);
    return hasAnyPermission(permissions);
}

/**
 * Hook to check if user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
    const hasAllPermissions = usePermissionsStore((state) => state.hasAllPermissions);
    return hasAllPermissions(permissions);
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: string): boolean {
    const hasRole = usePermissionsStore((state) => state.hasRole);
    return hasRole(role);
}

/**
 * Hook to get permission checking functions
 */
export function usePermissionCheck() {
    const hasPermission = usePermissionsStore((state) => state.hasPermission);
    const hasAnyPermission = usePermissionsStore((state) => state.hasAnyPermission);
    const hasAllPermissions = usePermissionsStore((state) => state.hasAllPermissions);
    const hasRole = usePermissionsStore((state) => state.hasRole);

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
    };
}
