'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Item } from '@/lib/types/inventory';
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
import { Search, MoreVertical, Edit, Trash2, Eye, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemsTableProps {
    items: Item[];
    onEdit?: (item: Item) => void;
    onDelete?: (item: Item) => void;
    onView?: (item: Item) => void;
}

export function ItemsTable({ items, onEdit, onDelete, onView }: ItemsTableProps) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<keyof Item>('item_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Filter items based on search
    const filteredItems = items.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort items
    const sortedItems = [...filteredItems].sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';

        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
    });

    const handleSort = (field: keyof Item) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleRowClick = (item: Item) => {
        if (onView) {
            onView(item);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="text-sm text-muted-foreground">
                    {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('item_code')}
                            >
                                Item Code {sortField === 'item_code' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleSort('item_name')}
                            >
                                Item Name {sortField === 'item_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>UoM</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                    <p className="font-medium">No items found</p>
                                    <p className="text-sm">Try adjusting your search</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedItems.map((item) => (
                                <TableRow
                                    key={item.item_code}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleRowClick(item)}
                                >
                                    <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                                    <TableCell className="font-medium">{item.item_name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {item.item_group}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{item.stock_uom}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {item.standard_rate ? `KES ${item.standard_rate.toLocaleString()}` : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={item.disabled ? 'destructive' : 'default'}
                                            className="text-xs"
                                        >
                                            {item.disabled ? 'Disabled' : 'Active'}
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
                                                    onView?.(item);
                                                }}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit?.(item);
                                                }}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete?.(item);
                                                    }}
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
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
