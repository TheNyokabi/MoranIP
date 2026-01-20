"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";
import { MobileBottomNav } from "./mobile-bottom-nav";

interface ResponsiveLayoutContextType {
    isMobile: boolean;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
}

const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextType>({
    isMobile: false,
    isSidebarOpen: false,
    toggleSidebar: () => { },
    closeSidebar: () => { },
});

export const useResponsiveLayout = () => useContext(ResponsiveLayoutContext);

interface ResponsiveLayoutProps {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
    tenantSlug?: string;
    title?: string;
    showBottomNav?: boolean;
    showHeader?: boolean;
}

export function ResponsiveLayout({
    children,
    sidebar,
    tenantSlug,
    title,
    showBottomNav = true,
    showHeader = true,
}: ResponsiveLayoutProps) {
    const [isMobile, setIsMobile] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
    const closeSidebar = () => setIsSidebarOpen(false);

    // Handle body scroll lock when sidebar is open on mobile
    useEffect(() => {
        if (isMobile && isSidebarOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isMobile, isSidebarOpen]);

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="min-h-screen bg-background">
                {children}
            </div>
        );
    }

    return (
        <ResponsiveLayoutContext.Provider
            value={{ isMobile, isSidebarOpen, toggleSidebar, closeSidebar }}
        >
            <div className="min-h-screen bg-background">
                {/* Mobile Header */}
                {isMobile && showHeader && (
                    <MobileHeader
                        tenantSlug={tenantSlug}
                        title={title}
                        onMenuToggle={toggleSidebar}
                        isMenuOpen={isSidebarOpen}
                    />
                )}

                {/* Mobile Sidebar Overlay */}
                {isMobile && isSidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
                            onClick={closeSidebar}
                            aria-hidden="true"
                        />
                        {/* Sidebar */}
                        <div
                            className={cn(
                                "fixed inset-y-0 left-0 z-50 w-64 bg-background shadow-xl",
                                "transform transition-transform duration-300 ease-in-out",
                                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                            )}
                        >
                            {sidebar}
                        </div>
                    </>
                )}

                {/* Desktop Sidebar */}
                {!isMobile && sidebar && (
                    <aside className="fixed inset-y-0 left-0 z-30 w-64">
                        {sidebar}
                    </aside>
                )}

                {/* Main Content */}
                <main
                    className={cn(
                        "min-h-screen transition-all duration-300",
                        // Desktop: offset for sidebar
                        !isMobile && sidebar && "md:pl-64",
                        // Mobile: offset for header and bottom nav
                        isMobile && showHeader && "pt-14",
                        isMobile && showBottomNav && "pb-16"
                    )}
                >
                    {children}
                </main>

                {/* Mobile Bottom Navigation */}
                {isMobile && showBottomNav && (
                    <MobileBottomNav tenantSlug={tenantSlug} />
                )}
            </div>
        </ResponsiveLayoutContext.Provider>
    );
}
