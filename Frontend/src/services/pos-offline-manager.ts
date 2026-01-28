/**
 * POS Offline Manager
 * Handles offline transaction queuing, IndexedDB storage, and background sync
 */

import { apiFetch } from '@/lib/api'

export interface OfflineTransaction {
  id: string
  tenantId: string
  transactionType: 'invoice' | 'payment' | 'stock_adjustment'
  data: any
  createdAt: Date
  retryCount: number
  maxRetries: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  lastAttempt?: Date
  priority: number
}

export interface SyncStatus {
  isOnline: boolean
  pendingTransactions: number
  lastSync: Date | null
  syncInProgress: boolean
  connectivityTest: {
    erpnext: boolean
    database: boolean
    overall: boolean
  }
}

class POSOfflineManager {
  private db: IDBDatabase | null = null
  private dbVersion = 1
  private syncInProgress = false
  private connectivityCheckInterval: NodeJS.Timeout | null = null
  private backgroundSyncInterval: NodeJS.Timeout | null = null
  private isOnline = navigator.onLine

  constructor() {
    this.initDB()
    this.setupEventListeners()
    this.startConnectivityMonitoring()
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('POSOfflineDB', this.dbVersion)

      request.onerror = () => {
        console.error('Failed to open IndexedDB')
        reject(new Error('Failed to initialize offline storage'))
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        console.log('Offline database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' })
          transactionStore.createIndex('status', 'status', { unique: false })
          transactionStore.createIndex('createdAt', 'createdAt', { unique: false })
          transactionStore.createIndex('priority', 'priority', { unique: false })
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('syncMetadata')) {
          db.createObjectStore('syncMetadata', { keyPath: 'key' })
        }

