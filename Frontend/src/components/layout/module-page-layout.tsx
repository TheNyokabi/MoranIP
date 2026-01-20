'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, LucideIcon } from 'lucide-react';

interface ModulePageLayoutProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  children: ReactNode;
}

export function ModulePageLayout({ title, description, action, children }: ModulePageLayoutProps) {
  const ActionIcon = action?.icon || Plus;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        {action && (
          <Button onClick={action.onClick} size="sm" className="gap-2">
            <ActionIcon className="h-4 w-4" />
            {action.label}
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
