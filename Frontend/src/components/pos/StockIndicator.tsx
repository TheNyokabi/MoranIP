'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Package, AlertTriangle, XCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StockIndicatorProps {
  quantity: number
  lowStockThreshold?: number
  showQuantity?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dot' | 'badge' | 'full'
  className?: string
}

/**
 * Stock Indicator Component
 * 
 * Displays stock level status with visual indicators:
 * - Green: In stock (qty > lowStockThreshold)
 * - Yellow/Amber: Low stock (0 < qty <= lowStockThreshold)
 * - Red: Out of stock (qty <= 0)
 */
export function StockIndicator({
  quantity,
  lowStockThreshold = 10,
  showQuantity = true,
  size = 'md',
  variant = 'badge',
  className,
}: StockIndicatorProps) {
  const stockStatus = getStockStatus(quantity, lowStockThreshold)
  
  const sizeClasses = {
    sm: {
      dot: 'h-2 w-2',
      badge: 'text-[10px] px-1.5 py-0.5',
      full: 'text-xs gap-1',
      icon: 'h-3 w-3',
    },
    md: {
      dot: 'h-2.5 w-2.5',
      badge: 'text-xs px-2 py-0.5',
      full: 'text-sm gap-1.5',
      icon: 'h-4 w-4',
    },
    lg: {
      dot: 'h-3 w-3',
      badge: 'text-sm px-2.5 py-1',
      full: 'text-base gap-2',
      icon: 'h-5 w-5',
    },
  }
  
  const colorClasses = {
    in_stock: {
      bg: 'bg-green-500',
      bgLight: 'bg-green-500/10',
      text: 'text-green-600',
      border: 'border-green-500/30',
    },
    low_stock: {
      bg: 'bg-amber-500',
      bgLight: 'bg-amber-500/10',
      text: 'text-amber-600',
      border: 'border-amber-500/30',
    },
    out_of_stock: {
      bg: 'bg-red-500',
      bgLight: 'bg-red-500/10',
      text: 'text-red-600',
      border: 'border-red-500/30',
    },
  }
  
  const colors = colorClasses[stockStatus]
  const sizes = sizeClasses[size]
  
  // Dot variant - just a colored dot
  if (variant === 'dot') {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn('rounded-full flex-shrink-0', colors.bg, sizes.dot, className)}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{getStatusLabel(stockStatus)}: {quantity} units</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  // Badge variant - colored badge with optional quantity
  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full font-medium',
          colors.bgLight,
          colors.text,
          sizes.badge,
          className
        )}
      >
        <span className={cn('rounded-full mr-1', colors.bg, 'h-1.5 w-1.5')} />
        {showQuantity ? quantity : getStatusLabel(stockStatus)}
      </span>
    )
  }
  
  // Full variant - icon + text + quantity
  return (
    <div
      className={cn(
        'inline-flex items-center',
        colors.text,
        sizes.full,
        className
      )}
    >
      {stockStatus === 'out_of_stock' ? (
        <XCircle className={sizes.icon} />
      ) : stockStatus === 'low_stock' ? (
        <AlertTriangle className={sizes.icon} />
      ) : (
        <Package className={sizes.icon} />
      )}
      <span className="font-medium">
        {showQuantity && `${quantity} `}
        {getStatusLabel(stockStatus)}
      </span>
    </div>
  )
}

// Stock level dots (3 dots indicator like signal strength)
interface StockLevelDotsProps {
  quantity: number
  lowStockThreshold?: number
  className?: string
}

export function StockLevelDots({
  quantity,
  lowStockThreshold = 10,
  className,
}: StockLevelDotsProps) {
  const stockStatus = getStockStatus(quantity, lowStockThreshold)
  
  const dotCount = stockStatus === 'in_stock' ? 3 : stockStatus === 'low_stock' ? 2 : 1
  const activeColor = stockStatus === 'in_stock' 
    ? 'bg-green-500' 
    : stockStatus === 'low_stock' 
      ? 'bg-amber-500' 
      : 'bg-red-500'
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-0.5', className)}>
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  dot <= dotCount ? activeColor : 'bg-muted'
                )}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getStatusLabel(stockStatus)}: {quantity} units</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Progress bar style indicator
interface StockProgressProps {
  quantity: number
  maxQuantity?: number
  lowStockThreshold?: number
  showLabel?: boolean
  className?: string
}

export function StockProgress({
  quantity,
  maxQuantity = 100,
  lowStockThreshold = 10,
  showLabel = true,
  className,
}: StockProgressProps) {
  const stockStatus = getStockStatus(quantity, lowStockThreshold)
  const percentage = Math.min(100, Math.max(0, (quantity / maxQuantity) * 100))
  
  const color = stockStatus === 'in_stock' 
    ? 'bg-green-500' 
    : stockStatus === 'low_stock' 
      ? 'bg-amber-500' 
      : 'bg-red-500'
  
  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Stock Level</span>
          <span className={cn(
            'font-medium',
            stockStatus === 'in_stock' && 'text-green-600',
            stockStatus === 'low_stock' && 'text-amber-600',
            stockStatus === 'out_of_stock' && 'text-red-600'
          )}>
            {quantity} units
          </span>
        </div>
      )}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// Helper functions
type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

function getStockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= lowStockThreshold) return 'low_stock'
  return 'in_stock'
}

function getStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'in_stock':
      return 'In Stock'
    case 'low_stock':
      return 'Low Stock'
    case 'out_of_stock':
      return 'Out of Stock'
  }
}

// Export utility function for use in other components
export { getStockStatus, getStatusLabel }
export type { StockStatus }
