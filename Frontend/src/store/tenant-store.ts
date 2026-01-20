import { create } from 'zustand'
import { Tenant } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

// Helper to get slug from tenant
export function getTenantSlug(tenant: Tenant): string {
    return tenant.code || tenant.name.toLowerCase().replace(/\s+/g, '-')
}

// Helper to find tenant by slug
export function findTenantBySlug(slug: string, tenants?: Tenant[]): Tenant | undefined {
    const resolvedTenants = tenants ?? useAuthStore.getState().availableTenants
    return resolvedTenants.find(t => getTenantSlug(t) === slug || t.code === slug)
}

interface TenantState {
    currentTenant: Tenant | null
    availableTenants: Tenant[]
    setCurrentTenant: (tenant: Tenant | null) => void
    setAvailableTenants: (tenants: Tenant[]) => void
    selectTenantBySlug: (slug: string) => Tenant | undefined
}

export const useTenantStore = create<TenantState>((set, get) => ({
    currentTenant: useAuthStore.getState().currentTenant,
    availableTenants: useAuthStore.getState().availableTenants,

    setCurrentTenant: (tenant) => {
        set({ currentTenant: tenant })
        useAuthStore.setState({ currentTenant: tenant })
    },
    
    setAvailableTenants: (tenants) => {
        set({ availableTenants: tenants })
        useAuthStore.setState({ availableTenants: tenants })
    },
    
    selectTenantBySlug: (slug: string) => {
        const { availableTenants } = get()
        const tenant = findTenantBySlug(slug, availableTenants)
        if (tenant) {
            set({ currentTenant: tenant })
            useAuthStore.setState({ currentTenant: tenant })
        }
        return tenant
    },
}))
