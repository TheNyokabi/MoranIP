'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { MasterDataCrudPage } from '@/components/master-data/MasterDataCrudPage';

export default function CRMMasterDataPage() {
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

    // UUID slug fallback
    if (tenantSlug && tenantSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setTenantId(tenantSlug);
    }
  }, [availableTenants, currentTenant, tenantSlug]);

  const configs = useMemo(() => {
    if (!tenantId) return null;

    return {
      customerGroups: {
        title: 'Customer Groups',
        description: 'Segment customers for pricing and reporting.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/crm/customer-groups`,
        createPath: (t: string) => `/tenants/${t}/erp/crm/customer-groups`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/crm/customer-groups/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/crm/customer-groups/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/crm/customer-groups/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'customer_group_name', label: 'Group Name' },
          { key: 'parent_customer_group', label: 'Parent' },
          { key: 'is_group', label: 'Is Group' },
        ],
        fields: [
          { key: 'customer_group_name', label: 'Customer Group Name', required: true, placeholder: 'e.g., Retail' },
          { key: 'parent_customer_group', label: 'Parent Customer Group', placeholder: 'e.g., All Customer Groups', defaultValue: 'All Customer Groups' },
          { key: 'is_group', label: 'Is Group', type: 'boolean', defaultValue: false },
        ],
      },
      territories: {
        title: 'Territories',
        description: 'Define sales regions and coverage hierarchy.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/crm/territories`,
        createPath: (t: string) => `/tenants/${t}/erp/crm/territories`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/crm/territories/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/crm/territories/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/crm/territories/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'territory_name', label: 'Territory' },
          { key: 'parent_territory', label: 'Parent' },
          { key: 'is_group', label: 'Is Group' },
        ],
        fields: [
          { key: 'territory_name', label: 'Territory Name', required: true, placeholder: 'e.g., Nairobi' },
          { key: 'parent_territory', label: 'Parent Territory', placeholder: 'e.g., All Territories', defaultValue: 'All Territories' },
          { key: 'is_group', label: 'Is Group', type: 'boolean', defaultValue: false },
        ],
      },
      salesPersons: {
        title: 'Sales Persons',
        description: 'Manage sales team hierarchy used in CRM and sales flows.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/crm/sales-persons`,
        createPath: (t: string) => `/tenants/${t}/erp/crm/sales-persons`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/crm/sales-persons/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/crm/sales-persons/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/crm/sales-persons/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Code' },
          { key: 'sales_person_name', label: 'Sales Person' },
          { key: 'parent_sales_person', label: 'Parent' },
          { key: 'enabled', label: 'Enabled' },
        ],
        fields: [
          { key: 'sales_person_name', label: 'Sales Person Name', required: true, placeholder: 'e.g., Jane Doe' },
          { key: 'parent_sales_person', label: 'Parent Sales Person', placeholder: 'Optional parent for hierarchy' },
          { key: 'enabled', label: 'Enabled', type: 'boolean', defaultValue: true },
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
        <h1 className="text-2xl font-bold">CRM Master Data</h1>
        <p className="text-sm text-muted-foreground">Configure CRM setup data for this tenant.</p>
      </div>

      <Tabs defaultValue="customer-groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customer-groups">Customer Groups</TabsTrigger>
          <TabsTrigger value="territories">Territories</TabsTrigger>
          <TabsTrigger value="sales-persons">Sales Persons</TabsTrigger>
        </TabsList>

        <TabsContent value="customer-groups">
          <MasterDataCrudPage config={configs.customerGroups} />
        </TabsContent>
        <TabsContent value="territories">
          <MasterDataCrudPage config={configs.territories} />
        </TabsContent>
        <TabsContent value="sales-persons">
          <MasterDataCrudPage config={configs.salesPersons} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
