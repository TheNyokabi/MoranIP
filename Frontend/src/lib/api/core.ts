/**
 * API Client for MoranERP Backend
 * Handles authentication, tenant context, and type-safe requests
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000'

// ============ Types ============

export interface User {
    id: string
    user_code: string
    email: string
    full_name: string | null
    kyc_tier: string
}

export interface Tenant {
    id: string
    name: string
    code: string
    engine?: 'odoo' | 'erpnext'
}

export interface TenantMembership {
    id: string
    name: string
    code: string
    engine?: 'odoo' | 'erpnext'
    status: string  // Tenant status (ACTIVE, SUSPENDED, etc.)
    role: string
    membership_status?: string  // Membership status (ACTIVE, INVITED, etc.)
}

export interface LoginResponse {
    access_token: string
    token_type: string
    user_id: string
    user_code: string
    email: string
    full_name: string | null
    kyc_tier: string
    tenants: Tenant[]
}

export interface TokenResponse {
    access_token: string
    token_type: string
    tenant: Tenant
}

export interface Partner {
    id: string
    name: string
    email: string | null
    phone: string | null
    type: 'Company' | 'Individual'
    source: 'odoo' | 'erpnext'
}

// ============ API Error ============

export class ApiError extends Error {
    constructor(
        public status: number,
        public detail: string,
        public rawError?: any
    ) {
        super(detail)
        this.name = 'ApiError'
    }
}

// ============ Fetch Wrapper ============

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
): Promise<T> {
    const isBrowser = typeof window !== 'undefined'

    const headers: HeadersInit = {
        ...options.headers,
    }

    if (!(options.body instanceof FormData)) {
        (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    // Auto-retrieve token and tenant ID from auth store if not provided
    let authToken = token;
    let tenantId: string | null = null;

    // Always try to get from store if not explicitly provided
    if (authToken === undefined || tenantId === null) {
        // Dynamically import to avoid circular dependency
        const { useAuthStore } = await import('@/store/auth-store');
        const authState = useAuthStore.getState();

        if (authToken === undefined) {
            authToken = authState.token;
        }

        // PRIORITY 1: Get tenant slug from URL (for /w/{workspace_slug} routes)
        // This ensures API calls use the same slug as the URL for consistency
        if (isBrowser) {
            const pathMatch = window.location.pathname.match(/^\/w\/([^\/]+)/);
            if (pathMatch) {
                const tenantSlug = pathMatch[1];
                // Use URL slug directly if it looks like a tenant code (TEN-XX-XX-XXXXX)
                if (tenantSlug.startsWith('TEN-')) {
                    tenantId = tenantSlug;
                } else {
                    // Try to find tenant by slug from available tenants
                    const { availableTenants } = authState;
                    const tenant = availableTenants?.find(t => t.code === tenantSlug || t.id === tenantSlug);
                    if (tenant) {
                        // Prefer slug (code) over ID for URL consistency
                        tenantId = tenant.code || tenant.id;
                    } else {
                        // Fallback: use the slug from the URL directly
                        tenantId = tenantSlug;
                    }
                }
            }
        }

        // PRIORITY 2: Fall back to auth store tenant if not on a workspace route
        if (!tenantId) {
            // Get tenant SLUG (code) from auth store - prefer slug over ID for URL consistency
            // The backend accepts both tenant_id (UUID) and tenant_code (slug like TEN-KE-26-XYZ)
            tenantId = authState.currentTenant?.code || authState.currentTenant?.id || null;
        }

        // If still no tenant ID, try to extract from endpoint path (e.g., /api/tenants/{tenant_slug}/...)
        if (!tenantId && endpoint) {
            const endpointMatch = endpoint.match(/\/tenants\/([^\/]+)/);
            if (endpointMatch) {
                const tenantIdentifier = endpointMatch[1];
                // Accept both UUID and tenant code (TEN-XX-XX-XXXXX format)
                if (tenantIdentifier && (tenantIdentifier.startsWith('TEN-') || tenantIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
                    // Try to find tenant by ID or code from available tenants
                    const { availableTenants } = authState;
                    const tenant = availableTenants?.find(t => t.id === tenantIdentifier || t.code === tenantIdentifier);
                    // Prefer slug (code) over ID for URL consistency
                    tenantId = tenant ? (tenant.code || tenant.id) : tenantIdentifier;
                }
            }
        }
    }

    if (authToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`
    }

    // Add tenant ID header for tenant-scoped endpoints (all module endpoints)
    if (tenantId && (
        endpoint.includes('/erpnext/') ||
        endpoint.includes('/erp/') ||
        endpoint.includes('/settings/') ||
        endpoint.includes('/inventory/') ||
        endpoint.includes('/accounting/') ||
        endpoint.includes('/crm/') ||
        endpoint.includes('/hr/') ||
        endpoint.includes('/manufacturing/') ||
        endpoint.includes('/projects/') ||
        endpoint.includes('/purchases/') ||
        endpoint.includes('/sales/') ||
        endpoint.includes('/support/') ||
        endpoint.includes('/assets/') ||
        endpoint.includes('/quality/') ||
        endpoint.includes('/pos/') ||
        endpoint.includes('/onboarding/') ||
        endpoint.includes('/provisioning/') ||
        endpoint.includes('/paint/')
    )) {
        (headers as Record<string, string>)['X-Tenant-ID'] = tenantId;
    }

    // Rewrite module endpoints to include tenant scope in URL path if not already present
    let rewrittenEndpoint = endpoint;
    if (tenantId && !endpoint.includes('/tenants/')) {
        const erpModules = [
            '/inventory', '/purchases', '/accounting', '/crm', '/hr',
            '/paint', '/manufacturing', '/projects', '/sales',
            '/support', '/assets', '/quality', '/permissions', '/pos'
        ];
        const tenantModules = [
            '/reports', '/commissions', '/dashboard', '/files'
        ];

        let pathToCheck = endpoint;
        if (pathToCheck.startsWith('/api/')) {
            pathToCheck = pathToCheck.substring(4);
        }

        let identified = false;
        for (const prefix of erpModules) {
            if (pathToCheck.startsWith(prefix)) {
                rewrittenEndpoint = `/tenants/${tenantId}/erp${pathToCheck}`;
                identified = true;
                break;
            }
        }
        if (!identified) {
            for (const prefix of tenantModules) {
                if (pathToCheck.startsWith(prefix)) {
                    rewrittenEndpoint = `/tenants/${tenantId}${pathToCheck}`;
                    break;
                }
            }
        }
    }

    const url = rewrittenEndpoint.startsWith('/api/')
        ? rewrittenEndpoint
        : isBrowser
            ? `/api${rewrittenEndpoint}`
            : `${API_BASE_URL}${rewrittenEndpoint}`

    const response = await fetch(url, {
        ...options,
        headers,
    })

    if (!response.ok) {
        let errorData: any;
        try {
            errorData = await response.json();
        } catch {
            errorData = { detail: 'Request failed' };
        }

        // FastAPI 422 validation errors return detail as an array of validation errors
        let errorMessage = 'Request failed';
        if (response.status === 422 && Array.isArray(errorData.detail)) {
            // Format validation errors nicely
            errorMessage = errorData.detail.map((err: any) => {
                if (typeof err === 'string') return err;
                if (err.loc && err.msg) {
                    const field = err.loc.slice(1).join('.');
                    return `${field}: ${err.msg}`;
                }
                return err.msg || JSON.stringify(err);
            }).join(', ');
        } else if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
                errorMessage = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                errorMessage = errorData.detail.map((e: any) => typeof e === 'string' ? e : e.msg || JSON.stringify(e)).join(', ');
            } else if (errorData.detail.message) {
                errorMessage = errorData.detail.message;
            } else {
                errorMessage = JSON.stringify(errorData.detail);
            }
        }

        throw new ApiError(response.status, errorMessage, errorData);
    }

    // Ensure we read the full response body
    try {
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        return JSON.parse(text) as T;
    } catch (e) {
        // If JSON parsing fails, try to return empty object
        console.error('Failed to parse response as JSON:', e);
        throw new ApiError(response.status, 'Invalid JSON response', { originalError: String(e) });
    }
}

/**
 * Legacy compatibility wrapper.
 *
 * Some pages call `apiCall("<tenantId>/erp/...", options)` (missing leading slash and `/tenants/`).
 * This normalizes those paths and forwards to `apiFetch`.
 */
