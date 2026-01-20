import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PermissionsState {
    permissions: string[];
    roles: string[];
    isSuperAdmin: boolean;
    loading: boolean;
    error: string | null;
    setPermissions: (permissions: string[]) => void;
    setRoles: (roles: string[]) => void;
    setIsSuperAdmin: (isSuperAdmin: boolean) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
    hasRole: (role: string) => boolean;
    clear: () => void;
}

export const usePermissionsStore = create<PermissionsState>()(
    persist(
        (set, get) => ({
            permissions: [],
            roles: [],
            isSuperAdmin: false,
            loading: false,
            error: null,

            setPermissions: (permissions) => set({ permissions }),
            setRoles: (roles) => set({ roles }),
            setIsSuperAdmin: (isSuperAdmin) => set({ isSuperAdmin }),
            setLoading: (loading) => set({ loading }),
            setError: (error) => set({ error }),

            hasPermission: (permission) => {
                const state = get();
                // Super admin has all permissions
                if (state.isSuperAdmin) return true;
                // Check exact permission
                if (state.permissions.includes(permission)) return true;
                // Check wildcard permissions
                const [module, resource, action] = permission.split(':');
                return (
                    state.permissions.includes(`${module}:${resource}:*`) ||
                    state.permissions.includes(`${module}:*:${action}`) ||
                    state.permissions.includes(`*:*:${action}`) ||
                    state.permissions.includes(`*:*:*`)
                );
            },

            hasAnyPermission: (permissions) => {
                const state = get();
                if (state.isSuperAdmin) return true;
                return permissions.some((perm) => state.hasPermission(perm));
            },

            hasAllPermissions: (permissions) => {
                const state = get();
                if (state.isSuperAdmin) return true;
                return permissions.every((perm) => state.hasPermission(perm));
            },

            hasRole: (role) => {
                const state = get();
                return state.roles.includes(role);
            },

            clear: () =>
                set({
                    permissions: [],
                    roles: [],
                    isSuperAdmin: false,
                    loading: false,
                    error: null,
                }),
        }),
        {
            name: 'permissions-storage',
            partialize: (state) => ({
                permissions: state.permissions,
                roles: state.roles,
                isSuperAdmin: state.isSuperAdmin,
            }),
        }
    )
);
