'use client';

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
  ArrowRight 
} from 'lucide-react';

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}

interface ModulesDashboardProps {
  tenantSlug: string;
}

export function ModulesDashboard({ tenantSlug }: ModulesDashboardProps) {
  const modules: ModuleCard[] = [
    {
      id: 'accounting',
      name: 'Accounting',
      description: 'GL Entries, Invoices, Payments',
      icon: <BarChart3 className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/accounting`,
      color: 'bg-blue-50 border-blue-200',
    },
    {
      id: 'crm',
      name: 'CRM',
      description: 'Contacts, Leads, Customers',
      icon: <Users className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/crm`,
      color: 'bg-green-50 border-green-200',
    },
    {
      id: 'hr',
      name: 'Human Resources',
      description: 'Employees, Attendance, Leaves',
      icon: <ShoppingCart className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/hr`,
      color: 'bg-purple-50 border-purple-200',
    },
    {
      id: 'manufacturing',
      name: 'Manufacturing',
      description: 'BOMs, Work Orders, Production',
      icon: <Hammer className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/manufacturing`,
      color: 'bg-orange-50 border-orange-200',
    },
    {
      id: 'projects',
      name: 'Projects',
      description: 'Projects, Tasks, Timesheets',
      icon: <Briefcase className="h-8 w-8" />,
      href: `/w/${tenantSlug}/modules/projects`,
      color: 'bg-pink-50 border-pink-200',
    },
    {
      id: 'pos',
      name: 'Point of Sale',
      description: 'Sales, Transactions, Reports',
      icon: <CheckSquare className="h-8 w-8" />,
      href: `/w/${tenantSlug}/pos`,
      color: 'bg-indigo-50 border-indigo-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Available Modules</h2>
        <p className="text-gray-600">Access all your business modules and data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((module) => (
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
            <Button variant="outline" size="sm">
              Create New Invoice
            </Button>
            <Button variant="outline" size="sm">
              Add Lead
            </Button>
            <Button variant="outline" size="sm">
              Record Attendance
            </Button>
            <Button variant="outline" size="sm">
              Create Work Order
            </Button>
            <Button variant="outline" size="sm">
              New Task
            </Button>
            <Button variant="outline" size="sm">
              View Reports
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
