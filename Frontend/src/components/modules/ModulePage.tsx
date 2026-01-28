'use client'

import * as React from 'react'
import { LucideIcon, Plus, Search, Filter, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, PageContent } from '@/components/ui/page-header'
import { ResponsiveTable, TablePagination, ColumnConfig } from '@/components/ui/responsive-table'
import { EmptyState, NoResultsState, NoDataState, ErrorState } from '@/components/ui/empty-state'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { useModuleCrud, CrudOptions } from '@/hooks/use-module-crud'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export interface StatConfig {
  title: string
  value: string | number | ((items: any[]) => string | number)
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
}

export interface ActionConfig {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
}

export interface ModulePageProps<T> {
  // Page metadata
  title: string
  description?: string
  icon?: LucideIcon
  
  // CRUD configuration
  crudOptions: CrudOptions<T>
  
  // Table columns
  columns: ColumnConfig<T>[]
  keyExtractor: (item: T) => string
  
  // Optional stats (shown above table)
  stats?: StatConfig[]
  
  // Optional actions (shown in header)
  actions?: ActionConfig[]
  
  // Create form
  createForm?: React.ReactNode
  createTitle?: string
  
  // Edit form factory
  editForm?: (item: T, onClose: () => void) => React.ReactNode
  editTitle?: string
  
  // Row click handler
  onRowClick?: (item: T) => void
  
  // Card renderer for mobile view
  cardRenderer?: (item: T) => React.ReactNode
  
  // Filter component
  filterComponent?: React.ReactNode
  
  // Empty state customization
  emptyTitle?: string
  emptyDescription?: string
  
  // Additional content
  children?: React.ReactNode
  
  // Class names
  className?: string
}

export function ModulePage<T extends { id?: string; name?: string }>({
  title,
  description,
  icon,
  crudOptions,
  columns,
  keyExtractor,
  stats,
  actions,
  createForm,
  createTitle = 'Add New',
  editForm,
  editTitle = 'Edit',
  onRowClick,
  cardRenderer,
  filterComponent,
  emptyTitle,
  emptyDescription,
  children,
  className,
}: ModulePageProps<T>) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<T | null>(null)
  const [showFilters, setShowFilters] = React.useState(false)
  
  const crud = useModuleCrud<T>(crudOptions)
  
  // Calculate stats
  const computedStats = React.useMemo(() => {
    if (!stats) return null
    
    return stats.map(stat => ({
      ...stat,
      value: typeof stat.value === 'function' ? stat.value(crud.items) : stat.value
    }))
  }, [stats, crud.items])
  
  // Handle row click
  const handleRowClick = (item: T) => {
    if (onRowClick) {
      onRowClick(item)
    } else if (editForm) {
      setEditingItem(item)
    }
  }
  
  // Render content based on state
  const renderContent = () => {
    if (crud.isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )
    }
    
    if (crud.isError) {
      return (
        <ErrorState
          message={crud.error?.message || 'Failed to load data'}
          onRetry={crud.refresh}
        />
      )
    }
    
    if (crud.items.length === 0) {
      if (crud.search || Object.keys(crud.filters).length > 0) {
        return (
          <NoResultsState
            searchQuery={crud.search}
            onClear={crud.clearFilters}
          />
        )
      }
      
      return (
        <NoDataState
          itemName={title.toLowerCase()}
          onAdd={createForm ? () => setIsCreateOpen(true) : undefined}
        />
      )
    }
    
    return (
      <>
        <ResponsiveTable
          data={crud.items}
          columns={columns}
          keyExtractor={keyExtractor}
          onRowClick={handleRowClick}
          cardRenderer={cardRenderer}
          sortState={{
            column: crud.sortBy,
            direction: crud.sortDirection,
          }}
          onSort={crud.setSort}
        />
        
        {crud.totalPages > 1 && (
          <TablePagination
            currentPage={crud.page}
            totalPages={crud.totalPages}
            onPageChange={crud.setPage}
            className="mt-4"
          />
        )}
      </>
    )
  }
  
  return (
    <div className={cn('min-h-screen', className)}>
      {/* Header */}
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={
          <div className="flex items-center gap-2">
            {actions?.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'outline'}
                onClick={action.onClick}
                className="gap-2"
              >
                {action.icon && <action.icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            ))}
            
            {createForm && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">{createTitle}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{createTitle}</DialogTitle>
                  </DialogHeader>
                  {createForm}
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />
      
      <PageContent>
        {/* Stats */}
        {computedStats && computedStats.length > 0 && (
          <StatCardGrid columns={Math.min(computedStats.length, 4) as 2 | 3 | 4} className="mb-6">
            {computedStats.map((stat, index) => (
              <StatCard
                key={index}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                trend={stat.trend}
                variant={stat.variant}
              />
            ))}
          </StatCardGrid>
        )}
        
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${title.toLowerCase()}...`}
              value={crud.search}
              onChange={(e) => crud.setSearch(e.target.value)}
              className="pl-9"
            />
            {crud.search && (
              <button
                onClick={() => crud.setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            {filterComponent && (
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'gap-2',
                  Object.keys(crud.filters).length > 0 && 'border-primary text-primary'
                )}
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {Object.keys(crud.filters).length > 0 && (
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {Object.keys(crud.filters).length}
                  </span>
                )}
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={crud.refresh}
              disabled={crud.isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', crud.isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {showFilters && filterComponent && (
          <div className="mb-6 p-4 border rounded-lg bg-card">
            {filterComponent}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={crud.clearFilters}>
                Clear All
              </Button>
              <Button onClick={() => setShowFilters(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        )}
        
        {/* Table/List */}
        {renderContent()}
        
        {/* Additional Content */}
        {children}
      </PageContent>
      
      {/* Edit Dialog */}
      {editForm && editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTitle}</DialogTitle>
            </DialogHeader>
            {editForm(editingItem, () => setEditingItem(null))}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default ModulePage
