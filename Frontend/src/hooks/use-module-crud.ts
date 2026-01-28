'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { apiFetch, ApiError } from '@/lib/api/core'
import { useTenantContext } from './use-tenant-context'
import { toast } from 'sonner'

/**
 * Generic CRUD hook for module data management
 * 
 * Provides standardized data fetching, creation, updates, and deletion
 * with built-in caching, pagination, and error handling.
 */

export interface CrudOptions<T> {
  // API endpoint (e.g., '/inventory/items')
  endpoint: string
  
  // Query key prefix for caching
  queryKey: string
  
  // Transform function for list response
  listTransform?: (response: any) => { items: T[]; total: number }
  
  // Transform function for single item response
  itemTransform?: (response: any) => T
  
  // Fields to include in list requests
  listFields?: string[]
  
  // Default filters
  defaultFilters?: Record<string, unknown>
  
  // Items per page
  pageSize?: number
  
  // Success/error messages
  messages?: {
    createSuccess?: string
    updateSuccess?: string
    deleteSuccess?: string
    createError?: string
    updateError?: string
    deleteError?: string
  }
  
  // Disable automatic refetch on window focus
  disableRefetchOnFocus?: boolean
}

export interface UseModuleCrudResult<T> {
  // Data
  items: T[]
  total: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  
  // Pagination
  page: number
  pageSize: number
  totalPages: number
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  
  // Search & Filters
  search: string
  setSearch: (search: string) => void
  filters: Record<string, unknown>
  setFilters: (filters: Record<string, unknown>) => void
  clearFilters: () => void
  
  // Sorting
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
  setSort: (field: string, direction?: 'asc' | 'desc') => void
  
