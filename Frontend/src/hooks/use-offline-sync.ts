'use client'

import * as React from 'react'
import {
  OfflineSyncManager,
  getOfflineSyncManager,
  SyncOperation,
  SyncException,
  SyncStatus,
} from '@/services/offline-sync'
import { useTenantContext } from './use-tenant-context'

/**
 * Hook for using the offline sync manager
 * 
 * Provides reactive state and methods for offline operations
 */

export interface OfflineSyncState {
  isOnline: boolean
  pendingCount: number
  failedCount: number
  conflictCount: number
  exceptionsCount: number
  lastSync?: Date
  isSyncing: boolean
}

export interface UseOfflineSyncResult {
  // State
  state: OfflineSyncState
  
  // Queue operations
  queueCreate: <T extends Record<string, unknown>>(entity: string, data: T) => Promise<string>
  queueUpdate: <T extends Record<string, unknown>>(entity: string, data: T) => Promise<string>
  queueDelete: (entity: string, id: string) => Promise<string>
  
  // Sync
  sync: () => Promise<void>
  
  // Operations
  getPendingOperations: () => Promise<SyncOperation[]>
  getFailedOperations: () => Promise<SyncOperation[]>
  
  // Exceptions
  getExceptions: () => Promise<SyncException[]>
  resolveException: (
    exceptionId: string,
    resolution: 'use_local' | 'use_server' | 'merge' | 'discard',
  ) => Promise<void>
  
  // Cache
  cacheData: <T extends Record<string, unknown>>(entity: string, data: T) => Promise<void>
  getCachedData: <T>(entity: string) => Promise<T[]>
  getCachedItem: <T>(entity: string, id: string) => Promise<T | undefined>
  clearCache: (entity?: string) => Promise<void>
}

export function useOfflineSync(): UseOfflineSyncResult {
  const { tenantId } = useTenantContext()
  const [manager] = React.useState<OfflineSyncManager>(() => getOfflineSyncManager())
  
  const [state, setState] = React.useState<OfflineSyncState>({
    isOnline: true,
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    exceptionsCount: 0,
    isSyncing: false,
  })
  
  // Initialize and setup listeners
  React.useEffect(() => {
    manager.initialize().then(() => {
      updateState()
    })
    
    const unsubOnline = manager.on('online', () => {
      setState(prev => ({ ...prev, isOnline: true }))
    })
    
    const unsubOffline = manager.on('offline', () => {
      setState(prev => ({ ...prev, isOnline: false }))
    })
    
    const unsubStarted = manager.on('sync:started', () => {
      setState(prev => ({ ...prev, isSyncing: true }))
    })
    
    const unsubCompleted = manager.on('sync:completed', () => {
      setState(prev => ({ ...prev, isSyncing: false }))
      updateState()
    })
    
    const unsubOperation = manager.on('operation:queued', () => {
      updateState()
    })
    
    const unsubException = manager.on('exception:created', () => {
      updateState()
    })
    
    return () => {
      unsubOnline()
      unsubOffline()
      unsubStarted()
      unsubCompleted()
      unsubOperation()
      unsubException()
    }
  }, [manager])
  
  const updateState = async () => {
    const status = await manager.getStatus()
    setState({
      isOnline: status.isOnline,
      pendingCount: status.pendingCount,
      failedCount: status.failedCount,
      conflictCount: status.conflictCount,
      exceptionsCount: status.exceptionsCount,
      lastSync: status.lastSync ? new Date(status.lastSync) : undefined,
      isSyncing: false,
    })
  }
  
  // Queue operations
  const queueCreate = React.useCallback(async <T extends Record<string, unknown>>(
    entity: string,
    data: T
  ): Promise<string> => {
    if (!tenantId) throw new Error('No tenant context')
    return manager.queueOperation('create', entity, data, tenantId)
  }, [manager, tenantId])
  
  const queueUpdate = React.useCallback(async <T extends Record<string, unknown>>(
    entity: string,
    data: T
  ): Promise<string> => {
    if (!tenantId) throw new Error('No tenant context')
    return manager.queueOperation('update', entity, data, tenantId)
  }, [manager, tenantId])
  
  const queueDelete = React.useCallback(async (
    entity: string,
    id: string
  ): Promise<string> => {
    if (!tenantId) throw new Error('No tenant context')
    return manager.queueOperation('delete', entity, { id }, tenantId)
  }, [manager, tenantId])
  
  // Sync
  const sync = React.useCallback(async () => {
    await manager.syncPendingOperations()
    await updateState()
  }, [manager])
  
  // Operations
  const getPendingOperations = React.useCallback(async () => {
    return manager.getQueuedOperations(tenantId || undefined, 'pending')
  }, [manager, tenantId])
  
  const getFailedOperations = React.useCallback(async () => {
    return manager.getQueuedOperations(tenantId || undefined, 'failed')
  }, [manager, tenantId])
  
  // Exceptions
  const getExceptions = React.useCallback(async () => {
    return manager.getExceptions(false)
  }, [manager])
  
  const resolveException = React.useCallback(async (
    exceptionId: string,
    resolution: 'use_local' | 'use_server' | 'merge' | 'discard'
  ) => {
    await manager.resolveException(exceptionId, resolution)
    await updateState()
  }, [manager])
  
  // Cache
  const cacheData = React.useCallback(async <T extends Record<string, unknown>>(
    entity: string,
    data: T
  ) => {
    if (!tenantId) throw new Error('No tenant context')
    await manager.cacheData(entity, data, tenantId)
  }, [manager, tenantId])
  
  const getCachedData = React.useCallback(async <T>(entity: string) => {
    if (!tenantId) return []
    return manager.getCachedData<T>(entity, tenantId)
  }, [manager, tenantId])
  
  const getCachedItem = React.useCallback(async <T>(entity: string, id: string) => {
    return manager.getCachedItem<T>(entity, id)
  }, [manager])
  
  const clearCache = React.useCallback(async (entity?: string) => {
    await manager.clearCache(entity, tenantId || undefined)
  }, [manager, tenantId])
  
  return {
    state,
    queueCreate,
    queueUpdate,
    queueDelete,
    sync,
    getPendingOperations,
    getFailedOperations,
    getExceptions,
    resolveException,
    cacheData,
    getCachedData,
    getCachedItem,
    clearCache,
  }
}

export default useOfflineSync
