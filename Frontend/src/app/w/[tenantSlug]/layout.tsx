"use client"

import { useEffect } from "react"
import { TenantSidebar } from "@/components/layout/tenant-sidebar"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
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
            {/* Mobile Header */}
            <div className="md:hidden flex items-center p-4 border-b bg-background sticky top-0 z-40">
                <MobileSidebar tenantSlug={params.tenantSlug} />
                <span className="font-semibold ml-2">Menu</span>
            </div>

            <TenantSidebar tenantSlug={params.tenantSlug} />
            <main className="md:pl-64 transition-all duration-300">
                <div className="container py-6">
                    {children}
                </div>
            </main>
        </div>
    )
}