export async function apiCall<T = any>(
    path: string,
    options: RequestInit = {},
    token?: string | null
): Promise<T> {
    // Allow passing absolute URLs (rare).
    if (/^https?:\/\//i.test(path)) {
        const response = await fetch(path, options)
        if (!response.ok) {
            let errorData: any
            try {
                errorData = await response.json()
            } catch {
                errorData = { detail: 'Request failed' }
            }
            throw new ApiError(response.status, errorData?.detail || 'Request failed', errorData)
        }
        return response.json()
    }

    let endpoint = path
    if (!endpoint.startsWith('/')) endpoint = `/${endpoint}`

    // Rewrite `/<tenantId>/erp/...` -> `/tenants/<tenantId>/erp/...`
    const legacyTenantPrefix = endpoint.match(/^\/([0-9a-fA-F-]+)\/erp\/(.+)$/)
    if (legacyTenantPrefix) {
        endpoint = `/tenants/${legacyTenantPrefix[1]}/erp/${legacyTenantPrefix[2]}`
    }

    // Projects module legacy fixes
    // - `/tenants/{id}/erp/projects/{projectId}` -> `/tenants/{id}/erp/projects/projects/{projectId}`
    // - `/tenants/{id}/erp/projects/{projectId}/tasks` -> `/tenants/{id}/erp/projects/tasks`
    const projectById = endpoint.match(/^\/tenants\/([^/]+)\/erp\/projects\/([^/]+)$/)
    if (projectById) {
        endpoint = `/tenants/${projectById[1]}/erp/projects/projects/${projectById[2]}`
    }

    const projectTasks = endpoint.match(/^\/tenants\/([^/]+)\/erp\/projects\/([^/]+)\/tasks$/)
    if (projectTasks) {
        endpoint = `/tenants/${projectTasks[1]}/erp/projects/tasks`
    }

    return apiFetch<T>(endpoint, options, token)
}

