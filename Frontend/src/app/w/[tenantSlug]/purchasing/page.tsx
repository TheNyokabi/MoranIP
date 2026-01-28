"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ShoppingCart,
    CreditCard,
    Plus,
    Search,
    Truck,
    Package,
    ArrowRight,
    TrendingUp,
    Store,
    FileText,
    ClipboardList
} from "lucide-react";
import { getPurchaseOrders } from "@/lib/api/purchases";
import type { PurchaseOrder } from "@/lib/types/purchases";
import { formatCurrency } from "@/lib/utils";

export default function PurchasingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [recentOrders, setRecentOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const orders = await getPurchaseOrders({ limit: 5 });
                setRecentOrders(orders);
            } catch (error) {
                console.error("Failed to fetch purchase orders:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchOrders();
    }, []);

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/purchasing${path}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Purchasing</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage suppliers, purchase orders, and receipts
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => navigateTo("/suppliers")} variant="outline" size="sm">
                        <Store className="h-4 w-4 mr-2" />
                        Suppliers
                    </Button>
                    <Button onClick={() => navigateTo("/purchase-orders")} variant="outline" size="sm">
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Orders
                    </Button>
                    <Button onClick={() => navigateTo("/receipts")} variant="outline" size="sm">
                        <Package className="h-4 w-4 mr-2" />
                        Receipts
                    </Button>
                    <Button onClick={() => navigateTo("/invoices")} variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Invoices
                    </Button>
                    <Button onClick={() => navigateTo("/purchase-orders/new")} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        New Order
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(recentOrders.reduce((acc, order) => acc + (order.total_amount || 0), 0))}</div>
                        <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{recentOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length}</div>
                        <p className="text-xs text-muted-foreground">Pending delivery</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
                        <Truck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12</div>
                        <p className="text-xs text-muted-foreground">Active supply partners</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Items Received</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">145</div>
                        <p className="text-xs text-muted-foreground">Last 7 days</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Orders */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>Latest purchase orders and their status</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                        ) : recentOrders.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No recent orders found</div>
                        ) : (
                            recentOrders.map((order) => (
                                <div
                                    key={order.name}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => navigateTo(`/purchase-orders/${order.name}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{order.supplier_name || "Unknown Supplier"}</p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>{order.name}</span>
                                                <span>•</span>
                                                <span>{order.transaction_date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold">{formatCurrency(order.grand_total || 0)}</p>
                                            <p className="text-xs text-muted-foreground">{order.items?.length || 0} Items</p>
                                        </div>
                                        <Badge variant={
                                            order.status === 'Completed' ? 'default' :
                                                order.status === 'Draft' ? 'secondary' :
                                                    order.status === 'Submitted' ? 'default' : 'outline'
                                        } className={
                                            order.status === 'Completed' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                order.status === 'Cancelled' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''
                                        }>
                                            {order.status}
                                        </Badge>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
