'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSuppliers } from '@/lib/api/purchases';
import type { Supplier } from '@/lib/types/purchases';
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
import { Plus, Search, Users } from 'lucide-react';

export default function SuppliersPage() {
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            setLoading(true);
            const data = await getSuppliers({ limit: 100 });
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to load suppliers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        supplier.country.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <Users className="h-8 w-8" />
                    <h1 className="text-3xl font-bold">Suppliers</h1>
                </div>
                <Button onClick={() => router.push('/dashboard/purchases/suppliers/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Supplier
                </Button>
            </div>

            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search suppliers..."
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
                                <TableHead>Supplier Name</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Tax ID</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No suppliers found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((supplier) => (
                                    <TableRow
                                        key={supplier.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/dashboard/purchases/suppliers/${supplier.id}`)}
                                    >
                                        <TableCell className="font-medium">{supplier.name}</TableCell>
                                        <TableCell>{supplier.supplier_group}</TableCell>
                                        <TableCell>{supplier.country}</TableCell>
                                        <TableCell>{supplier.currency || '-'}</TableCell>
                                        <TableCell>{supplier.tax_id || '-'}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${supplier.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {supplier.disabled ? 'Disabled' : 'Active'}
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
