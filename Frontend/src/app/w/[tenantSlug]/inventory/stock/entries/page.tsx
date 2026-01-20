'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowUpDown, TrendingUp, Package, ArrowRight, Filter, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getStockEntries } from '@/lib/api/inventory';
import { useState } from 'react';

const ENTRY_TYPE_ICONS = {
    'Material Receipt': TrendingUp,
    'Material Issue': Package,
    'Material Transfer': ArrowRight,
};

const ENTRY_TYPE_COLORS = {
    'Material Receipt': 'bg-green-500/10 text-green-600 border-green-500/20',
    'Material Issue': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    'Material Transfer': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export default function StockEntriesPage() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const { data: entries = [], isLoading } = useQuery({
        queryKey: ['stock-entries', typeFilter],
        queryFn: () => getStockEntries({
            limit: 100,
            stock_entry_type: typeFilter !== 'all' ? typeFilter : undefined,
        }),
    });

    const filteredEntries = typeFilter === 'all'
        ? entries
        : entries.filter(e => e.stock_entry_type === typeFilter);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <ArrowUpDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground">Loading stock entries...</p>
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
                        <h1 className="text-3xl font-bold tracking-tight">Stock Entries</h1>
                        <p className="text-muted-foreground">
                            View and manage all stock movements
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[200px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="Material Receipt">Material Receipt</SelectItem>
                            <SelectItem value="Material Issue">Material Issue</SelectItem>
                            <SelectItem value="Material Transfer">Material Transfer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow border-green-500/20"
                    onClick={() => router.push('/inventory/stock/receipt')}
                >
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                            <CardTitle className="text-base">Material Receipt</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>Receive stock into warehouse</CardDescription>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow border-orange-500/20"
                    onClick={() => router.push('/inventory/stock/issue')}
                >
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-orange-600" />
                            </div>
                            <CardTitle className="text-base">Material Issue</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>Issue stock from warehouse</CardDescription>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow border-blue-500/20"
                    onClick={() => router.push('/inventory/stock/transfer')}
                >
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <ArrowRight className="h-5 w-5 text-blue-600" />
                            </div>
                            <CardTitle className="text-base">Stock Transfer</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>Transfer between warehouses</CardDescription>
                    </CardContent>
                </Card>
            </div>

            {/* Entries List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Recent Entries</h2>

                {filteredEntries.length === 0 ? (
                    <Card>
                        <CardContent className="pt-12 pb-12">
                            <div className="text-center text-muted-foreground">
                                <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                <p className="font-medium">No stock entries found</p>
                                <p className="text-sm mt-1">Create your first stock entry to track inventory movements</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredEntries.map((entry) => {
                            const Icon = ENTRY_TYPE_ICONS[entry.stock_entry_type as keyof typeof ENTRY_TYPE_ICONS];
                            const colorClass = ENTRY_TYPE_COLORS[entry.stock_entry_type as keyof typeof ENTRY_TYPE_COLORS];

                            return (
                                <Card key={entry.name} className="hover:shadow-md transition-shadow">
                                    <CardContent className="pt-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center border ${colorClass}`}>
                                                    {Icon && <Icon className="h-6 w-6" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-semibold text-lg">{entry.name}</h3>
                                                        <Badge variant="outline">
                                                            {entry.stock_entry_type}
                                                        </Badge>
                                                    </div>

                                                    <div className="grid gap-2 text-sm text-muted-foreground">
                                                        {entry.posting_date && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">Date:</span>
                                                                <span>{new Date(entry.posting_date).toLocaleDateString()}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">Items:</span>
                                                            <span>{entry.items?.length || 0} item(s)</span>
                                                        </div>
                                                        {entry.from_warehouse && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">From:</span>
                                                                <span>{entry.from_warehouse}</span>
                                                            </div>
                                                        )}
                                                        {entry.to_warehouse && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">To:</span>
                                                                <span>{entry.to_warehouse}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Items List */}
                                                    {entry.items && entry.items.length > 0 && (
                                                        <div className="mt-4 pt-4 border-t">
                                                            <div className="space-y-2">
                                                                {entry.items.map((item, idx) => (
                                                                    <div key={idx} className="flex items-center justify-between text-sm">
                                                                        <span className="text-foreground">{item.item_code}</span>
                                                                        <Badge variant="secondary">
                                                                            Qty: {item.qty} {item.uom || ''}
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
