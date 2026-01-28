'use client'

import * as React from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, TrendingUp, TrendingDown, ShoppingCart, Package, Users,
  DollarSign, AlertTriangle, CheckCircle, Clock, MessageSquare,
  Heart, Share2, MoreHorizontal, ChevronRight, Star, Zap,
  Target, Award, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ==================== Types ====================

export type FeedItemType = 
  | 'sale' | 'order' | 'inventory' | 'customer' | 'achievement' 
  | 'alert' | 'milestone' | 'announcement' | 'task' | 'mention'

export interface FeedItem {
  id: string
  type: FeedItemType
  title: string
  description?: string
  timestamp: Date
  tenant?: {
    id: string
    name: string
    slug: string
    logo?: string
  }
  actor?: {
    id: string
    name: string
    avatar?: string
  }
  metadata?: {
    amount?: number
    currency?: string
    change?: number  // percentage change
    target?: number
    achieved?: number
    count?: number
    link?: string
  }
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  read?: boolean
  actions?: {
    label: string
    action: () => void
    variant?: 'default' | 'outline' | 'ghost'
  }[]
}

// ==================== Feed Item Component ====================

interface FeedItemCardProps {
  item: FeedItem
  onMarkRead?: (id: string) => void
  onAction?: (id: string, action: string) => void
  compact?: boolean
}

