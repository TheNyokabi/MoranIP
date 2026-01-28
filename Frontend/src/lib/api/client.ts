// Enhanced API Client with Security and Session Handling

// Use relative URLs in browser to route through Next.js proxy
// Use full URL on server for SSR
const API_BASE_URL = typeof window !== 'undefined'
    ? '' // Browser: use relative URLs through Next.js proxy at /api
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000');

// Token management
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
}

export function setAuthToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', token);
}

export function clearAuthToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
}

// Helper function to get auth headers
function getAuthHeaders(endpoint?: string): HeadersInit {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    // Add X-Tenant-ID header for tenant-scoped endpoints
    // Note: Backend accepts both tenant_id (UUID) and tenant_code (slug like TEN-KE-26-XYZ)
    if (typeof window !== 'undefined' && endpoint) {
        const isTenantScoped =
            endpoint.includes('/inventory/') ||
            endpoint.includes('/settings/') ||
            endpoint.includes('/pos/') ||
            endpoint.includes('/onboarding/') ||
            endpoint.includes('/provisioning/') ||
            endpoint.includes('/erpnext/') ||
            endpoint.includes('/erp/') ||
            endpoint.includes('/purchases/') ||
            endpoint.includes('/accounting/') ||
            endpoint.includes('/crm/') ||
            endpoint.includes('/hr/') ||
            endpoint.includes('/manufacturing/') ||
            endpoint.includes('/projects/') ||
            endpoint.includes('/sales/') ||
            endpoint.includes('/support/') ||
            endpoint.includes('/assets/') ||
            endpoint.includes('/quality/') ||
            endpoint.includes('/paint/');

        if (isTenantScoped) {
            // Try to get tenant SLUG (code) from auth store - prefer slug over ID for consistency
            try {
                const { useAuthStore } = require('@/store/auth-store');
                const authState = useAuthStore.getState();
                // Prefer code (slug) over ID for URL consistency
                const tenantSlug = authState.currentTenant?.code || authState.currentTenant?.id || null;

                // Fallback: try to get from URL if in workspace route
                if (!tenantSlug) {
                    const pathMatch = window.location.pathname.match(/^\/w\/([^\/]+)/);
                    if (pathMatch) {
                        const { availableTenants } = authState;
                        const tenant = availableTenants?.find((t: any) => t.code === pathMatch[1] || t.id === pathMatch[1]);
                        if (tenant) {
                            // Prefer slug (code) over ID
                            (headers as Record<string, string>)['X-Tenant-ID'] = tenant.code || tenant.id;
                        } else {
                            // Use the slug directly from URL
                            (headers as Record<string, string>)['X-Tenant-ID'] = pathMatch[1];
                        }
                    }
                } else {
                    (headers as Record<string, string>)['X-Tenant-ID'] = tenantSlug;
                }
            } catch (e) {
                // Auth store not available, skip tenant ID
            }
        }
    }

    return headers;
}