async function apiFetchBlob(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
): Promise<Blob> {
    const isBrowser = typeof window !== 'undefined'

    const headers: HeadersInit = {
        ...options.headers,
    }

    // Auto-retrieve token from auth store if not provided
    let authToken = token;
    if (authToken === undefined) {
        // Dynamically import to avoid circular dependency
        const { useAuthStore } = await import('@/store/auth-store');
        authToken = useAuthStore.getState().token;
    }

    if (authToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`
    }

    const url = endpoint.startsWith('/api/')
        ? endpoint
        : isBrowser
            ? `/api${endpoint}`
            : `${API_BASE_URL}${endpoint}`

    const response = await fetch(url, {
        ...options,
        headers,
    })

    if (!response.ok) {
        throw new ApiError(response.status, 'Download failed')
    }

    return response.blob()
}

// ============ Auth API ============

export const authApi = {
    /**
     * Global login - returns user info and available tenants
     */
    login: (email: string, password: string): Promise<LoginResponse> =>
        apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    /**
     * Login with tenant selection - returns scoped JWT
     */
    loginWithTenant: (
        email: string,
        password: string,
        tenantId?: string
    ): Promise<TokenResponse | { tenants: Tenant[]; require_tenant_selection: boolean }> =>
        apiFetch('/auth/v1/login-with-tenant', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                tenant_id: tenantId,
            }),
        }),

    /**
     * Check engine health for multiple tenants
     */
    checkEngineHealth: (tenantIds: string[], token: string): Promise<{ results: Record<string, { status: string; engine?: string; error?: string }> }> =>
        apiFetch('/auth/engine-health', {
            method: 'POST',
            body: JSON.stringify({ tenant_ids: tenantIds }),
        }, token),

    /**
     * Get current user's memberships with roles
     */
    getMemberships: (token: string): Promise<TenantMembership[]> =>
        apiFetch('/auth/me/memberships', {}, token),
}

// ============ IAM API ============

export interface InviteUserRequest {
    email: string
    full_name?: string
    role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER'
}

export interface InviteUserResponse {
    message: string
    invitation_code: string
    user_code: string
    type: 'INVITED_NEW' | 'INVITED_EXISTING' | 'REINVITED'
}

export interface CreateUserRequest {
    email: string
    full_name: string
    password: string
    role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER'
    country_code?: string
}

export interface CreateUserResponse {
    message: string
    user: {
        id: string
        user_code: string
        email: string
        full_name: string
    }
    role: string
    type: 'NEW_USER_CREATED' | 'EXISTING_USER_ADDED'
}

export interface TenantUser {
    id: string
    user_code: string
    email: string
    full_name: string | null
    is_active: boolean
    membership_status: string
    legacy_role: string
    rbac_roles: Array<{
        role_id: string
        role_code: string
        role_name: string
        assigned_at: string
    }>
}

export interface TenantUsersResponse {
    tenant_id: string
    total: number
    users: TenantUser[]
}

export interface TenantWithMetadata {
    id: string
    tenant_code: string
    name: string
    country_code: string
    status: string
    engine: 'odoo' | 'erpnext'
    member_count: number
    created_at: string
    owner?: {
        id: string
        email: string
        full_name: string | null
    }
}

export interface AllTenantsResponse {
    total: number
    tenants: TenantWithMetadata[]
    skip: number
    limit: number
}

export interface TenantSettings {
    id: string
    tenant_id: string
    enable_invoicing: boolean
    enable_pos: boolean
    enable_inventory: boolean
    enable_hr: boolean
    enable_projects: boolean
    company_name?: string
    logo_url?: string
    currency: string
    timezone: string
    created_at: string
    updated_at: string
}

export interface ModuleToggles {
    enable_invoicing?: boolean
    enable_pos?: boolean
    enable_inventory?: boolean
    enable_hr?: boolean
    enable_projects?: boolean
}

export interface Role {
    id: string
    code: string
    name: string
    description?: string
    level: string
    scope: string
    is_system: boolean
}

export interface RbacPermission {
    id: string
    code: string
    module: string
    resource: string
    action: string
    description?: string
    risk_level: string
}

export interface RoleWithPermissions extends Role {
    permissions: RbacPermission[]
}

export interface UserRole {
    id: string
    user_id: string
    tenant_id?: string
    role_id: string
    role_code: string
    role_name: string
    assigned_by?: string
    assigned_at: string
    expires_at?: string
    is_active: boolean
}

export const iamApi = {
    /**
     * List all tenants (SUPER_ADMIN only)
     */
    /**
     * Update member role in tenant
     */
    updateMembership: (token: string, tenantId: string, userId: string, role: string, status?: string): Promise<{ message: string }> => {
        return apiFetch(`/iam/tenants/${tenantId}/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role, status })
        }, token)
    },

    listAllTenants: (
        token: string,
        skip: number = 0,
        limit: number = 100,
        status?: string,
        engine?: string
    ): Promise<AllTenantsResponse> => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
        })
        if (status) params.append('status', status)
        if (engine) params.append('engine', engine)

        return apiFetch(`/iam/tenants?${params.toString()}`, {}, token)
    },

    createTenant: (data: {
        name: string
        category?: string
        description?: string
        country_code?: string
        admin_email: string
        admin_name: string
        admin_password: string
        engine?: 'odoo' | 'erpnext'
    }, token?: string) =>
        apiFetch('/iam/tenants', {
            method: 'POST',
            body: JSON.stringify(data),
        }, token),

    /**
     * Invite a user to a tenant (sends invitation code)
     */
    inviteUser: (tenantId: string, data: InviteUserRequest, token: string): Promise<InviteUserResponse> =>
        apiFetch(`/iam/tenants/${tenantId}/invite`, {
            method: 'POST',
            body: JSON.stringify(data),
        }, token),

    /**
     * Create a user directly with password (for internal staff)
     */
    createUser: (tenantId: string, data: CreateUserRequest, token: string): Promise<CreateUserResponse> =>
        apiFetch(`/iam/tenants/${tenantId}/users/create`, {
            method: 'POST',
            body: JSON.stringify(data),
        }, token),

    /**
     * Get all users in a tenant
     */
    getTenantUsers: (tenantId: string, token: string): Promise<TenantUsersResponse> =>
        apiFetch(`/iam/tenants/${tenantId}/users`, {}, token),

    /**
     * Update a user's role in a tenant
     */
    updateUserRole: (tenantId: string, userId: string, role: string, token: string) =>
        apiFetch(`/iam/tenants/${tenantId}/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        }, token),

    /**
     * Remove a user from a tenant
     */
    removeUser: (tenantId: string, userId: string, token: string) =>
        apiFetch(`/iam/tenants/${tenantId}/users/${userId}`, {
            method: 'DELETE',
        }, token),
}

// ============ ERP API (Engine-Agnostic) ============

// ============ Provisioning API ============

export interface ProvisioningConfig {
    include_demo_data?: boolean
    pos_store_enabled?: boolean
    country_template?: string | null
    template?: string
}

export interface StepError {
    step: string
    error: string
}

export interface ProvisioningStatus {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
    current_step?: string | null
    progress: number
    steps_completed: number
    total_steps: number
    errors: StepError[]
    estimated_completion?: string | null
    started_at?: string | null
    completed_at?: string | null
}

export interface ProvisioningLog {
    step: string
    status: string
    message?: string
    error?: string
    completed_at?: string
    duration_ms?: number
}

export const provisioningApi = {
    /**
     * Start provisioning for a tenant
     */
    startProvisioning: (tenantId: string, config?: ProvisioningConfig, token?: string): Promise<ProvisioningStatus> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/start`, {
            method: 'POST',
            body: JSON.stringify(config || {}),
        }, token),

    /**
     * Get provisioning status for a tenant
     */
    getProvisioningStatus: (tenantId: string, token?: string): Promise<ProvisioningStatus> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/status`, {}, token),

    /**
     * Retry failed provisioning step or entire provisioning
     */
    /**
     * Retry provisioning - clears all failed steps and retries from beginning
     */
    retryProvisioning: (tenantId: string, step?: string, token?: string): Promise<ProvisioningStatus> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/retry`, {
            method: 'POST',
            body: JSON.stringify({ step: step || null }),
        }, token),

    /**
     * Continue provisioning - resumes from the first failed step (keeps completed steps)
     */
    continueProvisioning: (tenantId: string, token?: string): Promise<ProvisioningStatus> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/continue`, {
            method: 'POST',
            body: JSON.stringify({}),
        }, token),

    /**
     * Skip an optional provisioning step
     */
    skipStep: (tenantId: string, step: string, token?: string): Promise<ProvisioningStatus> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/skip-step`, {
            method: 'POST',
            body: JSON.stringify({ step }),
        }, token),

    /**
     * Get provisioning logs for debugging
     */
    getProvisioningLogs: (tenantId: string, token?: string): Promise<{ logs: ProvisioningLog[] }> =>
        apiFetch(`/api/provisioning/tenants/${tenantId}/logs`, {}, token),
}

