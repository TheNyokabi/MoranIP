'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users,
  Package, AlertTriangle, CheckCircle, Clock, Target, Award,
  ArrowRight, BarChart3, PieChart, Activity, Calendar,
  CreditCard, Wallet, RefreshCw, ChevronRight, Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { MetricTrend } from '@/components/ui/metric-trend'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTenantContext } from '@/hooks/use-tenant-context'

// ==================== Types ====================

interface SalesData {
  period: string
  value: number
  target?: number
}

interface TopProduct {
  id: string
  name: string
  quantity: number
  revenue: number
  trend: number
}

interface TopCustomer {
  id: string
  name: string
  avatar?: string
  totalSpent: number
  ordersCount: number
  lastOrder?: Date
}

interface Alert {
  id: string
  type: 'warning' | 'error' | 'info'
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

interface TenantDashboardData {
  // KPIs
  todaySales: number
  todayOrders: number
  todayCustomers: number
  avgOrderValue: number
  // Comparisons (vs yesterday/last week)
  salesChange: number
  ordersChange: number
  customersChange: number
  aovChange: number
  // Targets
  monthlyTarget: number
  monthlyAchieved: number
  // Top items
  topProducts: TopProduct[]
  topCustomers: TopCustomer[]
  // Inventory alerts
  lowStockCount: number
  outOfStockCount: number
  // Cash position
  cashInDrawer?: number
  pendingPayments?: number
  // Recent alerts
  alerts: Alert[]
}

// ==================== KPI Card ====================

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  href?: string
  className?: string
}

