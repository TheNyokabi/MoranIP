'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Users,
  HelpCircle,
  Hammer,
  Briefcase,
  ShoppingCart,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ModulesNavProps {
  tenantSlug: string;
  className?: string;
}

export function ModulesNav({ tenantSlug, className }: ModulesNavProps) {
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  const modules = [
    {
      name: 'Accounting',
      href: `/w/${tenantSlug}/modules/accounting`,
      icon: BarChart3,
      description: 'Financial management',
    },
    {
      name: 'CRM',
      href: `/w/${tenantSlug}/modules/crm`,
      icon: Users,
      description: 'Customer relations',
    },
    {
      name: 'HR',
      href: `/w/${tenantSlug}/modules/hr`,
      icon: HelpCircle,
      description: 'Human resources',
    },
    {
      name: 'Manufacturing',
      href: `/w/${tenantSlug}/modules/manufacturing`,
      icon: Hammer,
      description: 'Production management',
    },
    {
      name: 'Projects',
      href: `/w/${tenantSlug}/modules/projects`,
      icon: Briefcase,
      description: 'Project management',
    },
    {
      name: 'POS',
      href: `/w/${tenantSlug}/pos`,
      icon: ShoppingCart,
      description: 'Point of sale',
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full justify-start"
        >
          <Menu className="h-4 w-4 mr-2" />
          Modules
          <ChevronDown className={cn(
            "h-4 w-4 ml-auto transition-transform",
            mobileOpen && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "space-y-1",
        !mobileOpen && "hidden md:block",
        className
      )}>
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = pathname.includes(module.href.split('/').pop() || '');

          return (
            <Link key={module.href} href={module.href}>
              <div className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}>
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{module.name}</p>
                  <p className="text-xs opacity-75 hidden lg:block">{module.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-muted rounded-lg p-2 mb-4 space-y-1">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = pathname.includes(module.href.split('/').pop() || '');

            return (
              <Link
                key={module.href}
                href={module.href}
                onClick={() => setMobileOpen(false)}
              >
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background"
                )}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{module.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