export const erpApi = {
    getPartners: (token: string, limit = 10): Promise<Partner[]> =>
        apiFetch(`/erp/partners?limit=${limit}`, {}, token),
}

export const erpNextApi = {
    listResource: <T = any>(token: string, doctype: string, params?: Record<string, string>): Promise<T[]> => {
        const query = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiFetch(`/erpnext/resource/${doctype}${query}`, {}, token).then((res: any) => {
            // Handle different response structures
            if (Array.isArray(res)) {
                return res;
            }
            if (res && typeof res === 'object') {
                // ResponseNormalizer wraps in {data: ...}
                if (Array.isArray(res.data)) {
                    return res.data;
                }
                // ERPNext might return {data: {data: [...]}} in some cases
                if (res.data && Array.isArray(res.data.data)) {
                    return res.data.data;
                }
                // If data is an object with a list property (e.g., {data: {items: [...]}})
                if (res.data && typeof res.data === 'object') {
                    const keys = Object.keys(res.data);
                    if (keys.length > 0 && Array.isArray(res.data[keys[0]])) {
                        return res.data[keys[0]];
                    }
                }
            }
            return [];
        });
    },
    getResource: <T = any>(token: string, doctype: string, name: string): Promise<T> =>
        apiFetch(`/erpnext/resource/${doctype}/${name}`, {}, token),
    createResource: <T = any>(token: string, doctype: string, data: any): Promise<T> =>
        apiFetch(`/erpnext/resource/${doctype}`, { method: 'POST', body: JSON.stringify(data) }, token),
    updateResource: <T = any>(token: string, doctype: string, name: string, data: any): Promise<T> =>
        apiFetch(`/erpnext/resource/${doctype}/${name}`, { method: 'PUT', body: JSON.stringify(data) }, token),
    deleteResource: (token: string, doctype: string, name: string): Promise<any> =>
        apiFetch(`/erpnext/resource/${doctype}/${name}`, { method: 'DELETE' }, token),
}

// ============ PoS API ============

export interface POSItem {
    item_code: string
    item_name: string
    item_group?: string
    stock_uom: string
    valuation_rate?: number
    standard_rate: number
    default_warehouse?: string
    stock_qty?: number  // Available stock quantity
    is_stock_item?: boolean | null
    image?: string  // Product image URL
    description?: string
}

export interface POSBulkStockRequest {
    pos_profile_id?: string
    warehouse?: string
    item_codes: string[]
}

export interface POSBulkStockResponse {
    warehouse: string
    pos_profile_id?: string | null
    as_of: string
    stocks: Array<{ item_code: string; qty: number }>
    missing_item_codes: string[]
}

export interface POSWarehouse {
    name: string
    warehouse_name?: string
    warehouse_code: string
    company: string
    is_group: boolean
    disabled: boolean
    parent_warehouse?: string
    warehouse_type?: string
    account?: string
    address_line_1?: string
    email_id?: string
}

export interface POSSalesPerson {
    name: string
    sales_person_name: string
    referral_prefix: string
    commission_rate: number
    person_type: string
    volume_threshold?: number
}

export interface POSPaymentMode {
    name: string
    type: string
    default_account: string
}

export interface POSInvoice {
    name: string
    posting_date: string
    posting_time: string
    customer: string
    customer_type: string
    referral_code?: string
    items: Array<{
        item_code: string
        qty: number
        rate: number
        warehouse: string
    }>
    payments: Array<{
        mode_of_payment: string
        amount: number
    }>
    net_total: number
    grand_total: number
    total_qty: number
    is_pos: number
    status: string
    sales_team: Array<{
        sales_person: string
        allocated_percentage: number
        commission_rate: number
        incentives: number
    }>
    commission_amount: number
    commission_rate: number
}

