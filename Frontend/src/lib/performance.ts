/**
 * Performance Optimization Utilities
 * 
 * Provides tools for optimizing application performance:
 * - Debouncing and throttling
 * - Request deduplication
 * - Caching utilities
 * - Lazy loading helpers
 * - Performance monitoring
 * 
 * Author: MoranERP Team
 */

// ==================== Debounce & Throttle ====================

/**
 * Debounce a function to limit how often it can fire
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null
  
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    const context = this
    timeoutId = setTimeout(() => {
      fn.apply(context, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Throttle a function to fire at most once per interval
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null
  
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now()
    const remaining = interval - (now - lastCall)
    const context = this
    
    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      fn.apply(context, args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn.apply(context, args)
      }, remaining)
    }
  }
}

// ==================== Request Deduplication ====================

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

const pendingRequests = new Map<string, PendingRequest<unknown>>()
const REQUEST_DEDUPE_TIME = 100 // ms

/**
 * Deduplicate identical requests within a time window
 */
export async function dedupeRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  maxAge: number = REQUEST_DEDUPE_TIME
): Promise<T> {
  const existing = pendingRequests.get(key)
  const now = Date.now()
  
  if (existing && (now - existing.timestamp) < maxAge) {
    return existing.promise as Promise<T>
  }
  
  const promise = requestFn()
  
  pendingRequests.set(key, { promise, timestamp: now })
  
  try {
    const result = await promise
    return result
  } finally {
    // Clean up after a delay
    setTimeout(() => {
      const current = pendingRequests.get(key)
      if (current?.promise === promise) {
        pendingRequests.delete(key)
      }
    }, maxAge)
  }
}

// ==================== In-Memory Cache ====================

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize: number
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }
  
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) return undefined
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }
    
    return entry.value
  }
  
  set<T>(key: string, value: T, ttl: number = 60000): void {
    // Evict old entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.getOldestKey()
      if (oldest) this.cache.delete(oldest)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    })
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key)
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    return true
  }
  
  private getOldestKey(): string | undefined {
    let oldestKey: string | undefined
    let oldestTime = Infinity
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    })
    
    return oldestKey
  }
}

// Global cache instance
export const globalCache = new MemoryCache(500)

/**
 * Wrapper for caching function results
 */
export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyFn?: (...args: Parameters<T>) => string
    ttl?: number
    cache?: MemoryCache
  } = {}
): T {
  const {
    keyFn = (...args) => JSON.stringify(args),
    ttl = 60000,
    cache = globalCache,
  } = options
  
  return (async (...args: Parameters<T>) => {
    const key = keyFn(...args)
    
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    
    const result = await fn(...args)
    cache.set(key, result, ttl)
    
    return result
  }) as T
}

// ==================== Batch Operations ====================

interface BatchConfig<T, R> {
  maxSize: number
  maxWait: number
  executor: (items: T[]) => Promise<Map<T, R>>
}

/**
 * Batch multiple operations into a single request
 */
export class BatchProcessor<T, R> {
  private queue: Array<{
    item: T
    resolve: (value: R) => void
    reject: (error: unknown) => void
  }> = []
  private timeoutId: NodeJS.Timeout | null = null
  private config: BatchConfig<T, R>
  
  constructor(config: BatchConfig<T, R>) {
    this.config = config
  }
  
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })
      
      if (this.queue.length >= this.config.maxSize) {
        this.flush()
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.config.maxWait)
      }
    })
  }
  
  private async flush(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    
    if (this.queue.length === 0) return
    
    const batch = this.queue
    this.queue = []
    
    try {
      const items = batch.map(b => b.item)
      const results = await this.config.executor(items)
      
      batch.forEach(({ item, resolve, reject }) => {
        const result = results.get(item)
        if (result !== undefined) {
          resolve(result)
        } else {
          reject(new Error('Item not found in batch results'))
        }
      })
    } catch (error) {
      batch.forEach(({ reject }) => reject(error))
    }
  }
}

// ==================== Lazy Loading ====================

type LazyModule<T> = () => Promise<{ default: T }>

/**
 * Lazy load a module with retry logic
 */
