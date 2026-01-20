"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Menu,
    X,
    Bell,
    Search,
    User,
    LayoutDashboard,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

interface MobileHeaderProps {
    tenantSlug?: string;
    title?: string;
    onMenuToggle?: () => void;
    isMenuOpen?: boolean;
}

export function MobileHeader({
    tenantSlug,
    title = "MoranERP",
    onMenuToggle,
    isMenuOpen = false,
}: MobileHeaderProps) {
    const { user } = useAuthStore();
    const pathname = usePathname();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border md:hidden">
            <div className="flex items-center justify-between h-full px-4">
                {/* Left: Menu button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuToggle}
                    className="h-9 w-9"
                    aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                >
                    {isMenuOpen ? (
                        <X className="h-5 w-5" />
                    ) : (
                        <Menu className="h-5 w-5" />
                    )}
                </Button>

                {/* Center: Title/Logo */}
                <Link
                    href={tenantSlug ? `/w/${tenantSlug}` : "/dashboard"}
                    className="flex items-center gap-2"
                >
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                        <LayoutDashboard className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-sm truncate max-w-[150px]">
                        {title}
                    </span>
                </Link>

                {/* Right: Actions */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Search className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                    </Button>
                </div>
            </div>
        </header>
    );
}
