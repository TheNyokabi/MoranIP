'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

interface AvatarItem {
  id: string
  name: string
  image?: string
  initials?: string
}

interface AvatarGroupProps {
  items: AvatarItem[]
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  onClick?: (item: AvatarItem) => void
  onOverflowClick?: () => void
  className?: string
}

const sizeStyles = {
  xs: {
    avatar: 'h-6 w-6 text-[10px]',
    overlap: '-ml-1.5',
    overflowText: 'text-[10px]',
  },
  sm: {
    avatar: 'h-8 w-8 text-xs',
    overlap: '-ml-2',
    overflowText: 'text-xs',
  },
  md: {
    avatar: 'h-10 w-10 text-sm',
    overlap: '-ml-2.5',
    overflowText: 'text-sm',
  },
  lg: {
    avatar: 'h-12 w-12 text-base',
    overlap: '-ml-3',
    overflowText: 'text-base',
  },
}

export function AvatarGroup({
  items,
  max = 5,
  size = 'md',
  showTooltip = true,
  onClick,
  onOverflowClick,
  className,
}: AvatarGroupProps) {
  const styles = sizeStyles[size]
  const visibleItems = items.slice(0, max)
  const overflowCount = items.length - max

  const getInitials = (item: AvatarItem) => {
    if (item.initials) return item.initials
    return item.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const renderAvatar = (item: AvatarItem, index: number) => {
    const avatar = (
      <Avatar
        className={cn(
          styles.avatar,
          'border-2 border-background ring-0',
          index > 0 && styles.overlap,
          onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all'
        )}
        onClick={onClick ? () => onClick(item) : undefined}
      >
        <AvatarImage src={item.image} alt={item.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(item)}
        </AvatarFallback>
      </Avatar>
    )

    if (showTooltip) {
      return (
        <TooltipProvider key={item.id} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              {avatar}
            </TooltipTrigger>
            <TooltipContent>
              <p>{item.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return <div key={item.id}>{avatar}</div>
  }

  return (
    <div className={cn('flex items-center', className)}>
      {visibleItems.map((item, index) => renderAvatar(item, index))}
      
      {overflowCount > 0 && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  styles.avatar,
                  styles.overlap,
                  'rounded-full border-2 border-background bg-muted flex items-center justify-center',
                  'font-medium text-muted-foreground',
                  onOverflowClick && 'cursor-pointer hover:bg-muted/80 transition-colors'
                )}
                onClick={onOverflowClick}
              >
                <span className={styles.overflowText}>+{overflowCount}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {items.slice(max).map((item) => (
                  <p key={item.id}>{item.name}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

// Stacked Avatar List (vertical)
interface AvatarStackProps {
  items: AvatarItem[]
  max?: number
  size?: 'sm' | 'md' | 'lg'
  showNames?: boolean
  className?: string
}

export function AvatarStack({
  items,
  max = 5,
  size = 'md',
  showNames = true,
  className,
}: AvatarStackProps) {
  const styles = sizeStyles[size]
  const visibleItems = items.slice(0, max)
  const overflowCount = items.length - max

  const getInitials = (item: AvatarItem) => {
    if (item.initials) return item.initials
    return item.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className={cn('space-y-2', className)}>
      {visibleItems.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <Avatar className={styles.avatar}>
            <AvatarImage src={item.image} alt={item.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(item)}
            </AvatarFallback>
          </Avatar>
          {showNames && (
            <span className="text-sm text-foreground truncate">{item.name}</span>
          )}
        </div>
      ))}
      
      {overflowCount > 0 && (
        <p className="text-sm text-muted-foreground pl-1">
          +{overflowCount} more
        </p>
      )}
    </div>
  )
}

// Single Avatar with details
interface AvatarWithDetailsProps {
  name: string
  subtitle?: string
  image?: string
  initials?: string
  size?: 'sm' | 'md' | 'lg'
  action?: React.ReactNode
  className?: string
}

export function AvatarWithDetails({
  name,
  subtitle,
  image,
  initials,
  size = 'md',
  action,
  className,
}: AvatarWithDetailsProps) {
  const styles = sizeStyles[size]

  const getInitials = () => {
    if (initials) return initials
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Avatar className={styles.avatar}>
        <AvatarImage src={image} alt={name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{name}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
