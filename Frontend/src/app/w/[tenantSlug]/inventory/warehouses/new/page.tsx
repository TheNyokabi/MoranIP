'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import { toast as sonnerToast } from 'sonner';

const warehouseSchema = z.object({
    warehouse_name: z.string().min(1, 'Warehouse name is required').max(140),
    warehouse_code: z.string().optional(),
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

export default function NewWarehousePage() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const tenantId = tenantSlug;
    const { token } = useAuthStore();
    const { toast } = useToast();

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: {
            warehouse_name: '',
            warehouse_code: '',
            warehouse_type: '',
            parent_warehouse: '',
        },
    });

    const [isCreating, setIsCreating] = useState(false);

    const onSubmit = async (data: WarehouseFormValues) => {
        if (!token || !tenantId) {
            toast({
                title: 'Error',
                description: 'Authentication required. Please log in again.',
                variant: 'destructive',
            });
            return;
        }

        setIsCreating(true);
        try {
            // Use tenant-scoped inventory API endpoint (company is auto-resolved by backend)
            const result = await apiFetch<any>(
                `/api/tenants/${tenantId}/erp/inventory/warehouses`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        warehouse_name: data.warehouse_name,
                        warehouse_code: data.warehouse_code || data.warehouse_name.substring(0, 3).toUpperCase(),
                        warehouse_type: data.warehouse_type || undefined,
                        parent_warehouse: data.parent_warehouse || undefined,
                        is_group: 0
                    })
                },
                token
            );

            const warehouseData = result?.data || result;
            toast({
                title: 'Success',
                description: 'Warehouse created successfully.',
            });
            router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouseData.warehouse_name || data.warehouse_name)}`);
        } catch (error: any) {
            console.error('Failed to create warehouse:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to create warehouse.',
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
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
                    <h1 className="text-3xl font-bold tracking-tight">New Warehouse</h1>
                    <p className="text-muted-foreground">Add a new storage location</p>
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                    <CardDescription>
                        Enter the details for the new warehouse or storage location
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Warehouse Name */}
                                <FormField
                                    control={form.control}
                                    name="warehouse_name"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Warehouse Name *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Main Warehouse - Nairobi" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Unique name for the warehouse. Company is automatically set from your workspace settings.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Warehouse Code */}
                                <FormField
                                    control={form.control}
                                    name="warehouse_code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Warehouse Code</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., MPS" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Short code/abbreviation (optional, auto-generated if empty)
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

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

                                {/* Parent Warehouse */}
                                <FormField
                                    control={form.control}
                                    name="parent_warehouse"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
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
                            </div>

                            <div className="flex justify-end gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? 'Creating...' : 'Create Warehouse'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
