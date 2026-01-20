'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { MasterDataCrudPage } from '@/components/master-data/MasterDataCrudPage';

export default function ManufacturingMasterDataPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;

  const { availableTenants } = useTenantStore();
  const { currentTenant } = useAuthStore();

  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    const tenant = findTenantBySlug(tenantSlug, availableTenants);
    if (tenant?.id) {
      setTenantId(tenant.id);
      return;
    }

    if (currentTenant?.id) {
      const currentSlug = currentTenant.code || currentTenant.id;
      if (currentSlug === tenantSlug || currentTenant.id === tenantSlug) {
        setTenantId(currentTenant.id);
        return;
      }
    }

    if (tenantSlug && tenantSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setTenantId(tenantSlug);
    }
  }, [availableTenants, currentTenant, tenantSlug]);

  const configs = useMemo(() => {
    if (!tenantId) return null;

    return {
      workCenters: {
        title: 'Work Centers',
        description: 'Work centers (ERPNext Workstations) used in routing and production.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/manufacturing/work-centers`,
        createPath: (t: string) => `/tenants/${t}/erp/manufacturing/work-centers`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/work-centers/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/work-centers/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/work-centers/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'ID' },
          { key: 'workstation_name', label: 'Work Center' },
          { key: 'production_capacity', label: 'Capacity' },
          { key: 'disabled', label: 'Disabled' },
        ],
        fields: [
          { key: 'workstation_name', label: 'Work Center Name', required: true, placeholder: 'e.g., Assembly Line 1' },
          { key: 'production_capacity', label: 'Production Capacity (optional)', placeholder: 'e.g., 100' },
          { key: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
        ],
      },
      operations: {
        title: 'Operations',
        description: 'Manufacturing operations used in BOMs and routings.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/manufacturing/operations`,
        createPath: (t: string) => `/tenants/${t}/erp/manufacturing/operations`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/operations/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/operations/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/manufacturing/operations/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'ID' },
          { key: 'operation_name', label: 'Operation' },
          { key: 'description', label: 'Description' },
        ],
        fields: [
          { key: 'operation_name', label: 'Operation Name', required: true, placeholder: 'e.g., Welding' },
          { key: 'description', label: 'Description (optional)', placeholder: 'Short description' },
        ],
      },
    } as const;
  }, [tenantId]);

  if (!tenantId || !configs) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manufacturing Master Data</h1>
        <p className="text-sm text-muted-foreground">Configure manufacturing setup data for this tenant.</p>
      </div>

      <Tabs defaultValue="work-centers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="work-centers">Work Centers</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="work-centers">
          <MasterDataCrudPage config={configs.workCenters} />
        </TabsContent>
        <TabsContent value="operations">
          <MasterDataCrudPage config={configs.operations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