        // Cached data store
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' })
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false })
        }
      }
    })
  }

  /**
   * Setup event listeners for online/offline detection
   */
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // Listen for background sync events (if supported)
    if ('serviceWorker' in navigator && 'sync' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        if ('sync' in registration) {
          // Background sync is available
          console.log('Background sync is available')
        }
      })
    }
  }

  /**
   * Handle coming online
   */
  private async handleOnline(): Promise<void> {
    console.log('Device came online')
    this.isOnline = true

    // Start automatic sync
    this.startBackgroundSync()

    // Notify user
    this.showNotification('You are back online. Synchronizing data...', 'info')
  }

  /**
   * Handle going offline
   */
  private async handleOffline(): Promise<void> {
    console.log('Device went offline')
    this.isOnline = false

    // Stop automatic sync
    this.stopBackgroundSync()

    // Notify user
    this.showNotification('You are offline. Transactions will be saved locally.', 'warning')
  }

  /**
   * Start connectivity monitoring
   */
  private startConnectivityMonitoring(): void {
    this.connectivityCheckInterval = setInterval(async () => {
      await this.testConnectivity()
    }, 30000) // Check every 30 seconds
  }

  /**
   * Test connectivity to required services
   */
  private async testConnectivity(): Promise<void> {
    try {
      const response = await apiFetch('/pos/sync/test-connectivity', {}, localStorage.getItem('authToken') || '')
      const wasOnline = this.isOnline

      this.isOnline = (response as any).connectivity_test.overall

      if (!wasOnline && this.isOnline) {
        this.handleOnline()
      } else if (wasOnline && !this.isOnline) {
        this.handleOffline()
      }

      // Store connectivity status
      await this.setSyncMetadata('connectivityStatus', (response as any).connectivity_test)

    } catch (error) {
      // If connectivity test fails, we're likely offline
      if (this.isOnline) {
        this.handleOffline()
      }
    }
  }

  /**
   * Queue a transaction for offline processing
   */
  async queueTransaction(
    transactionType: OfflineTransaction['transactionType'],
    data: any,
    priority: number = 2
  ): Promise<string> {
    const transaction: OfflineTransaction = {
      id: this.generateId(),
      tenantId: localStorage.getItem('currentTenant') || '',
      transactionType,
      data,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
      priority
    }

    await this.storeTransaction(transaction)

    // If online, try to sync immediately for high priority transactions
    if (this.isOnline && priority >= 3) {
      this.syncTransaction(transaction.id)
    }

    console.log(`Queued ${transactionType} transaction: ${transaction.id}`)
    return transaction.id
  }

  /**
   * Store transaction in IndexedDB
   */
  private async storeTransaction(transaction: OfflineTransaction): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction_req = this.db!.transaction(['transactions'], 'readwrite')
      const store = transaction_req.objectStore('transactions')
      const request = store.put(transaction)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to store transaction'))
    })
  }

  /**
   * Get all pending transactions
   */
  async getPendingTransactions(): Promise<OfflineTransaction[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly')
      const store = transaction.objectStore('transactions')
      const index = store.index('status')
      const request = index.getAll('pending')

      request.onsuccess = () => {
        const transactions = request.result as OfflineTransaction[]
        // Sort by priority (high first) then by creation time
        transactions.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority
          }
          return a.createdAt.getTime() - b.createdAt.getTime()
        })
        resolve(transactions)
      }
      request.onerror = () => reject(new Error('Failed to get pending transactions'))
    })
  }

  /**
   * Sync a single transaction
   */
  async syncTransaction(transactionId: string): Promise<boolean> {
    try {
      const transaction = await this.getTransaction(transactionId)
      if (!transaction || transaction.status !== 'pending') {
        return false
      }

      // Mark as processing
      transaction.status = 'processing'
      transaction.lastAttempt = new Date()
      await this.storeTransaction(transaction)

      // Attempt to sync
      const success = await this.processTransaction(transaction)

      if (success) {
        transaction.status = 'completed'
        await this.storeTransaction(transaction)
        console.log(`Successfully synced transaction: ${transactionId}`)
        return true
      } else {
        transaction.status = 'failed'
        transaction.retryCount++
        transaction.errorMessage = 'Sync failed'
        await this.storeTransaction(transaction)
        console.warn(`Failed to sync transaction: ${transactionId}`)
        return false
      }
    } catch (error) {
      console.error(`Error syncing transaction ${transactionId}:`, error)
      return false
    }
  }

  /**
   * Process a transaction by sending it to the server
   */
  private async processTransaction(transaction: OfflineTransaction): Promise<boolean> {
    try {
      // Send transaction to appropriate endpoint
      let endpoint = ''
      let method = 'POST'
      let data = transaction.data

      switch (transaction.transactionType) {
        case 'invoice':
          endpoint = '/pos/invoice'
          break
        case 'payment':
          // Payments might need special handling for offline
          return false // Payments typically require real-time processing
        case 'stock_adjustment':
          endpoint = '/pos/stock-adjustment'
          break
        default:
          throw new Error(`Unknown transaction type: ${transaction.transactionType}`)
      }

      await apiFetch(endpoint, { method, body: JSON.stringify(data) })
      return true
    } catch (error) {
      console.error('Transaction processing failed:', error)
      return false
    }
  }

  /**
   * Sync all pending transactions
   */
  async syncAllPending(): Promise<{ successful: number; failed: number; total: number }> {
    if (this.syncInProgress) {
      console.log('Sync already in progress')
      return { successful: 0, failed: 0, total: 0 }
    }

    this.syncInProgress = true

    try {
      const pendingTransactions = await this.getPendingTransactions()
      let successful = 0
      let failed = 0

      console.log(`Starting sync of ${pendingTransactions.length} transactions`)

      for (const transaction of pendingTransactions) {
        if (await this.syncTransaction(transaction.id)) {
          successful++
        } else {
          failed++
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Sync completed: ${successful} successful, ${failed} failed`)

      // Update last sync time
      await this.setSyncMetadata('lastSync', new Date().toISOString())

      return { successful, failed, total: pendingTransactions.length }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Start background sync
   */
  private startBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval)
    }

    this.backgroundSyncInterval = setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        const pendingCount = (await this.getPendingTransactions()).length
        if (pendingCount > 0) {
          console.log(`Auto-syncing ${pendingCount} pending transactions`)
          await this.syncAllPending()
        }
      }
    }, 60000) // Sync every minute when online
  }

  /**
   * Stop background sync
   */
  private stopBackgroundSync(): void {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval)
      this.backgroundSyncInterval = null
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const pendingTransactions = await this.getPendingTransactions()
    const connectivityStatus = await this.getSyncMetadata('connectivityStatus') || {
      erpnext: false,
      database: false,
      overall: false
    }
    const lastSyncStr = await this.getSyncMetadata('lastSync')
    const lastSync = lastSyncStr ? new Date(lastSyncStr) : null

    return {
      isOnline: this.isOnline,
      pendingTransactions: pendingTransactions.length,
      lastSync,
      syncInProgress: this.syncInProgress,
      connectivityTest: connectivityStatus
    }
  }

  /**
   * Cache data locally
   */
  async cacheData(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put({ key, data, expiresAt })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to cache data'))
    })
  }

  /**
   * Get cached data
   */
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        if (result && new Date(result.expiresAt) > new Date()) {
          resolve(result.data)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(new Error('Failed to get cached data'))
    })
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const index = store.index('expiresAt')
      const range = IDBKeyRange.upperBound(new Date())

      let deletedCount = 0
      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          deletedCount++
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }

      request.onerror = () => reject(new Error('Failed to clear expired cache'))
    })
  }

  /**
   * Get transaction by ID
   */
  private async getTransaction(id: string): Promise<OfflineTransaction | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly')
      const store = transaction.objectStore('transactions')
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to get transaction'))
    })
  }

  /**
   * Set sync metadata
   */
  private async setSyncMetadata(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncMetadata'], 'readwrite')
      const store = transaction.objectStore('syncMetadata')
      const request = store.put({ key, value })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to set sync metadata'))
    })
  }

  /**
   * Get sync metadata
   */
  private async getSyncMetadata(key: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncMetadata'], 'readonly')
      const store = transaction.objectStore('syncMetadata')
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result?.value || null)
      request.onerror = () => reject(new Error('Failed to get sync metadata'))
    })
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  /**
   * Show notification to user
   */
  private showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    // In a real implementation, you might use a toast system or browser notifications
    console.log(`[${type.toUpperCase()}] ${message}`)

    // For now, dispatch a custom event that can be listened to by components
    window.dispatchEvent(new CustomEvent('pos-offline-notification', {
      detail: { message, type }
    }))
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopBackgroundSync()
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval)
    }
    if (this.db) {
      this.db.close()
    }
  }
}

// Export singleton instance
export const offlineManager = new POSOfflineManager()

// Export types