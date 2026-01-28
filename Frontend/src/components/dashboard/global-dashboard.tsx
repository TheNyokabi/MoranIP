'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, Settings, Plus, Search, TrendingUp, Building2,
  ShoppingCart, DollarSign, Package, Users, Calendar,
  BarChart3, Target, Zap, Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SocialFeed,
  QuickStatsRow,
  WorkspaceCards,
  type FeedItem,
} from './social-feed'
import { useIsMobile } from '@/hooks/use-mobile'

// ==================== Dashboard Header ====================

interface DashboardHeaderProps {
  user?: {
    name: string
    avatar?: string
  }
  notificationCount?: number
  onNotificationsClick?: () => void
  onSettingsClick?: () => void
  onSearchChange?: (query: string) => void
}

function DashboardHeader({
  user,
  notificationCount = 0,
  onNotificationsClick,
  onSettingsClick,
  onSearchChange,
}: DashboardHeaderProps) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const isMobile = useIsMobile()
  
  // Get greeting based on time
  const greeting = React.useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])
  
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex h-16 items-center justify-between gap-4 px-4">
        {/* Greeting */}
        <div className="flex items-center gap-3">
          {user && (
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="text-lg font-semibold">{user?.name || 'User'}</h1>
          </div>
        </div>
        
        {/* Search (expandable on mobile) */}
        <div className={cn(
          'flex-1 max-w-md transition-all',
          isMobile && !searchOpen && 'max-w-0 overflow-hidden opacity-0'
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all workspaces..."
              className="pl-9 bg-muted/50"
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onNotificationsClick}
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </Button>
          
          <Button variant="ghost" size="icon" onClick={onSettingsClick}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

// ==================== Today's Summary Widget ====================

interface TodaySummaryProps {
  data: {
    totalSales: number
    ordersCount: number
    newCustomers: number
    lowStockItems: number
    pendingTasks: number
    targetProgress: number
  }
  currency?: string
}

function TodaySummary({ data, currency = 'KES' }: TodaySummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Today&apos;s Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              {currency} {data.totalSales.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Sales</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.ordersCount}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.newCustomers}</p>
            <p className="text-xs text-muted-foreground">New Customers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{data.lowStockItems}</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-500">{data.pendingTasks}</p>
            <p className="text-xs text-muted-foreground">Pending Tasks</p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{data.targetProgress}%</p>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">Target Progress</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Quick Actions Widget ====================

interface QuickAction {
  label: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  badge?: string | number
}

interface QuickActionsWidgetProps {
  actions: QuickAction[]
  className?: string
}

function QuickActionsWidget({ actions, className }: QuickActionsWidgetProps) {
  const router = useRouter()
  
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => action.onClick?.() || (action.href && router.push(action.href))}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-muted transition-colors relative"
            >
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                {action.icon}
              </div>
              <span className="text-xs text-center">{action.label}</span>
              {action.badge && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center text-[10px]"
                >
                  {action.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Main Global Dashboard ====================

interface GlobalDashboardProps {
  user?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  workspaces?: Array<{
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
  }>
  feedItems?: FeedItem[]
  todaySummary?: {
    totalSales: number
    ordersCount: number
    newCustomers: number
    lowStockItems: number
    pendingTasks: number
    targetProgress: number
  }
  notificationCount?: number
  loading?: boolean
  onRefresh?: () => void
  onWorkspaceSelect?: (workspaceId: string) => void
}

export function GlobalDashboard({
  user,
  workspaces = [],
  feedItems = [],
  todaySummary,
  notificationCount = 0,
  loading = false,
  onRefresh,
  onWorkspaceSelect,
}: GlobalDashboardProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = React.useState('feed')
  
  // Quick actions
  const quickActions: QuickAction[] = [
    {
      label: 'New Sale',
      icon: <ShoppingCart className="h-4 w-4" />,
      href: workspaces[0] ? `/w/${workspaces[0].slug}/pos` : undefined,
    },
    {
      label: 'Add Item',
      icon: <Package className="h-4 w-4" />,
      href: workspaces[0] ? `/w/${workspaces[0].slug}/inventory` : undefined,
    },
    {
      label: 'Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      href: workspaces[0] ? `/w/${workspaces[0].slug}/reports` : undefined,
    },
    {
      label: 'Customers',
      icon: <Users className="h-4 w-4" />,
      href: workspaces[0] ? `/w/${workspaces[0].slug}/crm` : undefined,
    },
  ]
  
  // Quick stats
  const quickStats = todaySummary ? [
    {
      label: 'Today Sales',
      value: `KES ${todaySummary.totalSales.toLocaleString()}`,
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: 'Orders',
      value: todaySummary.ordersCount,
      icon: <ShoppingCart className="h-4 w-4" />,
    },
    {
      label: 'Alerts',
      value: todaySummary.lowStockItems,
      icon: <Bell className="h-4 w-4" />,
    },
    {
      label: 'Target',
      value: `${todaySummary.targetProgress}%`,
      icon: <Target className="h-4 w-4" />,
    },
  ] : []
  
  const handleWorkspaceSelect = (workspace: { id: string; slug: string }) => {
    if (onWorkspaceSelect) {
      onWorkspaceSelect(workspace.id)
    }
    router.push(`/w/${workspace.slug}`)
  }
  
  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader
        user={user}
        notificationCount={notificationCount}
        onNotificationsClick={() => setActiveTab('notifications')}
        onSettingsClick={() => router.push('/settings')}
      />
      
      <main className="container px-4 py-6">
        {/* Mobile tabs */}
        {isMobile ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="feed">Feed</TabsTrigger>
              <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
            
            <TabsContent value="feed" className="space-y-4">
              {quickStats.length > 0 && <QuickStatsRow stats={quickStats} />}
              <SocialFeed
                items={feedItems}
                loading={loading}
                onRefresh={onRefresh}
              />
            </TabsContent>
            
            <TabsContent value="workspaces">
              <WorkspaceCards
                workspaces={workspaces}
                onSelect={handleWorkspaceSelect}
              />
            </TabsContent>
            
            <TabsContent value="stats" className="space-y-4">
              {todaySummary && <TodaySummary data={todaySummary} />}
              <QuickActionsWidget actions={quickActions} />
            </TabsContent>
          </Tabs>
        ) : (
          /* Desktop layout - 3 column */
          <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
            {/* Left sidebar - Workspaces */}
            <aside className="space-y-4">
              <WorkspaceCards
                workspaces={workspaces}
                onSelect={handleWorkspaceSelect}
              />
            </aside>
            
            {/* Main content - Feed */}
            <div className="space-y-4">
              {quickStats.length > 0 && <QuickStatsRow stats={quickStats} />}
              <SocialFeed
                items={feedItems}
                loading={loading}
                onRefresh={onRefresh}
              />
            </div>
            
            {/* Right sidebar - Summary & Actions */}
            <aside className="space-y-4">
              {todaySummary && <TodaySummary data={todaySummary} />}
              <QuickActionsWidget actions={quickActions} />
            </aside>
          </div>
        )}
      </main>
      
      {/* FAB for mobile */}
      {isMobile && (
        <Button
          size="lg"
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            if (workspaces[0]) {
              router.push(`/w/${workspaces[0].slug}/pos`)
            }
          }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}

export default GlobalDashboard
