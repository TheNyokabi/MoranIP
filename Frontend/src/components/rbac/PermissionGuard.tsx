import React from 'react';
import { useHasPermission } from '@/hooks/usePermissions';

interface PermissionGuardProps {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Guard component that shows/hides content based on permission
 * 
 * @example
 * <PermissionGuard permission="erp:partners:create">
 *   <Button>Create Partner</Button>
 * </PermissionGuard>
 */
export function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    const hasPermission = useHasPermission(permission);

    if (!hasPermission) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

interface AnyPermissionGuardProps {
    permissions: string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Guard component that shows content if user has ANY of the specified permissions
 * 
 * @example
 * <AnyPermissionGuard permissions={["erp:partners:view", "erp:partners:create"]}>
 *   <PartnersSection />
 * </AnyPermissionGuard>
 */
export function AnyPermissionGuard({ permissions, children, fallback = null }: AnyPermissionGuardProps) {
    const { hasAnyPermission } = usePermissionCheck();
    const hasAccess = hasAnyPermission(permissions);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

interface AllPermissionsGuardProps {
    permissions: string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Guard component that shows content if user has ALL of the specified permissions
 * 
 * @example
 * <AllPermissionsGuard permissions={["erp:partners:view", "erp:partners:edit"]}>
 *   <EditPartnerForm />
 * </AllPermissionsGuard>
 */
export function AllPermissionsGuard({ permissions, children, fallback = null }: AllPermissionsGuardProps) {
    const { hasAllPermissions } = usePermissionCheck();
    const hasAccess = hasAllPermissions(permissions);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// Import usePermissionCheck for the guards
import { usePermissionCheck } from '@/hooks/usePermissions';
