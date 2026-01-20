"use client"

import { useEffect } from "react"
import { TenantSidebar } from "@/components/layout/tenant-sidebar"
import { useAuthStore } from "@/store/auth-store"
import { findTenantBySlug } from "@/store/tenant-store"

export default function TenantLayout({
    children,
    params
}: {
    children: React.ReactNode
    params: { tenantSlug: string }
}) {
    const { availableTenants, currentTenant, setCurrentTenant } = useAuthStore();

    // Set current tenant when entering workspace
    useEffect(() => {
        const tenant = findTenantBySlug(params.tenantSlug, availableTenants);
        
        // Only update if tenant is found and different from current
        if (tenant && (!currentTenant || currentTenant.id !== tenant.id)) {
            setCurrentTenant(tenant);
        } else if (!tenant && availableTenants.length > 0) {
            // If tenant not found but we have tenants, it might be loading
            // Wait a bit and try again (for cases where tenants are still loading)
            const timeoutId = setTimeout(() => {
                const retryTenant = findTenantBySlug(params.tenantSlug, useAuthStore.getState().availableTenants);
                if (retryTenant) {
                    setCurrentTenant(retryTenant);
                }
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [params.tenantSlug, availableTenants, currentTenant, setCurrentTenant]);

    return (
        <div className="min-h-screen bg-background">
            <TenantSidebar tenantSlug={params.tenantSlug} />
            <main className="pl-64 transition-all duration-300">
                <div className="container py-6">
                    {children}
                </div>
            </main>
        </div>
    )
}
