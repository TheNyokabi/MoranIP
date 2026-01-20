"use client"

import { useEffect, useState } from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    Building2,
    Settings,
    LogOut,
    LayoutDashboard
} from "lucide-react"
import { useAuthStore } from "@/store/auth-store"

export function GlobalSidebar() {
    const pathnameObj = usePathname()
    const pathname = pathnameObj || ""
    const router = useRouter()
    const { user, logout } = useAuthStore()

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    const handleLogout = () => {
        logout()
        router.push('/login')
    }

    return (
        <div className="flex h-screen flex-col w-64 fixed left-0 top-0 z-30 bg-[#0d0d14] border-r border-white/10">
            {/* Logo */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600">
                        <LayoutDashboard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            Moran
                        </span>
                        <span className="text-white/40 text-xs block">ERP Platform</span>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 px-3">
                <div className="space-y-6">
                    {/* Main Navigation */}
                    <div className="py-2">
                        <div className="space-y-1">
                            <Link href="/dashboard">
                                <div className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                                    pathname === "/dashboard"
                                        ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30"
                                        : "hover:bg-white/5"
                                )}>
                                    <LayoutDashboard className={cn(
                                        "h-4 w-4",
                                        pathname === "/dashboard" ? "text-cyan-400" : "text-white/50 group-hover:text-white/70"
                                    )} />
                                    <span className={cn(
                                        "text-sm font-medium",
                                        pathname === "/dashboard" ? "text-white" : "text-white/70 group-hover:text-white"
                                    )}>Dashboard</span>
                                    {pathname === "/dashboard" && (
                                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    )}
                                </div>
                            </Link>

                            <Link href="/admin/workspaces">
                                <div className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                                    pathname === "/admin/workspaces"
                                        ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30"
                                        : "hover:bg-white/5"
                                )}>
                                    <Building2 className={cn(
                                        "h-4 w-4",
                                        pathname === "/admin/workspaces" ? "text-cyan-400" : "text-white/50 group-hover:text-white/70"
                                    )} />
                                    <span className={cn(
                                        "text-sm font-medium",
                                        pathname === "/admin/workspaces" ? "text-white" : "text-white/70 group-hover:text-white"
                                    )}>New Workspace</span>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Settings */}
                    <div className="py-2">
                        <div className="space-y-1">
                            <Link href="/settings">
                                <div className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                                    pathname === "/settings"
                                        ? "bg-white/10 border border-white/20"
                                        : "hover:bg-white/5"
                                )}>
                                    <Settings className={cn(
                                        "h-4 w-4",
                                        pathname === "/settings" ? "text-white/70" : "text-white/50 group-hover:text-white/70"
                                    )} />
                                    <span className={cn(
                                        "text-sm",
                                        pathname === "/settings" ? "text-white" : "text-white/70 group-hover:text-white"
                                    )}>Settings</span>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* User Section */}
            <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white">
                        {(mounted ? user?.name?.charAt(0) : undefined) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white block truncate">{(mounted ? user?.name : undefined) || 'User'}</span>
                        <span className="text-xs text-white/40 truncate block">{(mounted ? user?.email : undefined) || ''}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/40 hover:text-white hover:bg-white/10 shrink-0"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
