'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getWarehouses } from '@/lib/api/inventory';
import type { Warehouse } from '@/lib/types/inventory';
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
import { Plus, Search, Warehouse as WarehouseIcon } from 'lucide-react';

export default function WarehousesPage() {
    const router = useRouter();
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadWarehouses();
    }, []);

    const loadWarehouses = async () => {
        try {
            setLoading(true);
            const data = await getWarehouses({ limit: 100 });
            setWarehouses(data);
        } catch (error) {
            console.error('Failed to load warehouses:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredWarehouses = warehouses.filter(warehouse =>
        warehouse.warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
        warehouse.company.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <WarehouseIcon className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Warehouses</h1>
                </div>
                <Button onClick={() => router.push('/dashboard/inventory/warehouses/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Warehouse
                </Button>
            </div>

            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search warehouses..."
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
                                <TableHead>Warehouse Name</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Parent Warehouse</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredWarehouses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No warehouses found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredWarehouses.map((warehouse) => (
                                    <TableRow
                                        key={warehouse.warehouse_name}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/inventory/warehouses/${warehouse.warehouse_name}`)}
                                    >
                                        <TableCell className="font-medium">{warehouse.warehouse_name}</TableCell>
                                        <TableCell>{warehouse.company}</TableCell>
                                        <TableCell>{warehouse.warehouse_type || '-'}</TableCell>
                                        <TableCell>{warehouse.parent_warehouse || '-'}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${warehouse.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {warehouse.disabled ? 'Disabled' : 'Active'}
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
