'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, isTokenValid } from '@/lib/api/client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        // Check authentication on mount and when visibility changes
        const checkAuth = () => {
            if (!isAuthenticated() || !isTokenValid()) {
                router.push('/auth/login?session=expired');
            }
        };

        checkAuth();

        // Recheck when page becomes visible
        document.addEventListener('visibilitychange', checkAuth);

        // Recheck periodically (every 5 minutes)
        const interval = setInterval(checkAuth, 5 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', checkAuth);
            clearInterval(interval);
        };
    }, [router]);

    // Don't render children if not authenticated
    if (!isAuthenticated() || !isTokenValid()) {
        return null;
    }

    return <>{children}</>;
}
