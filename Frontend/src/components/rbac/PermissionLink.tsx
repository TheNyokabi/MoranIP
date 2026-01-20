import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useHasPermission } from '@/hooks/usePermissions';

interface PermissionLinkProps extends Omit<LinkProps, 'href'> {
    permission: string;
    href: string;
    children: React.ReactNode;
    className?: string;
    fallback?: React.ReactNode;
}

/**
 * Link component that is only rendered if user has the required permission
 * 
 * @example
 * <PermissionLink permission="erp:partners:view" href="/partners">
 *   View Partners
 * </PermissionLink>
 */
export function PermissionLink({
    permission,
    href,
    children,
    className,
    fallback = null,
    ...props
}: PermissionLinkProps) {
    const hasPermission = useHasPermission(permission);

    if (!hasPermission) {
        return <>{fallback}</>;
    }

    return (
        <Link href={href} className={className} {...props}>
            {children}
        </Link>
    );
}
