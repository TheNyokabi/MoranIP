'use client'

import * as React from 'react'
import { LayoutGrid, List, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { DataCard, DataCardGrid, DataCardList } from './data-card'

// Column configuration
export interface ColumnConfig<T> {
  key: keyof T | string
  header: string
  accessor?: (item: T) => React.ReactNode
  sortable?: boolean
  hideOnMobile?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

// Sort state
export type SortDirection = 'asc' | 'desc' | null
export interface SortState {
  column: string | null
  direction: SortDirection
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: ColumnConfig<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  cardRenderer?: (item: T) => React.ReactNode
  defaultView?: 'table' | 'cards'
  showViewToggle?: boolean
  loading?: boolean
  emptyState?: React.ReactNode
  sortState?: SortState
  onSort?: (column: string) => void
  className?: string
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  cardRenderer,
  defaultView = 'table',
  showViewToggle = true,
  loading = false,
  emptyState,
  sortState,
  onSort,
  className,
}: ResponsiveTableProps<T>) {
  const [view, setView] = React.useState<'table' | 'cards'>(defaultView)
  
  // Auto-switch to cards on mobile
  React.useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 768) {
        setView('cards')
      }
    }
    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  const getValue = (item: T, column: ColumnConfig<T>): React.ReactNode => {
    if (column.accessor) {
      return column.accessor(item)
    }
    const value = (item as Record<string, unknown>)[column.key as string]
    // Return value as ReactNode - handles string, number, boolean, null, undefined
    if (value === null || value === undefined) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    if (React.isValidElement(value)) return value
    return String(value)
  }

  const renderSortIcon = (column: ColumnConfig<T>) => {
    if (!column.sortable || !sortState) return null
    
    if (sortState.column === column.key) {
      return sortState.direction === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )
    }
    return <ChevronsUpDown className="h-4 w-4 opacity-50" />
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  // Empty state
  if (data.length === 0) {
    return emptyState || (
      <div className="text-center py-12 text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className={className}>
      {/* View Toggle */}
      {showViewToggle && (
        <div className="flex justify-end mb-4 md:hidden">
          <div className="flex items-center rounded-lg border bg-muted p-1">
            <button
              onClick={() => setView('cards')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'cards' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'table' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cards View (Mobile) */}
      {view === 'cards' ? (
        <DataCardList>
          {data.map((item) => {
            const key = keyExtractor(item)
            
            if (cardRenderer) {
              return <div key={key}>{cardRenderer(item)}</div>
            }

            // Default card rendering
            const visibleColumns = columns.filter(c => !c.hideOnMobile)
            const titleColumn = visibleColumns[0]
            const subtitleColumn = visibleColumns[1]
            const metadataColumns = visibleColumns.slice(2)

            return (
              <DataCard
                key={key}
                title={String(getValue(item, titleColumn) || '')}
                subtitle={subtitleColumn ? String(getValue(item, subtitleColumn) || '') : undefined}
                metadata={metadataColumns.map(col => ({
                  label: col.header,
                  value: String(getValue(item, col) || ''),
                }))}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              />
            )
          })}
        </DataCardList>
      ) : (
        /* Table View (Desktop) */
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      'px-4 py-3 text-left text-sm font-medium text-muted-foreground',
                      column.hideOnMobile && 'hidden md:table-cell',
                      column.sortable && 'cursor-pointer select-none hover:text-foreground',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                    style={{ width: column.width }}
                    onClick={column.sortable && onSort ? () => onSort(String(column.key)) : undefined}
                  >
                    <div className={cn(
                      'flex items-center gap-1',
                      column.align === 'center' && 'justify-center',
                      column.align === 'right' && 'justify-end'
                    )}>
                      {column.header}
                      {renderSortIcon(column)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                  )}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn(
                        'px-4 py-3 text-sm',
                        column.hideOnMobile && 'hidden md:table-cell',
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                    >
                      {getValue(item, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Pagination component
interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const pages = React.useMemo(() => {
    const items: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i)
      }
    } else {
      items.push(1)
      
      if (currentPage > 3) {
        items.push('ellipsis')
      }
      
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        items.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        items.push('ellipsis')
      }
      
      items.push(totalPages)
    }
    
    return items
  }, [currentPage, totalPages])

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      
      <div className="hidden sm:flex items-center gap-1">
        {pages.map((page, index) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="w-9"
            >
              {page}
            </Button>
          )
        ))}
      </div>
      
      <span className="sm:hidden text-sm text-muted-foreground px-2">
        {currentPage} / {totalPages}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  )
}
