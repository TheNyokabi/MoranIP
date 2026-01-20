'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Package, DollarSign, Tag, Warehouse, ArrowUp, ArrowDown, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getItem } from '@/lib/api/inventory';
import { cn } from '@/lib/utils';

// Mock stock balance data
const mockStockBalance = [
    { warehouse: 'Main Warehouse', qty: 150, reserved: 20, available: 130, value: 1950000 },
    { warehouse: 'Mombasa Branch', qty: 45, reserved: 5, available: 40, value: 585000 },
    { warehouse: 'Kisumu Store', qty: 80, reserved: 0, available: 80, value: 1040000 },
];

// Mock transaction history
const mockTransactions = [
    { id: 'TXN-001', type: 'receipt', date: '2026-01-20', qty: 50, warehouse: 'Main Warehouse', reference: 'PO-2024001', user: 'John K.' },
    { id: 'TXN-002', type: 'issue', date: '2026-01-19', qty: 15, warehouse: 'Main Warehouse', reference: 'SO-2024123', user: 'Mary W.' },
    { id: 'TXN-003', type: 'transfer', date: '2026-01-18', qty: 25, warehouse: 'Mombasa Branch', reference: 'ST-2024045', user: 'Peter O.' },
    { id: 'TXN-004', type: 'receipt', date: '2026-01-17', qty: 100, warehouse: 'Main Warehouse', reference: 'PO-2024002', user: 'Jane A.' },
    { id: 'TXN-005', type: 'issue', date: '2026-01-16', qty: 30, warehouse: 'Kisumu Store', reference: 'SO-2024120', user: 'David K.' },
];

const transactionConfig = {
    receipt: { label: 'Receipt', icon: ArrowDown, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
    issue: { label: 'Issue', icon: ArrowUp, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
    transfer: { label: 'Transfer', icon: RefreshCw, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
};

export default function ItemDetailsPage({ params }: { params: { code: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const itemCode = decodeURIComponent(params.code);

    const { data: item, isLoading } = useQuery({
        queryKey: ['item', itemCode],
        queryFn: () => getItem(itemCode),
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const totalStock = mockStockBalance.reduce((sum, s) => sum + s.qty, 0);
    const totalAvailable = mockStockBalance.reduce((sum, s) => sum + s.available, 0);
    const totalValue = mockStockBalance.reduce((sum, s) => sum + s.value, 0);

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

    if (!item) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Item not found</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/w/${tenantSlug}/inventory/items`)}
                    >
                        Back to Items
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
                        <h1 className="text-3xl font-bold tracking-tight">{item.item_name}</h1>
                        <p className="text-muted-foreground font-mono">{item.item_code}</p>
                    </div>
                </div>
                <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/items/${item.item_code}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
            </div>

            {/* Item Details */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                        <CardDescription>Core item details and specifications</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Code</span>
                            <span className="font-mono">{item.item_code}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Name</span>
                            <span className="font-medium">{item.item_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Group</span>
                            <Badge variant="outline">
                                <Tag className="h-3 w-3 mr-1" />
                                {item.item_group}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Unit of Measure</span>
                            <span>{item.stock_uom}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Status</span>
                            <Badge variant={item.disabled ? 'destructive' : 'default'}>
                                {item.disabled ? 'Disabled' : 'Active'}
                            </Badge>
                        </div>
                        {item.description && (
                            <div className="pt-4 border-t">
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Description</span>
                                <p className="text-sm">{item.description}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pricing</CardTitle>
                        <CardDescription>Standard rates and valuation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Standard Rate</span>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-lg font-semibold">
                                    {item.standard_rate ? `KES ${item.standard_rate.toLocaleString()}` : '-'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Stock</p>
                                <p className="text-2xl font-bold">{totalStock} {item.stock_uom}</p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Package className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Available</p>
                                <p className="text-2xl font-bold text-emerald-600">{totalAvailable} {item.stock_uom}</p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 border-0 shadow-lg">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Value</p>
                                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Balance by Warehouse */}
            <Card>
                <CardHeader>
                    <CardTitle>Stock by Warehouse</CardTitle>
                    <CardDescription>Current stock levels across all locations</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Warehouse</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Quantity</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Reserved</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Available</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {mockStockBalance.map((stock, idx) => (
                                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                                    <Warehouse className="h-4 w-4 text-white" />
                                                </div>
                                                <span className="font-medium">{stock.warehouse}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">{stock.qty}</td>
                                        <td className="py-3 px-4 text-right">
                                            <span className={cn(stock.reserved > 0 ? "text-amber-600" : "text-muted-foreground")}>
                                                {stock.reserved}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-emerald-600">{stock.available}</td>
                                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(stock.value)}</td>
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
                    <CardDescription>Latest stock movements for this item</CardDescription>
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
                                            <p className="text-sm text-muted-foreground">{tx.warehouse} • {tx.user}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "font-bold",
                                            tx.type === 'receipt' ? "text-emerald-600" : tx.type === 'issue' ? "text-red-600" : "text-blue-600"
                                        )}>
                                            {tx.type === 'receipt' ? '+' : tx.type === 'issue' ? '-' : '±'}{tx.qty} {item.stock_uom}
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

