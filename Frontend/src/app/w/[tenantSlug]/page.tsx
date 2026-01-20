"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { findTenantBySlug, useTenantStore } from "@/store/tenant-store"
import { useAuthStore } from "@/store/auth-store"
import { useModuleStore } from "@/store/module-store"
import { posApi, DailySummary, POSInvoice, apiFetch, ApiError } from "@/lib/api"
import {
    Users,
    Wallet,
    FileText,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    ShoppingCart,
    Receipt,
    CreditCard,
    Building2,
    Package,
    Briefcase,
    UserCheck,
    Settings,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    DollarSign,
    Calendar,
    Clock,
    Globe,
    Phone,
    Mail,
    MapPin,
    Zap,
    ArrowRight,
    PlusCircle,
    BarChart3,
    Boxes
} from "lucide-react"
import { LoadingSpinner } from "@/components/loading-spinner"
import { cn } from "@/lib/utils"

// Dashboard stat card - Neon Edition
function StatCard({
    title,
    value,
    description,
    trend,
    icon: Icon,
    loading = false,
    onClick,
    glowColor = 'cyan'
}: {
    title: string
    value: string
    description: string
    trend?: { value: number; isPositive: boolean }
    icon: React.ElementType
    loading?: boolean
    onClick?: () => void
    glowColor?: 'cyan' | 'purple' | 'emerald' | 'orange'
}) {
    const glowClasses = {
        cyan: 'glow-border-cyan',
        purple: 'glow-border-purple',
        emerald: 'glow-border-emerald',
        orange: 'glow-border-orange',
    }

    const iconGradients = {
        cyan: 'from-cyan-500 to-blue-600',
        purple: 'from-purple-500 to-pink-600',
        emerald: 'from-emerald-500 to-teal-600',
        orange: 'from-orange-500 to-amber-600',
    }

    return (
        <div
            className={cn(
                "obsidian-card-elevated p-6 transition-all duration-300 hover:-translate-y-1",
                glowClasses[glowColor],
                onClick && "cursor-pointer hover:shadow-2xl"
            )}
            onClick={onClick}
        >
            <div className="flex flex-row items-center justify-between space-y-0 mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <div className={`p-2.5 bg-gradient-to-br ${iconGradients[glowColor]} rounded-xl shadow-lg relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                    <Icon className="h-5 w-5 text-white relative z-10" />
                </div>
            </div>
            <div>
                {loading ? (
                    <>
                        <Skeleton className="h-8 w-24 mb-1 bg-muted" />
                        <Skeleton className="h-4 w-32 bg-muted/50" />
                    </>
                ) : (
                    <>
                        <div className="text-3xl font-bold text-foreground mb-2">{value}</div>
                        <div className="flex items-center text-xs text-muted-foreground">
                            {trend && (
                                <span className={`flex items-center mr-1 ${trend.isPositive ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {trend.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {Math.abs(trend.value)}%
                                </span>
                            )}
                            {description}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// Feature card component
function FeatureCard({
    title,
    description,
    icon: Icon,
    enabled,
    onClick,
    comingSoon = false
}: {
    title: string
    description: string
    icon: React.ElementType
    enabled: boolean
    onClick?: () => void
    comingSoon?: boolean
}) {
    return (
        <Card
            className={`relative overflow-hidden transition-all duration-200 ${enabled
                ? 'border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 hover:shadow-lg cursor-pointer'
                : 'opacity-60 hover:opacity-100'
                } ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${enabled ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                            <Icon className={`h-5 w-5 ${enabled ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        <div>
                            <CardTitle className="text-base">{title}</CardTitle>
                            <CardDescription className="text-xs">{description}</CardDescription>
                        </div>
                    </div>
                    {enabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            Disabled
                        </Badge>
                    )}
                </div>
            </CardHeader>
            {comingSoon && (
                <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                        Coming Soon
                    </Badge>
                </div>
            )}
        </Card>
    )
}

// Activity item
function ActivityItem({ title, time, type }: { title: string; time: string; type: 'info' | 'success' | 'warning' }) {
    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
    }
    return (
        <div className="flex items-center gap-3 py-2">
            <div className={`h-2 w-2 rounded-full ${colors[type]}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{title}</p>
                <p className="text-xs text-muted-foreground">{time}</p>
            </div>
        </div>
    )
}

// Format currency
function formatCurrency(amount: number, currency: string = 'KES'): string {
    if (amount >= 1000000) {
        return `${currency} ${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
        return `${currency} ${(amount / 1000).toFixed(1)}K`
    }
    return `${currency} ${amount.toFixed(0)}`
}

// Format date consistently
function formatDate(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export default function TenantDashboardPage({ params }: { params: { tenantSlug: string } }) {
    const router = useRouter()
    const { availableTenants } = useTenantStore()
    const { token, user } = useAuthStore()
    const { tenantSettings, fetchTenantSettings, loading: settingsLoading } = useModuleStore()
    const tenant = findTenantBySlug(params.tenantSlug, availableTenants)
    const tenantSlug = params.tenantSlug
    const tenantName = tenant?.name || params.tenantSlug

    // State for real data
    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState<DailySummary | null>(null)
    const [recentInvoices, setRecentInvoices] = useState<POSInvoice[]>([])
    const [cashSummary, setCashSummary] = useState<{ cash: number; mpesa: number; bank: number; total: number } | null>(null)
    const [currentDate, setCurrentDate] = useState<string>('')

    // Fetch tenant settings on mount
    useEffect(() => {
        if (tenant?.id) {
            fetchTenantSettings(tenant.id)
        }
    }, [tenant?.id, fetchTenantSettings])

    // Set date on client only
    useEffect(() => {
        setCurrentDate(formatDate(new Date()))
    }, [])

    // Load data based on enabled features
    useEffect(() => {
        async function loadData() {
            if (!token || !tenant?.id) {
                setLoading(false)
                return
            }

            // Only load PoS data if PoS is enabled
            const isPosEnabled = tenantSettings?.enable_pos || tenant?.engine === 'erpnext'

            if (isPosEnabled) {
                try {
                    const [summaryRes, invoicesRes, cashRes] = await Promise.all([
                        posApi.getDailySummary(token).catch(() => null),
                        posApi.getInvoices(token, 10).catch(() => ({ invoices: [] })),
                        posApi.getCashSummary(token).catch(() => null)
                    ])
                    setSummary(summaryRes)
                    setRecentInvoices(invoicesRes.invoices || [])
                    setCashSummary(cashRes)
                } catch (error) {
                    console.error('Failed to load dashboard data:', error)
                }
            }

            setLoading(false)
        }
        loadData()
    }, [token, tenant?.id, tenantSettings?.enable_pos, tenant?.engine])

    // Calculate setup progress
    const setupProgress = React.useMemo(() => {
        if (!tenantSettings) return 0

        const checks = [
            tenantSettings.company_name,
            tenantSettings.email,
            tenantSettings.currency,
            tenantSettings.language,
            tenantSettings.timezone,
            tenantSettings.setup_completed
        ]

        const completed = checks.filter(Boolean).length
        return Math.round((completed / checks.length) * 100)
    }, [tenantSettings])

    // Get enabled features count
    const enabledFeatures = React.useMemo(() => {
        if (!tenantSettings) return []

        const features = []
        if (tenantSettings.enable_invoicing) features.push({ name: 'Invoicing', icon: FileText, path: '/invoices' })
        if (tenantSettings.enable_pos) features.push({ name: 'Point of Sale', icon: ShoppingCart, path: '/pos' })
        if (tenantSettings.enable_inventory) features.push({ name: 'Inventory', icon: Package, path: '/inventory' })
        if (tenantSettings.enable_hr) features.push({ name: 'Human Resources', icon: UserCheck, path: '/hr' })
        if (tenantSettings.enable_projects) features.push({ name: 'Projects', icon: Briefcase, path: '/projects' })

        return features
    }, [tenantSettings])

    const currency = tenantSettings?.currency || 'KES'
    const companyName = tenantSettings?.company_name || tenantName
    const isPosEnabled = tenantSettings?.enable_pos || tenant?.engine === 'erpnext'

    // Onboarding status state
    const [onboardingStatus, setOnboardingStatus] = useState<{
        status: string;
        progress: number;
        workspace_type?: string;
    } | null>(null);

    useEffect(() => {
        if (!tenant?.id || !token) return;

        let cancelled = false;
        const checkOnboarding = async () => {
            try {
                const data = await apiFetch<any>(`/onboarding/tenants/${tenant.id}/status`);
                if (!cancelled) setOnboardingStatus(data?.data || data);
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    if (!cancelled) setOnboardingStatus({ status: 'NOT_STARTED', progress: 0 });
                    return;
                }
                console.error('Failed to check onboarding status:', err);
            }
        };

        void checkOnboarding();
        return () => {
            cancelled = true;
        };
    }, [tenant?.id, token]);

    // Loading state
    if (settingsLoading && !tenantSettings) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-obsidian-base">
            {/* Ambient Background Effects */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 right-1/4 w-[700px] h-[700px] bg-cyan-500/[0.05] dark:bg-cyan-500/[0.05] rounded-full blur-[160px] animate-pulse-slow" />
                <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-purple-500/[0.04] dark:bg-purple-500/[0.04] rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
                <div className="absolute bottom-20 right-1/3 w-[500px] h-[500px] bg-emerald-500/[0.03] dark:bg-emerald-500/[0.03] rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '3s' }} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            {tenantSettings?.logo_url ? (
                                <img
                                    src={tenantSettings.logo_url}
                                    alt={companyName}
                                    className="h-10 w-10 rounded-lg object-cover"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-white" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    {companyName}
                                </h1>
                                <p className="text-muted-foreground text-sm flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    {currentDate}
                                </p>
                            </div>
                        </div>

                        {/* Company Info Quick View */}
                        {tenantSettings && (
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                                {tenantSettings.email && (
                                    <div className="flex items-center gap-1">
                                        <Mail className="h-3 w-3" />
                                        {tenantSettings.email}
                                    </div>
                                )}
                                {tenantSettings.phone && (
                                    <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        {tenantSettings.phone}
                                    </div>
                                )}
                                {tenantSettings.city && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {tenantSettings.city}{tenantSettings.country ? `, ${tenantSettings.country}` : ''}
                                    </div>
                                )}
                                {tenantSettings.currency && (
                                    <Badge variant="outline" className="text-xs">
                                        <DollarSign className="h-3 w-3 mr-1" />
                                        {tenantSettings.currency}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                    <ThemeToggle />
                </div>

                {/* Onboarding Banner */}
                {onboardingStatus && onboardingStatus.status !== 'COMPLETED' && onboardingStatus.status !== 'NOT_STARTED' && (
                    <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 dark:border-blue-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                                            {onboardingStatus.status === 'PAUSED'
                                                ? 'Onboarding Paused'
                                                : 'Onboarding in Progress'}
                                        </p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                            {onboardingStatus.workspace_type && (
                                                <span className="mr-2">Workspace: <strong>{onboardingStatus.workspace_type}</strong></span>
                                            )}
                                            Progress: {onboardingStatus.progress.toFixed(0)}%
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => router.push(`/w/${tenantSlug}/onboarding`)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {onboardingStatus.status === 'PAUSED' ? 'Resume' : 'Continue'} Onboarding
                                    <ArrowRight className="h-3 w-3 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Onboarding Not Started Banner */}
                {onboardingStatus?.status === 'NOT_STARTED' && (
                    <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 dark:border-purple-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="h-5 w-5 text-purple-600" />
                                    <div>
                                        <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                                            Welcome! Let&apos;s Set Up Your Workspace
                                        </p>
                                        <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                                            Complete the onboarding process to configure your workspace type and enable features
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => router.push(`/w/${tenantSlug}/onboarding`)}
                                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                                >
                                    Start Onboarding
                                    <ArrowRight className="h-3 w-3 ml-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Setup Progress */}
                {setupProgress < 100 && onboardingStatus?.status === 'COMPLETED' && (
                    <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                        Complete Your Setup ({setupProgress}%)
                                    </span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings/hub`)}
                                    className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                >
                                    Complete Setup
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                            </div>
                            <Progress value={setupProgress} className="h-2" />
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                                Finish configuring your organization to unlock all features
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Stats Grid - Show based on enabled features */}
                {(isPosEnabled && (summary || loading)) && (
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <StatCard
                            title="Today's Sales"
                            value={summary ? formatCurrency(summary.total_sales, currency) : `${currency} 0`}
                            description="total revenue"
                            icon={Wallet}
                            loading={loading}
                            onClick={() => router.push(`/w/${params.tenantSlug}/sales`)}
                            glowColor="cyan"
                        />
                        <StatCard
                            title="Transactions"
                            value={summary ? summary.total_transactions.toString() : '0'}
                            description="invoices today"
                            icon={Receipt}
                            loading={loading}
                            onClick={() => router.push(`/w/${params.tenantSlug}/invoices`)}
                            glowColor="purple"
                        />
                        <StatCard
                            title="Commission Earned"
                            value={summary ? formatCurrency(summary.total_commission, currency) : `${currency} 0`}
                            description="to sales team"
                            icon={TrendingUp}
                            loading={loading}
                            onClick={() => router.push(`/w/${params.tenantSlug}/commissions`)}
                            glowColor="emerald"
                        />
                        <StatCard
                            title="Avg. Transaction"
                            value={summary && summary.total_transactions > 0
                                ? formatCurrency(summary.total_sales / summary.total_transactions, currency)
                                : `${currency} 0`}
                            description="per sale"
                            icon={ShoppingCart}
                            loading={loading}
                            glowColor="orange"
                        />
                    </div>
                )}

                {/* Enabled Features Grid */}
                {enabledFeatures.length > 0 && (
                    <Card className="mb-6">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-purple-500" />
                                        Active Features
                                    </CardTitle>
                                    <CardDescription>
                                        Your enabled modules and quick access
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings?tab=features`)}
                                >
                                    Manage
                                    <Settings className="h-3 w-3 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {enabledFeatures.map((feature) => (
                                    <FeatureCard
                                        key={feature.name}
                                        title={feature.name}
                                        description={`Access ${feature.name.toLowerCase()} module`}
                                        icon={feature.icon}
                                        enabled={true}
                                        onClick={() => router.push(`/w/${params.tenantSlug}${feature.path}`)}
                                    />
                                ))}
                                {tenantSettings && (
                                    <>
                                        {!tenantSettings.enable_invoicing && (
                                            <FeatureCard
                                                title="Invoicing"
                                                description="Bill customers and track payments"
                                                icon={FileText}
                                                enabled={false}
                                                onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings?tab=features`)}
                                            />
                                        )}
                                        {!tenantSettings.enable_pos && (
                                            <FeatureCard
                                                title="Point of Sale"
                                                description="Sell products at your store"
                                                icon={ShoppingCart}
                                                enabled={false}
                                                onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings?tab=features`)}
                                            />
                                        )}
                                        {!tenantSettings.enable_inventory && (
                                            <FeatureCard
                                                title="Inventory"
                                                description="Manage stock and products"
                                                icon={Package}
                                                enabled={false}
                                                onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings?tab=features`)}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Content Grid - Dynamic based on enabled features */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    {/* Recent Transactions - Only if PoS enabled */}
                    {isPosEnabled && (
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Receipt className="h-5 w-5" />
                                    Recent Transactions
                                </CardTitle>
                                <CardDescription>Latest sales from the PoS</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="flex items-center gap-3">
                                                <Skeleton className="h-2 w-2 rounded-full" />
                                                <div className="flex-1">
                                                    <Skeleton className="h-4 w-48 mb-1" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : recentInvoices.length > 0 ? (
                                    <div className="space-y-1">
                                        {recentInvoices.slice(0, 5).map((invoice) => (
                                            <ActivityItem
                                                key={invoice.name}
                                                title={`${invoice.name} • ${invoice.customer_type} • ${formatCurrency(invoice.grand_total, currency)}`}
                                                time={`${invoice.posting_time?.split('.')[0] || 'Today'}`}
                                                type={invoice.customer_type === 'Direct' ? 'info' : invoice.customer_type === 'Wholesaler' ? 'warning' : 'success'}
                                            />
                                        ))}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full mt-3"
                                            onClick={() => router.push(`/w/${params.tenantSlug}/invoices`)}
                                        >
                                            View All Transactions
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                                        <p className="text-sm text-muted-foreground mb-3">
                                            No transactions yet today.
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={() => router.push(`/w/${params.tenantSlug}/pos`)}
                                        >
                                            <PlusCircle className="h-4 w-4 mr-1" />
                                            Start Selling
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment Breakdown - Only if PoS enabled */}
                    {isPosEnabled && (
                        <Card className={isPosEnabled ? "col-span-3" : "col-span-full"}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Payment Methods
                                </CardTitle>
                                <CardDescription>Today&apos;s collection by type</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="flex justify-between">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-4 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                ) : cashSummary ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Wallet className="h-4 w-4 text-green-500" />
                                                Cash
                                            </span>
                                            <span className="font-medium">{formatCurrency(cashSummary.cash, currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-emerald-500" />
                                                M-Pesa
                                            </span>
                                            <span className="font-medium">{formatCurrency(cashSummary.mpesa, currency)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-blue-500" />
                                                PesaLink
                                            </span>
                                            <span className="font-medium">{formatCurrency(cashSummary.bank, currency)}</span>
                                        </div>
                                        <div className="border-t pt-3">
                                            <div className="flex justify-between items-center font-semibold">
                                                <span>Total Collected</span>
                                                <span className="text-primary">{formatCurrency(cashSummary.total, currency)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        No payments collected yet
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Default Content for non-PoS tenants */}
                    {!isPosEnabled && (
                        <>
                            <Card className="col-span-4">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        Overview
                                    </CardTitle>
                                    <CardDescription>Your workspace at a glance</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {tenantSettings ? (
                                            <>
                                                <div className="p-4 rounded-lg bg-muted/50">
                                                    <div className="text-sm font-semibold mb-2">Company Information</div>
                                                    <div className="text-xs text-muted-foreground space-y-1">
                                                        {tenantSettings.company_name && <p>• {tenantSettings.company_name}</p>}
                                                        {tenantSettings.legal_name && <p>• Legal: {tenantSettings.legal_name}</p>}
                                                        {tenantSettings.industry && <p>• Industry: {tenantSettings.industry}</p>}
                                                        {tenantSettings.employees_count && <p>• Employees: {tenantSettings.employees_count}</p>}
                                                    </div>
                                                </div>
                                                {tenantSettings.setup_completed && (
                                                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            <span className="font-medium">Setup Complete</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                                                <p className="text-sm text-muted-foreground mb-3">
                                                    Configure your workspace to get started
                                                </p>
                                                <Button
                                                    size="sm"
                                                    onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings/hub`)}
                                                >
                                                    <Settings className="h-4 w-4 mr-1" />
                                                    Go to Settings
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="col-span-3">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Zap className="h-5 w-5" />
                                        Quick Actions
                                    </CardTitle>
                                    <CardDescription>Get started quickly</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => router.push(`/w/${params.tenantSlug}/modules/settings/hub`)}
                                        >
                                            <Settings className="h-4 w-4 mr-2" />
                                            Configure Settings
                                        </Button>
                                        {tenantSettings?.enable_inventory && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => router.push(`/w/${params.tenantSlug}/inventory`)}
                                            >
                                                <Boxes className="h-4 w-4 mr-2" />
                                                Manage Inventory
                                            </Button>
                                        )}
                                        {tenantSettings?.enable_invoicing && (
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start"
                                                onClick={() => router.push(`/w/${params.tenantSlug}/invoices`)}
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                Create Invoice
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => router.push(`/w/${params.tenantSlug}/finance`)}
                                        >
                                            <Wallet className="h-4 w-4 mr-2" />
                                            View Finance
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>

                {/* Sales by Customer Type - Only if PoS enabled and data available */}
                {isPosEnabled && summary && summary.by_customer_type && Object.keys(summary.by_customer_type).length > 0 && (
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Sales by Customer Type</CardTitle>
                            <CardDescription>Breakdown of today&apos;s sales</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                {Object.entries(summary.by_customer_type).map(([type, data]) => (
                                    <div key={type} className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800">
                                        <div className="text-sm font-medium text-muted-foreground">{type}</div>
                                        <div className="text-2xl font-bold mt-1">{formatCurrency(data.total, currency)}</div>
                                        <div className="text-xs text-muted-foreground">{data.count} transaction{data.count !== 1 ? 's' : ''}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
