"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Package, Settings, Users, Shield, Building2, Database } from "lucide-react";

interface SettingsLayoutProps {
    children: React.ReactNode;
    params: { tenantSlug: string };
}

export default function SettingsLayout({ children, params }: SettingsLayoutProps) {
    const pathname = usePathname();
    const { tenantSlug } = params;

    const sidebarNavItems = [
        {
            title: "General",
            href: `/w/${tenantSlug}/settings`,
            icon: Settings,
        },
        {
            title: "Company Setup",
            href: `/w/${tenantSlug}/settings/company-setup`,
            icon: Building2,
        },
        {
            title: "Master Data",
            href: `/w/${tenantSlug}/settings/master-data`,
            icon: Database,
        },
        {
            title: "ERP Modules",
            href: `/w/${tenantSlug}/settings/modules`,
            icon: Package,
        },
        {
            title: "Team Members",
            href: `/w/${tenantSlug}/settings/members`,
            icon: Users,
        },
        {
            title: "Roles & Permissions",
            href: `/w/${tenantSlug}/settings/roles`,
            icon: Shield,
        },
    ];

    return (
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 p-6">
            <aside className="-mx-4 lg:w-1/5">
                <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                    {sidebarNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                                pathname === item.href ? "bg-accent" : "transparent"
                            )}
                        >
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.title}</span>
                        </Link>
                    ))}
                </nav>
            </aside>
            <div className="flex-1 lg:max-w-4xl">{children}</div>
        </div>
    );
}
