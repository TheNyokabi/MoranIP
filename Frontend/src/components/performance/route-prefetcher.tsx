"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Common routes that should be prefetched for faster navigation.
 * These are high-traffic routes that users frequently navigate to.
 */
const PREFETCH_ROUTES = [
    "/dashboard",
    "/pos",
    "/inventory/items",
    "/invoices",
    "/sales",
    "/crm",
    "/hr",
    "/accounting",
    "/reports",
];

interface RoutePrefetcherProps {
    tenantSlug: string;
}

/**
 * Component that prefetches common routes for faster navigation.
 * Place this in the layout to enable prefetching across the app.
 */
export function RoutePrefetcher({ tenantSlug }: RoutePrefetcherProps) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only prefetch if we're in the app (not on login, etc.)
        if (!pathname?.includes(`/w/${tenantSlug}`)) return;

        // Prefetch common routes with a delay to avoid blocking initial render
        const timeoutId = setTimeout(() => {
            PREFETCH_ROUTES.forEach((route) => {
                const fullPath = `/w/${tenantSlug}${route}`;
                // Don't prefetch current route
                if (!pathname.includes(fullPath)) {
                    router.prefetch(fullPath);
                }
            });
        }, 2000); // Wait 2 seconds after page load

        return () => clearTimeout(timeoutId);
    }, [router, pathname, tenantSlug]);

    // This component doesn't render anything
    return null;
}

/**
 * Hook for manual route prefetching based on user behavior.
 * Use this to prefetch routes when hovering over nav items.
 */
export function usePrefetch() {
    const router = useRouter();

    const prefetch = (path: string) => {
        router.prefetch(path);
    };

    return { prefetch };
}