export async function lazyLoadWithRetry<T>(
  loader: LazyModule<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const loadedModule = await loader()
      return loadedModule.default
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)))
      }
    }
  }
  
  throw lastError
}

/**
 * Preload a module without rendering
 */
export function preloadModule<T>(loader: LazyModule<T>): void {
  // Start loading but don't wait
  loader().catch(() => {
    // Silently fail preloading
  })
}

// ==================== Image Optimization ====================

/**
 * Check if IntersectionObserver is available
 */
const hasIntersectionObserver = typeof IntersectionObserver !== 'undefined'

/**
 * Create a lazy image loader
 */
export function createImageLazyLoader(options: {
  rootMargin?: string
  threshold?: number
} = {}): {
  observe: (element: HTMLImageElement) => void
  disconnect: () => void
} {
  if (!hasIntersectionObserver) {
    return {
      observe: (element) => {
        const src = element.dataset.src
        if (src) element.src = src
      },
      disconnect: () => {},
    }
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.dataset.src
          if (src) {
            img.src = src
            img.removeAttribute('data-src')
          }
          observer.unobserve(img)
        }
      })
    },
    {
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0,
    }
  )
  
  return {
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect(),
  }
}

// ==================== Performance Monitoring ====================

interface PerformanceMark {
  name: string
  timestamp: number
  duration?: number
}

class PerformanceMonitor {
  private marks: PerformanceMark[] = []
  private enabled: boolean = process.env.NODE_ENV === 'development'
  
  mark(name: string): void {
    if (!this.enabled) return
    
    this.marks.push({
      name,
      timestamp: performance.now(),
    })
  }
  
  measure(name: string, startMark: string, endMark?: string): number | undefined {
    if (!this.enabled) return undefined
    
    const start = this.marks.find(m => m.name === startMark)
    const end = endMark 
      ? this.marks.find(m => m.name === endMark)
      : { timestamp: performance.now() }
    
    if (!start || !end) return undefined
    
    const duration = end.timestamp - start.timestamp
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`)
    }
    
    return duration
  }
  
  clear(): void {
    this.marks = []
  }
  
  getMarks(): PerformanceMark[] {
    return [...this.marks]
  }
}

export const perfMonitor = new PerformanceMonitor()

/**
 * Track component render time
 */
export function trackRenderTime(componentName: string): {
  start: () => void
  end: () => void
} {
  const startMark = `${componentName}-render-start`
  const endMark = `${componentName}-render-end`
  
  return {
    start: () => perfMonitor.mark(startMark),
    end: () => perfMonitor.measure(`${componentName} render`, startMark),
  }
}

// ==================== Request Idle Callback Polyfill ====================

type IdleCallback = (deadline: {
  didTimeout: boolean
  timeRemaining: () => number
}) => void

/**
 * Schedule work during browser idle time
 */
export function scheduleIdleWork(
  callback: IdleCallback,
  options?: { timeout?: number }
): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(callback, options)
  }
  
  // Fallback for browsers without requestIdleCallback
  const start = Date.now()
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    })
  }, 1) as unknown as number
}

export function cancelIdleWork(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

// ==================== Chunk Array Utility ====================

/**
 * Split array into chunks for batch processing
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  
  return chunks
}

/**
 * Process array items in batches with delay between batches
 */
export async function processBatched<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
  } = {}
): Promise<R[]> {
  const { batchSize = 10, delayBetweenBatches = 0 } = options
  const results: R[] = []
  const chunks = chunkArray(items, batchSize)
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkResults = await Promise.all(chunk.map(processor))
    results.push(...chunkResults)
    
    if (delayBetweenBatches > 0 && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }
  
  return results
}

const performanceUtils = {
  debounce,
  throttle,
  dedupeRequest,
  memoizeAsync,
  globalCache,
  BatchProcessor,
  lazyLoadWithRetry,
  preloadModule,
  createImageLazyLoader,
  perfMonitor,
  trackRenderTime,
  scheduleIdleWork,
  cancelIdleWork,
  chunkArray,
  processBatched,
}

export default performanceUtils
