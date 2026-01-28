'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number // 0-100
  size?: 'sm' | 'md' | 'lg' | 'xl'
  thickness?: number
  color?: 'primary' | 'success' | 'warning' | 'error' | 'custom'
  customColor?: string
  trackColor?: string
  showValue?: boolean
  showLabel?: boolean
  label?: string
  animated?: boolean
  className?: string
  children?: React.ReactNode
}

const sizeConfig = {
  sm: { size: 40, fontSize: 'text-xs', strokeWidth: 3 },
  md: { size: 64, fontSize: 'text-sm', strokeWidth: 4 },
  lg: { size: 96, fontSize: 'text-lg', strokeWidth: 5 },
  xl: { size: 128, fontSize: 'text-xl', strokeWidth: 6 },
}

const colorConfig = {
  primary: 'stroke-primary',
  success: 'stroke-green-500',
  warning: 'stroke-amber-500',
  error: 'stroke-red-500',
  custom: '',
}

export function ProgressRing({
  value,
  size = 'md',
  thickness,
  color = 'primary',
  customColor,
  trackColor = 'stroke-muted',
  showValue = true,
  showLabel = false,
  label,
  animated = true,
  className,
  children,
}: ProgressRingProps) {
  const config = sizeConfig[size]
  const strokeWidth = thickness || config.strokeWidth
  const radius = (config.size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(100, Math.max(0, value))
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const strokeClass = color === 'custom' && customColor
    ? undefined
    : colorConfig[color]

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.size}
        height={config.size}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          className={trackColor}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          className={cn(strokeClass, animated && 'transition-all duration-500 ease-out')}
          style={customColor ? { stroke: customColor } : undefined}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      
      {/* Center Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children || (
          <>
            {showValue && (
              <span className={cn('font-semibold text-foreground', config.fontSize)}>
                {Math.round(progress)}%
              </span>
            )}
            {showLabel && label && (
              <span className="text-xs text-muted-foreground mt-0.5">
                {label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Multiple Progress Rings (for comparisons)
interface MultiProgressRingProps {
  items: Array<{
    value: number
    label: string
    color: string
  }>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MultiProgressRing({ items, size = 'md', className }: MultiProgressRingProps) {
  const config = sizeConfig[size]
  const baseRadius = (config.size - config.strokeWidth) / 2
  const gap = config.strokeWidth + 2

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={config.size + (items.length - 1) * gap * 2}
        height={config.size + (items.length - 1) * gap * 2}
        className="transform -rotate-90"
      >
        {items.map((item, index) => {
          const radius = baseRadius - index * gap
          const circumference = 2 * Math.PI * radius
          const strokeDashoffset = circumference - (item.value / 100) * circumference
          const center = (config.size + (items.length - 1) * gap * 2) / 2

          return (
            <React.Fragment key={index}>
              {/* Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                className="stroke-muted"
                strokeWidth={config.strokeWidth}
              />
              
              {/* Progress */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                style={{ stroke: item.color }}
                strokeWidth={config.strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </React.Fragment>
          )
        })}
      </svg>
    </div>
  )
}

// Linear Progress Bar
interface LinearProgressProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'warning' | 'error'
  showValue?: boolean
  label?: string
  animated?: boolean
  className?: string
}

export function LinearProgress({
  value,
  size = 'md',
  color = 'primary',
  showValue = false,
  label,
  animated = true,
  className,
}: LinearProgressProps) {
  const progress = Math.min(100, Math.max(0, value))

  const heightStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const colorStyles = {
    primary: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  }

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm text-muted-foreground">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-medium text-foreground">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      <div className={cn('w-full bg-muted rounded-full overflow-hidden', heightStyles[size])}>
        <div
          className={cn(
            'h-full rounded-full',
            colorStyles[color],
            animated && 'transition-all duration-500 ease-out'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// Segmented Progress
interface SegmentedProgressProps {
  value: number
  segments: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'success' | 'warning' | 'error'
  className?: string
}

export function SegmentedProgress({
  value,
  segments,
  size = 'md',
  color = 'primary',
  className,
}: SegmentedProgressProps) {
  const progress = Math.min(100, Math.max(0, value))
  const filledSegments = Math.round((progress / 100) * segments)

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  }

  const colorStyles = {
    primary: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  }

  return (
    <div className={cn('flex gap-1', className)}>
      {[...Array(segments)].map((_, index) => (
        <div
          key={index}
          className={cn(
            'flex-1 rounded-full transition-colors duration-300',
            heightStyles[size],
            index < filledSegments ? colorStyles[color] : 'bg-muted'
          )}
        />
      ))}
    </div>
  )
}
