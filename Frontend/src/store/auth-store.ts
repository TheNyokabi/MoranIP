import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authApi, Tenant, LoginResponse, TokenResponse, ApiError } from '@/lib/api'

export interface AuthUser {
    id: string
    userCode: string
    name: string
    email: string
    kycTier: string
    isSuperAdmin?: boolean
}

interface AuthState {
    // State
    user: AuthUser | null
    token: string | null
    availableTenants: Tenant[]
    currentTenant: Tenant | null
    isLoading: boolean
    error: string | null

    // Computed
    isSuperAdmin: () => boolean

    // Actions
    login: (email: string, password: string) => Promise<LoginResponse>
    selectTenant: (email: string, password: string, tenantId: string) => Promise<void>
    loginWithTenant: (email: string, password: string, tenantId?: string) => Promise<boolean>
    setCurrentTenant: (tenant: Tenant | null) => void
    logout: () => void
    clearError: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            availableTenants: [],
            currentTenant: null,
            isLoading: false,
            error: null,

            isSuperAdmin: () => {
                const state = get()
                return state.user?.isSuperAdmin || false
            },

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await authApi.login(email, password)

                    // Decode JWT to get is_super_admin flag
                    let isSuperAdmin = false
                    if (response.access_token) {
                        try {
                            const tokenParts = response.access_token.split('.')
                            const payload = JSON.parse(atob(tokenParts[1]))
                            isSuperAdmin = payload.is_super_admin || false
                        } catch (e) {
                            console.warn('Failed to decode token:', e)
                        }
                    }

                    // Store identity token (global, no tenant context)
                    if (response.access_token) {
                        // Set HTTP cookie for middleware
                        document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days

                        // Store in localStorage for compatibility
                        localStorage.setItem('token', response.access_token)
                        localStorage.setItem('access_token', response.access_token)
                        localStorage.setItem('moran_auth_token', response.access_token)
                        localStorage.setItem('moran_jwt_token', response.access_token)
                    }

                    set({
                        user: {
                            id: response.user_id,
                            userCode: response.user_code,
                            name: response.full_name || response.email.split('@')[0],
                            email: response.email,
                            kycTier: response.kyc_tier,
                            isSuperAdmin,
                        },
                        token: response.access_token || null,
                        availableTenants: response.tenants,
                        currentTenant: null, // No tenant context on login
                        isLoading: false,
                    })
                    return response
                } catch (e) {
                    const message = e instanceof ApiError ? e.detail : 'Login failed'
                    set({ error: message, isLoading: false })
                    throw e
                }
            },

            selectTenant: async (email: string, password: string, tenantId: string) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await authApi.loginWithTenant(email, password, tenantId)
                    if ('access_token' in response) {
                        // Decode JWT to get is_super_admin flag
                        const tokenParts = response.access_token.split('.')
                        const payload = JSON.parse(atob(tokenParts[1]))

                        // Set HTTP cookie for middleware
                        document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days

                        // Compatibility: keep legacy token keys in sync while we migrate callers
                        localStorage.setItem('token', response.access_token)
                        localStorage.setItem('access_token', response.access_token)
                        localStorage.setItem('moran_auth_token', response.access_token)
                        localStorage.setItem('moran_jwt_token', response.access_token)

                        set({
                            token: response.access_token,
                            currentTenant: response.tenant,
                            user: {
                                ...get().user!,
                                isSuperAdmin: payload.is_super_admin || false
                            },
                            isLoading: false,
                        })
                    }
                } catch (e) {
                    const message = e instanceof ApiError ? e.detail : 'Tenant selection failed'
                    set({ error: message, isLoading: false })
                    throw e
                }
            },

            loginWithTenant: async (email: string, password: string, tenantId?: string) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await authApi.loginWithTenant(email, password, tenantId)

                    if ('access_token' in response) {
                        // Decode JWT to get is_super_admin flag
                        const tokenParts = response.access_token.split('.')
                        const payload = JSON.parse(atob(tokenParts[1]))

                        // Set HTTP cookie for middleware
                        document.cookie = `auth_token=${response.access_token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days

                        // Compatibility: keep legacy token keys in sync while we migrate callers
                        localStorage.setItem('token', response.access_token)
                        localStorage.setItem('access_token', response.access_token)
                        localStorage.setItem('moran_auth_token', response.access_token)
                        localStorage.setItem('moran_jwt_token', response.access_token)

                        set({
                            token: response.access_token,
                            currentTenant: response.tenant,
                            user: {
                                ...get().user!,
                                isSuperAdmin: payload.is_super_admin || false
                            },
                            isLoading: false,
                        })
                        return true
                    } else {
                        set({
                            availableTenants: response.tenants,
                            isLoading: false,
                        })
                        return false
                    }
                } catch (e) {
                    const message = e instanceof ApiError ? e.detail : 'Login failed'
                    set({ error: message, isLoading: false })
                    throw e
                }
            },

            logout: () => {
                // Clear HTTP cookie
                document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

                localStorage.removeItem('token')
                localStorage.removeItem('access_token')
                localStorage.removeItem('moran_auth_token')
                localStorage.removeItem('moran_jwt_token')

                set({
                    user: null,
                    token: null,
                    availableTenants: [],
                    currentTenant: null,
                    error: null,
                })
            },

            setCurrentTenant: (tenant: Tenant | null) => {
                set({ currentTenant: tenant })
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'moran-auth',
            storage: createJSONStorage(() => {
                if (typeof window !== 'undefined') {
                    return localStorage
                }
                return {
                    getItem: () => null,
                    setItem: () => { },
                    removeItem: () => { },
                }
            }),
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                availableTenants: state.availableTenants,
                currentTenant: state.currentTenant,
            }),
        }
    )
)
