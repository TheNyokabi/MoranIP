'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Warehouse } from '@/lib/types/inventory';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, Edit, Eye, Warehouse as WarehouseIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarehousesTableProps {
    warehouses: Warehouse[];
    onEdit?: (warehouse: Warehouse) => void;
    onView?: (warehouse: Warehouse) => void;
}

export function WarehousesTable({ warehouses, onEdit, onView }: WarehousesTableProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredWarehouses = warehouses.filter(wh =>
        wh.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wh.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRowClick = (warehouse: Warehouse) => {
        if (onView) {
            onView(warehouse);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search warehouses..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="text-sm text-muted-foreground">
                    {filteredWarehouses.length} {filteredWarehouses.length === 1 ? 'warehouse' : 'warehouses'}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Warehouse Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredWarehouses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                    <WarehouseIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-medium">No warehouses found</p>
                                    <p className="text-sm">Try adjusting your search</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredWarehouses.map((warehouse) => (
                                <TableRow
                                    key={warehouse.warehouse_name}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(warehouse)}
                                >
                                    <TableCell className="font-medium">{warehouse.warehouse_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{warehouse.company}</TableCell>
                                    <TableCell>
                                        {warehouse.warehouse_type ? (
                                            <Badge variant="outline" className="text-xs">
                                                {warehouse.warehouse_type}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={warehouse.disabled ? 'destructive' : 'default'}
                                            className="text-xs"
                                        >
                                            {warehouse.disabled ? 'Disabled' : 'Active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onView?.(warehouse);
                                                }}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit?.(warehouse);
                                                }}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
