'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getItems } from '@/lib/api/inventory';
import type { Item } from '@/lib/types/inventory';
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
import { Plus, Search } from 'lucide-react';

export default function ItemsPage() {
    const router = useRouter();
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = async () => {
        try {
            setLoading(true);
            const data = await getItems({ limit: 100 });
            setItems(data);
        } catch (error) {
            console.error('Failed to load items:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.item_name.toLowerCase().includes(search.toLowerCase()) ||
        item.item_code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Items</h1>
                <Button onClick={() => router.push('/dashboard/inventory/items/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Item
                </Button>
            </div>

            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
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
                                <TableHead>Item Code</TableHead>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead>UOM</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No items found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <TableRow
                                        key={item.item_code}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/inventory/items/${item.item_code}`)}
                                    >
                                        <TableCell className="font-medium">{item.item_code}</TableCell>
                                        <TableCell>{item.item_name}</TableCell>
                                        <TableCell>{item.item_group}</TableCell>
                                        <TableCell>{item.stock_uom}</TableCell>
                                        <TableCell className="text-right">
                                            {item.standard_rate ? `$${item.standard_rate.toFixed(2)}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {item.disabled ? 'Disabled' : 'Active'}
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
