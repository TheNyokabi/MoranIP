'use client'

import * as React from 'react'
import { MoreVertical, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

interface DataCardAction {
  label: string
  onClick: () => void
  icon?: React.ReactNode
  variant?: 'default' | 'destructive'
}

interface DataCardProps {
  title: string
  subtitle?: string
  description?: string
  badge?: {
    label: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  metadata?: Array<{
    label: string
    value: string | number
    icon?: React.ReactNode
  }>
  avatar?: React.ReactNode
  actions?: DataCardAction[]
  onClick?: () => void
  selected?: boolean
  className?: string
  children?: React.ReactNode
}

export function DataCard({
  title,
  subtitle,
  description,
  badge,
  metadata,
  avatar,
  actions,
  onClick,
  selected = false,
  className,
  children,
}: DataCardProps) {
  const hasActions = actions && actions.length > 0

  return (
    <div
      className={cn(
        'relative bg-card border rounded-xl p-4 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30 active:scale-[0.99]',
        selected && 'border-primary ring-2 ring-primary/20',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {avatar && (
          <div className="flex-shrink-0">
            {avatar}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">
                  {title}
                </h3>
                {badge && (
                  <Badge variant={badge.variant || 'secondary'} className="flex-shrink-0">
                    {badge.label}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Actions Menu */}
            {hasActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.onClick()
                      }}
                      className={action.variant === 'destructive' ? 'text-destructive' : ''}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Chevron for clickable cards without actions */}
            {onClick && !hasActions && (
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {description}
            </p>
          )}

          {/* Metadata Grid */}
          {metadata && metadata.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
              {metadata.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-sm">
                  {item.icon && (
                    <span className="text-muted-foreground">{item.icon}</span>
                  )}
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Additional Content */}
          {children && (
            <div className="mt-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Grid layout for data cards
interface DataCardGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3
  className?: string
}

export function DataCardGrid({ children, columns = 1, className }: DataCardGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }

  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  )
}

// List layout for data cards
interface DataCardListProps {
  children: React.ReactNode
  className?: string
}

export function DataCardList({ children, className }: DataCardListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {children}
    </div>
  )
}

// Compact data card for lists
interface CompactDataCardProps {
  title: string
  subtitle?: string
  trailing?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function CompactDataCard({
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: CompactDataCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-3 rounded-lg border bg-card',
        onClick && 'cursor-pointer hover:bg-muted/50 active:scale-[0.99] transition-all',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {trailing && (
        <div className="flex-shrink-0">
          {trailing}
        </div>
      )}
    </div>
  )
}
