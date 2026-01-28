'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  items: T[]
  height: number | string
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  onEndReached?: () => void
  endReachedThreshold?: number
  className?: string
  emptyContent?: React.ReactNode
  loading?: boolean
  loadingContent?: React.ReactNode
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 3,
  onEndReached,
  endReachedThreshold = 200,
  className,
  emptyContent,
  loading = false,
  loadingContent,
}: VirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(0)

  // Update container height when it changes
  React.useEffect(() => {
    if (!containerRef.current) return

    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
      }
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  // Handle scroll
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)

    // Check if near end
    if (onEndReached) {
      const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
      if (scrollBottom < endReachedThreshold) {
        onEndReached()
      }
    }
  }, [onEndReached, endReachedThreshold])

  // Calculate visible range
  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const offsetY = startIndex * itemHeight

  if (items.length === 0 && !loading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        {emptyContent || <span className="text-muted-foreground">No items</span>}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
      {loading && (
        <div className="flex justify-center py-4">
          {loadingContent || (
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  )
}

// Variable height virtual list (more complex)
interface VariableVirtualListProps<T> {
  items: T[]
  height: number | string
  estimatedItemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
}

export function VariableVirtualList<T>({
  items,
  height,
  estimatedItemHeight,
  renderItem,
  overscan = 3,
  className,
}: VariableVirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const measurementCache = React.useRef<Map<number, number>>(new Map())
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerHeight, setContainerHeight] = React.useState(0)

  React.useEffect(() => {
    if (!containerRef.current) return
    setContainerHeight(containerRef.current.clientHeight)
  }, [])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }

  const getItemHeight = (index: number): number => {
    return measurementCache.current.get(index) ?? estimatedItemHeight
  }

  const getItemOffset = (index: number): number => {
    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i)
    }
    return offset
  }

  // Find start index
  let startIndex = 0
  let accumulatedHeight = 0
  while (startIndex < items.length && accumulatedHeight < scrollTop) {
    accumulatedHeight += getItemHeight(startIndex)
    startIndex++
  }
  startIndex = Math.max(0, startIndex - overscan - 1)

  // Find end index
  let endIndex = startIndex
  let visibleHeight = 0
  while (endIndex < items.length && visibleHeight < containerHeight) {
    visibleHeight += getItemHeight(endIndex)
    endIndex++
  }
  endIndex = Math.min(items.length - 1, endIndex + overscan)

  const totalHeight = items.reduce((sum, _, i) => sum + getItemHeight(i), 0)
  const visibleItems = items.slice(startIndex, endIndex + 1)
  const offsetY = getItemOffset(startIndex)

  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index

            return (
              <div 
                key={actualIndex}
                ref={(el) => {
                  // Measure item on mount/update
                  if (el) {
                    const height = el.getBoundingClientRect().height
                    if (height > 0 && height !== measurementCache.current.get(actualIndex)) {
                      measurementCache.current.set(actualIndex, height)
                    }
                  }
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Simple infinite scroll wrapper
interface InfiniteScrollProps {
  children: React.ReactNode
  hasMore: boolean
  loadMore: () => void
  loading?: boolean
  loader?: React.ReactNode
  threshold?: number
  className?: string
}

export function InfiniteScroll({
  children,
  hasMore,
  loadMore,
  loading = false,
  loader,
  threshold = 200,
  className,
}: InfiniteScrollProps) {
  const loaderRef = React.useRef<HTMLDivElement>(null)
  const loadMoreRef = React.useRef(loadMore)
  loadMoreRef.current = loadMore

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && hasMore && !loading) {
          loadMoreRef.current()
        }
      },
      { rootMargin: `${threshold}px` }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, threshold])

  return (
    <div className={className}>
      {children}
      <div ref={loaderRef}>
        {loading && (
          loader || (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )
        )}
      </div>
    </div>
  )
}
