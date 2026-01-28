"use client"

import { SidebarContent } from "@/components/layout/sidebar-content"

export function TenantSidebar({ tenantSlug }: { tenantSlug: string }) {
    return (
        <div className="hidden md:flex h-screen flex-col border-r w-64 fixed left-0 top-0 z-30">
            <SidebarContent tenantSlug={tenantSlug} />
        </div>
    )
}
