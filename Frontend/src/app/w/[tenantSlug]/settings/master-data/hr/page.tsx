'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { useAuthStore } from '@/store/auth-store';
import { MasterDataCrudPage } from '@/components/master-data/MasterDataCrudPage';

export default function HRMasterDataPage() {
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
      departments: {
        title: 'Departments',
        description: 'Define department structure for HR, approvals, and reporting.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/hr/departments`,
        createPath: (t: string) => `/tenants/${t}/erp/hr/departments`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/hr/departments/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/hr/departments/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/hr/departments/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'department_name', label: 'Department' },
          { key: 'parent_department', label: 'Parent' },
          { key: 'is_group', label: 'Is Group' },
        ],
        fields: [
          { key: 'department_name', label: 'Department Name', required: true, placeholder: 'e.g., Finance' },
          { key: 'parent_department', label: 'Parent Department', placeholder: 'Optional for hierarchy' },
          { key: 'is_group', label: 'Is Group', type: 'boolean', defaultValue: false },
        ],
      },
      designations: {
        title: 'Designations',
        description: 'Create job titles (e.g., Accountant, Supervisor).',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/hr/designations`,
        createPath: (t: string) => `/tenants/${t}/erp/hr/designations`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/hr/designations/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/hr/designations/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/hr/designations/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'designation_name', label: 'Designation' },
        ],
        fields: [
          { key: 'designation_name', label: 'Designation Name', required: true, placeholder: 'e.g., Operations Manager' },
        ],
      },
      holidayLists: {
        title: 'Holiday Lists',
        description: 'Define public holidays and weekly offs for payroll and attendance.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/hr/holiday-lists`,
        createPath: (t: string) => `/tenants/${t}/erp/hr/holiday-lists`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/hr/holiday-lists/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/hr/holiday-lists/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/hr/holiday-lists/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'holiday_list_name', label: 'Holiday List' },
          { key: 'from_date', label: 'From' },
          { key: 'to_date', label: 'To' },
        ],
        fields: [
          { key: 'holiday_list_name', label: 'Holiday List Name', required: true, placeholder: 'e.g., Kenya 2026' },
          { key: 'from_date', label: 'From Date', type: 'date', required: true },
          { key: 'to_date', label: 'To Date', type: 'date', required: true },
          { key: 'weekly_off', label: 'Weekly Off (optional)', placeholder: 'e.g., Sunday' },
        ],
      },
      shiftTypes: {
        title: 'Shift Types',
        description: 'Define working shifts used for attendance scheduling.',
        tenantId,
        listPath: (t: string) => `/tenants/${t}/erp/hr/shift-types`,
        createPath: (t: string) => `/tenants/${t}/erp/hr/shift-types`,
        getPath: (t: string, id: string) => `/tenants/${t}/erp/hr/shift-types/${encodeURIComponent(id)}`,
        updatePath: (t: string, id: string) => `/tenants/${t}/erp/hr/shift-types/${encodeURIComponent(id)}`,
        deletePath: (t: string, id: string) => `/tenants/${t}/erp/hr/shift-types/${encodeURIComponent(id)}`,
        idField: 'name',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'shift_type', label: 'Shift Type' },
          { key: 'start_time', label: 'Start' },
          { key: 'end_time', label: 'End' },
          { key: 'enabled', label: 'Enabled' },
        ],
        fields: [
          { key: 'shift_type', label: 'Shift Type', required: true, placeholder: 'e.g., Day Shift' },
          { key: 'start_time', label: 'Start Time (optional)', placeholder: 'e.g., 09:00:00' },
          { key: 'end_time', label: 'End Time (optional)', placeholder: 'e.g., 17:00:00' },
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
        <h1 className="text-2xl font-bold">HR Master Data</h1>
        <p className="text-sm text-muted-foreground">Configure HR setup data for this tenant.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Note: “Shift Types” require the HRMS app in ERPNext. This environment currently installs only ERPNext,
          so Shift Types are hidden.
        </p>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="designations">Designations</TabsTrigger>
          <TabsTrigger value="holiday-lists">Holiday Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <MasterDataCrudPage config={configs.departments} />
        </TabsContent>
        <TabsContent value="designations">
          <MasterDataCrudPage config={configs.designations} />
        </TabsContent>
        <TabsContent value="holiday-lists">
          <MasterDataCrudPage config={configs.holidayLists} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
