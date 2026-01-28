'use client'

import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  onClick: () => void
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default'
  badge?: number
  disabled?: boolean
}

interface QuickActionsPanelProps {
  actions: QuickAction[]
  columns?: 2 | 3 | 4
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outlined' | 'filled'
  className?: string
}

const colorStyles = {
  primary: {
    default: 'bg-primary/10 text-primary hover:bg-primary/20',
    outlined: 'border-primary/30 text-primary hover:bg-primary/10',
    filled: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  success: {
    default: 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
    outlined: 'border-green-500/30 text-green-600 hover:bg-green-500/10',
    filled: 'bg-green-500 text-white hover:bg-green-500/90',
  },
  warning: {
    default: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
    outlined: 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10',
    filled: 'bg-amber-500 text-white hover:bg-amber-500/90',
  },
  error: {
    default: 'bg-red-500/10 text-red-600 hover:bg-red-500/20',
    outlined: 'border-red-500/30 text-red-600 hover:bg-red-500/10',
    filled: 'bg-red-500 text-white hover:bg-red-500/90',
  },
  default: {
    default: 'bg-muted text-foreground hover:bg-muted/80',
    outlined: 'border-border text-foreground hover:bg-muted',
    filled: 'bg-foreground text-background hover:bg-foreground/90',
  },
}

const sizeStyles = {
  sm: {
    padding: 'p-3',
    icon: 'h-5 w-5',
    text: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    padding: 'p-4',
    icon: 'h-6 w-6',
    text: 'text-sm',
    gap: 'gap-2',
  },
  lg: {
    padding: 'p-5',
    icon: 'h-7 w-7',
    text: 'text-base',
    gap: 'gap-2.5',
  },
}

export function QuickActionsPanel({
  actions,
  columns = 4,
  size = 'md',
  variant = 'default',
  className,
}: QuickActionsPanelProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }

  const styles = sizeStyles[size]

  return (
    <div className={cn('grid gap-3', gridCols[columns], className)}>
      {actions.map((action) => {
        const Icon = action.icon
        const color = action.color || 'default'
        const colorStyle = colorStyles[color][variant]

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              'active:scale-[0.98]',
              variant === 'outlined' && 'border',
              styles.padding,
              styles.gap,
              colorStyle,
              action.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="relative">
              <Icon className={styles.icon} />
              {action.badge !== undefined && action.badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-medium px-1">
                  {action.badge > 99 ? '99+' : action.badge}
                </span>
              )}
            </div>
            <span className={cn('font-medium text-center', styles.text)}>
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Horizontal quick actions (scrollable)
interface HorizontalQuickActionsProps {
  actions: QuickAction[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function HorizontalQuickActions({
  actions,
  size = 'md',
  className,
}: HorizontalQuickActionsProps) {
  const styles = sizeStyles[size]

  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-2 -mx-4 px-4', className)}>
      {actions.map((action) => {
        const Icon = action.icon
        const color = action.color || 'default'
        const bgColor = colorStyles[color].default

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full',
              'whitespace-nowrap transition-all duration-200',
              'active:scale-[0.98]',
              bgColor,
              action.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Single action button (large touch target)
interface ActionButtonProps {
  label: string
  icon: LucideIcon
  onClick: () => void
  color?: 'primary' | 'success' | 'warning' | 'error'
  variant?: 'solid' | 'outline' | 'ghost'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function ActionButton({
  label,
  icon: Icon,
  onClick,
  color = 'primary',
  variant = 'solid',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  className,
}: ActionButtonProps) {
  const sizeClasses = {
    md: 'h-12 px-5 text-sm',
    lg: 'h-14 px-6 text-base',
  }

  const colorClasses = {
    primary: {
      solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
      outline: 'border-2 border-primary text-primary hover:bg-primary/10',
      ghost: 'text-primary hover:bg-primary/10',
    },
    success: {
      solid: 'bg-green-500 text-white hover:bg-green-500/90',
      outline: 'border-2 border-green-500 text-green-600 hover:bg-green-500/10',
      ghost: 'text-green-600 hover:bg-green-500/10',
    },
    warning: {
      solid: 'bg-amber-500 text-white hover:bg-amber-500/90',
      outline: 'border-2 border-amber-500 text-amber-600 hover:bg-amber-500/10',
      ghost: 'text-amber-600 hover:bg-amber-500/10',
    },
    error: {
      solid: 'bg-red-500 text-white hover:bg-red-500/90',
      outline: 'border-2 border-red-500 text-red-600 hover:bg-red-500/10',
      ghost: 'text-red-600 hover:bg-red-500/10',
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl',
        'font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        'active:scale-[0.98]',
        sizeClasses[size],
        colorClasses[color][variant],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {loading ? (
        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      {label}
    </button>
  )
}

// Icon-only action button
interface IconActionButtonProps {
  icon: LucideIcon
  onClick: () => void
  label: string // For accessibility
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'solid' | 'outline' | 'ghost'
  disabled?: boolean
  className?: string
}

export function IconActionButton({
  icon: Icon,
  onClick,
  label,
  color = 'default',
  size = 'md',
  variant = 'ghost',
  disabled = false,
  className,
}: IconActionButtonProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  const colorClasses = {
    primary: {
      solid: 'bg-primary text-primary-foreground',
      outline: 'border border-primary text-primary',
      ghost: 'text-primary hover:bg-primary/10',
    },
    success: {
      solid: 'bg-green-500 text-white',
      outline: 'border border-green-500 text-green-600',
      ghost: 'text-green-600 hover:bg-green-500/10',
    },
    warning: {
      solid: 'bg-amber-500 text-white',
      outline: 'border border-amber-500 text-amber-600',
      ghost: 'text-amber-600 hover:bg-amber-500/10',
    },
    error: {
      solid: 'bg-red-500 text-white',
      outline: 'border border-red-500 text-red-600',
      ghost: 'text-red-600 hover:bg-red-500/10',
    },
    default: {
      solid: 'bg-muted text-foreground',
      outline: 'border border-border text-foreground',
      ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        'active:scale-[0.95]',
        sizeClasses[size],
        colorClasses[color][variant],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Icon className={iconSizes[size]} />
    </button>
  )
}