  // CRUD Operations
  create: (data: Partial<T>) => Promise<T>
  update: (id: string, data: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<void>
  
  // Mutations state
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  
  // Refresh
  refresh: () => void
  
  // Get single item
  getItem: (id: string) => Promise<T>
}

export function useModuleCrud<T extends { id?: string; name?: string }>(
  options: CrudOptions<T>
): UseModuleCrudResult<T> {
  const {
    endpoint,
    queryKey,
    listTransform = defaultListTransform,
    itemTransform = defaultItemTransform,
    pageSize: defaultPageSize = 50,
    defaultFilters = {},
    messages = {},
    disableRefetchOnFocus = false,
  } = options
  
  const { tenantId, buildErpUrl } = useTenantContext()
  const queryClient = useQueryClient()
  
  // State
  const [page, setPage] = useState(1)
  const [pageSize] = useState(defaultPageSize)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown>>(defaultFilters)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Build the full API URL
  const apiUrl = useMemo(() => {
    if (!tenantId) return null
    
    // Parse moduleName from endpoint (e.g., '/inventory/items' -> 'inventory')
    const parts = endpoint.split('/').filter(Boolean)
    const moduleName = parts[0]
    const path = '/' + parts.slice(1).join('/')
    
    return buildErpUrl(moduleName, path)
  }, [tenantId, endpoint, buildErpUrl])
  
  // Query key with pagination and filters
  const fullQueryKey = useMemo(() => [
    queryKey,
    tenantId,
    { page, pageSize, search, filters, sortBy, sortDirection }
  ], [queryKey, tenantId, page, pageSize, search, filters, sortBy, sortDirection])
  
  // List query
  const listQuery = useQuery({
    queryKey: fullQueryKey,
    queryFn: async () => {
      if (!apiUrl) throw new Error('No tenant context')
      
      const params = new URLSearchParams()
      params.set('limit', String(pageSize))
      params.set('offset', String((page - 1) * pageSize))
      
      if (search) params.set('search', search)
      if (sortBy) {
        params.set('order_by', sortBy)
        params.set('order_direction', sortDirection)
      }
      if (Object.keys(filters).length > 0) {
        params.set('filters', JSON.stringify(filters))
      }
      
      const url = `${apiUrl}?${params.toString()}`
      const response = await apiFetch<any>(url)
      
      return listTransform(response)
    },
    enabled: !!apiUrl,
    refetchOnWindowFocus: !disableRefetchOnFocus,
    staleTime: 30000, // 30 seconds
  })
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<T>) => {
      if (!apiUrl) throw new Error('No tenant context')
      
      const response = await apiFetch<any>(apiUrl, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      
      return itemTransform(response.data || response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey, tenantId] })
      toast.success(messages.createSuccess || 'Created successfully')
    },
    onError: (error: ApiError) => {
      toast.error(messages.createError || error.detail || 'Failed to create')
    },
  })
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<T> }) => {
      if (!apiUrl) throw new Error('No tenant context')
      
      const response = await apiFetch<any>(`${apiUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      
      return itemTransform(response.data || response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey, tenantId] })
      toast.success(messages.updateSuccess || 'Updated successfully')
    },
    onError: (error: ApiError) => {
      toast.error(messages.updateError || error.detail || 'Failed to update')
    },
  })
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!apiUrl) throw new Error('No tenant context')
      
      await apiFetch(`${apiUrl}/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey, tenantId] })
      toast.success(messages.deleteSuccess || 'Deleted successfully')
    },
    onError: (error: ApiError) => {
      toast.error(messages.deleteError || error.detail || 'Failed to delete')
    },
  })
  
  // Get single item
  const getItem = useCallback(async (id: string): Promise<T> => {
    if (!apiUrl) throw new Error('No tenant context')
    
    const response = await apiFetch<any>(`${apiUrl}/${id}`)
    return itemTransform(response.data || response)
  }, [apiUrl, itemTransform])
  
  // Pagination helpers
  const totalPages = Math.ceil((listQuery.data?.total || 0) / pageSize)
  
  const nextPage = useCallback(() => {
    if (page < totalPages) setPage(page + 1)
  }, [page, totalPages])
  
  const prevPage = useCallback(() => {
    if (page > 1) setPage(page - 1)
  }, [page])
  
  // Filter helpers
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters)
    setSearch('')
    setPage(1)
  }, [defaultFilters])
  
  // Sort helper
  const setSort = useCallback((field: string, direction?: 'asc' | 'desc') => {
    if (sortBy === field && !direction) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDirection(direction || 'desc')
    }
    setPage(1)
  }, [sortBy, sortDirection])
  
  // CRUD wrappers
  const create = useCallback(async (data: Partial<T>) => {
    return createMutation.mutateAsync(data)
  }, [createMutation])
  
  const update = useCallback(async (id: string, data: Partial<T>) => {
    return updateMutation.mutateAsync({ id, data })
  }, [updateMutation])
  
  const remove = useCallback(async (id: string) => {
    return deleteMutation.mutateAsync(id)
  }, [deleteMutation])
  
  return {
    // Data
    items: listQuery.data?.items || [],
    total: listQuery.data?.total || 0,
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    error: listQuery.error,
    
    // Pagination
    page,
    pageSize,
    totalPages,
    setPage: (p) => setPage(p),
    nextPage,
    prevPage,
    
    // Search & Filters
    search,
    setSearch: (s) => { setSearch(s); setPage(1) },
    filters,
    setFilters: (f) => { setFilters(f); setPage(1) },
    clearFilters,
    
    // Sorting
    sortBy,
    sortDirection,
    setSort,
    
    // CRUD
    create,
    update,
    remove,
    
    // Mutations state
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    
    // Refresh
    refresh: () => listQuery.refetch(),
    
    // Get single
    getItem,
  }
}

// Default transformers
function defaultListTransform<T>(response: any): { items: T[]; total: number } {
  if (Array.isArray(response)) {
    return { items: response, total: response.length }
  }
  
  if (response?.items) {
    return { items: response.items, total: response.total || response.items.length }
  }
  
  if (response?.data) {
    const data = response.data
    if (Array.isArray(data)) {
      return { items: data, total: data.length }
    }
    return { items: data.items || [], total: data.total || 0 }
  }
  
  return { items: [], total: 0 }
}

function defaultItemTransform<T>(response: any): T {
  return response?.data || response
}

export default useModuleCrud
