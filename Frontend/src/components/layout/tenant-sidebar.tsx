"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
    Briefcase,
    LayoutDashboard,
    Users,
    Wallet,
    FileText,
    Settings,
    ArrowLeft,
    Store,
    Factory,
    ShoppingCart,
    Package,
    TrendingUp,
    UserPlus,
    Crown,
    Shield,
    Receipt,
    BarChart3,
    Boxes,
    CheckCircle2
} from "lucide-react"
import { findTenantBySlug, useTenantStore } from "@/store/tenant-store"
import { useAuthStore } from "@/store/auth-store"
import { useModuleStore } from "@/store/module-store"
import { authApi, TenantMembership } from "@/lib/api"

// Role badge config
const ROLE_CONFIG: Record<string, { icon: typeof Shield; color: string; bgColor: string; label: string }> = {
    ADMIN: { icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Admin' },
    MANAGER: { icon: Shield, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Manager' },
    CASHIER: { icon: Users, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Cashier' },
    VIEWER: { icon: Users, color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: 'Viewer' },
};

export function TenantSidebar({ tenantSlug }: { tenantSlug: string }) {
    const pathnameObj = usePathname()
    const pathname = pathnameObj || ""
    const { availableTenants } = useTenantStore()
    const { token, user } = useAuthStore()
    const { tenantSettings, fetchTenantSettings } = useModuleStore()
    
    // Prevent hydration mismatch by only using store data after mount
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    const tenant = findTenantBySlug(tenantSlug, availableTenants)
    // Use tenantSlug during SSR and initial render to prevent hydration mismatch
    // Only use tenant?.name after component is mounted on client
    const tenantName = mounted && tenant?.name ? tenant.name : tenantSlug
    const isERPNext = tenant?.engine === 'erpnext'
    const isPaintShop = tenantName.includes('Paint Shop')

    // Check if superadmin
    const isSuperAdmin = user?.email === 'admin@moran.com'

    // Fetch tenant settings on mount
    useEffect(() => {
        if (tenant?.id) {
            fetchTenantSettings(tenant.id)
        }
    }, [tenant?.id, fetchTenantSettings])

    // Fetch user's role for this tenant
    const [userRole, setUserRole] = useState<string>('CASHIER')

    useEffect(() => {
        async function fetchRole() {
            if (!token || !tenant) return
            try {
                const memberships = await authApi.getMemberships(token)
                const membership = memberships.find(m => m.id === tenant.id)
                if (membership?.role) {
                    setUserRole(membership.role)
                }
            } catch (error) {
                console.error('Failed to fetch role:', error)
            }
        }
        fetchRole()
    }, [token, tenant])

    // Get enabled features from tenant settings
    const isPosEnabled = tenantSettings?.enable_pos || isERPNext || isPaintShop
    const isInvoicingEnabled = tenantSettings?.enable_invoicing ?? true
    const isInventoryEnabled = tenantSettings?.enable_inventory ?? true
    const isHREnabled = tenantSettings?.enable_hr ?? false
    const isProjectsEnabled = tenantSettings?.enable_projects ?? false

    const isAdmin = userRole === 'ADMIN' || isSuperAdmin
    const isManager = userRole === 'MANAGER' || isSuperAdmin
    const isCashier = userRole === 'CASHIER'
    const canManageUsers = isAdmin || isManager

    // Determine type based on name
    const tenantType = tenantSlug.includes('coop') ? 'Cooperative' :
        tenantSlug.includes('sacco') ? 'Sacco' :
            tenantSlug.includes('mboga') ? 'MSME' :
                isPaintShop ? 'Retail' : 'Platform'

    const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.CASHIER
    const RoleIcon = roleConfig.icon

    // Render loading state consistently
    if (!mounted) {
        return (
            <div className="flex h-screen flex-col border-r bg-slate-50/50 dark:bg-slate-900/50 w-64 fixed left-0 top-0 z-30">
                <div className="p-4 border-b bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30">
                    <div className="text-sm text-muted-foreground">Loading workspace…</div>
                </div>
                <ScrollArea className="flex-1 px-4 py-4">
                    <div className="space-y-2">
                        <div className="h-9 rounded-md bg-muted/40" />
                        <div className="h-9 rounded-md bg-muted/40" />
                        <div className="h-9 rounded-md bg-muted/40" />
                    </div>
                </ScrollArea>
            </div>
        )
    }

    return (
        <div className="flex h-screen flex-col border-r bg-slate-50/50 dark:bg-slate-900/50 w-64 fixed left-0 top-0 z-30">
            <div className="p-4 border-b bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30">
                <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
                    <Link href="/dashboard" data-testid="nav-back-dashboard">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Dashboard
                    </Link>
                </Button>
                <div className="flex items-center gap-2 font-bold text-lg text-primary mb-2">
                    {tenantSettings?.logo_url ? (
                        <img
                            src={tenantSettings.logo_url}
                            alt={tenantSettings.company_name || tenantName}
                            className="h-8 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                    ) : (
                        <>
                            {tenantType === "MSME" ? <Store className="h-5 w-5" /> :
                                tenantType === "Cooperative" ? <Users className="h-5 w-5" /> :
                                    <Factory className="h-5 w-5" />}
                        </>
                    )}
                    <span className="truncate">{tenantSettings?.company_name || tenantName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className={`${roleConfig.bgColor} ${roleConfig.color} border-0 text-xs`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConfig.label}
                    </Badge>
                    {tenantSettings?.currency && (
                        <Badge variant="outline" className="text-xs">
                            {tenantSettings.currency}
                        </Badge>
                    )}
                    {tenantSettings?.setup_completed && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Setup
                        </Badge>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4">
                    <div className="space-y-1">
                        {/* Overview - Admin/Manager only */}
                        {canManageUsers && (
                            <Button variant={pathname === `/w/${tenantSlug}` ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}`}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    Overview
                                </Link>
                            </Button>
                        )}

                        {/* PoS - Show if enabled in settings or legacy ERPNext */}
                        {isPosEnabled && (
                            <Button variant={pathname.includes("/pos") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/pos`} data-testid="nav-pos">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Point of Sale
                                </Link>
                            </Button>
                        )}

                        {/* Sales - Admin/Manager if PoS enabled */}
                        {isPosEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/sales") && !pathname.includes("/pos") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/sales`} data-testid="nav-sales">
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Sales
                                </Link>
                            </Button>
                        )}

                        {/* Invoices - Show if invoicing enabled */}
                        {isInvoicingEnabled && (
                            <Button variant={pathname.includes("/invoices") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/invoices`} data-testid="nav-invoices">
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Invoices
                                </Link>
                            </Button>
                        )}

                        {/* Inventory - Show if inventory enabled (all users can view stock) */}
                        {isInventoryEnabled && (
                            <Button variant={pathname.includes("/inventory") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/inventory`} data-testid="nav-inventory">
                                    <Boxes className="mr-2 h-4 w-4" />
                                    Inventory
                                </Link>
                            </Button>
                        )}

                        {/* HR - Show if HR enabled */}
                        {isHREnabled && canManageUsers && (
                            <Button variant={pathname.includes("/hr") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/hr`}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Human Resources
                                </Link>
                            </Button>
                        )}

                        {/* Projects - Show if projects enabled */}
                        {isProjectsEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/projects") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/projects`}>
                                    <Briefcase className="mr-2 h-4 w-4" />
                                    Projects
                                </Link>
                            </Button>
                        )}

                        {/* Team Management - Admin/Manager only */}
                        {canManageUsers && (
                            <Button variant={pathname.includes("/team") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/team`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Team
                                </Link>
                            </Button>
                        )}

                        {/* Finance - Admin only */}
                        {isAdmin && (
                            <Button variant={pathname.includes("/finance") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/finance`} data-testid="nav-finance">
                                    <Wallet className="mr-2 h-4 w-4" />
                                    Finance
                                </Link>
                            </Button>
                        )}

                        {/* Commission Reports - Admin/Manager if PoS enabled */}
                        {isPosEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/commissions") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/commissions`}>
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    Commissions
                                </Link>
                            </Button>
                        )}

                        {/* Reports - Admin/Manager only */}
                        {canManageUsers && (
                            <Button variant={pathname.includes("/reports") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                <Link href={`/w/${tenantSlug}/reports`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Reports
                                </Link>
                            </Button>
                        )}
                    </div>

                    {canManageUsers && (
                        <>
                            <Separator />
                            <div className="space-y-1">
                                <Button variant={pathname.includes("/modules/settings") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                    <Link href={`/w/${tenantSlug}/modules/settings/hub`}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Configuration
                                    </Link>
                                </Button>
                                {isAdmin && (
                                    <Button variant={pathname.includes("/settings") && !pathname.includes("/modules") ? "secondary" : "ghost"} className="w-full justify-start" asChild>
                                        <Link href={`/w/${tenantSlug}/settings`}>
                                            <Settings className="mr-2 h-4 w-4" />
                                            Settings
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </ScrollArea>

            {/* Cashier Quick Actions */}
            {isCashier && isPosEnabled && (
                <div className="p-4 border-t">
                    <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                        <Link href={`/w/${tenantSlug}/pos`}>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Start Selling
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    )
}
