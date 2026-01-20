'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Warehouse as WarehouseIcon, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getWarehouse } from '@/lib/api/inventory';

export default function WarehouseDetailsPage({ params }: { params: { name: string } }) {
    const router = useRouter();
    const routeParams = useParams() as any;
    const tenantSlug = routeParams.tenantSlug as string;
    const warehouseName = decodeURIComponent(params.name);

    const { data: warehouse, isLoading } = useQuery({
        queryKey: ['warehouse', warehouseName],
        queryFn: () => getWarehouse(warehouseName),
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

    if (!warehouse) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <WarehouseIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Warehouse not found</p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses`)}
                    >
                        Back to Warehouses
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
                        <h1 className="text-3xl font-bold tracking-tight">{warehouse.warehouse_name}</h1>
                        <p className="text-muted-foreground">{warehouse.company}</p>
                    </div>
                </div>
                <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouse.warehouse_name)}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
            </div>

            {/* Warehouse Details */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Basic Information</CardTitle>
                        <CardDescription>Core warehouse details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Warehouse Name</span>
                            <span className="font-medium">{warehouse.warehouse_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Company</span>
                            <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{warehouse.company}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Status</span>
                            <Badge variant={warehouse.disabled ? 'destructive' : 'default'}>
                                {warehouse.disabled ? 'Disabled' : 'Active'}
                            </Badge>
                        </div>
                        {warehouse.warehouse_type && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Type</span>
                                <Badge variant="outline">{warehouse.warehouse_type}</Badge>
                            </div>
                        )}
                        {warehouse.parent_warehouse && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Parent Warehouse</span>
                                <span className="text-sm">{warehouse.parent_warehouse}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Statistics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Stock Statistics</CardTitle>
                        <CardDescription>Current stock in this warehouse</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-muted-foreground">
                            <WarehouseIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Stock statistics coming soon</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Items in Warehouse */}
            <Card>
                <CardHeader>
                    <CardTitle>Stock Items</CardTitle>
                    <CardDescription>All items currently stored in this warehouse</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <WarehouseIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Stock items list coming soon</p>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>Latest stock movements for this warehouse</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                        <WarehouseIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>Transaction history coming soon</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
