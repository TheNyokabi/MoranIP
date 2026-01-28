'use client'

import { useCallback, useMemo, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { getApiRoutes, getNavRoutes, buildTenantRoute, buildErpRoute } from '@/lib/api/routes'

/**
 * Hook to manage tenant context across the application.
 * 
 * Provides:
 * - Current tenant ID and slug
 * - URL builders for API calls and navigation
 * - Tenant validation
 * - Route helpers
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { tenantId, tenantSlug, api, nav, isValid } = useTenantContext()
 *   
 *   // Build API URLs
 *   const itemsUrl = api.inventory.items()
 *   
 *   // Build navigation URLs
 *   const settingsUrl = nav.settings()
 *   
 *   // Or use the generic builders
 *   const customUrl = buildApiUrl('/custom-endpoint')
 * }
 * ```
 */
export function useTenantContext() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  
  const { currentTenant, availableTenants, token } = useAuthStore()
  
  // Extract tenant slug from URL params
  const tenantSlug = params?.tenantSlug as string | undefined
  
  // Get tenant from store or find by slug
  const tenant = useMemo(() => {
    if (currentTenant) return currentTenant
    
    if (tenantSlug && availableTenants) {
      return availableTenants.find(
        t => t.code === tenantSlug || t.id === tenantSlug
      )
    }
    
    return null
  }, [currentTenant, tenantSlug, availableTenants])
  
  const tenantId = tenant?.id || null
  
  // Validate tenant context
  const isValid = !!tenantId && !!tenantSlug
  
  // Check if we're in a tenant context (URL has /w/{tenantSlug})
  const isInTenantContext = pathname?.startsWith('/w/') ?? false
  
  // Redirect to workspaces if no valid tenant context
  useEffect(() => {
    if (isInTenantContext && !isValid && token) {
      // Only redirect if we have a token but no valid tenant
      // This prevents redirect loops during initial load
      const timer = setTimeout(() => {
        router.push('/workspaces')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isInTenantContext, isValid, token, router])
  
  // Build API URL with tenant context
  const buildApiUrl = useCallback((path: string) => {
    if (!tenantId) {
      console.warn('buildApiUrl called without tenant context:', path)
      return path
    }
    return buildTenantRoute(tenantId, path)
  }, [tenantId])
  
  // Build ERP module URL
  const buildErpUrl = useCallback((module: string, path: string = '') => {
    if (!tenantId) {
      console.warn('buildErpUrl called without tenant context:', module, path)
      return `/erp/${module}${path}`
    }
    return buildErpRoute(tenantId, module, path)
  }, [tenantId])
  
  // Build navigation URL with tenant slug
  const buildNavUrl = useCallback((path: string) => {
    if (!tenantSlug) {
      console.warn('buildNavUrl called without tenant slug:', path)
      return path
    }
    return `/w/${tenantSlug}${path.startsWith('/') ? path : `/${path}`}`
  }, [tenantSlug])
  
  // Navigate within tenant context
  const navigate = useCallback((path: string) => {
    const url = buildNavUrl(path)
    router.push(url)
  }, [buildNavUrl, router])
  
  // Get all API route helpers
  const api = useMemo(() => {
    if (!tenantId) return null
    return getApiRoutes(tenantId)
  }, [tenantId])
  
  // Get all navigation route helpers  
  const nav = useMemo(() => {
    if (!tenantSlug) return null
    return getNavRoutes(tenantSlug)
  }, [tenantSlug])
  
  return {
    // IDs
    tenantId,
    tenantSlug,
    tenant,
    
    // State
    isValid,
    isInTenantContext,
    
    // URL Builders
    buildApiUrl,
    buildErpUrl,
    buildNavUrl,
    
    // Navigation
    navigate,
    
    // Route helpers (null if no tenant)
    api,
    nav,
  }
}

/**
 * Hook to require tenant context.
 * Throws an error if used outside of tenant context.
 */
export function useRequiredTenantContext() {
  const context = useTenantContext()
  
  if (!context.isValid) {
    throw new Error(
      'useRequiredTenantContext must be used within a tenant context. ' +
      'Make sure the component is rendered under a /w/[tenantSlug] route.'
    )
  }
  
  return context as Required<typeof context> & {
    tenantId: string
    tenantSlug: string
    api: NonNullable<typeof context.api>
    nav: NonNullable<typeof context.nav>
  }
}

/**
 * Hook to get tenant-scoped headers for API requests
 */
export function useTenantHeaders() {
  const { tenantId } = useTenantContext()
  const { token } = useAuthStore()
  
  return useMemo(() => {
    const headers: Record<string, string> = {}
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId
    }
    
    return headers
  }, [token, tenantId])
}

/**
 * Hook for tenant-aware navigation links
 */
export function useTenantLink(path: string): string {
  const { buildNavUrl, isValid } = useTenantContext()
  
  return useMemo(() => {
    if (!isValid) return path
    return buildNavUrl(path)
  }, [path, buildNavUrl, isValid])
}

export default useTenantContext
