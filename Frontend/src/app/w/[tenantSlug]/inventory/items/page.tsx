'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Package, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ItemsTable } from '@/components/inventory/ItemsTable';
import { getItems, deleteItem } from '@/lib/api/inventory';
import { Item } from '@/lib/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { BulkUploadModal } from '@/components/shared/bulk-upload-modal';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ItemsPage() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

    // Fetch items
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ limit: 200 }),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (code: string) => deleteItem(code),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            toast({
                title: 'Item deleted',
                description: 'The item has been successfully deleted.',
            });
            setItemToDelete(null);
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to delete item. Please try again.',
                variant: 'destructive',
            });
        },
    });

    const handleView = (item: Item) => {
        router.push(`/w/${tenantSlug}/inventory/items/${item.item_code}`);
    };

    const handleEdit = (item: Item) => {
        router.push(`/w/${tenantSlug}/inventory/items/${item.item_code}/edit`);
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['items'] });
    };

    const handleDelete = (item: Item) => {
        setItemToDelete(item);
    };

    const confirmDelete = () => {
        if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.item_code);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground">Loading items...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
                    <p className="text-muted-foreground">
                        Manage your inventory items and stock levels
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BulkUploadModal entityType="inventory" onSuccess={handleRefresh} />
                    <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/items/new`)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                    </Button>
                </div>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                    <CardDescription>
                        {items.length} {items.length === 1 ? 'item' : 'items'} in inventory
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ItemsTable
                        items={items}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete <span className="font-semibold">{itemToDelete?.item_name}</span>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
