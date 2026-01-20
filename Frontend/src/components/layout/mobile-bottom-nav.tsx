"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Receipt,
    MoreHorizontal,
    Settings,
    Users,
    BarChart3,
} from "lucide-react";

interface MobileBottomNavProps {
    tenantSlug?: string;
}

interface NavItem {
    href: string;
    icon: React.ElementType;
    label: string;
    badge?: number;
}

export function MobileBottomNav({ tenantSlug }: MobileBottomNavProps) {
    const pathname = usePathname();

    // Define navigation items based on context
    const navItems: NavItem[] = tenantSlug
        ? [
            {
                href: `/w/${tenantSlug}`,
                icon: LayoutDashboard,
                label: "Home",
            },
            {
                href: `/w/${tenantSlug}/pos`,
                icon: ShoppingCart,
                label: "POS",
            },
            {
                href: `/w/${tenantSlug}/inventory`,
                icon: Package,
                label: "Inventory",
            },
            {
                href: `/w/${tenantSlug}/invoices`,
                icon: Receipt,
                label: "Invoices",
            },
            {
                href: `/w/${tenantSlug}/settings`,
                icon: Settings,
                label: "More",
            },
        ]
        : [
            {
                href: "/dashboard",
                icon: LayoutDashboard,
                label: "Dashboard",
            },
            {
                href: "/admin/workspaces",
                icon: Users,
                label: "Workspaces",
            },
            {
                href: "/feed",
                icon: BarChart3,
                label: "Feed",
            },
            {
                href: "/settings",
                icon: Settings,
                label: "Settings",
            },
        ];

    const isActive = (href: string) => {
        if (href === `/w/${tenantSlug}` || href === "/dashboard") {
            return pathname === href;
        }
        return pathname?.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border md:hidden safe-area-inset-bottom">
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 relative transition-colors",
                                active
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className="relative">
                                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                                {item.badge && item.badge > 0 && (
                                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                                        {item.badge > 9 ? "9+" : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium",
                                active && "text-primary"
                            )}>
                                {item.label}
                            </span>
                            {active && (
                                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
