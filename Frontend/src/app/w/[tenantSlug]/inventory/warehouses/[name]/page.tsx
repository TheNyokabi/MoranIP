'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Warehouse as WarehouseIcon, Building2, Package, TrendingUp, DollarSign, ArrowUp, ArrowDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getWarehouse } from '@/lib/api/inventory';
import { cn } from '@/lib/utils';

// Mock stock statistics
const mockStats = {
    totalItems: 145,
    totalQty: 3250,
    totalValue: 8750000,
    lowStockItems: 8,
};

// Mock items in warehouse
const mockWarehouseItems = [
    { code: 'ITEM-001', name: 'Office Chair Premium', qty: 150, uom: 'Nos', value: 1950000, status: 'ok' },
    { code: 'ITEM-002', name: 'Executive Desk Large', qty: 45, uom: 'Nos', value: 1575000, status: 'ok' },
    { code: 'ITEM-003', name: 'Filing Cabinet 3-Drawer', qty: 8, uom: 'Nos', value: 68000, status: 'low' },
    { code: 'ITEM-004', name: 'Conference Table 8-Seater', qty: 12, uom: 'Nos', value: 600000, status: 'ok' },
    { code: 'ITEM-005', name: 'Printer Paper A4', qty: 5, uom: 'Reams', value: 2500, status: 'low' },
];

// Mock transactions
const mockTransactions = [
    { id: 'TXN-001', type: 'receipt', date: '2026-01-20', item: 'Office Chair Premium', qty: 50, reference: 'PO-2024001' },
    { id: 'TXN-002', type: 'issue', date: '2026-01-19', item: 'Executive Desk Large', qty: 10, reference: 'SO-2024123' },
    { id: 'TXN-003', type: 'transfer', date: '2026-01-18', item: 'Filing Cabinet 3-Drawer', qty: 25, reference: 'ST-2024045' },
    { id: 'TXN-004', type: 'receipt', date: '2026-01-17', item: 'Conference Table 8-Seater', qty: 8, reference: 'PO-2024002' },
];

const transactionConfig = {
    receipt: { label: 'Receipt', icon: ArrowDown, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    issue: { label: 'Issue', icon: ArrowUp, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
    transfer: { label: 'Transfer', icon: RefreshCw, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
};

export default function WarehouseDetailsPage({ params }: { params: { name: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const warehouseName = decodeURIComponent(params.name);

    const { data: warehouse, isLoading } = useQuery({
        queryKey: ['warehouse', warehouseName],
        queryFn: () => getWarehouse(warehouseName),
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (!warehouse) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <WarehouseIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Warehouse not found</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses`)}
                    >
                        Back to Warehouses
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{warehouse.warehouse_name}</h1>
                        <p className="text-muted-foreground">{warehouse.company}</p>
                    </div>
                </div>
                <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouse.warehouse_name)}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
            </div>

            {/* Stock Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Items</p>
                                <p className="text-2xl font-bold">{mockStats.totalItems}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Qty</p>
                                <p className="text-2xl font-bold text-emerald-600">{mockStats.totalQty.toLocaleString()}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Value</p>
                                <p className="text-xl font-bold">{formatCurrency(mockStats.totalValue)}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn(
                    "border-0 shadow-lg",
                    mockStats.lowStockItems > 0
                        ? "bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900"
                        : "bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900"
                )}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Low Stock</p>
                                <p className={cn("text-2xl font-bold", mockStats.lowStockItems > 0 ? "text-amber-600" : "")}>
                                    {mockStats.lowStockItems}
                                </p>
                            </div>
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                mockStats.lowStockItems > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-slate-100 dark:bg-slate-800"
                            )}>
                                <AlertTriangle className={cn("h-5 w-5", mockStats.lowStockItems > 0 ? "text-amber-600" : "text-slate-500")} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Warehouse Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                    <CardDescription>Core warehouse information</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium text-muted-foreground">Warehouse Name</span>
                        <span className="font-medium">{warehouse.warehouse_name}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium text-muted-foreground">Company</span>
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{warehouse.company}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                        <Badge variant={warehouse.disabled ? 'destructive' : 'default'}>
                            {warehouse.disabled ? 'Disabled' : 'Active'}
                        </Badge>
                    </div>
                    {warehouse.warehouse_type && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <span className="text-sm font-medium text-muted-foreground">Type</span>
                            <Badge variant="outline">{warehouse.warehouse_type}</Badge>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stock Items in Warehouse */}
            <Card>
                <CardHeader>
                    <CardTitle>Stock Items</CardTitle>
                    <CardDescription>All items currently stored in this warehouse</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Quantity</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">UoM</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {mockWarehouseItems.map((item) => (
                                    <tr
                                        key={item.code}
                                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/w/${tenantSlug}/inventory/items/${encodeURIComponent(item.code)}`)}
                                    >
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-muted-foreground font-mono">{item.code}</p>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">{item.qty}</td>
                                        <td className="py-3 px-4">{item.uom}</td>
                                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(item.value)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <Badge className={cn(
                                                "text-xs",
                                                item.status === 'low'
                                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            )}>
                                                {item.status === 'low' ? 'Low Stock' : 'In Stock'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Latest stock movements for this warehouse</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {mockTransactions.map((tx) => {
                            const config = transactionConfig[tx.type as keyof typeof transactionConfig];
                            const Icon = config.icon;
                            return (
                                <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", config.color)}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn("text-xs", config.color)}>
                                                    {config.label}
                                                </Badge>
                                                <span className="font-mono text-sm text-muted-foreground">{tx.reference}</span>
                                            </div>
                                            <p className="text-sm">{tx.item}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "font-bold",
                                            tx.type === 'receipt' ? "text-emerald-600" : tx.type === 'issue' ? "text-red-600" : "text-blue-600"
                                        )}>
                                            {tx.type === 'receipt' ? '+' : tx.type === 'issue' ? '-' : '±'}{tx.qty}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

