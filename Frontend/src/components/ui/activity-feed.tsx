'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'

export type ActivityType = 
  | 'sale' 
  | 'purchase' 
  | 'stock' 
  | 'customer' 
  | 'alert' 
  | 'task' 
  | 'system' 
  | 'user'

interface Activity {
  id: string
  type: ActivityType
  title: string
  description?: string
  timestamp: Date | string
  user?: {
    name: string
    avatar?: string
  }
  metadata?: Record<string, unknown>
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
}

interface ActivityFeedProps {
  activities: Activity[]
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  emptyMessage?: string
  className?: string
}

const typeStyles: Record<ActivityType, { bg: string; text: string }> = {
  sale: { bg: 'bg-green-500/10', text: 'text-green-600' },
  purchase: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  stock: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
  customer: { bg: 'bg-cyan-500/10', text: 'text-cyan-600' },
  alert: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  task: { bg: 'bg-indigo-500/10', text: 'text-indigo-600' },
  system: { bg: 'bg-gray-500/10', text: 'text-gray-600' },
  user: { bg: 'bg-pink-500/10', text: 'text-pink-600' },
}

const defaultIcons: Record<ActivityType, string> = {
  sale: '💰',
  purchase: '📦',
  stock: '📋',
  customer: '👤',
  alert: '⚠️',
  task: '✅',
  system: '⚙️',
  user: '👥',
}

export function ActivityFeed({
  activities,
  loading = false,
  onLoadMore,
  hasMore = false,
  emptyMessage = 'No recent activity',
  className,
}: ActivityFeedProps) {
  if (loading && activities.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1}
        />
      ))}
      
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full py-3 text-sm text-primary hover:text-primary/80 transition-colors"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

interface ActivityItemProps {
  activity: Activity
  isLast?: boolean
}

function ActivityItem({ activity, isLast = false }: ActivityItemProps) {
  const styles = typeStyles[activity.type]
  const timestamp = typeof activity.timestamp === 'string' 
    ? new Date(activity.timestamp) 
    : activity.timestamp

  return (
    <div className="relative flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[1.625rem] top-14 bottom-0 w-px bg-border" />
      )}

      {/* Icon/Avatar */}
      <div className="relative z-10 flex-shrink-0">
        {activity.user ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
            <AvatarFallback className={cn(styles.bg, styles.text)}>
              {activity.user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center text-lg',
            styles.bg
          )}>
            {activity.icon || defaultIcons[activity.type]}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {activity.description}
              </p>
            )}
          </div>
          
          <time className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </time>
        </div>

        {/* Action Button */}
        {activity.action && (
          <button
            onClick={activity.action.onClick}
            className="text-xs text-primary hover:underline mt-2"
          >
            {activity.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// Notification Item variant
interface NotificationItemProps {
  id: string
  title: string
  description?: string
  timestamp: Date | string
  read?: boolean
  type?: ActivityType
  onClick?: () => void
  onDismiss?: () => void
}

export function NotificationItem({
  id,
  title,
  description,
  timestamp,
  read = false,
  type = 'system',
  onClick,
  onDismiss,
}: NotificationItemProps) {
  const styles = typeStyles[type]
  const time = typeof timestamp === 'string' ? new Date(timestamp) : timestamp

  return (
    <div
      className={cn(
        'relative flex gap-3 p-4 rounded-lg border transition-colors',
        !read && 'bg-primary/5 border-primary/20',
        read && 'bg-card border-border',
        onClick && 'cursor-pointer hover:bg-muted/50'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {/* Unread indicator */}
      {!read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center text-lg flex-shrink-0',
        styles.bg
      )}>
        {defaultIcons[type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm text-foreground',
            !read && 'font-medium'
          )}>
            {title}
          </p>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(time, { addSuffix: true })}
          </time>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        >
          ×
        </button>
      )}
    </div>
  )
}
