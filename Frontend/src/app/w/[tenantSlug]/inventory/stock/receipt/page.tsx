'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, TrendingUp } from 'lucide-react';
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
import { createStockEntry, submitStockEntry, getStockEntryPosting } from '@/lib/api/inventory';
import { getItems, getWarehouses } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const stockEntryItemSchema = z.object({
    item_code: z.string().min(1, 'Item is required'),
    qty: z.number().min(0.01, 'Quantity must be greater than 0'),
    basic_rate: z.number().min(0.01, 'Basic Rate must be greater than 0'),
    uom: z.string().optional(),
});

const stockEntrySchema = z.object({
    to_warehouse: z.string().min(1, 'Target warehouse is required'),
    posting_date: z.string().optional(),
    items: z.array(stockEntryItemSchema).min(1, 'At least one item is required'),
});

type StockEntryFormValues = z.infer<typeof stockEntrySchema>;

export default function MaterialReceiptPage() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const { toast } = useToast();

    // Fetch items and warehouses
    const { data: items = [] } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ limit: 200 }),
    });

    const { data: warehouses = [] } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => getWarehouses({ limit: 100 }),
    });

    const form = useForm<StockEntryFormValues>({
        resolver: zodResolver(stockEntrySchema),
        defaultValues: {
            to_warehouse: '',
            posting_date: new Date().toISOString().split('T')[0],
            items: [{ item_code: '', qty: 1, basic_rate: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const created = await createStockEntry(data);
            await submitStockEntry(created.name);
            return created;
        },
        onSuccess: async (created) => {
            try {
                const posting = await getStockEntryPosting(created.name, 50);
                const glCount = posting?.gl_entries?.length ?? 0;
                const sleCount = posting?.stock_ledger_entries?.length ?? 0;
                toast({
                    title: 'Posted',
                    description: `Material receipt submitted (GL ${glCount}, SLE ${sleCount}).`,
                });
            } catch {
                // Non-blocking: submission already succeeded
            }
            toast({
                title: 'Success',
                description: 'Material receipt created and submitted successfully.',
            });
            router.push(`/w/${tenantSlug}/inventory/stock/entries`);
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to create material receipt.',
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: StockEntryFormValues) => {
        const payload = {
            stock_entry_type: 'Material Receipt' as const,
            to_warehouse: data.to_warehouse,
            posting_date: data.posting_date,
            items: data.items.map(item => ({
                item_code: item.item_code,
                qty: item.qty,
                basic_rate: item.basic_rate,
                t_warehouse: data.to_warehouse,
            })),
        };
        createMutation.mutate(payload);
    };

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
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Material Receipt</h1>
                            <p className="text-muted-foreground">Receive stock into warehouse</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Receipt Details</CardTitle>
                    <CardDescription>
                        Enter details for receiving materials into your warehouse
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Target Warehouse */}
                                <FormField
                                    control={form.control}
                                    name="to_warehouse"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Warehouse *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select warehouse" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {warehouses.map((wh) => (
                                                        <SelectItem key={wh.warehouse_name} value={wh.warehouse_name}>
                                                            {wh.warehouse_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                Warehouse to receive materials
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Posting Date */}
                                <FormField
                                    control={form.control}
                                    name="posting_date"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Posting Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Date of receipt
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Items */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Items</h3>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => append({ item_code: '', qty: 1, basic_rate: 0 })}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Item
                                    </Button>
                                </div>

                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-4 items-start">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.item_code`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className={index > 0 ? 'sr-only' : ''}>
                                                        Item
                                                    </FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select item" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {items.map((item) => (
                                                                <SelectItem key={item.item_code} value={item.item_code}>
                                                                    {item.item_name} ({item.item_code})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.qty`}
                                            render={({ field }) => (
                                                <FormItem className="w-32">
                                                    <FormLabel className={index > 0 ? 'sr-only' : ''}>
                                                        Quantity
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Qty"
                                                            value={field.value}
                                                            onChange={(e) => {
                                                                field.onChange(e.target.value === '' ? 0 : Number(e.target.value));
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.basic_rate`}
                                            render={({ field }) => (
                                                <FormItem className="w-40">
                                                    <FormLabel className={index > 0 ? 'sr-only' : ''}>
                                                        Basic Rate
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Basic Rate"
                                                            value={field.value}
                                                            onChange={(e) => {
                                                                field.onChange(e.target.value === '' ? 0 : Number(e.target.value));
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={`${index === 0 ? 'mt-8' : ''} text-destructive hover:bg-destructive/10`}
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Receipt'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
