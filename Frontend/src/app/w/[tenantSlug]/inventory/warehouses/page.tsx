'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Warehouse, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WarehousesTable } from '@/components/inventory/WarehousesTable';
import { getWarehouses } from '@/lib/api/inventory';
import { Warehouse as WarehouseType } from '@/lib/types/inventory';
import { BulkUploadModal } from '@/components/shared/bulk-upload-modal';

export default function WarehousesPage() {
    const router = useRouter();
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const queryClient = useQueryClient();

    const { data: warehouses = [], isLoading } = useQuery({
        queryKey: ['warehouses'],
        queryFn: () => getWarehouses({ limit: 100 }),
    });

    const handleView = (warehouse: WarehouseType) => {
        router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouse.warehouse_name)}`);
    };

    const handleEdit = (warehouse: WarehouseType) => {
        router.push(`/w/${tenantSlug}/inventory/warehouses/${encodeURIComponent(warehouse.warehouse_name)}/edit`);
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                    <Warehouse className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground">Loading warehouses...</p>
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
                    <h1 className="text-3xl font-bold tracking-tight">Warehouses</h1>
                    <p className="text-muted-foreground">
                        Manage your storage locations and distribution centers
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BulkUploadModal entityType="warehouses" onSuccess={handleRefresh} />
                    <Button onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses/new`)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Warehouse
                    </Button>
                </div>
            </div>

            {/* Warehouses Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Warehouses</CardTitle>
                    <CardDescription>
                        {warehouses.length} {warehouses.length === 1 ? 'warehouse' : 'warehouses'} configured
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WarehousesTable
                        warehouses={warehouses}
                        onView={handleView}
                        onEdit={handleEdit}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
