'use client'

import * as React from 'react'
import { LucideIcon, Inbox, Search, FileX, AlertCircle, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'search' | 'error' | 'minimal'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}

const presetIcons = {
  default: Inbox,
  search: Search,
  error: AlertCircle,
  minimal: FileX,
}

const sizeStyles = {
  sm: {
    container: 'py-8',
    icon: 'h-10 w-10',
    title: 'text-base',
    description: 'text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'h-12 w-12',
    title: 'text-lg',
    description: 'text-sm',
  },
  lg: {
    container: 'py-16',
    icon: 'h-16 w-16',
    title: 'text-xl',
    description: 'text-base',
  },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  size = 'md',
  className,
  children,
}: EmptyStateProps) {
  const Icon = icon || presetIcons[variant]
  const styles = sizeStyles[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        styles.container,
        className
      )}
    >
      <div className={cn(
        'rounded-full bg-muted p-4 mb-4',
        variant === 'error' && 'bg-red-500/10'
      )}>
        <Icon className={cn(
          'text-muted-foreground',
          styles.icon,
          variant === 'error' && 'text-red-500'
        )} />
      </div>

      <h3 className={cn('font-semibold text-foreground', styles.title)}>
        {title}
      </h3>

      {description && (
        <p className={cn(
          'text-muted-foreground mt-2 max-w-md mx-auto',
          styles.description
        )}>
          {description}
        </p>
      )}

      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {action.icon ? <action.icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Common empty state presets
export function NoResultsState({
  searchQuery,
  onClear,
  className,
}: {
  searchQuery?: string
  onClear?: () => void
  className?: string
}) {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={searchQuery 
        ? `No items match "${searchQuery}". Try adjusting your search or filters.`
        : 'No items match your current filters.'
      }
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
      className={className}
    />
  )
}

export function NoDataState({
  itemName = 'items',
  onAdd,
  className,
}: {
  itemName?: string
  onAdd?: () => void
  className?: string
}) {
  return (
    <EmptyState
      title={`No ${itemName} yet`}
      description={`Get started by creating your first ${itemName.replace(/s$/, '')}.`}
      action={onAdd ? { label: `Add ${itemName.replace(/s$/, '')}`, onClick: onAdd } : undefined}
      className={className}
    />
  )
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  className,
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <EmptyState
      variant="error"
      title="Error"
      description={message}
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      className={className}
    />
  )
}
