"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePickerWithRange } from '@/components/ui/date-picker'
import { Progress } from '@/components/ui/progress'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, CreditCard, Download, RefreshCw,
  Calendar, Filter, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'
import { DateRange } from 'react-day-picker'

interface AnalyticsData {
  summary: {
    total_sales: number
    total_transactions: number
    avg_transaction: number
    total_customers: number
    loyalty_points_issued: number
    date_range: string
  }
  trends: {
    sales_by_day: Array<{ date: string; sales: number; transactions: number }>
    sales_by_hour: Array<{ hour: string; sales: number }>
  }
  top_performers: {
    products: Array<{ name: string; sales: number; quantity: number }>
    staff: Array<{ name: string; sales: number; transactions: number }>
  }
  payment_methods: Record<string, { amount: number; count: number; percentage: number }>
  kpis: {
    conversion_rate: number
    avg_order_value: number
    customer_satisfaction: number
    inventory_turnover: number
  }
}

export function AnalyticsDashboard() {
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [posProfile, setPosProfile] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')
  const [exporting, setExporting] = useState(false)

  // Load analytics data
  const loadAnalytics = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (dateRange?.from) {
        params.append('date_from', dateRange.from.toISOString().split('T')[0])
      }
      if (dateRange?.to) {
        params.append('date_to', dateRange.to.toISOString().split('T')[0])
      }
      if (posProfile !== 'all') {
        params.append('pos_profile_id', posProfile)
      }

      const response = await apiFetch(`/pos/analytics/dashboard?${params}`, {}, token)
      setAnalyticsData((response as any).analytics)

    } catch (error) {
      console.error('Failed to load analytics:', error)
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  // Export analytics
  const exportAnalytics = async (format: 'excel' | 'csv' | 'pdf') => {
    try {
      setExporting(true)

      const exportRequest = {
        format,
        date_from: dateRange?.from?.toISOString().split('T')[0] || '',
        date_to: dateRange?.to?.toISOString().split('T')[0] || '',
        report_type: 'sales_summary',
        filters: {
          pos_profile_id: posProfile !== 'all' ? posProfile : undefined
        }
      }

      const response = await apiFetch('/pos/analytics/export', {
        method: 'POST',
        body: JSON.stringify(exportRequest)
      }, token)

      toast({
        title: "Export Started",
        description: `Generating ${format.toUpperCase()} report...`
      })

      // In a real implementation, you'd poll for export status and provide download link

    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to start analytics export",
        variant: "destructive"
      })
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [dateRange, posProfile])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No analytics data available</p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-KE').format(num)
  }

  // Prepare chart data
  const salesTrendData = analyticsData.trends.sales_by_day.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
    sales: day.sales,
    transactions: day.transactions
  }))

  const hourlySalesData = analyticsData.trends.sales_by_hour.map(hour => ({
    hour: `${hour.hour}:00`,
    sales: hour.sales
  }))

  const paymentMethodData = Object.entries(analyticsData.payment_methods).map(([method, data]) => ({
    name: method,
    value: data.amount,
    count: data.count
  }))

  const paymentColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Sales performance and business insights
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Date Range Picker */}
          <DatePickerWithRange
            date={dateRange}
            onDateChange={setDateRange}
          />

          {/* POS Profile Filter */}
          <Select value={posProfile} onValueChange={setPosProfile}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select POS Profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              <SelectItem value="POS001">Main Store</SelectItem>
              <SelectItem value="POS002">Branch Store</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('excel')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAnalytics('pdf')}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>

          {/* Refresh Button */}
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analyticsData.summary.total_sales)}
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1" />
              +12.5% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(analyticsData.summary.total_transactions)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(analyticsData.summary.avg_transaction)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(analyticsData.summary.total_customers)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.summary.loyalty_points_issued} loyalty points issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.kpis.conversion_rate.toFixed(1)}%
            </div>
            <Progress value={analyticsData.kpis.conversion_rate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Sales (KES)"
                  />
                  <Bar dataKey="transactions" fill="#82ca9d" name="Transactions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }: any) => `${name}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={paymentColors[index % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.top_performers.products.slice(0, 5).map((product, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} units sold
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {formatCurrency(product.sales)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Hourly Sales */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Sales Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="sales" fill="#8884d8" name="Sales (KES)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.top_performers.products.map((product, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {product.quantity} units • {formatCurrency(product.sales / product.quantity)} avg price
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(product.sales)}</p>
                      <Badge variant={index < 3 ? "default" : "secondary"}>
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(analyticsData.payment_methods).map(([method, data]) => (
              <Card key={method}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {method}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="font-semibold">{formatCurrency(data.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Transactions</span>
                      <span className="font-semibold">{data.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Share</span>
                      <span className="font-semibold">{data.percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={data.percentage} className="mt-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.top_performers.staff.map((staff, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{staff.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {staff.transactions} transactions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(staff.sales)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(staff.sales / staff.transactions)} avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}