export function FeedItemCard({
  item,
  onMarkRead,
  onAction,
  compact = false,
}: FeedItemCardProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [liked, setLiked] = React.useState(false)
  
  const icon = getItemIcon(item.type)
  const color = getItemColor(item.type, item.priority)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative group',
        !item.read && 'bg-primary/5 dark:bg-primary/10'
      )}
    >
      <Card className={cn(
        'border-l-4 transition-all duration-200',
        `border-l-${color}`,
        isHovered && 'shadow-md',
        compact ? 'py-2' : 'py-3'
      )}>
        <CardContent className={cn('p-4', compact && 'p-3')}>
          <div className="flex gap-3">
            {/* Icon/Avatar */}
            <div className="flex-shrink-0">
              {item.actor ? (
                <Avatar className={cn(compact ? 'h-8 w-8' : 'h-10 w-10')}>
                  <AvatarImage src={item.actor.avatar} />
                  <AvatarFallback className={cn('text-xs', `bg-${color}/10 text-${color}`)}>
                    {item.actor.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className={cn(
                  'rounded-full flex items-center justify-center',
                  `bg-${color}/10 text-${color}`,
                  compact ? 'h-8 w-8' : 'h-10 w-10'
                )}>
                  {icon}
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Tenant badge */}
                  {item.tenant && (
                    <Badge variant="outline" className="mb-1 text-xs">
                      {item.tenant.name}
                    </Badge>
                  )}
                  
                  {/* Title */}
                  <h4 className={cn(
                    'font-medium text-foreground leading-tight',
                    compact ? 'text-sm' : 'text-base'
                  )}>
                    {item.actor && (
                      <span className="font-semibold">{item.actor.name} </span>
                    )}
                    {item.title}
                  </h4>
                </div>
                
                {/* Actions dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity',
                        isHovered && 'opacity-100'
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!item.read && (
                      <DropdownMenuItem onClick={() => onMarkRead?.(item.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as read
                      </DropdownMenuItem>
                    )}
                    {item.metadata?.link && (
                      <DropdownMenuItem>
                        <ChevronRight className="h-4 w-4 mr-2" />
                        View details
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Description */}
              {item.description && (
                <p className={cn(
                  'text-muted-foreground mt-1',
                  compact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2'
                )}>
                  {item.description}
                </p>
              )}
              
              {/* Metadata */}
              {item.metadata && !compact && (
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {item.metadata.amount !== undefined && (
                    <span className="text-sm font-medium">
                      {item.metadata.currency || 'KES'} {item.metadata.amount.toLocaleString()}
                    </span>
                  )}
                  {item.metadata.change !== undefined && (
                    <Badge variant={item.metadata.change >= 0 ? 'default' : 'destructive'} className="gap-1">
                      {item.metadata.change >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(item.metadata.change)}%
                    </Badge>
                  )}
                  {item.metadata.target && item.metadata.achieved !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <span>{item.metadata.achieved}% of target</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Footer */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                </span>
                
                {/* Engagement actions (social media style) */}
                {!compact && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('h-7 px-2 gap-1', liked && 'text-red-500')}
                      onClick={() => setLiked(!liked)}
                    >
                      <Heart className={cn('h-3.5 w-3.5', liked && 'fill-current')} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              {item.actions && item.actions.length > 0 && !compact && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.actions.map((action, i) => (
                    <Button
                      key={i}
                      variant={action.variant || 'outline'}
                      size="sm"
                      onClick={action.action}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ==================== Social Feed Component ====================

interface SocialFeedProps {
  items: FeedItem[]
  loading?: boolean
  onRefresh?: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  onMarkRead?: (id: string) => void
  emptyMessage?: string
  className?: string
}

export function SocialFeed({
  items,
  loading = false,
  onRefresh,
  onLoadMore,
  hasMore = false,
  onMarkRead,
  emptyMessage = 'No updates yet',
  className,
}: SocialFeedProps) {
  const [filter, setFilter] = React.useState<FeedItemType | 'all'>('all')
  
  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.type === filter)
  
  const unreadCount = items.filter(i => !i.read).length
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Activity Feed</h2>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} new</Badge>
          )}
        </div>
        
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        )}
      </div>
      
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {(['all', 'sale', 'order', 'inventory', 'achievement', 'alert'] as const).map(type => (
          <Button
            key={type}
            variant={filter === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(type)}
            className="flex-shrink-0"
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>
      
      {/* Feed items */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredItems.length === 0 && !loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{emptyMessage}</p>
            </motion.div>
          ) : (
            filteredItems.map(item => (
              <FeedItemCard
                key={item.id}
                item={item}
                onMarkRead={onMarkRead}
              />
            ))
          )}
        </AnimatePresence>
        
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}
        
        {hasMore && !loading && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onLoadMore}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  )
}

// ==================== Quick Stats Row ====================

interface QuickStat {
  label: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  href?: string
}

interface QuickStatsRowProps {
  stats: QuickStat[]
  className?: string
}

export function QuickStatsRow({ stats, className }: QuickStatsRowProps) {
  return (
    <div className={cn(
      'grid gap-4',
      stats.length <= 2 ? 'grid-cols-2' : 
      stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4',
      className
    )}>
      {stats.map((stat, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            {stat.icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {stat.icon}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
              {stat.change !== undefined && (
                <p className={cn(
                  'text-xs flex items-center gap-1',
                  stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {stat.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stat.change)}%
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ==================== Workspace Cards ====================

interface Workspace {
  id: string
  name: string
  slug: string
  logo?: string
  stats?: {
    sales?: number
    orders?: number
    alerts?: number
  }
  lastActivity?: Date
}

interface WorkspaceCardsProps {
  workspaces: Workspace[]
  onSelect: (workspace: Workspace) => void
  className?: string
}

export function WorkspaceCards({ workspaces, onSelect, className }: WorkspaceCardsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-lg font-semibold">Your Workspaces</h2>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map(workspace => (
          <Card
            key={workspace.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelect(workspace)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={workspace.logo} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {workspace.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{workspace.name}</h3>
                  {workspace.lastActivity && (
                    <p className="text-xs text-muted-foreground">
                      Active {formatDistanceToNow(workspace.lastActivity, { addSuffix: true })}
                    </p>
                  )}
                </div>
                
                {workspace.stats?.alerts && workspace.stats.alerts > 0 && (
                  <Badge variant="destructive" className="flex-shrink-0">
                    {workspace.stats.alerts}
                  </Badge>
                )}
              </div>
              
              {workspace.stats && (
                <div className="flex gap-4 mt-3 pt-3 border-t text-xs">
                  {workspace.stats.sales !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Sales</span>
                      <p className="font-medium">KES {workspace.stats.sales.toLocaleString()}</p>
                    </div>
                  )}
                  {workspace.stats.orders !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Orders</span>
                      <p className="font-medium">{workspace.stats.orders}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ==================== Helper Functions ====================

function getItemIcon(type: FeedItemType) {
  const iconClass = 'h-4 w-4'
  switch (type) {
    case 'sale':
      return <DollarSign className={iconClass} />
    case 'order':
      return <ShoppingCart className={iconClass} />
    case 'inventory':
      return <Package className={iconClass} />
    case 'customer':
      return <Users className={iconClass} />
    case 'achievement':
      return <Award className={iconClass} />
    case 'alert':
      return <AlertTriangle className={iconClass} />
    case 'milestone':
      return <Star className={iconClass} />
    case 'announcement':
      return <Bell className={iconClass} />
    case 'task':
      return <CheckCircle className={iconClass} />
    case 'mention':
      return <MessageSquare className={iconClass} />
    default:
      return <Zap className={iconClass} />
  }
}

function getItemColor(type: FeedItemType, priority?: string): string {
  if (priority === 'urgent') return 'red-500'
  if (priority === 'high') return 'orange-500'
  
  switch (type) {
    case 'sale':
      return 'green-500'
    case 'order':
      return 'blue-500'
    case 'inventory':
      return 'purple-500'
    case 'customer':
      return 'cyan-500'
    case 'achievement':
      return 'yellow-500'
    case 'alert':
      return 'red-500'
    case 'milestone':
      return 'indigo-500'
    case 'announcement':
      return 'blue-500'
    case 'task':
      return 'green-500'
    case 'mention':
      return 'pink-500'
    default:
      return 'gray-500'
  }
}

export default SocialFeed
