'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getWarehouse, updateWarehouse } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const warehouseSchema = z.object({
    warehouse_type: z.string().optional(),
    parent_warehouse: z.string().optional(),
});

type WarehouseFormValues = z.infer<typeof warehouseSchema>;

const WAREHOUSE_TYPES = [
    'Transit',
    'Stores',
    'Manufacturing',
    'Retail',
    'Rejected',
    'Returns',
];

export default function EditWarehousePage({ params }: { params: { name: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const warehouseName = decodeURIComponent(params.name);

    const { data: warehouse, isLoading } = useQuery({
        queryKey: ['warehouse', warehouseName],
        queryFn: () => getWarehouse(warehouseName),
    });

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        values: warehouse ? {
            warehouse_type: warehouse.warehouse_type || '',
            parent_warehouse: warehouse.parent_warehouse || '',
        } : undefined,
    });

    const updateMutation = useMutation({
        mutationFn: (data: WarehouseFormValues) => updateWarehouse(warehouseName, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouse', warehouseName] });
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast({
                title: 'Success',
                description: 'Warehouse updated successfully.',
            });
            router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouseName)}`);
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update warehouse.',
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: WarehouseFormValues) => {
        updateMutation.mutate(data);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (!warehouse) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Warehouse not found</p>
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
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Warehouse</h1>
                    <p className="text-muted-foreground">{warehouseName}</p>
                    {warehouse?.company && (
                        <p className="text-sm text-muted-foreground mt-1">Company: {warehouse.company} (managed by workspace settings)</p>
                    )}
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                    <CardDescription>
                        Update the details for this warehouse. Company is automatically managed from your workspace settings.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Warehouse Type */}
                                <FormField
                                    control={form.control}
                                    name="warehouse_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Warehouse Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type (optional)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {WAREHOUSE_TYPES.map((type) => (
                                                        <SelectItem key={type} value={type}>
                                                            {type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                Classification of the warehouse
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                            </div>

                            {/* Parent Warehouse */}
                            <FormField
                                control={form.control}
                                name="parent_warehouse"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Parent Warehouse</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Leave empty for top-level warehouse"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            For hierarchical warehouse structure (optional)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={updateMutation.isPending}>
                                    {updateMutation.isPending ? 'Updating...' : 'Update Warehouse'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
