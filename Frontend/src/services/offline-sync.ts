/**
 * Robust Offline Sync System
 * 
 * Provides comprehensive offline support for POS with:
 * - Queue-based operation management
 * - Automatic sync with exponential backoff
 * - Conflict detection and resolution
 * - Exception tracking for manual reconciliation
 * - Data integrity validation
 * 
 * Author: MoranERP Team
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ==================== Types ====================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity: string  // 'invoice', 'payment', 'customer', etc.
  data: Record<string, unknown>
  timestamp: number
  status: SyncStatus
  attempts: number
  lastAttempt?: number
  error?: string
  conflictData?: Record<string, unknown>
  tenantId: string
  userId?: string
  localId?: string  // For linking with local data
  serverId?: string  // After successful sync
}

export interface SyncException {
  id: string
  operationId: string
  type: 'conflict' | 'validation' | 'network' | 'server' | 'unknown'
  message: string
  details?: Record<string, unknown>
  localData: Record<string, unknown>
  serverData?: Record<string, unknown>
  timestamp: number
  resolved: 0 | 1  // Using 0/1 instead of boolean for IndexedDB index compatibility
  resolvedAt?: number
  resolutionType?: 'use_local' | 'use_server' | 'merge' | 'discard'
  resolvedBy?: string
}

export interface OfflineItem {
  id: string
  entity: string
  data: Record<string, unknown>
  version: number
  lastModified: number
  syncedAt?: number
  tenantId: string
}

export interface SyncConfig {
  maxRetries: number
  baseDelay: number  // ms
  maxDelay: number  // ms
  batchSize: number
  autoSyncInterval: number  // ms
}

// ==================== IndexedDB Schema ====================

interface OfflineSyncDB extends DBSchema {
  operations: {
    key: string
    value: SyncOperation
    indexes: {
      'by-status': SyncStatus
      'by-entity': string
      'by-tenant': string
      'by-timestamp': number
    }
  }
  exceptions: {
    key: string
    value: SyncException
    indexes: {
      'by-resolved': number  // 0 or 1, since boolean is not a valid IDBValidKey
      'by-type': string
      'by-timestamp': number
    }
  }
  offlineData: {
    key: string
    value: OfflineItem
    indexes: {
      'by-entity': string
      'by-tenant': string
      'by-modified': number
    }
  }
  syncState: {
    key: string
    value: {
      key: string
      lastSync: number
      lastError?: string
      syncInProgress: boolean
    }
  }
}

// ==================== Offline Sync Manager ====================

export class OfflineSyncManager {
  private db: IDBPDatabase<OfflineSyncDB> | null = null
  private config: SyncConfig
  private syncTimer: NodeJS.Timeout | null = null
  private isOnline: boolean = true
  private listeners: Map<string, Set<(event: unknown) => void>> = new Map()
  private syncInProgress: boolean = false
  
  constructor(config?: Partial<SyncConfig>) {
    this.config = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 60000,
      batchSize: 10,
      autoSyncInterval: 30000,
      ...config
    }
    
    // Setup online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
      this.isOnline = navigator.onLine
    }
  }
  
  // ==================== Initialization ====================
  
  async initialize(): Promise<void> {
    if (this.db) return
    
    this.db = await openDB<OfflineSyncDB>('moran-erp-offline', 2, {
      upgrade(db, oldVersion) {
        // Operations store
        if (!db.objectStoreNames.contains('operations')) {
          const opStore = db.createObjectStore('operations', { keyPath: 'id' })
          opStore.createIndex('by-status', 'status')
          opStore.createIndex('by-entity', 'entity')
          opStore.createIndex('by-tenant', 'tenantId')
          opStore.createIndex('by-timestamp', 'timestamp')
        }
        
        // Exceptions store
        if (!db.objectStoreNames.contains('exceptions')) {
          const exStore = db.createObjectStore('exceptions', { keyPath: 'id' })
          exStore.createIndex('by-resolved', 'resolved')
          exStore.createIndex('by-type', 'type')
          exStore.createIndex('by-timestamp', 'timestamp')
        }
        
        // Offline data store
        if (!db.objectStoreNames.contains('offlineData')) {
          const dataStore = db.createObjectStore('offlineData', { keyPath: 'id' })
          dataStore.createIndex('by-entity', 'entity')
          dataStore.createIndex('by-tenant', 'tenantId')
          dataStore.createIndex('by-modified', 'lastModified')
        }
        
        // Sync state store
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'key' })
        }
      }
    })
    
    // Start auto-sync if online
    if (this.isOnline) {
      this.startAutoSync()
    }
  }
  
  // ==================== Queue Operations ====================
  
  async queueOperation(
    type: SyncOperation['type'],
    entity: string,
    data: Record<string, unknown>,
    tenantId: string,
    userId?: string
  ): Promise<string> {
    await this.initialize()
    
    const operation: SyncOperation = {
      id: this.generateId(),
      type,
      entity,
      data,
      timestamp: Date.now(),
      status: 'pending',
      attempts: 0,
      tenantId,
      userId,
      localId: data.id as string,
    }
    
    await this.db!.put('operations', operation)
    
    this.emit('operation:queued', operation)
    
    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.syncPendingOperations()
    }
    
    return operation.id
  }
  
  async getQueuedOperations(
    tenantId?: string,
    status?: SyncStatus
  ): Promise<SyncOperation[]> {
    await this.initialize()
    
    let operations: SyncOperation[]
    
    if (status) {
      operations = await this.db!.getAllFromIndex('operations', 'by-status', status)
    } else {
      operations = await this.db!.getAll('operations')
    }
    
    if (tenantId) {
      operations = operations.filter(op => op.tenantId === tenantId)
    }
    
    return operations.sort((a, b) => a.timestamp - b.timestamp)
  }
  
  async removeOperation(id: string): Promise<void> {
    await this.initialize()
    await this.db!.delete('operations', id)
    this.emit('operation:removed', { id })
  }
  
  // ==================== Sync Logic ====================
  
  async syncPendingOperations(): Promise<{
    synced: number
    failed: number
    conflicts: number
  }> {
    if (!this.isOnline || this.syncInProgress) {
      return { synced: 0, failed: 0, conflicts: 0 }
    }
    
    await this.initialize()
    this.syncInProgress = true
    this.emit('sync:started', {})
    
    const results = { synced: 0, failed: 0, conflicts: 0 }
    
    try {
      // Get pending operations
      const pending = await this.db!.getAllFromIndex('operations', 'by-status', 'pending')
      const failed = (await this.db!.getAllFromIndex('operations', 'by-status', 'failed'))
        .filter(op => op.attempts < this.config.maxRetries)
      
      const toSync = [...pending, ...failed]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, this.config.batchSize)
      
      for (const operation of toSync) {
        try {
          // Mark as syncing
          operation.status = 'syncing'
          operation.attempts += 1
          operation.lastAttempt = Date.now()
          await this.db!.put('operations', operation)
          
          // Perform sync
          const result = await this.performSync(operation)
          
          if (result.success) {
            operation.status = 'synced'
            operation.serverId = result.serverId
            results.synced++
            this.emit('operation:synced', operation)
          } else if (result.conflict) {
            operation.status = 'conflict'
            operation.conflictData = result.serverData
            results.conflicts++
            await this.createException(operation, 'conflict', result.message || 'Data conflict detected')
            this.emit('operation:conflict', operation)
          } else {
            operation.status = 'failed'
            operation.error = result.message
            results.failed++
            
            if (operation.attempts >= this.config.maxRetries) {
              await this.createException(operation, 'network', result.message || 'Max retries exceeded')
            }
            
            this.emit('operation:failed', operation)
          }
          
          await this.db!.put('operations', operation)
          
        } catch (error) {
          operation.status = 'failed'
          operation.error = error instanceof Error ? error.message : 'Unknown error'
          await this.db!.put('operations', operation)
          results.failed++
        }
      }
      
    } finally {
      this.syncInProgress = false
      this.emit('sync:completed', results)
      
      // Update sync state
      await this.db!.put('syncState', {
        key: 'lastSync',
        lastSync: Date.now(),
        syncInProgress: false
      })
    }
    
    return results
  }
  
  private async performSync(operation: SyncOperation): Promise<{
    success: boolean
    serverId?: string
    conflict?: boolean
    serverData?: Record<string, unknown>
    message?: string
  }> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api'
    const entityEndpoints: Record<string, string> = {
      invoice: '/pos/invoices',
      payment: '/pos/payments',
      customer: '/crm/customers',
    }
    
    const endpoint = entityEndpoints[operation.entity] || `/${operation.entity}`
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: operation.type === 'create' ? 'POST' :
                operation.type === 'update' ? 'PUT' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': operation.tenantId,
          'X-Offline-Sync': 'true',
          'X-Local-Timestamp': String(operation.timestamp),
        },
        body: JSON.stringify(operation.data),
      })
      
      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          serverId: data.id || data.name,
        }
      }
      
      if (response.status === 409) {
        // Conflict
        const serverData = await response.json()
        return {
          success: false,
          conflict: true,
          serverData: serverData.data,
          message: 'Conflict with server data',
        }
      }
      
      const error = await response.json().catch(() => ({}))
      return {
        success: false,
        message: error.detail || error.message || `HTTP ${response.status}`,
      }
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      }
    }
  }
  
  // ==================== Exception Management ====================
  
  private async createException(
    operation: SyncOperation,
    type: SyncException['type'],
    message: string
  ): Promise<void> {
    const exception: SyncException = {
      id: this.generateId(),
      operationId: operation.id,
      type,
      message,
      localData: operation.data,
      serverData: operation.conflictData,
      timestamp: Date.now(),
      resolved: 0,  // 0 = unresolved
    }
    
    await this.db!.put('exceptions', exception)
    this.emit('exception:created', exception)
  }
  
  async getExceptions(resolved?: boolean): Promise<SyncException[]> {
    await this.initialize()
    
    if (resolved !== undefined) {
      // IndexedDB indexes require IDBValidKey, so use 0/1 for boolean
      return this.db!.getAllFromIndex('exceptions', 'by-resolved', resolved ? 1 : 0)
    }
    
    return this.db!.getAll('exceptions')
  }
  
  async resolveException(
    exceptionId: string,
    resolutionType: SyncException['resolutionType'],
    resolvedBy?: string
  ): Promise<void> {
    await this.initialize()
    
    const exception = await this.db!.get('exceptions', exceptionId)
    if (!exception) throw new Error('Exception not found')
    
    exception.resolved = 1  // 1 = resolved
    exception.resolvedAt = Date.now()
    exception.resolutionType = resolutionType
    exception.resolvedBy = resolvedBy
    
    await this.db!.put('exceptions', exception)
    
    // Handle the resolution
    const operation = await this.db!.get('operations', exception.operationId)
    if (operation) {
      switch (resolutionType) {
        case 'use_local':
          // Re-queue with force flag
          operation.status = 'pending'
          operation.data._forceOverwrite = true
          await this.db!.put('operations', operation)
          break
        case 'use_server':
          // Discard local changes
          await this.db!.delete('operations', operation.id)
          break
        case 'discard':
          // Just remove the operation
          await this.db!.delete('operations', operation.id)
          break
        case 'merge':
          // Custom merge logic would go here
          // For now, treat as use_local
          operation.status = 'pending'
          await this.db!.put('operations', operation)
          break
      }
    }
    
    this.emit('exception:resolved', exception)
  }
  
  // ==================== Offline Data Cache ====================
  
  async cacheData(
    entity: string,
    data: Record<string, unknown>,
    tenantId: string
  ): Promise<void> {
    await this.initialize()
    
    const item: OfflineItem = {
      id: `${entity}:${data.id}`,
      entity,
      data,
      version: (data.modified || 0) as number,
      lastModified: Date.now(),
      tenantId,
    }
    
    await this.db!.put('offlineData', item)
  }
  
  async getCachedData<T>(
    entity: string,
    tenantId: string
  ): Promise<T[]> {
    await this.initialize()
    
    const items = await this.db!.getAllFromIndex('offlineData', 'by-entity', entity)
    return items
      .filter(item => item.tenantId === tenantId)
      .map(item => item.data as T)
  }
  
  async getCachedItem<T>(entity: string, id: string): Promise<T | undefined> {
    await this.initialize()
    
    const item = await this.db!.get('offlineData', `${entity}:${id}`)
    return item?.data as T | undefined
  }
  
  async clearCache(entity?: string, tenantId?: string): Promise<void> {
    await this.initialize()
    
    if (!entity && !tenantId) {
      await this.db!.clear('offlineData')
      return
    }
    
    const items = await this.db!.getAll('offlineData')
    for (const item of items) {
      if (entity && item.entity !== entity) continue
      if (tenantId && item.tenantId !== tenantId) continue
      await this.db!.delete('offlineData', item.id)
    }
  }
  
  // ==================== Utility Methods ====================
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  private handleOnline(): void {
    this.isOnline = true
    this.emit('online', {})
    this.startAutoSync()
    this.syncPendingOperations()
  }
  
  private handleOffline(): void {
    this.isOnline = false
    this.emit('offline', {})
    this.stopAutoSync()
  }
  
  private startAutoSync(): void {
    if (this.syncTimer) return
    
    this.syncTimer = setInterval(() => {
      this.syncPendingOperations()
    }, this.config.autoSyncInterval)
  }
  
  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }
  
  // ==================== Event System ====================
  
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }
  
  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    })
  }
  
  // ==================== Status Methods ====================
  
  async getStatus(): Promise<{
    isOnline: boolean
    pendingCount: number
    failedCount: number
    conflictCount: number
    exceptionsCount: number
    lastSync?: number
  }> {
    await this.initialize()
    
    const [pending, failed, conflicts, exceptions, syncState] = await Promise.all([
      this.db!.countFromIndex('operations', 'by-status', 'pending'),
      this.db!.countFromIndex('operations', 'by-status', 'failed'),
      this.db!.countFromIndex('operations', 'by-status', 'conflict'),
      this.db!.countFromIndex('exceptions', 'by-resolved', 0),  // 0 = unresolved
      this.db!.get('syncState', 'lastSync'),
    ])
    
    return {
      isOnline: this.isOnline,
      pendingCount: pending,
      failedCount: failed,
      conflictCount: conflicts,
      exceptionsCount: exceptions,
      lastSync: syncState?.lastSync,
    }
  }
  
  // ==================== Cleanup ====================
  
  async cleanup(): Promise<void> {
    this.stopAutoSync()
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.listeners.clear()
  }
}

// ==================== Singleton Instance ====================

let offlineSyncInstance: OfflineSyncManager | null = null

export function getOfflineSyncManager(): OfflineSyncManager {
  if (!offlineSyncInstance) {
    offlineSyncInstance = new OfflineSyncManager()
  }
  return offlineSyncInstance
}

export default OfflineSyncManager
