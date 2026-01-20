"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/auth-store"
import { posApi } from "@/lib/api"
import {
    TrendingUp,
    Package,
    CreditCard,
    Users,
    BarChart3,
    Calendar,
    Download,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function POSAnalyticsPage() {
    const params = useParams()
    const { token } = useAuthStore()
    const tenantSlug = (params?.tenantSlug as string) || ''

    const [loading, setLoading] = useState(false)
    const [fromDate, setFromDate] = useState("")
    const [toDate, setToDate] = useState("")

    // Analytics data
    const [dailySales, setDailySales] = useState<any>(null)
    const [productPerformance, setProductPerformance] = useState<any>(null)
    const [paymentAnalysis, setPaymentAnalysis] = useState<any>(null)
    const [staffPerformance, setStaffPerformance] = useState<any>(null)
    const [customerInsights, setCustomerInsights] = useState<any>(null)

    // Set default date range (last 30 days)
    useEffect(() => {
        const today = new Date()
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)

        setToDate(today.toISOString().split('T')[0])
        setFromDate(thirtyDaysAgo.toISOString().split('T')[0])
    }, [])

    // Load analytics when dates change
    useEffect(() => {
        if (fromDate && toDate && token) {
            loadAllAnalytics()
        }
    }, [fromDate, toDate, token])

    const loadAllAnalytics = async () => {
        if (!token || !fromDate || !toDate) return

        setLoading(true)
        try {
            const [daily, products, payments, staff, customers] = await Promise.all([
                posApi.getDailySales(token, toDate).catch(() => null),
                posApi.getProductPerformance(token, fromDate, toDate, 20).catch(() => null),
                posApi.getPaymentAnalysis(token, fromDate, toDate).catch(() => null),
                posApi.getStaffPerformance(token, fromDate, toDate).catch(() => null),
                posApi.getCustomerInsights(token, fromDate, toDate, 20).catch(() => null),
            ])

            setDailySales(daily)
            setProductPerformance(products)
            setPaymentAnalysis(payments)
            setStaffPerformance(staff)
            setCustomerInsights(customers)
        } catch (error) {
            toast.error("Failed to load analytics")
            console.error("Analytics error:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">POS Analytics</h1>
                    <p className="text-muted-foreground">Sales performance and insights</p>
                </div>
                <Link href={`/w/${tenantSlug}/pos`}>
                    <Button variant="outline">Back to POS</Button>
                </Link>
            </div>

            {/* Date Range Filter */}
            <Card>
                <CardHeader>
                    <CardTitle>Date Range</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Label htmlFor="fromDate">From Date</Label>
                            <Input
                                id="fromDate"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <Label htmlFor="toDate">To Date</Label>
                            <Input
                                id="toDate"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={loadAllAnalytics} disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <BarChart3 className="h-4 w-4 mr-2" />
                                        Refresh
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="daily" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="daily">Daily Sales</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="staff">Staff</TabsTrigger>
                    <TabsTrigger value="customers">Customers</TabsTrigger>
                </TabsList>

                {/* Daily Sales */}
                <TabsContent value="daily" className="space-y-4">
                    {dailySales && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatCurrency(dailySales.total_sales)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{dailySales.transaction_count}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Average</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatCurrency(dailySales.average_transaction)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">Tax</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatCurrency(dailySales.total_tax)}</div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* Product Performance */}
                <TabsContent value="products" className="space-y-4">
                    {productPerformance && productPerformance.products && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Products</CardTitle>
                                <CardDescription>{productPerformance.total_products} products sold</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {productPerformance.products.map((product: any, index: number) => (
                                        <div key={product.item_code} className="flex items-center justify-between p-2 border rounded">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{product.item_name}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {product.total_qty} units
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(product.total_amount)}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {product.transaction_count} transactions
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Payment Analysis */}
                <TabsContent value="payments" className="space-y-4">
                    {paymentAnalysis && paymentAnalysis.payment_methods && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Methods</CardTitle>
                                <CardDescription>Total: {formatCurrency(paymentAnalysis.total_amount)}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {paymentAnalysis.payment_methods.map((method: any) => (
                                        <div key={method.mode} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <div className="font-medium">{method.mode}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {method.transaction_count} transactions
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(method.total_amount)}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {method.percentage.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Staff Performance */}
                <TabsContent value="staff" className="space-y-4">
                    {staffPerformance && staffPerformance.staff && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Staff Performance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {staffPerformance.staff.map((staff: any) => (
                                        <div key={staff.staff_member} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <div className="font-medium">{staff.staff_member}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {staff.transaction_count} transactions
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(staff.total_sales)}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Avg: {formatCurrency(staff.average_transaction)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Customer Insights */}
                <TabsContent value="customers" className="space-y-4">
                    {customerInsights && customerInsights.customers && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Customers</CardTitle>
                                <CardDescription>{customerInsights.total_customers} customers</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {customerInsights.customers.map((customer: any) => (
                                        <div key={customer.customer} className="flex items-center justify-between p-2 border rounded">
                                            <div>
                                                <div className="font-medium">{customer.customer_name}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    {customer.transaction_count} transactions
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">{formatCurrency(customer.total_spent)}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Last: {new Date(customer.last_purchase_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