export interface POSInvoiceRequest {
    customer: string
    customer_type: 'Direct' | 'Fundi' | 'Sales Team' | 'Wholesaler'
    referral_code?: string
    pos_profile_id: string  // REQUIRED: POS Profile ID for warehouse and payment account mapping
    items: Array<{
        item_code: string
        qty: number
        rate?: number
        warehouse?: string
        is_vatable?: boolean  // Whether item is VATable
    }>
    payments: Array<{
        mode_of_payment: string
        amount: number
    }>
    warehouse?: string
    notes?: string
}

export interface DailySummary {
    date: string
    total_sales: number
    total_transactions: number
    total_commission: number
    by_customer_type: Record<string, { count: number; total: number }>
    by_payment_mode: {
        cash: number
        mpesa: number
        bank: number
        total: number
    }
}

export const posApi = {
    // Catalog
    getItems: (token: string): Promise<{ items: POSItem[] }> =>
        apiFetch('/pos/items', {}, token),

    getItem: (token: string, itemCode: string): Promise<POSItem> =>
        apiFetch(`/pos/items/${itemCode}`, {}, token),

    getItemStock: (token: string, itemCode: string, warehouse?: string): Promise<{ item_code: string; warehouse: string; qty: number }> =>
        apiFetch(`/pos/items/${itemCode}/stock${warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : ''}`, {}, token),

    getBulkStock: (token: string, request: POSBulkStockRequest): Promise<POSBulkStockResponse> =>
        apiFetch('/pos/stock/bulk', { method: 'POST', body: JSON.stringify(request) }, token),

    // Warehouses
    getWarehouses: (token: string): Promise<{ warehouses: POSWarehouse[] }> =>
        apiFetch('/pos/warehouses', {}, token),

    // POS Profiles
    getPosProfiles: (token: string, warehouse?: string): Promise<{ profiles: any[] }> =>
        apiFetch(`/pos/profiles${warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : ''}`, {}, token),

    getPosProfile: (token: string, profileId: string): Promise<any> =>
        apiFetch(`/pos/profiles/${profileId}`, {}, token),

    // Payment Modes
    getPaymentModes: (token: string): Promise<{ payment_modes: POSPaymentMode[] }> =>
        apiFetch('/pos/payment-modes', {}, token),

    // Sales Persons
    getSalesPersons: (token: string, personType?: string): Promise<{ sales_persons: POSSalesPerson[] }> =>
        apiFetch(`/pos/sales-persons${personType ? `?person_type=${encodeURIComponent(personType)}` : ''}`, {}, token),

    // Customers
    getCustomers: (token: string, customerGroup?: string): Promise<{ customers: any[] }> =>
        apiFetch(`/pos/customers${customerGroup ? `?customer_group=${encodeURIComponent(customerGroup)}` : ''}`, {}, token),

    createCustomer: (token: string, data: { customer_name: string; customer_type?: string; customer_group?: string; phone?: string; email?: string }) =>
        apiFetch('/pos/customers', { method: 'POST', body: JSON.stringify(data) }, token),

    // Invoices
    createInvoice: (token: string, invoice: POSInvoiceRequest): Promise<POSInvoice> =>
        apiFetch('/pos/invoice', { method: 'POST', body: JSON.stringify(invoice) }, token),

    getInvoices: (token: string, limit?: number): Promise<{ invoices: POSInvoice[] }> =>
        apiFetch(`/pos/invoices${limit ? `?limit=${limit}` : ''}`, {}, token),

    getInvoice: (token: string, invoiceName: string): Promise<POSInvoice> =>
        apiFetch(`/pos/invoices/${invoiceName}`, {}, token),

    // Reports
    getCashSummary: (token: string): Promise<{ cash: number; mpesa: number; bank: number; total: number }> =>
        apiFetch('/pos/reports/cash-summary', {}, token),

    getCommissionReport: (token: string, salesPerson?: string): Promise<any[]> =>
        apiFetch(`/pos/reports/commissions${salesPerson ? `?sales_person=${encodeURIComponent(salesPerson)}` : ''}`, {}, token),

    // Import
    importInventory: (token: string, file: File): Promise<{ success: boolean; imported_count: number; errors: string[] }> => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('/pos/import/inventory', {
            method: 'POST',
            body: formData,
            headers: {}, // Let browser set content-type for FormData
        }, token);
    },

    getDailySummary: (token: string, date?: string): Promise<DailySummary> =>
        apiFetch(`/pos/reports/daily-summary${date ? `?date=${date}` : ''}`, {}, token),

    // Quick Actions
    getFrequentItems: (token: string, posProfileId: string, limit?: number, daysBack?: number): Promise<any> =>
        apiFetch(`/pos/quick-actions/frequent-items?pos_profile_id=${encodeURIComponent(posProfileId)}${limit ? `&limit=${limit}` : ''}${daysBack ? `&days_back=${daysBack}` : ''}`, {}, token),

    getRecentCustomers: (token: string, posProfileId: string, limit?: number, daysBack?: number): Promise<any> =>
        apiFetch(`/pos/quick-actions/recent-customers?pos_profile_id=${encodeURIComponent(posProfileId)}${limit ? `&limit=${limit}` : ''}${daysBack ? `&days_back=${daysBack}` : ''}`, {}, token),

    searchItems: (token: string, query: string, posProfileId?: string, limit?: number): Promise<any> =>
        apiFetch(`/pos/quick-actions/search-items?q=${encodeURIComponent(query)}${posProfileId ? `&pos_profile_id=${encodeURIComponent(posProfileId)}` : ''}${limit ? `&limit=${limit}` : ''}`, {}, token),

    createQuickSale: (token: string, presetId: string, posProfileId: string): Promise<any> =>
        apiFetch('/pos/quick-actions/quick-sale', {
            method: 'POST',
            body: JSON.stringify({ preset_id: presetId, pos_profile_id: posProfileId })
        }, token),

    repeatLastSale: (token: string, customer: string, posProfileId: string): Promise<any> =>
        apiFetch('/pos/quick-actions/repeat-last-sale', {
            method: 'POST',
            body: JSON.stringify({ customer, pos_profile_id: posProfileId })
        }, token),

    createQuickCustomer: (token: string, customerData: any): Promise<any> =>
        apiFetch('/pos/quick-actions/quick-customer', {
            method: 'POST',
            body: JSON.stringify(customerData)
        }, token),

    bulkAddItems: (token: string, items: any[], posProfileId: string): Promise<any> =>
        apiFetch('/pos/quick-actions/bulk-add', {
            method: 'POST',
            body: JSON.stringify({ items, pos_profile_id: posProfileId })
        }, token),

    // M-Pesa Payments
    initiateSTKPush: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/payments/mpesa/stk-push', { method: 'POST', body: JSON.stringify(request) }, token),

    confirmMpesaPayment: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/payments/mpesa/confirm', { method: 'POST', body: JSON.stringify(request) }, token),

    queryMpesaTransaction: (token: string, checkoutRequestId: string): Promise<any> =>
        apiFetch('/api/pos/payments/mpesa/query', { method: 'POST', body: JSON.stringify({ checkout_request_id: checkoutRequestId }) }, token),

    // Loyalty
    getCustomerPoints: (token: string, customer: string): Promise<any> =>
        apiFetch(`/api/pos/loyalty/customer/${encodeURIComponent(customer)}/points`, {}, token),

    getCustomerTier: (token: string, customer: string): Promise<any> =>
        apiFetch(`/api/pos/loyalty/customer/${encodeURIComponent(customer)}/tier`, {}, token),

    calculatePoints: (token: string, purchaseAmount: number, customer: string, isBirthday?: boolean): Promise<any> =>
        apiFetch('/api/pos/loyalty/calculate-points', {
            method: 'POST',
            body: JSON.stringify({ purchase_amount: purchaseAmount, customer, is_birthday: isBirthday || false })
        }, token),

    redeemPoints: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/loyalty/redeem', { method: 'POST', body: JSON.stringify(request) }, token),

    awardReferralPoints: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/loyalty/referral', { method: 'POST', body: JSON.stringify(request) }, token),

    // Layaway
    createLayaway: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/layaway/create', { method: 'POST', body: JSON.stringify(request) }, token),

    getLayawayStatus: (token: string, layawayId: string): Promise<any> =>
        apiFetch(`/api/pos/layaway/${layawayId}`, {}, token),

    recordLayawayPayment: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/layaway/payment', { method: 'POST', body: JSON.stringify(request) }, token),

    completeLayaway: (token: string, layawayId: string): Promise<any> =>
        apiFetch(`/api/pos/layaway/${layawayId}/complete`, { method: 'POST' }, token),

    cancelLayaway: (token: string, layawayId: string, refundPolicy?: string): Promise<any> =>
        apiFetch(`/api/pos/layaway/${layawayId}/cancel`, { method: 'POST', body: JSON.stringify({ refund_policy: refundPolicy || 'partial' }) }, token),

    // Offline Sync
    getSyncStatus: (token: string): Promise<any> =>
        apiFetch('/api/pos/sync/status', {}, token),

    getPendingTransactions: (token: string): Promise<{ transactions: any[] }> =>
        apiFetch('/api/pos/sync/pending', {}, token),

    getTransactionStatus: (token: string, transactionId: string): Promise<any> =>
        apiFetch(`/api/pos/sync/transaction/${transactionId}`, {}, token),

    syncPendingTransactions: (token: string, maxRetries?: number): Promise<any> =>
        apiFetch('/api/pos/sync/sync', { method: 'POST', body: JSON.stringify({ max_retries: maxRetries || 3 }) }, token),

    resolveConflict: (token: string, request: any): Promise<any> =>
        apiFetch('/api/pos/sync/resolve-conflict', { method: 'POST', body: JSON.stringify(request) }, token),

    // Analytics
    getDailySales: (token: string, date?: string): Promise<any> =>
        apiFetch(`/api/pos/analytics/daily${date ? `?date=${date}` : ''}`, {}, token),

    getProductPerformance: (token: string, fromDate?: string, toDate?: string, limit?: number): Promise<any> =>
        apiFetch(`/api/pos/analytics/products${fromDate ? `?from_date=${fromDate}` : ''}${toDate ? `&to_date=${toDate}` : ''}${limit ? `&limit=${limit}` : ''}`, {}, token),

    getPaymentAnalysis: (token: string, fromDate?: string, toDate?: string): Promise<any> =>
        apiFetch(`/api/pos/analytics/payments${fromDate ? `?from_date=${fromDate}` : ''}${toDate ? `&to_date=${toDate}` : ''}`, {}, token),

    getStaffPerformance: (token: string, fromDate?: string, toDate?: string): Promise<any> =>
        apiFetch(`/api/pos/analytics/staff${fromDate ? `?from_date=${fromDate}` : ''}${toDate ? `&to_date=${toDate}` : ''}`, {}, token),

    getCustomerInsights: (token: string, fromDate?: string, toDate?: string, limit?: number): Promise<any> =>
        apiFetch(`/api/pos/analytics/customers${fromDate ? `?from_date=${fromDate}` : ''}${toDate ? `&to_date=${toDate}` : ''}${limit ? `&limit=${limit}` : ''}`, {}, token),

    // Receipts
    getReceipt: (token: string, invoiceId: string, format?: string, language?: string): Promise<string> => {
        const normalized = (typeof invoiceId === 'string' ? invoiceId.trim() : '')
        if (!normalized || ['undefined', 'null', 'none'].includes(normalized.toLowerCase())) {
            throw new ApiError(400, 'Invoice ID is missing or invalid')
        }
        return apiFetch(`/pos/receipts/${normalized}?format=${format || 'html'}&language=${language || 'en'}`, {}, token)
            .then((res: any) => res?.content ?? '')
    },

    getThermalReceipt: (token: string, invoiceId: string, width?: number, language?: string): Promise<string> => {
        const normalized = (typeof invoiceId === 'string' ? invoiceId.trim() : '')
        if (!normalized || ['undefined', 'null', 'none'].includes(normalized.toLowerCase())) {
            throw new ApiError(400, 'Invoice ID is missing or invalid')
        }
        return apiFetch(`/pos/receipts/${normalized}/thermal?width=${width || 80}&language=${language || 'en'}`, {}, token)
            .then((res: any) => res?.content ?? '')
    },

    emailReceipt: (token: string, invoiceId: string, email: string, language?: string): Promise<any> =>
        (() => {
            const normalized = (typeof invoiceId === 'string' ? invoiceId.trim() : '')
            if (!normalized || ['undefined', 'null', 'none'].includes(normalized.toLowerCase())) {
                throw new ApiError(400, 'Invoice ID is missing or invalid')
            }
            return apiFetch(`/pos/receipts/${normalized}/email`, {
            method: 'POST',
            body: JSON.stringify({ email, language: language || 'en' })
            }, token)
        })(),

    smsReceipt: (token: string, invoiceId: string, phoneNumber: string, language?: string): Promise<any> =>
        (() => {
            const normalized = (typeof invoiceId === 'string' ? invoiceId.trim() : '')
            if (!normalized || ['undefined', 'null', 'none'].includes(normalized.toLowerCase())) {
                throw new ApiError(400, 'Invoice ID is missing or invalid')
            }
            return apiFetch(`/pos/receipts/${normalized}/sms`, {
            method: 'POST',
            body: JSON.stringify({ phone_number: phoneNumber, language: language || 'en' })
            }, token)
        })(),

    bulkPrintReceipts: (token: string, invoiceIds: string[], format?: string, width?: number, language?: string): Promise<any> =>
        apiFetch('/pos/receipts/bulk-print', {
            method: 'POST',
            body: JSON.stringify({
                invoice_ids: invoiceIds,
                format: format || 'thermal',
                width: width || 80,
                language: language || 'en'
            })
        }, token),

    // Internationalization
    getSupportedLanguages: (token: string): Promise<any> =>
        apiFetch('/i18n/languages', {}, token),

    getTranslations: (token: string, language: string, section?: string): Promise<any> =>
        apiFetch(`/i18n/translations/${language}${section ? `?section=${section}` : ''}`, {}, token),

    formatCurrency: (token: string, amount: number, currency?: string, language?: string): Promise<any> =>
        apiFetch('/i18n/format/currency', {
            method: 'POST',
            body: JSON.stringify({ amount, currency: currency || 'KES', language: language || 'en' })
        }, token),

    formatDate: (token: string, dateString: string, format?: string, language?: string): Promise<any> =>
        apiFetch('/i18n/format/date', {
            method: 'POST',
            body: JSON.stringify({
                date_string: dateString,
                format: format || 'short',
                language: language || 'en'
            })
        }, token),

    formatDateTime: (token: string, dateTimeString: string, format?: string, language?: string): Promise<any> =>
        apiFetch('/i18n/format/datetime', {
            method: 'POST',
            body: JSON.stringify({
                datetime_string: dateTimeString,
                format: format || 'short',
                language: language || 'en'
            })
        }, token),

    formatNumber: (token: string, number: number, language?: string): Promise<any> =>
        apiFetch('/i18n/format/number', {
            method: 'POST',
            body: JSON.stringify({ number, language: language || 'en' })
        }, token),

    getTranslatedText: (token: string, key: string, language?: string, params?: any): Promise<any> => {
        const paramsStr = params ? `&params=${encodeURIComponent(JSON.stringify(params))}` : '';
        return apiFetch(`/i18n/text/${key}?language=${language || 'en'}${paramsStr}`, {}, token);
    },

    validateLanguage: (token: string, language: string): Promise<any> =>
        apiFetch(`/i18n/validate/${language}`, {}, token),

    // Enhanced POS Payments
    initiateMpesaPayment: (token: string, phoneNumber: string, amount: number, accountReference: string, transactionDesc?: string): Promise<any> =>
        apiFetch('/pos/payments/mpesa/stk-push', {
            method: 'POST',
            body: JSON.stringify({ phone_number: phoneNumber, amount, account_reference: accountReference, transaction_desc: transactionDesc })
        }, token),

    queryMpesaPayment: (token: string, checkoutRequestId: string): Promise<any> =>
        apiFetch('/pos/payments/mpesa/query', {
            method: 'POST',
            body: JSON.stringify({ checkout_request_id: checkoutRequestId })
        }, token),

    initiateMobileMoneyPayment: (token: string, provider: string, phoneNumber: string, amount: number, accountReference: string, transactionDesc?: string): Promise<any> =>
        apiFetch('/pos/payments/mobile-money/initiate', {
            method: 'POST',
            body: JSON.stringify({ provider, phone_number: phoneNumber, amount, account_reference: accountReference, transaction_desc: transactionDesc })
        }, token),

    calculateLoyaltyPoints: (token: string, customer: string, purchaseAmount: number, isBirthday?: boolean): Promise<any> =>
        apiFetch('/pos/payments/loyalty/calculate', {
            method: 'POST',
            body: JSON.stringify({ customer, purchase_amount: purchaseAmount, is_birthday: isBirthday })
        }, token),

    awardLoyaltyPoints: (token: string, customer: string, points: number, reason: string, invoiceId?: string): Promise<any> =>
        apiFetch('/pos/payments/loyalty/award', {
            method: 'POST',
            body: JSON.stringify({ customer, points, reason, invoice_id: invoiceId })
        }, token),

    redeemLoyaltyPoints: (token: string, customer: string, pointsToRedeem: number, invoiceId: string): Promise<any> =>
        apiFetch('/pos/payments/loyalty/redeem', {
            method: 'POST',
            body: JSON.stringify({ customer, points_to_redeem: pointsToRedeem, invoice_id: invoiceId })
        }, token),

    getLoyaltyPoints: (token: string, customer: string): Promise<any> =>
        apiFetch(`/pos/payments/loyalty/customer/${encodeURIComponent(customer)}/points`, {}, token),

    queueOfflineTransaction: (token: string, transactionType: string, data: any, priority?: number): Promise<any> =>
        apiFetch(`/pos/sync/queue?transaction_type=${transactionType}${priority ? `&priority=${priority}` : ''}`, {
            method: 'POST',
            body: JSON.stringify(data)
        }, token),

    clearOldTransactions: (token: string, maxAgeDays?: number): Promise<any> =>
        apiFetch(`/pos/sync/clear-old${maxAgeDays ? `?max_age_days=${maxAgeDays}` : ''}`, { method: 'DELETE' }, token),

    resolveSyncConflict: (token: string, conflictId: string, resolution: string): Promise<any> =>
        apiFetch('/pos/sync/resolve-conflict', {
            method: 'POST',
            body: JSON.stringify({ conflict_id: conflictId, resolution })
        }, token),

    getOfflineConfig: (token: string): Promise<any> =>
        apiFetch('/pos/sync/config', {}, token),

    testOnlineConnectivity: (token: string): Promise<any> =>
        apiFetch('/pos/sync/test-connectivity', { method: 'POST' }, token),

    forceSyncNow: (token: string): Promise<any> =>
        apiFetch('/pos/sync/force-sync', { method: 'POST' }, token),
}

