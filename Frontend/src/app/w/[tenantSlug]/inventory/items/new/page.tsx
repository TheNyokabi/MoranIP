'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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
import { createItem } from '@/lib/api/inventory';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Form validation schema
const itemSchema = z.object({
    item_code: z.string().min(1, 'Item code is required').max(140),
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

export default function NewItemPage() {
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<ItemFormValues>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            item_code: '',
            item_name: '',
            item_group: 'Products',
            stock_uom: 'Nos',
            standard_rate: 0,
            description: '',
        },
    });

    const createMutation = useMutation({
        mutationFn: createItem,
        onSuccess: (data) => {
            const tenantSlug = window.location.pathname.split('/')[2];
            toast({
                title: 'Success',
                description: 'Item created successfully.',
            });
            router.push(`/w/${tenantSlug}/inventory/items/${data.item_code}`);
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Failed to create item.',
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: ItemFormValues) => {
        createMutation.mutate(data);
    };

    return (
        <div className="space-y-6 max-w-3xl">
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
                    <h1 className="text-3xl font-bold tracking-tight">New Item</h1>
                    <p className="text-muted-foreground">Add a new item to your inventory</p>
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Item Details</CardTitle>
                    <CardDescription>
                        Enter the details for the new inventory item
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Item Code */}
                                <FormField
                                    control={form.control}
                                    name="item_code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Item Code *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., ITEM-001" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Unique identifier for the item
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Item Name */}
                                <FormField
                                    control={form.control}
                                    name="item_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Item Name *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Laptop" {...field} />
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select group" />
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select UoM" />
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
                                                    placeholder="0.00"
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
                                <Button type="submit" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Item'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
