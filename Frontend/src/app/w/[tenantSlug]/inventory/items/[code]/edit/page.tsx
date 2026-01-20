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
import { Textarea } from '@/components/ui/textarea';
import { getItem, updateItem } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const itemSchema = z.object({
    item_name: z.string().min(1, 'Item name is required').max(140),
    item_group: z.string().min(1, 'Item group is required'),
    stock_uom: z.string().min(1, 'Unit of measure is required'),
    standard_rate: z.number().min(0).optional(),
    description: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

const ITEM_GROUPS = [
    'Products',
    'Raw Materials',
    'Services',
    'Sub Assemblies',
    'Consumable',
];

const UNITS_OF_MEASURE = [
    'Nos',
    'Kg',
    'Ltr',
    'Meter',
    'Unit',
    'Box',
    'Pcs',
];

export default function EditItemPage({ params }: { params: { code: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const itemCode = decodeURIComponent(params.code);

    const { data: item, isLoading } = useQuery({
        queryKey: ['item', itemCode],
        queryFn: () => getItem(itemCode),
    });

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        values: item ? {
            item_name: item.item_name,
            item_group: item.item_group,
            stock_uom: item.stock_uom,
            standard_rate: item.standard_rate,
            description: item.description || '',
        } : undefined,
    });

    const updateMutation = useMutation({
        mutationFn: (data: ItemFormValues) => updateItem(itemCode, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['item', itemCode] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
            toast({
                title: 'Success',
                description: 'Item updated successfully.',
            });
            router.push(`/w/${tenantSlug}/inventory/items/${itemCode}`);
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update item.',
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: ItemFormValues) => {
        updateMutation.mutate(data);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Item not found</p>
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
                <h1 className="text-3xl font-bold tracking-tight">Edit Item</h1>
                <p className="text-muted-foreground font-mono">{itemCode}</p>
            </div>
        </div>

        {/* Form */}
        <Card>
            <CardHeader>
                <CardTitle>Item Details</CardTitle>
                <CardDescription>
                    Update the details for this inventory item
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Item Name */}
                            <FormField
                                control={form.control}
                                name="item_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Item Name *</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Display name of the item
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Item Group */}
                            <FormField
                                control={form.control}
                                name="item_group"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Item Group *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ITEM_GROUPS.map((group) => (
                                                    <SelectItem key={group} value={group}>
                                                        {group}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Category of the item
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Stock UoM */}
                            <FormField
                                control={form.control}
                                name="stock_uom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit of Measure *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {UNITS_OF_MEASURE.map((uom) => (
                                                    <SelectItem key={uom} value={uom}>
                                                        {uom}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            How the item is measured
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Standard Rate */}
                            <FormField
                                control={form.control}
                                name="standard_rate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Standard Rate</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={field.value ?? ''}
                                                onChange={(e) => {
                                                    const raw = e.target.value
                                                    field.onChange(raw === '' ? undefined : Number(raw))
                                                }}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Default selling price
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter item description..."
                                            className="resize-none"
                                            rows={4}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Optional detailed description of the item
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
                                {updateMutation.isPending ? 'Updating...' : 'Update Item'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
        );
    }
