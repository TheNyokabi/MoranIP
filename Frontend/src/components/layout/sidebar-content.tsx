"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
    TrendingUp,
    UserPlus,
    Crown,
    Shield,
    Receipt,
    BarChart3,
    Boxes,
    CheckCircle2,
    ClipboardCheck,
    Building,
    HelpCircle,
    CreditCard
} from "lucide-react"
import { findTenantBySlug, useTenantStore } from "@/store/tenant-store"
import { useAuthStore } from "@/store/auth-store"
import { useModuleStore } from "@/store/module-store"
import { authApi } from "@/lib/api"

// Role badge config
const ROLE_CONFIG: Record<string, { icon: typeof Shield; color: string; bgColor: string; label: string }> = {
    ADMIN: { icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Admin' },
    MANAGER: { icon: Shield, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Manager' },
    CASHIER: { icon: Users, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Cashier' },
    VIEWER: { icon: Users, color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: 'Viewer' },
};

interface SidebarContentProps {
    tenantSlug: string;
    onNavigate?: () => void;
}

export function SidebarContent({ tenantSlug, onNavigate }: SidebarContentProps) {
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
    const tenantName = mounted && tenant?.name ? tenant.name : tenantSlug
    const isERPNext = tenant?.engine === 'erpnext'
    const isPaintShop = tenantName.includes('Paint Shop')

    const isSuperAdmin = user?.email === 'admin@moran.com'

    useEffect(() => {
        if (tenant?.id) {
            fetchTenantSettings(tenant.id)
        }
    }, [tenant?.id, fetchTenantSettings])

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

    // Feature flags (defaulting to enabled for missing/implied ones for now to show links)
    const isPosEnabled = tenantSettings?.enable_pos || isERPNext || isPaintShop
    const isInvoicingEnabled = tenantSettings?.enable_invoicing ?? true
    const isInventoryEnabled = tenantSettings?.enable_inventory ?? true
    const isHREnabled = tenantSettings?.enable_hr ?? false
    const isProjectsEnabled = tenantSettings?.enable_projects ?? false
    const isManufacturingEnabled = tenantSettings?.enable_manufacturing ?? true
    const isPurchasingEnabled = true // Assume enabled for now

    const isAdmin = userRole === 'ADMIN' || isSuperAdmin
    const isManager = userRole === 'MANAGER' || isSuperAdmin
    const isCashier = userRole === 'CASHIER'
    const canManageUsers = isAdmin || isManager

    const tenantType = tenantSlug.includes('coop') ? 'Cooperative' :
        tenantSlug.includes('sacco') ? 'Sacco' :
            tenantSlug.includes('mboga') ? 'MSME' :
                isPaintShop ? 'Retail' : 'Platform'

    const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.CASHIER
    const RoleIcon = roleConfig.icon

    if (!mounted) {
        return (
            <div className="flex h-full flex-col bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-4 border-b">
                    <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                </div>
                <div className="p-4 space-y-2">
                    <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                    <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                    <div className="h-9 rounded-md bg-muted/40 animate-pulse" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-4 border-b bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30">
                <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
                    <Link href="/dashboard" onClick={onNavigate}>
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
                        {canManageUsers && (
                            <Button variant={pathname === `/w/${tenantSlug}` ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}`}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    Overview
                                </Link>
                            </Button>
                        )}

                        {isPosEnabled && (
                            <Button variant={pathname.includes("/pos") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/pos`}>
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Point of Sale
                                </Link>
                            </Button>
                        )}

                        {isPosEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/sales") && !pathname.includes("/pos") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/sales`}>
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Sales
                                </Link>
                            </Button>
                        )}

                        {isInvoicingEnabled && (
                            <Button variant={pathname.includes("/invoices") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/invoices`}>
                                    <Receipt className="mr-2 h-4 w-4" />
                                    Invoices
                                </Link>
                            </Button>
                        )}

                        {isInventoryEnabled && (
                            <Button variant={pathname.includes("/inventory") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/inventory`}>
                                    <Boxes className="mr-2 h-4 w-4" />
                                    Inventory
                                </Link>
                            </Button>
                        )}

                        {isPurchasingEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/purchasing") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/purchasing`}>
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Purchasing
                                </Link>
                            </Button>
                        )}

                        {isManufacturingEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/manufacturing") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/manufacturing`}>
                                    <Factory className="mr-2 h-4 w-4" />
                                    Manufacturing
                                </Link>
                            </Button>
                        )}

                        {canManageUsers && (
                            <Button variant={pathname.includes("/quality") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/quality`}>
                                    <ClipboardCheck className="mr-2 h-4 w-4" />
                                    Quality
                                </Link>
                            </Button>
                        )}

                        {canManageUsers && (
                            <Button variant={pathname.includes("/assets") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/assets`}>
                                    <Building className="mr-2 h-4 w-4" />
                                    Assets
                                </Link>
                            </Button>
                        )}

                        {isHREnabled && canManageUsers && (
                            <Button variant={pathname.includes("/hr") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/hr`}>
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    Human Resources
                                </Link>
                            </Button>
                        )}

                        {isProjectsEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/projects") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/projects`}>
                                    <Briefcase className="mr-2 h-4 w-4" />
                                    Projects
                                </Link>
                            </Button>
                        )}

                        {canManageUsers && (
                            <Button variant={pathname.includes("/team") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/team`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Team
                                </Link>
                            </Button>
                        )}

                        {isAdmin && (
                            <Button variant={pathname.includes("/finance") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/finance`}>
                                    <Wallet className="mr-2 h-4 w-4" />
                                    Finance
                                </Link>
                            </Button>
                        )}

                        {isPosEnabled && canManageUsers && (
                            <Button variant={pathname.includes("/commissions") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                <Link href={`/w/${tenantSlug}/commissions`}>
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    Commissions
                                </Link>
                            </Button>
                        )}

                        {canManageUsers && (
                            <>
                                <Button variant={pathname.includes("/reports") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                    <Link href={`/w/${tenantSlug}/reports`}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Reports
                                    </Link>
                                </Button>
                                <Button variant={pathname.includes("/support") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                    <Link href={`/w/${tenantSlug}/support`}>
                                        <HelpCircle className="mr-2 h-4 w-4" />
                                        Support
                                    </Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {canManageUsers && (
                        <>
                            <Separator />
                            <div className="space-y-1">
                                <Button variant={pathname.includes("/modules/settings") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
                                    <Link href={`/w/${tenantSlug}/modules/settings/hub`}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        Configuration
                                    </Link>
                                </Button>
                                {isAdmin && (
                                    <Button variant={pathname.includes("/settings") && !pathname.includes("/modules") ? "secondary" : "ghost"} className="w-full justify-start" asChild onClick={onNavigate}>
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

            {isCashier && isPosEnabled && (
                <div className="p-4 border-t">
                    <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild onClick={onNavigate}>
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
