import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase, Factory, Users, Building2, Settings2 } from 'lucide-react';

export default function MasterDataIndexPage({ params }: { params: { tenantSlug: string } }) {
  const { tenantSlug } = params;

  const sections = [
    {
      title: 'CRM Master Data',
      description: 'Customer Groups, Territories, Sales Persons',
      icon: Users,
      href: `/w/${tenantSlug}/settings/master-data/crm`,
    },
    {
      title: 'HR Master Data',
      description: 'Departments, Designations, Holiday Lists, Shift Types',
      icon: Briefcase,
      href: `/w/${tenantSlug}/settings/master-data/hr`,
    },
    {
      title: 'Manufacturing Master Data',
      description: 'Work Centers (Workstations) and Operations',
      icon: Factory,
      href: `/w/${tenantSlug}/settings/master-data/manufacturing`,
    },
    {
      title: 'Projects Master Data',
      description: 'Project Templates',
      icon: Settings2,
      href: `/w/${tenantSlug}/settings/master-data/projects`,
    },
    {
      title: 'Accounting Setup',
      description: 'Company Setup and Chart of Accounts',
      icon: Building2,
      href: `/w/${tenantSlug}/settings/company-setup`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold">Master Data</h3>
        <p className="text-sm text-muted-foreground">
          Configure tenant-level master data required for Phase 1.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.href} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{s.title}</CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={s.href} className="flex items-center justify-between">
                    <span>Open</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
