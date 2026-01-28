'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricTrendProps {
  value: number
  label?: string
  format?: 'percent' | 'number' | 'currency'
  currency?: string
  positive?: 'up' | 'down' // Which direction is positive
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showBackground?: boolean
  className?: string
}

export function MetricTrend({
  value,
  label,
  format = 'percent',
  currency = 'KES',
  positive = 'up',
  size = 'md',
  showIcon = true,
  showBackground = true,
  className,
}: MetricTrendProps) {
  const isPositive = positive === 'up' ? value > 0 : value < 0
  const isNegative = positive === 'up' ? value < 0 : value > 0
  const isNeutral = value === 0

  const formatValue = () => {
    const absValue = Math.abs(value)
    switch (format) {
      case 'percent':
        return `${absValue.toFixed(1)}%`
      case 'currency':
        return `${currency} ${absValue.toLocaleString()}`
      case 'number':
        return absValue.toLocaleString()
      default:
        return String(absValue)
    }
  }

  const sizeStyles = {
    sm: {
      container: 'text-xs gap-0.5',
      icon: 'h-3 w-3',
      padding: showBackground ? 'px-1.5 py-0.5' : '',
    },
    md: {
      container: 'text-sm gap-1',
      icon: 'h-4 w-4',
      padding: showBackground ? 'px-2 py-1' : '',
    },
    lg: {
      container: 'text-base gap-1.5',
      icon: 'h-5 w-5',
      padding: showBackground ? 'px-2.5 py-1.5' : '',
    },
  }

  const colorStyles = isNeutral
    ? 'text-muted-foreground bg-muted/50'
    : isPositive
      ? 'text-green-600 bg-green-500/10'
      : 'text-red-600 bg-red-500/10'

  const styles = sizeStyles[size]

  const TrendIcon = isNeutral
    ? Minus
    : value > 0
      ? TrendingUp
      : TrendingDown

  return (
    <div
      className={cn(
        'inline-flex items-center font-medium rounded-md',
        styles.container,
        showBackground ? colorStyles : '',
        showBackground ? styles.padding : '',
        !showBackground && (isNeutral
          ? 'text-muted-foreground'
          : isPositive
            ? 'text-green-600'
            : 'text-red-600'),
        className
      )}
    >
      {showIcon && (
        <TrendIcon className={styles.icon} />
      )}
      <span>
        {value > 0 && '+'}
        {formatValue()}
      </span>
      {label && (
        <span className="text-muted-foreground font-normal ml-1">{label}</span>
      )}
    </div>
  )
}

// Compact trend indicator
interface TrendBadgeProps {
  value: number
  className?: string
}

export function TrendBadge({ value, className }: TrendBadgeProps) {
  const isPositive = value > 0
  const isNeutral = value === 0

  const Icon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isNeutral && 'text-muted-foreground',
        isPositive && 'text-green-600',
        !isPositive && !isNeutral && 'text-red-600',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// Sparkline mini chart
interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: 'primary' | 'success' | 'warning' | 'error' | 'auto'
  showDots?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = 'auto',
  showDots = false,
  className,
}: SparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const padding = 2
  const effectiveWidth = width - padding * 2
  const effectiveHeight = height - padding * 2

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * effectiveWidth
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight
    return { x, y, value }
  })

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  // Determine color based on trend
  const trend = data[data.length - 1] - data[0]
  const strokeColor = color === 'auto'
    ? trend >= 0 ? 'stroke-green-500' : 'stroke-red-500'
    : {
        primary: 'stroke-primary',
        success: 'stroke-green-500',
        warning: 'stroke-amber-500',
        error: 'stroke-red-500',
      }[color]

  return (
    <svg
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
    >
      <path
        d={pathD}
        fill="none"
        className={cn('transition-colors', strokeColor)}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={2}
          className={cn('fill-current', strokeColor.replace('stroke-', 'text-'))}
        />
      ))}
    </svg>
  )
}

// Comparison Metric
interface ComparisonMetricProps {
  current: number
  previous: number
  label?: string
  format?: 'number' | 'currency' | 'percent'
  currency?: string
  className?: string
}

export function ComparisonMetric({
  current,
  previous,
  label,
  format = 'number',
  currency = 'KES',
  className,
}: ComparisonMetricProps) {
  const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `${currency} ${val.toLocaleString()}`
      case 'percent':
        return `${val.toFixed(1)}%`
      default:
        return val.toLocaleString()
    }
  }

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <p className="text-sm text-muted-foreground">{label}</p>
      )}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {formatValue(current)}
        </span>
        <MetricTrend value={change} size="sm" />
      </div>
      <p className="text-xs text-muted-foreground">
        vs {formatValue(previous)} previously
      </p>
    </div>
  )
}
