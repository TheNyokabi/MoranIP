'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EnhancedOnboardingWizard } from '@/components/onboarding/EnhancedOnboardingWizard';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ErrorHandler } from '@/components/error-handler';
import { authApi } from '@/lib/api';

/**
 * Onboarding Page - Standalone page without sidebar layout
 * This page should be accessed directly for workspace setup
 */
export default function OnboardingPage() {
    const params = useParams() as any;
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const { currentTenant, token } = useAuthStore();
    const { availableTenants } = useTenantStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);

    useEffect(() => {
        // Find tenant from available tenants first
        const tenant = findTenantBySlug(tenantSlug, availableTenants);
        
        if (tenant?.id) {
            setTenantId(tenant.id);
            setLoading(false);
            return;
        }

        // Fallback: use current tenant if it matches
        if (currentTenant?.id) {
            // Check if current tenant matches the slug
            const currentTenantSlug = currentTenant.code || currentTenant.id;
            if (currentTenantSlug === tenantSlug || currentTenant.id === tenantSlug) {
                setTenantId(currentTenant.id);
                setLoading(false);
                return;
            }
        }

        // Last resort: use slug as tenant ID (if it's a UUID)
        // In production, you might want to fetch tenant by slug from API
        if (tenantSlug && tenantSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            setTenantId(tenantSlug);
            setLoading(false);
        } else {
            fetchTenantId();
        }
    }, [currentTenant, tenantSlug, token, availableTenants]);

    const fetchTenantId = async () => {
        if (!token) {
            setError('Authentication required. Please log in first.');
            setLoading(false);
            return;
        }

        try {
            const data = await authApi.getMemberships(token);
            const memberships = (data as any).memberships || (data as any).data || [];
            
            // Find tenant by matching slug with various tenant identifier fields
            const tenant = memberships.find((m: any) => {
                const t = m.tenant || m;
                return (
                    t.tenant_code === tenantSlug ||
                    t.id === tenantSlug ||
                    t.slug === tenantSlug ||
                    t.name?.toLowerCase().replace(/\s+/g, '-') === tenantSlug.toLowerCase()
                );
            });

            if (tenant) {
                const tenantData = tenant.tenant || tenant;
                setTenantId(tenantData.id || tenantSlug);
            } else {
                // If not found, use slug as fallback (assuming it's the tenant ID)
                setTenantId(tenantSlug);
            }

            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching tenant ID:', err);
            setError(err.message || 'Failed to load tenant information');
            setLoading(false);
        }
    };

    const handleComplete = () => {
        // Redirect to tenant dashboard after onboarding completes
        router.push(`/w/${tenantSlug}`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen p-6 bg-background">
                <div className="max-w-md w-full">
                    <ErrorHandler error={error} onDismiss={() => setError(null)} />
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-sm text-muted-foreground hover:text-foreground underline"
                        >
                            Go back to dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!tenantId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center space-y-4">
                    <p className="text-muted-foreground">Unable to determine tenant ID</p>
                    <div className="space-x-4">
                        <button
                            onClick={() => router.push(`/w/${tenantSlug}`)}
                            className="text-sm text-primary hover:underline"
                        >
                            Go to workspace
                        </button>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-sm text-muted-foreground hover:text-foreground underline"
                        >
                            Go to dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <EnhancedOnboardingWizard
                tenantId={tenantId}
                tenantSlug={tenantSlug}
                onComplete={handleComplete}
            />
        </div>
    );
}
