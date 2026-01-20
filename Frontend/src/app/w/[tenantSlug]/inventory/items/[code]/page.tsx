'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Package, DollarSign, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getItem } from '@/lib/api/inventory';

export default function ItemDetailsPage({ params }: { params: { code: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const itemCode = decodeURIComponent(params.code);

    const { data: item, isLoading } = useQuery({
        queryKey: ['item', itemCode],
        queryFn: () => getItem(itemCode),
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Item not found</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/w/${tenantSlug}/inventory/items`)}
                    >
                        Back to Items
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{item.item_name}</h1>
                        <p className="text-muted-foreground font-mono">{item.item_code}</p>
                    </div>
                </div>
                <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/items/${item.item_code}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
            </div>

            {/* Item Details */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                        <CardDescription>Core item details and specifications</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Code</span>
                            <span className="font-mono">{item.item_code}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Name</span>
                            <span className="font-medium">{item.item_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Item Group</span>
                            <Badge variant="outline">
                                <Tag className="h-3 w-3 mr-1" />
                                {item.item_group}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Unit of Measure</span>
                            <span>{item.stock_uom}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Status</span>
                            <Badge variant={item.disabled ? 'destructive' : 'default'}>
                                {item.disabled ? 'Disabled' : 'Active'}
                            </Badge>
                        </div>
                        {item.description && (
                            <div className="pt-4 border-t">
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Description</span>
                                <p className="text-sm">{item.description}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card>
                    <CardHeader>
                        <CardTitle>Pricing</CardTitle>
                        <CardDescription>Standard rates and valuation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Standard Rate</span>
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-lg font-semibold">
                                    {item.standard_rate ? `KES ${item.standard_rate.toLocaleString()}` : '-'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Stock Information</CardTitle>
                    <CardDescription>Current stock levels across warehouses</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Stock balance feature coming soon</p>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Latest stock movements for this item</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Transaction history coming soon</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