// ============ Accounting API ============

// Accounting exports removed to avoid conflict with accounting.ts

// ============ Import API ============

export interface ImportValidation {
    valid: boolean
    errors: string[]
    row_count: number
    preview: any[]
}

export interface ImportResult {
    processed: number
    created: number
    errors?: string[]
}

export const importApi = {
    getTemplate: (token: string, entityType: string): Promise<Blob> =>
        apiFetchBlob(`/imports/template/${entityType}`, {}, token),

    validate: (token: string, entityType: string, file: File): Promise<ImportValidation> => {
        const formData = new FormData()
        formData.append('file', file)
        return apiFetch(`/imports/validate/${entityType}`, {
            method: 'POST',
            body: formData,
        }, token)
    },

    execute: (token: string, entityType: string, file: File): Promise<ImportResult> => {
        const formData = new FormData()
        formData.append('file', file)
        return apiFetch(`/imports/execute/${entityType}`, {
            method: 'POST',
            body: formData,
        }, token)
    }
}

// ============ Query Keys ============

export const queryKeys = {
    user: ['user'] as const,
    tenants: ['tenants'] as const,
    partners: (tenantId: string) => ['partners', tenantId] as const,
    partner: (tenantId: string, id: string) => ['partners', tenantId, id] as const,
}

