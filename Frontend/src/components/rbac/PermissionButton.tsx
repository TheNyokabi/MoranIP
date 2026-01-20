import React, { ButtonHTMLAttributes } from 'react';
import { useHasPermission } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    permission: string;
    children: React.ReactNode;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    fallback?: React.ReactNode;
}

/**
 * Button component that is only enabled if user has the required permission
 * 
 * @example
 * <PermissionButton permission="erp:partners:create" onClick={handleCreate}>
 *   Create Partner
 * </PermissionButton>
 */
export function PermissionButton({
    permission,
    children,
    variant = 'default',
    size = 'default',
    fallback = null,
    disabled,
    ...props
}: PermissionButtonProps) {
    const hasPermission = useHasPermission(permission);

    if (!hasPermission && fallback) {
        return <>{fallback}</>;
    }

    return (
        <Button
            variant={variant}
            size={size}
            disabled={disabled || !hasPermission}
            {...props}
        >
            {children}
        </Button>
    );
}
