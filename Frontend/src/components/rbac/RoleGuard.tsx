import React from 'react';
import { useHasRole } from '@/hooks/usePermissions';

interface RoleGuardProps {
    role: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Guard component that shows/hides content based on user role
 * 
 * @example
 * <RoleGuard role="ADMIN">
 *   <AdminPanel />
 * </RoleGuard>
 */
export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
    const hasRole = useHasRole(role);

    if (!hasRole) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

interface AnyRoleGuardProps {
    roles: string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Guard component that shows content if user has ANY of the specified roles
 * 
 * @example
 * <AnyRoleGuard roles={["ADMIN", "MANAGER"]}>
 *   <ManagementSection />
 * </AnyRoleGuard>
 */
export function AnyRoleGuard({ roles, children, fallback = null }: AnyRoleGuardProps) {
    const userRoles = usePermissionsStore((state) => state.roles);
    const hasAnyRole = roles.some((role) => userRoles.includes(role));

    if (!hasAnyRole) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// Import store for AnyRoleGuard
import { usePermissionsStore } from '@/store/permissions-store';