// ============ Generic API Client ============
// For use in stores that need a simple axios-like interface

export const api = {
    get: async <T = any>(endpoint: string, token?: string): Promise<{ data: T }> => {
        const result = await apiFetch<T>(endpoint, {}, token)
        return { data: result }
    },
    post: async <T = any>(endpoint: string, data?: any, token?: string): Promise<{ data: T }> => {
        const result = await apiFetch<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        }, token)
        return { data: result }
    },
    put: async <T = any>(endpoint: string, data?: any, token?: string): Promise<{ data: T }> => {
        const result = await apiFetch<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        }, token)
        return { data: result }
    },
    patch: async <T = any>(endpoint: string, data?: any, token?: string): Promise<{ data: T }> => {
        const result = await apiFetch<T>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }, token)
        return { data: result }
    },
    delete: async <T = any>(endpoint: string, token?: string): Promise<{ data: T }> => {
        const result = await apiFetch<T>(endpoint, {
            method: 'DELETE'
        }, token)
        return { data: result }
    }
}

// ============ Settings API ============

export const settingsApi = {
    /**
     * Get tenant settings
     */
    getTenantSettings: (token: string): Promise<{ data: TenantSettings }> => {
        return apiFetch('/api/settings/tenant', {}, token)
    },

    /**
     * Update module toggles
     */
    updateModules: (token: string, modules: ModuleToggles): Promise<{ data: TenantSettings, message: string }> => {
        return apiFetch('/api/settings/tenant/modules', {
            method: 'PATCH',
            body: JSON.stringify(modules)
        }, token)
    }
}

