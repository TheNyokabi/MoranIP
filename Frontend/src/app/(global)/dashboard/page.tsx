'use client';

import { useEffect } from 'react';
import { ActionDashboard } from "@/components/dashboard/action-dashboard"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuthStore } from "@/store/auth-store"

export default function GlobalDashboardPage() {
    const { setCurrentTenant, currentTenant } = useAuthStore();

    // Clear tenant context when entering global dashboard
    useEffect(() => {
        // Only clear if there's a current tenant (avoid unnecessary state updates)
        if (currentTenant) {
            setCurrentTenant(null);
        }
    }, [currentTenant, setCurrentTenant]);

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            {/* Fixed theme toggle */}
            <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <ActionDashboard />
        </div>
    )
}