// Custom error class for API errors
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public data?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Helper function to handle API responses with security
async function handleResponse<T>(response: Response): Promise<T> {
    // Handle 401 Unauthorized - invalid/expired session
    if (response.status === 401) {
        clearAuthToken();

        // Redirect to login if we're in the browser
        if (typeof window !== 'undefined') {
            window.location.href = '/login?session=expired';
        }

        throw new ApiError(401, 'Session expired. Please login again.');
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
        throw new ApiError(403, 'You do not have permission to perform this action.');
    }

    // Handle other error statuses
    if (!response.ok) {
        const error = await response.json().catch(() => ({
            message: `HTTP ${response.status}: ${response.statusText}`
        }));

        throw new ApiError(
            response.status,
            error.message || error.detail || 'An error occurred',
            error
        );
    }

    // Handle empty responses
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

// Secure fetch wrapper with retry logic
async function secureFetch(
    url: string,
    options: RequestInit = {},
    retries = 0
): Promise<Response> {
    try {
        // Extract endpoint from URL for tenant context detection
        const endpoint = url.replace(API_BASE_URL, '');
        const headers: Record<string, string> = { ...getAuthHeaders(endpoint) as Record<string, string> };
        // X-Tenant-ID now contains tenant slug (code) for URL consistency
        const tenantSlug = headers['X-Tenant-ID'] || null;

        let finalUrl = url;
        // Rewrite module endpoints to include tenant scope in URL path if not already present
        // Uses tenant slug for consistent URLs across the application
        if (tenantSlug && !endpoint.includes('/tenants/')) {
            const erpModules = [
                '/inventory', '/purchases', '/accounting', '/crm', '/hr',
                '/paint', '/manufacturing', '/projects', '/sales',
                '/support', '/assets', '/quality', '/permissions', '/pos'
            ];
            const tenantModules = [
                '/reports', '/commissions', '/dashboard', '/files'
            ];

            // Normalize endpoint by removing /api if present
            let pathToCheck = endpoint;
            if (pathToCheck.startsWith('/api/')) {
                pathToCheck = pathToCheck.substring(4);
            }

            let identified = false;
            let targetPath = '';

            for (const prefix of erpModules) {
                if (pathToCheck.startsWith(prefix)) {
                    // Use tenant slug in URL for consistency
                    targetPath = `/api/tenants/${tenantSlug}/erp${pathToCheck}`;
                    identified = true;
                    break;
                }
            }

            if (!identified) {
                for (const prefix of tenantModules) {
                    if (pathToCheck.startsWith(prefix)) {
                        // Use tenant slug in URL for consistency
                        targetPath = `/api/tenants/${tenantSlug}${pathToCheck}`;
                        identified = true;
                        break;
                    }
                }
            }

            if (identified) {
                finalUrl = `${API_BASE_URL}${targetPath}`;
            }
        }

        // In browser, ensure URLs go through Next.js proxy with /api prefix
        if (typeof window !== 'undefined' && !finalUrl.startsWith('/api') && !finalUrl.startsWith('http')) {
            finalUrl = `/api${finalUrl}`;
        }

        const response = await fetch(finalUrl, {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
        });

        return response;
    } catch (error) {
        // Network error - retry up to 2 times
        if (retries < 2 && error instanceof TypeError) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
            return secureFetch(url, options, retries + 1);
        }

        throw error;
    }
}

// Export secure API methods
export async function apiGet<T>(endpoint: string): Promise<T> {
    const response = await secureFetch(`${API_BASE_URL}${endpoint}`);
    return handleResponse<T>(response);
}

export async function apiPost<T>(endpoint: string, data: any): Promise<T> {
    const response = await secureFetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
}

export async function apiPut<T>(endpoint: string, data: any): Promise<T> {
    const response = await secureFetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
    const response = await secureFetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
    });
    return handleResponse<T>(response);
}

// Axios-like wrapper for legacy call sites
export const apiClient = {
    get: async <T = any>(endpoint: string, options?: { params?: Record<string, any> }): Promise<{ data: T }> => {
        const params = options?.params
        let url = endpoint
        if (params && typeof params === 'object') {
            const sp = new URLSearchParams()
            for (const [k, v] of Object.entries(params)) {
                if (v === undefined || v === null) continue
                sp.set(k, String(v))
            }
            const qs = sp.toString()
            if (qs) url = `${endpoint}?${qs}`
        }
        const data = await apiGet<T>(url)
        return { data }
    },
    post: async <T = any>(endpoint: string, data?: any): Promise<{ data: T }> => {
        const result = await apiPost<T>(endpoint, data)
        return { data: result }
    },
    put: async <T = any>(endpoint: string, data?: any): Promise<{ data: T }> => {
        const result = await apiPut<T>(endpoint, data)
        return { data: result }
    },
    delete: async <T = any>(endpoint: string): Promise<{ data: T }> => {
        const result = await apiDelete<T>(endpoint)
        return { data: result }
    },
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return getAuthToken() !== null;
}

// Validate token (basic check - backend will do full validation)
export function isTokenValid(): boolean {
    const token = getAuthToken();
    if (!token) return false;

    try {
        // Basic JWT structure check
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        // Decode payload (without verification - backend does that)
        const payload = JSON.parse(atob(parts[1]));

        // Check expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            clearAuthToken();
            return false;
        }

        return true;
    } catch {
        clearAuthToken();
        return false;
    }
}
