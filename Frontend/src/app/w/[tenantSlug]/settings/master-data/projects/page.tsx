'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { MasterDataCrudPage } from '@/components/master-data/MasterDataCrudPage';

export default function ProjectsMasterDataPage() {
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

  const config = useMemo(() => {
    if (!tenantId) return null;

    return {
      title: 'Project Templates',
      description: 'Reusable templates to standardize project structure.',
      tenantId,
      listPath: (t: string) => `/tenants/${t}/erp/projects/project-templates`,
      createPath: (t: string) => `/tenants/${t}/erp/projects/project-templates`,
      getPath: (t: string, id: string) => `/tenants/${t}/erp/projects/project-templates/${encodeURIComponent(id)}`,
      updatePath: (t: string, id: string) => `/tenants/${t}/erp/projects/project-templates/${encodeURIComponent(id)}`,
      deletePath: (t: string, id: string) => `/tenants/${t}/erp/projects/project-templates/${encodeURIComponent(id)}`,
      idField: 'name',
      columns: [
        { key: 'name', label: 'ID' },
        { key: 'project_template_name', label: 'Template' },
        { key: 'description', label: 'Description' },
      ],
      fields: [
        { key: 'project_template_name', label: 'Template Name', required: true, placeholder: 'e.g., New Store Rollout' },
        { key: 'description', label: 'Description (optional)', placeholder: 'Short description' },
      ],
    };
  }, [tenantId]);

  if (!tenantId || !config) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Projects Master Data</h1>
        <p className="text-sm text-muted-foreground">Configure project setup data for this tenant.</p>
      </div>

      <MasterDataCrudPage config={config as any} />
    </div>
  );
}
