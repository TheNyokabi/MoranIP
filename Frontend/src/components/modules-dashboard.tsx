'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  ShoppingCart,
  Briefcase,
  Hammer,
  CheckSquare,
  ArrowRight,
  ClipboardCheck,
  Building,
  CreditCard,
  HelpCircle,
  Settings
} from 'lucide-react';
import { useModuleStore } from '@/store/module-store';
import { useTenantStore } from '@/store/tenant-store';
import { findTenantBySlug } from '@/store/tenant-store';

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  enabled: boolean;
}

interface ModulesDashboardProps {
  tenantSlug: string;
}

export function ModulesDashboard({ tenantSlug }: ModulesDashboardProps) {
  const { tenantSettings, fetchTenantSettings } = useModuleStore();
  const { availableTenants } = useTenantStore();

  // Find tenant ID to fetch settings
  const tenant = findTenantBySlug(tenantSlug, availableTenants);

  useEffect(() => {
    if (tenant?.id) {
      fetchTenantSettings(tenant.id);
    }
  }, [tenant?.id, fetchTenantSettings]);

  // Determine enabled modules (default to true if undefined for discovery, except explicit opt-ins)
  // Logic matches SidebarContent for consistency
  const isPosEnabled = tenantSettings?.enable_pos ?? false;
  const isManufacturingEnabled = tenantSettings?.enable_manufacturing ?? true;
  const isProjectsEnabled = tenantSettings?.enable_projects ?? false;
  const isHREnabled = tenantSettings?.enable_hr ?? false;

  // Core modules usually enabled
  const isAccountingEnabled = true;
  const isCRMEnabled = true;
  const isPurchasingEnabled = true;
  const isQualityEnabled = true;

  const modules: ModuleCard[] = [
    {
      id: 'accounting',
      name: 'Accounting',
      description: 'GL Entries, Invoices, Payments',
      icon: <BarChart3 className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/accounting`,
      color: 'bg-blue-50 border-blue-200',
      enabled: isAccountingEnabled
    },
    {
      id: 'crm',
      name: 'CRM',
      description: 'Contacts, Leads, Customers',
      icon: <Users className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/crm`,
      color: 'bg-green-50 border-green-200',
      enabled: isCRMEnabled
    },
    {
      id: 'purchasing',
      name: 'Purchasing',
      description: 'Purchase Orders, Suppliers',
      icon: <CreditCard className="h-8 w-8" />,
      href: `/w/${tenantSlug}/purchasing`,
      color: 'bg-teal-50 border-teal-200',
      enabled: isPurchasingEnabled
    },
    {
      id: 'hr',
      name: 'Human Resources',
      description: 'Employees, Attendance, Leaves',
      icon: <ShoppingCart className="h-8 w-8" />, // Note: Using ShoppingCart icon from original file, but Users/UserPlus might be better. Keeping original for now to minimize visual drift unless requested.
      href: `/w/${tenantSlug}/modules/hr`,
      color: 'bg-purple-50 border-purple-200',
      enabled: isHREnabled
    },
    {
      id: 'manufacturing',
      name: 'Manufacturing',
      description: 'BOMs, Work Orders, Production',
      icon: <Hammer className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/manufacturing`,
      color: 'bg-orange-50 border-orange-200',
      enabled: isManufacturingEnabled
    },
    {
      id: 'quality',
      name: 'Quality',
      description: 'Inspections, Reviews',
      icon: <ClipboardCheck className="h-8 w-8" />,
      href: `/w/${tenantSlug}/quality`,
      color: 'bg-red-50 border-red-200',
      enabled: isQualityEnabled
    },
    {
      id: 'assets',
      name: 'Assets',
      description: 'Asset Management, Depreciation',
      icon: <Building className="h-8 w-8" />,
      href: `/w/${tenantSlug}/assets`,
      color: 'bg-amber-50 border-amber-200',
      enabled: true
    },
    {
      id: 'projects',
      name: 'Projects',
      description: 'Projects, Tasks, Timesheets',
      icon: <Briefcase className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/projects`,
      color: 'bg-pink-50 border-pink-200',
      enabled: isProjectsEnabled
    },
    {
      id: 'pos',
      name: 'Point of Sale',
      description: 'Sales, Transactions, Reports',
      icon: <CheckSquare className="h-8 w-8" />,
      href: `/w/${tenantSlug}/pos`,
      color: 'bg-indigo-50 border-indigo-200',
      enabled: isPosEnabled
    },
  ];

  const activeModules = modules.filter(m => m.enabled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Available Modules</h2>
        <p className="text-gray-600">Access all your business modules and data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeModules.map((module) => (
          <Link key={module.id} href={module.href}>
            <Card className={`cursor-pointer hover:shadow-lg transition-shadow h-full border ${module.color}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-gray-700">{module.icon}</div>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">{module.name}</CardTitle>
                <p className="text-sm text-gray-600">{module.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link href={`/w/${tenantSlug}/invoices/new`}>
              <Button variant="outline" size="sm" className="w-full">
                Create New Invoice
              </Button>
            </Link>
            {isCRMEnabled && (
              <Link href={`/w/${tenantSlug}/modules/crm`}>
                <Button variant="outline" size="sm" className="w-full">
                  Add Lead
                </Button>
              </Link>
            )}
            {isHREnabled && (
              <Link href={`/w/${tenantSlug}/hr`}>
                <Button variant="outline" size="sm" className="w-full">
                  Record Attendance
                </Button>
              </Link>
            )}
            {isManufacturingEnabled && (
              <Link href={`/w/${tenantSlug}/modules/manufacturing`}>
                <Button variant="outline" size="sm" className="w-full">
                  Create Work Order
                </Button>
              </Link>
            )}
            {isProjectsEnabled && (
              <Link href={`/w/${tenantSlug}/modules/projects`}>
                <Button variant="outline" size="sm" className="w-full">
                  New Task
                </Button>
              </Link>
            )}
            <Link href={`/w/${tenantSlug}/reports`}>
              <Button variant="outline" size="sm" className="w-full">
                View Reports
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