// ============ RBAC API ============

export const rbacApi = {
    /**
     * List all available roles
     */
    listRoles: (token: string): Promise<Role[]> => {
        return apiFetch('/rbac/roles', {}, token)
    },

    /**
     * Get role with permissions
     */
    getRolePermissions: (token: string, roleCode: string): Promise<RoleWithPermissions> => {
        return apiFetch(`/rbac/roles/${roleCode}/permissions`, {}, token)
    },

    /**
     * Assign role to user in tenant
     */
    assignRole: (token: string, tenantId: string, userId: string, roleCode: string): Promise<{ message: string, user_role_id: string }> => {
        return apiFetch(`/rbac/tenants/${tenantId}/roles`, {
            method: 'POST',
            body: JSON.stringify({ role_code: roleCode, user_id: userId })
        }, token)
    },

    /**
     * Remove role from user in tenant
     */
    removeRole: (token: string, tenantId: string, userId: string, roleCode: string): Promise<{ message: string }> => {
        return apiFetch(`/rbac/tenants/${tenantId}/users/${userId}/roles/${roleCode}`, {
            method: 'DELETE'
        }, token)
    },

    /**
     * Get user's roles in tenant
     */
    getUserRoles: (token: string, tenantId: string, userId: string): Promise<UserRole[]> => {
        return apiFetch(`/rbac/tenants/${tenantId}/users/${userId}/roles`, {}, token)
    }
}