function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  href,
  className,
}: KPICardProps) {
  const router = useRouter()
  
  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all',
        className
      )}
      onClick={() => href && router.push(href)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          {change !== undefined && (
            <Badge
              variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}
              className="gap-1"
            >
              {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : 
               trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
              {Math.abs(change)}%
            </Badge>
          )}
        </div>
        
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
          {changeLabel && (
            <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
          )}
        </div>
        
        {href && (
          <div className="flex items-center gap-1 mt-2 text-xs text-primary">
            View details <ChevronRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== Target Progress Widget ====================

interface TargetProgressProps {
  target: number
  achieved: number
  currency?: string
  label?: string
}

function TargetProgress({ target, achieved, currency = 'KES', label = 'Monthly Target' }: TargetProgressProps) {
  const percentage = Math.min(100, Math.round((achieved / target) * 100))
  const remaining = Math.max(0, target - achieved)
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const currentDay = new Date().getDate()
  const expectedProgress = Math.round((currentDay / daysInMonth) * 100)
  
  const isOnTrack = percentage >= expectedProgress
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-3xl font-bold">{percentage}%</p>
            <p className="text-sm text-muted-foreground">
              {currency} {achieved.toLocaleString()} / {target.toLocaleString()}
            </p>
          </div>
          <ProgressRing
            value={percentage}
            size="lg"
            color={isOnTrack ? 'success' : 'warning'}
          />
        </div>
        
        <Progress value={percentage} className="h-2 mb-3" />
        
        <div className="flex items-center justify-between text-sm">
          <span className={cn(
            'flex items-center gap-1',
            isOnTrack ? 'text-green-600' : 'text-orange-600'
          )}>
            {isOnTrack ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {isOnTrack ? 'On track' : 'Behind schedule'}
          </span>
          <span className="text-muted-foreground">
            {currency} {remaining.toLocaleString()} to go
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Top Products Widget ====================

interface TopProductsProps {
  products: TopProduct[]
  currency?: string
  onViewAll?: () => void
}

function TopProducts({ products, currency = 'KES', onViewAll }: TopProductsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Top Products</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.slice(0, 5).map((product, i) => (
            <div key={product.id} className="flex items-center gap-3">
              <span className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                i === 0 && 'bg-yellow-100 text-yellow-700',
                i === 1 && 'bg-gray-100 text-gray-700',
                i === 2 && 'bg-orange-100 text-orange-700',
                i > 2 && 'bg-muted text-muted-foreground'
              )}>
                {i + 1}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.quantity} sold</p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">{currency} {product.revenue.toLocaleString()}</p>
                <MetricTrend
                  value={product.trend}
                  format="percent"
                  size="sm"
                />
              </div>
            </div>
          ))}
          
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sales data yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Top Customers Widget ====================

interface TopCustomersProps {
  customers: TopCustomer[]
  currency?: string
  onViewAll?: () => void
}

function TopCustomers({ customers, currency = 'KES', onViewAll }: TopCustomersProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Top Customers</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {customers.slice(0, 5).map((customer, i) => (
            <div key={customer.id} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={customer.avatar} />
                <AvatarFallback className="text-xs">
                  {customer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {customer.ordersCount} orders
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">{currency} {customer.totalSpent.toLocaleString()}</p>
                {i < 3 && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <Star className="h-2.5 w-2.5" />
                    Top {i + 1}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          
          {customers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No customer data yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Alerts Widget ====================

interface AlertsWidgetProps {
  alerts: Alert[]
  onAction?: (alertId: string) => void
}

function AlertsWidget({ alerts, onAction }: AlertsWidgetProps) {
  const router = useRouter()
  
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
          <p className="text-sm font-medium">All clear!</p>
          <p className="text-xs text-muted-foreground">No alerts at the moment</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.slice(0, 4).map(alert => (
            <div
              key={alert.id}
              className={cn(
                'p-3 rounded-lg border',
                alert.type === 'error' && 'bg-red-50 border-red-200 dark:bg-red-950/20',
                alert.type === 'warning' && 'bg-orange-50 border-orange-200 dark:bg-orange-950/20',
                alert.type === 'info' && 'bg-blue-50 border-blue-200 dark:bg-blue-950/20'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  {alert.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.description}
                    </p>
                  )}
                </div>
                {alert.actionLabel && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alert.actionHref ? router.push(alert.actionHref) : onAction?.(alert.id)}
                  >
                    {alert.actionLabel}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Cash Position Widget ====================

interface CashPositionProps {
  cashInDrawer: number
  pendingPayments: number
  currency?: string
}

function CashPosition({ cashInDrawer, pendingPayments, currency = 'KES' }: CashPositionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Cash Position
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
            <p className="text-xs text-muted-foreground">Cash in Drawer</p>
            <p className="text-xl font-bold text-green-600">
              {currency} {cashInDrawer.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-xl font-bold text-blue-600">
              {currency} {pendingPayments.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Main Tenant Dashboard ====================

interface TenantDashboardProps {
  data?: TenantDashboardData
  loading?: boolean
  onRefresh?: () => void
  currency?: string
}

export function TenantDashboard({
  data,
  loading = false,
  onRefresh,
  currency = 'KES',
}: TenantDashboardProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { tenantSlug, buildNavUrl } = useTenantContext()
  const [period, setPeriod] = React.useState('today')
  
  // Default data for display
  const displayData: TenantDashboardData = data || {
    todaySales: 0,
    todayOrders: 0,
    todayCustomers: 0,
    avgOrderValue: 0,
    salesChange: 0,
    ordersChange: 0,
    customersChange: 0,
    aovChange: 0,
    monthlyTarget: 100000,
    monthlyAchieved: 0,
    topProducts: [],
    topCustomers: [],
    lowStockCount: 0,
    outOfStockCount: 0,
    cashInDrawer: 0,
    pendingPayments: 0,
    alerts: [],
  }
  
  // Generate alerts from data
  const alerts: Alert[] = [
    ...(displayData.alerts || []),
    ...(displayData.lowStockCount > 0 ? [{
      id: 'low-stock',
      type: 'warning' as const,
      title: `${displayData.lowStockCount} items low in stock`,
      actionLabel: 'View',
      actionHref: buildNavUrl('/inventory?filter=low_stock'),
    }] : []),
    ...(displayData.outOfStockCount > 0 ? [{
      id: 'out-of-stock',
      type: 'error' as const,
      title: `${displayData.outOfStockCount} items out of stock`,
      actionLabel: 'Restock',
      actionHref: buildNavUrl('/inventory?filter=out_of_stock'),
    }] : []),
  ]
  
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>
      
      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-muted" />
          ))}
        </div>
      )}
      
      {/* KPI Cards */}
      {!loading && (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Sales"
              value={`${currency} ${displayData.todaySales.toLocaleString()}`}
              change={displayData.salesChange}
              changeLabel="vs yesterday"
              icon={<DollarSign className="h-5 w-5" />}
              trend={displayData.salesChange > 0 ? 'up' : displayData.salesChange < 0 ? 'down' : 'neutral'}
              href={buildNavUrl('/reports/sales')}
            />
            <KPICard
              title="Orders"
              value={displayData.todayOrders}
              change={displayData.ordersChange}
              changeLabel="vs yesterday"
              icon={<ShoppingCart className="h-5 w-5" />}
              trend={displayData.ordersChange > 0 ? 'up' : displayData.ordersChange < 0 ? 'down' : 'neutral'}
              href={buildNavUrl('/orders')}
            />
            <KPICard
              title="Customers"
              value={displayData.todayCustomers}
              change={displayData.customersChange}
              changeLabel="new today"
              icon={<Users className="h-5 w-5" />}
              trend={displayData.customersChange > 0 ? 'up' : 'neutral'}
              href={buildNavUrl('/crm')}
            />
            <KPICard
              title="Avg Order Value"
              value={`${currency} ${displayData.avgOrderValue.toLocaleString()}`}
              change={displayData.aovChange}
              icon={<Activity className="h-5 w-5" />}
              trend={displayData.aovChange > 0 ? 'up' : displayData.aovChange < 0 ? 'down' : 'neutral'}
            />
          </div>
          
          {/* Main content grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Target progress */}
              <TargetProgress
                target={displayData.monthlyTarget}
                achieved={displayData.monthlyAchieved}
                currency={currency}
              />
              
              {/* Top products & customers */}
              <div className="grid gap-6 md:grid-cols-2">
                <TopProducts
                  products={displayData.topProducts}
                  currency={currency}
                  onViewAll={() => router.push(buildNavUrl('/reports/products'))}
                />
                <TopCustomers
                  customers={displayData.topCustomers}
                  currency={currency}
                  onViewAll={() => router.push(buildNavUrl('/crm'))}
                />
              </div>
            </div>
            
            {/* Right column */}
            <div className="space-y-6">
              {/* Alerts */}
              <AlertsWidget alerts={alerts} />
              
              {/* Cash position */}
              {displayData.cashInDrawer !== undefined && (
                <CashPosition
                  cashInDrawer={displayData.cashInDrawer}
                  pendingPayments={displayData.pendingPayments || 0}
                  currency={currency}
                />
              )}
              
              {/* Inventory summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inventory Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low Stock</span>
                      <Badge variant={displayData.lowStockCount > 0 ? 'destructive' : 'secondary'}>
                        {displayData.lowStockCount}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Out of Stock</span>
                      <Badge variant={displayData.outOfStockCount > 0 ? 'destructive' : 'secondary'}>
                        {displayData.outOfStockCount}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(buildNavUrl('/inventory'))}
                    >
                      Manage Inventory
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TenantDashboard
