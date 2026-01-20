import React from 'react';
import { usePermissionCheck } from '@/hooks/usePermissions';

interface MenuItem {
    label: string;
    href?: string;
    icon?: React.ReactNode;
    permission?: string;
    permissions?: string[]; // Any of these permissions
    role?: string;
    children?: MenuItem[];
    onClick?: () => void;
}

interface RoleBasedMenuProps {
    items: MenuItem[];
    renderItem: (item: MenuItem, hasAccess: boolean) => React.ReactNode;
    className?: string;
}

/**
 * Menu component that filters items based on user permissions and roles
 * 
 * @example
 * <RoleBasedMenu
 *   items={menuItems}
 *   renderItem={(item, hasAccess) => (
 *     hasAccess ? <MenuItem {...item} /> : null
 *   )}
 * />
 */
export function RoleBasedMenu({ items, renderItem, className }: RoleBasedMenuProps) {
    const { hasPermission, hasAnyPermission, hasRole } = usePermissionCheck();

    const checkAccess = (item: MenuItem): boolean => {
        // If no permission/role specified, allow access
        if (!item.permission && !item.permissions && !item.role) {
            return true;
        }

        // Check role
        if (item.role && !hasRole(item.role)) {
            return false;
        }

        // Check single permission
        if (item.permission && !hasPermission(item.permission)) {
            return false;
        }

        // Check multiple permissions (any)
        if (item.permissions && !hasAnyPermission(item.permissions)) {
            return false;
        }

        return true;
    };

    const filterItems = (items: MenuItem[]): MenuItem[] => {
        return items
            .filter((item) => checkAccess(item))
            .map((item) => ({
                ...item,
                children: item.children ? filterItems(item.children) : undefined,
            }));
    };

    const filteredItems = filterItems(items);

    return (
        <div className={className}>
            {filteredItems.map((item, index) => (
                <React.Fragment key={index}>
                    {renderItem(item, checkAccess(item))}
                </React.Fragment>
            ))}
        </div>
    );
}

/**
 * Simple menu item component for use with RoleBasedMenu
 */
export function SimpleMenuItem({ item }: { item: MenuItem }) {
    const content = (
        <div className="flex items-center gap-2 px-4 py-2 hover:bg-accent rounded-md cursor-pointer">
            {item.icon}
            <span>{item.label}</span>
        </div>
    );

    if (item.href) {
        return (
            <a href={item.href} className="block">
                {content}
            </a>
        );
    }

    if (item.onClick) {
        return <div onClick={item.onClick}>{content}</div>;
    }

    return content;
}
