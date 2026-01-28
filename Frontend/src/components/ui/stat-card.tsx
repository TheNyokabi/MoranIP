'use client'

import * as React from 'react'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  loading?: boolean
  onClick?: () => void
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-green-500/5 border-green-500/20',
  warning: 'bg-amber-500/5 border-amber-500/20',
  error: 'bg-red-500/5 border-red-500/20',
}

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-500/10 text-green-600',
  warning: 'bg-amber-500/10 text-amber-600',
  error: 'bg-red-500/10 text-red-600',
}

const sizeStyles = {
  sm: {
    card: 'p-3',
    title: 'text-xs',
    value: 'text-xl',
    icon: 'h-8 w-8',
    iconSize: 16,
  },
  md: {
    card: 'p-4',
    title: 'text-sm',
    value: 'text-2xl',
    icon: 'h-10 w-10',
    iconSize: 20,
  },
  lg: {
    card: 'p-6',
    title: 'text-base',
    value: 'text-3xl',
    icon: 'h-12 w-12',
    iconSize: 24,
  },
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  size = 'md',
  className,
  loading = false,
  onClick,
}: StatCardProps) {
  const styles = sizeStyles[size]
  
  const TrendIcon = trend 
    ? trend.value > 0 
      ? TrendingUp 
      : trend.value < 0 
        ? TrendingDown 
        : Minus
    : null

  const trendColor = trend
    ? trend.isPositive !== undefined
      ? trend.isPositive
        ? 'text-green-600'
        : 'text-red-600'
      : trend.value > 0
        ? 'text-green-600'
        : trend.value < 0
          ? 'text-red-600'
          : 'text-muted-foreground'
    : ''

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        variantStyles[variant],
        styles.card,
        onClick && 'cursor-pointer hover:shadow-md active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-muted-foreground truncate', styles.title)}>
            {title}
          </p>
          
          {loading ? (
            <div className={cn('h-8 bg-muted rounded animate-pulse mt-1', size === 'sm' ? 'w-16' : 'w-24')} />
          ) : (
            <p className={cn('font-bold text-foreground mt-1 truncate', styles.value)}>
              {value}
            </p>
          )}
          
          {(trend || description) && (
            <div className="flex items-center gap-2 mt-2">
              {trend && TrendIcon && (
                <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{Math.abs(trend.value)}%</span>
                  {trend.label && (
                    <span className="text-muted-foreground font-normal">{trend.label}</span>
                  )}
                </div>
              )}
              {description && !trend && (
                <p className="text-xs text-muted-foreground truncate">{description}</p>
              )}
            </div>
          )}
        </div>
        
        {Icon && (
          <div className={cn(
            'rounded-lg flex items-center justify-center flex-shrink-0',
            iconVariantStyles[variant],
            styles.icon
          )}>
            <Icon size={styles.iconSize} />
          </div>
        )}
      </div>
    </div>
  )
}

// Grid wrapper for stat cards
interface StatCardGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function StatCardGrid({ children, columns = 4, className }: StatCardGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }
  
  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  )
}
