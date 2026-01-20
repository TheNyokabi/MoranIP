'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Printer, Package } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getItems, getWarehouses, getStockBalance } from '@/lib/api/inventory';

export default function StockBalanceReport() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const [selectedItem, setSelectedItem] = useState<string>('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

    const { data: items = [] } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ limit: 200 }),
    });

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => getWarehouses({ limit: 100 }),
    });

    const { data: balances = [], isLoading } = useQuery({
        queryKey: ['stock-balance', selectedItem, selectedWarehouse],
        queryFn: () => getStockBalance({
            item_code: selectedItem !== 'all' ? selectedItem : undefined,
            warehouse: selectedWarehouse !== 'all' ? selectedWarehouse : undefined,
        }),
    });

    const totalQty = balances.reduce((sum, b) => sum + b.qty, 0);
    const totalValue = balances.reduce((sum, b) => sum + (b.qty * (b.valuation_rate || 0)), 0);

    const handleExportCSV = () => {
        const headers = ['Item Code', 'Warehouse', 'Quantity', 'Valuation Rate', 'Value'];
        const rows = balances.map(b => [
            b.item_code,
            b.warehouse,
            b.qty,
            b.valuation_rate || 0,
            b.qty * (b.valuation_rate || 0)
        ]);

        const csv = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-balance-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Stock Balance Report</h1>
                        <p className="text-muted-foreground">Current stock levels across warehouses</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Filter the report by item and warehouse</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Item</label>
                            <Select value={selectedItem} onValueChange={setSelectedItem}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Items</SelectItem>
                                    {items.map((item) => (
                                        <SelectItem key={item.item_code} value={item.item_code}>
                                            {item.item_name} ({item.item_code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Warehouse</label>
                            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Warehouses</SelectItem>
                                    {warehouses.map((wh) => (
                                        <SelectItem key={wh.warehouse_name} value={wh.warehouse_name}>
                                            {wh.warehouse_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Quantity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalQty.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">KES {totalValue.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Report Table */}
            <Card>
                <CardHeader className="print:border-b">
                    <CardTitle>Stock Balance Details</CardTitle>
                    <CardDescription className="print:hidden">
                        Detailed breakdown of stock levels
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Package className="h-8 w-8 animate-pulse text-muted-foreground" />
                        </div>
                    ) : balances.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p className="font-medium">No stock balance data</p>
                            <p className="text-sm">Adjust your filters to see stock information</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="text-right">Valuation Rate</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balances.map((balance, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{balance.item_code}</TableCell>
                                        <TableCell>{balance.warehouse}</TableCell>
                                        <TableCell className="text-right">
                                            {balance.qty.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            KES {(balance.valuation_rate || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            KES {(balance.qty * (balance.valuation_rate || 0)).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold bg-muted/50">
                                    <TableCell colSpan={2}>Total</TableCell>
                                    <TableCell className="text-right">{totalQty.toLocaleString()}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right">KES {totalValue.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Print styles */}
            <style jsx global>{`
                @media print {
                    .print\\:hidden {
                        display: none !important;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
