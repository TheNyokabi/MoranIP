'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPurchaseOrders } from '@/lib/api/purchases';
import type { PurchaseOrder } from '@/lib/types/purchases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Plus, Search, FileText } from 'lucide-react';

export default function PurchaseOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await getPurchaseOrders({ limit: 100 });
            setOrders(data);
        } catch (error) {
            console.error('Failed to load purchase orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(order =>
        order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.supplier_id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Purchase Orders</h1>
                </div>
                <Button onClick={() => router.push('/dashboard/purchases/orders/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Purchase Order
                </Button>
            </div>

            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search orders..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8">Loading...</div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Order Date</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No purchase orders found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders.map((order) => (
                                    <TableRow
                                        key={order.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/purchases/orders/${order.id}`)}
                                    >
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>{order.supplier_id}</TableCell>
                                        <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                                        <TableCell>{order.currency}</TableCell>
                                        <TableCell className="text-right">
                                            {order.total_amount ? `${order.currency} ${order.total_amount.toFixed(2)}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${order.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                                                    order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-700'
                                                }`}>
                                                {order.status || 'Draft'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
