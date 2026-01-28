'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore, getTenantSlug } from '@/store/tenant-store';
import { ApiError, authApi, Tenant, TenantMembership } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Building2,
    Plus,
    Search,
    ArrowRight,
    Shield,
    Star,
    ChevronLeft,
    ChevronRight,
    X,
    Database,
    Layers,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Pause,
    Loader2,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Types ---
type SortOption = 'name-asc' | 'name-desc' | 'recent' | 'role';

interface ExtendedTenant extends Tenant {
    role: string;
    status?: string;
    isFavorite?: boolean;
    engineStatus?: 'online' | 'offline' | 'degraded' | 'not_provisioned';
}

// --- LocalStorage Utilities ---
function getStoredFavorites(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('workspace-favorites');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function toggleFavoriteLocal(tenantId: string): boolean {
    const favorites = getStoredFavorites();
    const newFavorites = favorites.includes(tenantId)
        ? favorites.filter(id => id !== tenantId)
        : [...favorites, tenantId];
    localStorage.setItem('workspace-favorites', JSON.stringify(newFavorites));
    return newFavorites.includes(tenantId);
}

function getRecentWorkspaces(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('recent-workspaces');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function addToRecentLocal(tenantId: string) {
    const recent = getRecentWorkspaces();
    const newRecent = [tenantId, ...recent.filter(id => id !== tenantId)].slice(0, 4);
    localStorage.setItem('recent-workspaces', JSON.stringify(newRecent));
}

// --- Utilities ---
const ROLE_COLORS = {
    OWNER: 'from-cyan-500 to-blue-600',
    ADMIN: 'from-purple-500 to-pink-600',
    MANAGER: 'from-emerald-500 to-teal-600',
    VIEWER: 'from-slate-500 to-gray-600',
    CASHIER: 'from-orange-500 to-amber-600',
};

const ROLE_PRIORITY = {
    OWNER: 1,
    ADMIN: 2,
    MANAGER: 3,
    CASHIER: 4,
    VIEWER: 5,
};

// --- Components ---

function CleanWorkspaceCard({
    tenant,
    onFavoriteToggle,
    onNavigate
}: {
    tenant: ExtendedTenant;
    onFavoriteToggle: () => void;
    onNavigate: () => void;
}) {
    const roleColor = ROLE_COLORS[tenant.role as keyof typeof ROLE_COLORS] || ROLE_COLORS.VIEWER;
    const EngineIcon = tenant.engine === 'odoo' ? Layers : Database;

    // Determine workspace state and styling
    const workspaceStatus = tenant.status || 'ACTIVE';
    const isActive = workspaceStatus === 'ACTIVE';
    const isSuspended = workspaceStatus === 'SUSPENDED';
    const isSettingUp = workspaceStatus === 'DRAFT' || workspaceStatus === 'SETTING_UP';
    const isClickable = isActive && !isSuspended && !isSettingUp;

    // Engine connectivity status (from real health checks)
    const engineStatus = tenant.engineStatus || 'offline';
    const getEngineStatusBadge = () => {
        switch (engineStatus) {
            case 'online':
                return (
                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs" title="Engine is connected and healthy">
                        <div className="h-2 w-2 rounded-full bg-green-400 mr-1.5 animate-pulse" />
                        Online
                    </Badge>
                );
            case 'degraded':
                return (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs" title="Engine is reachable but limited">
                        <div className="h-2 w-2 rounded-full bg-amber-400 mr-1.5" />
                        Degraded
                    </Badge>
                );
            case 'offline':
                return (
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-xs" title="Engine not connected / unreachable">
                        <div className="h-2 w-2 rounded-full bg-red-400 mr-1.5" />
                        Offline
                    </Badge>
                );
            case 'not_provisioned':
                return (
                    <Badge variant="outline" className="border-gray-500/30 text-gray-400 bg-gray-500/10 text-xs" title="Engine not yet attached">
                        <div className="h-2 w-2 rounded-full bg-gray-400 mr-1.5" />
                        Not Provisioned
                    </Badge>
                );
            default:
                return null;
        }
    };

    // Role label mapping
    const roleLabel = tenant.role === 'OWNER' ? 'Owner' :
        tenant.role === 'ADMIN' ? 'Admin' :
            tenant.role === 'MANAGER' ? 'Manager' :
                tenant.role === 'CASHIER' ? 'Cashier' :
                    tenant.role === 'VIEWER' ? 'Viewer' : 'Member';

    return (
        <div
            onClick={isClickable ? onNavigate : undefined}
            data-testid="workspace-card"
            data-tenant-id={tenant.id}
            data-tenant-code={tenant.code}
            data-engine={tenant.engine || 'erpnext'}
            data-workspace-status={workspaceStatus}
            data-engine-status={engineStatus}
            className={cn(
                "group relative obsidian-card-elevated glow-border p-6 transition-all duration-300",
                isClickable
                    ? "cursor-pointer hover:shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-1"
                    : "cursor-not-allowed opacity-60",
                isSuspended && "border-amber-500/30 bg-amber-500/5",
                isSettingUp && "border-blue-500/30 bg-blue-500/5"
            )}
        >
            {/* Favorite Star */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onFavoriteToggle();
                }}
                className="absolute top-4 right-4 p-1.5 hover:bg-muted/50 rounded-lg transition-colors z-10"
            >
                <Star className={cn(
                    "h-4 w-4 transition-all duration-300",
                    tenant.isFavorite ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-muted-foreground hover:text-foreground"
                )} />
            </button>

            {/* Content */}
            <div className="space-y-4">
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "h-14 w-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg font-bold text-white border border-white/20 flex-shrink-0 shadow-xl relative overflow-hidden",
                        roleColor
                    )}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                        <span className="relative z-10">{tenant.name.charAt(0).toUpperCase()}</span>
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-semibold text-foreground text-lg mb-1 truncate group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                            {tenant.name}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono truncate">{tenant.code}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn(
                            "text-xs",
                            tenant.role === 'OWNER'
                                ? "border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10"
                                : "border-border text-muted-foreground bg-muted/30"
                        )}>
                            <Shield className="h-3 w-3 mr-1" />
                            {roleLabel}
                        </Badge>

                        <Badge variant="outline" className="border-border text-muted-foreground bg-muted/30 text-xs">
                            <EngineIcon className="h-3 w-3 mr-1" />
                            {tenant.engine || 'ERPNext'}
                        </Badge>

                        {/* Engine Connectivity Status */}
                        {getEngineStatusBadge()}

                        {/* Workspace Status Badge */}
                        {isActive && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                            </Badge>
                        )}
                        {isSuspended && (
                            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Suspended
                            </Badge>
                        )}
                        {isSettingUp && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Setting up
                            </Badge>
                        )}
                    </div>

                    {isClickable && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-cyan-600 dark:text-cyan-400 text-sm font-medium">
                            Open
                            <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    )}
                    {!isClickable && (
                        <div className="flex items-center text-muted-foreground text-sm">
                            {isSuspended && "Suspended"}
                            {isSettingUp && "Setting up..."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EmptyState({
    searchTerm,
    hasFilters,
    onCreateNew,
    onJoinWorkspace,
    hasPendingInvitations = false
}: {
    searchTerm: string;
    hasFilters: boolean;
    onCreateNew: () => void;
    onJoinWorkspace?: () => void;
    hasPendingInvitations?: boolean;
}) {
    if (searchTerm || hasFilters) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
                <div className="relative mb-6">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center border border-border">
                        <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                    No matches found
                </h3>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                    Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
            </div>
        );
    }

    if (hasPendingInvitations) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
                <div className="relative mb-6">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center border border-amber-500/20">
                        <AlertCircle className="h-10 w-10 text-amber-500" />
                    </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                    You have pending invitations
                </h3>
                <p className="text-muted-foreground text-center max-w-sm mb-6">
                    You&apos;ve been invited to join workspaces. Accept the invitations to get started.
                </p>
                <div className="flex gap-3">
                    <Button
                        onClick={onJoinWorkspace}
                        variant="outline"
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        View Invitations
                    </Button>
                    <Button
                        onClick={onCreateNew}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Workspace
                    </Button>
                </div>
            </div>
        );
    }

    // New user - no workspaces
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-20 px-4">
            <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center border border-border">
                    <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-border flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
                </div>
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-2">
                You&apos;re not part of any workspace yet
            </h3>

            <p className="text-muted-foreground text-center max-w-sm mb-6">
                Get started by creating your first workspace or joining an existing one via invite link or workspace code.
            </p>

            <div className="flex gap-3">
                <Button
                    onClick={onCreateNew}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workspace
                </Button>
                {onJoinWorkspace && (
                    <Button
                        onClick={onJoinWorkspace}
                        variant="outline"
                        className="border-border hover:bg-muted"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Join Workspace
                    </Button>
                )}
            </div>
        </div>
    );
}

export function ActionDashboard() {
    const router = useRouter();
    const { user, token, logout } = useAuthStore();
    const { setAvailableTenants } = useTenantStore();

    const [memberships, setMemberships] = useState<TenantMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [engineFilter, setEngineFilter] = useState<string>('all');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [engineStatuses, setEngineStatuses] = useState<Record<string, 'online' | 'offline' | 'degraded' | 'not_provisioned'>>({});

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);

    // Fetch engine health status
    const fetchEngineHealth = async (tenantIds: string[]) => {
        if (!token || tenantIds.length === 0) return;

        try {
            const healthData = await authApi.checkEngineHealth(tenantIds, token);
            const statusMap: Record<string, 'online' | 'offline' | 'degraded' | 'not_provisioned'> = {};

            for (const [tenantId, result] of Object.entries(healthData.results)) {
                if (result.status === 'online') {
                    statusMap[tenantId] = 'online';
                } else if (result.status === 'degraded') {
                    statusMap[tenantId] = 'degraded';
                } else if (result.status === 'not_provisioned') {
                    statusMap[tenantId] = 'not_provisioned';
                } else {
                    statusMap[tenantId] = 'offline';
                }
            }

            setEngineStatuses(statusMap);
        } catch (e) {
            console.error("Failed to fetch engine health:", e);
            // Set all to offline on error
            const offlineMap: Record<string, 'offline'> = {};
            tenantIds.forEach(id => { offlineMap[id] = 'offline'; });
            setEngineStatuses(offlineMap);
        }
    };

    // Fetch workspaces function (reusable)
    const fetchWorkspaces = async () => {
        if (!token) {
            setLoading(false);
            router.replace('/login');
            return;
        }
        try {
            const mems = await authApi.getMemberships(token);
            setMemberships(mems);
            setAvailableTenants(mems.map(m => ({
                id: m.id,
                name: m.name,
                code: m.code,
                engine: m.engine,
                status: m.status
            })));

            setFavorites(getStoredFavorites());
            setRecentIds(getRecentWorkspaces());

            // Fetch engine health for all tenants
            const tenantIds = mems.map(m => m.id);
            await fetchEngineHealth(tenantIds);
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) {
                logout();
                router.replace('/login');
                return;
            }
            // Only log non-prefetch errors (prefetch failures are expected and non-critical)
            if (e instanceof Error && !e.message.includes('fetchServerResponse') && !e.message.includes('prefetch')) {
                console.error("Dashboard init error", e);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkspaces();

        // Set up polling for workspace list (every 30 seconds)
        const workspaceIntervalId = setInterval(fetchWorkspaces, 30000);

        // Set up polling for engine health (every 60 seconds)
        const healthIntervalId = setInterval(() => {
            if (memberships.length > 0) {
                const tenantIds = memberships.map(m => m.id);
                fetchEngineHealth(tenantIds);
            }
        }, 60000);

        // Refresh on window focus
        const handleWindowFocus = () => {
            fetchWorkspaces();
        };
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            clearInterval(workspaceIntervalId);
            clearInterval(healthIntervalId);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [logout, router, token, setAvailableTenants, memberships.length]);

    const displayTenants: ExtendedTenant[] = useMemo(() => {
        return memberships.map(m => ({
            id: m.id,
            name: m.name,
            code: m.code,
            engine: m.engine,
            role: m.role || 'VIEWER',
            status: m.status,
            isFavorite: favorites.includes(m.id),
            engineStatus: engineStatuses[m.id] || 'offline', // Use real engine status
        }));
    }, [memberships, favorites, engineStatuses]);

    // Filtering & Sorting
    const processedTenants = useMemo(() => {
        let result = displayTenants;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(term) ||
                t.code.toLowerCase().includes(term)
            );
        }

        if (roleFilter !== 'all') {
            result = result.filter(t => t.role === roleFilter);
        }

        if (engineFilter !== 'all') {
            result = result.filter(t => (t.engine || 'erpnext') === engineFilter);
        }

        switch (sortBy) {
            case 'name-asc':
                result.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                result.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'role':
                result.sort((a, b) => {
                    const pA = ROLE_PRIORITY[a.role as keyof typeof ROLE_PRIORITY] || 999;
                    const pB = ROLE_PRIORITY[b.role as keyof typeof ROLE_PRIORITY] || 999;
                    return pA - pB;
                });
                break;
            case 'recent':
                result.sort((a, b) => {
                    const iA = recentIds.indexOf(a.id);
                    const iB = recentIds.indexOf(b.id);
                    if (iA === -1 && iB === -1) return 0;
                    if (iA === -1) return 1;
                    if (iB === -1) return -1;
                    return iA - iB;
                });
                break;
        }

        return result;
    }, [displayTenants, searchTerm, roleFilter, engineFilter, sortBy, recentIds]);

    const favoriteTenants = processedTenants.filter(t => t.isFavorite);
    const regularTenants = processedTenants.filter(t => !t.isFavorite);

    const totalPages = Math.ceil(regularTenants.length / itemsPerPage);
    const paginatedTenants = regularTenants.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, roleFilter, engineFilter, sortBy]);

    const handleToggleFavorite = (tenantId: string) => {
        toggleFavoriteLocal(tenantId);
        setFavorites(getStoredFavorites());
    };

    const handleNavigate = (tenant: ExtendedTenant) => {
        addToRecentLocal(tenant.id);
        setRecentIds(getRecentWorkspaces());

        // Set current tenant before navigation to ensure context is available immediately
        const tenantObj = {
            id: tenant.id,
            name: tenant.name,
            code: tenant.code || tenant.id,
            engine: tenant.engine || 'erpnext',
        };
        useAuthStore.getState().setCurrentTenant(tenantObj);

        const slug = getTenantSlug(tenant);
        router.push(tenant.role === 'CASHIER' ? `/w/${slug}/pos` : `/w/${slug}`);
    };

    const firstName = user?.name?.split(' ')[0] || 'There';
    const hasFilters = roleFilter !== 'all' || engineFilter !== 'all';
    const roles = Array.from(new Set(displayTenants.map(t => t.role)));
    const engines = Array.from(new Set(displayTenants.map(t => t.engine || 'erpnext')));

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <Skeleton className="h-16 w-96 bg-white/10" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-48 rounded-xl bg-white/10" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-obsidian-base">
            {/* Ambient Background - Enhanced */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-20 left-1/4 w-[800px] h-[800px] bg-cyan-500/[0.06] dark:bg-cyan-500/[0.06] rounded-full blur-[180px] animate-pulse-slow" />
                <div className="absolute top-40 right-1/4 w-[700px] h-[700px] bg-purple-500/[0.06] dark:bg-purple-500/[0.06] rounded-full blur-[160px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-20 left-1/2 w-[600px] h-[600px] bg-emerald-500/[0.04] dark:bg-emerald-500/[0.04] rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-3">
                            <span className="text-muted-foreground">Welcome back, </span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-500 dark:from-cyan-400 dark:to-purple-400">
                                {firstName}
                            </span>
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Manage your workspaces and get started • {displayTenants.length} total
                        </p>
                    </div>

                    {/* Primary Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {/* Create Workspace */}
                        <button
                            onClick={() => router.push('/admin/workspaces')}
                            className="group relative p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-1"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 group-hover:scale-110 transition-transform">
                                    <Plus className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-cyan-400 transition-colors">
                                        Create Workspace
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Start a new workspace and become the owner
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* View Your Workspaces */}
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                                    <Building2 className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h3 className="font-semibold text-foreground mb-1">
                                        Your Workspaces
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {displayTenants.length} workspace{displayTenants.length !== 1 ? 's' : ''} available
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[250px] max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                data-testid="workspace-search"
                                className="pl-11 pr-10 h-12 bg-muted/30 border-border text-foreground placeholder:text-muted-foreground focus:border-cyan-500/50 rounded-xl"
                                placeholder="Search workspaces..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <X className="h-4 w-4 text-muted-foreground" />
                                </button>
                            )}
                        </div>

                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[140px] h-12 bg-muted/30 border-border text-foreground rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {roles.map(role => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={engineFilter} onValueChange={setEngineFilter}>
                            <SelectTrigger className="w-[140px] h-12 bg-muted/30 border-border text-foreground rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Engines</SelectItem>
                                {engines.map(engine => (
                                    <SelectItem key={engine} value={engine}>
                                        {engine === 'erpnext' ? 'ERPNext' : 'Odoo'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                            <SelectTrigger className="w-[160px] h-12 bg-muted/30 border-border text-foreground rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name-asc">Name: A → Z</SelectItem>
                                <SelectItem value="name-desc">Name: Z → A</SelectItem>
                                <SelectItem value="role">By Role</SelectItem>
                                <SelectItem value="recent">Recent</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex-1" />

                        <Button
                            onClick={() => router.push('/admin/workspaces')}
                            className="h-12 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-cyan-900/20 rounded-xl"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Workspace
                        </Button>
                    </div>
                </div>

                {/* Content */}
                {processedTenants.length === 0 ? (
                    <EmptyState
                        searchTerm={searchTerm}
                        hasFilters={hasFilters}
                        onCreateNew={() => router.push('/admin/workspaces')}
                        onJoinWorkspace={() => {
                            router.push('/admin/workspaces')
                        }}
                        hasPendingInvitations={false}
                    />
                ) : (
                    <div className="space-y-10">
                        <CardDescription className="text-cyan-100/70">Here&apos;s what&apos;s happening in your workspace today.</CardDescription>
                        <p className="text-sm font-medium text-white/90">You don&apos;t have any active workspaces.</p>
                        <p className="text-xs text-white/60 mt-1">Contact your administrator to get access or create a new one.</p>
                        <p className="text-sm font-medium text-white/90">It looks like the backend is unreachable.</p>
                        <p className="text-xs text-white/60 mt-1">Please check if the server is running and try again.</p>
                        {favoriteTenants.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                                    <h2 className="text-xl font-semibold text-foreground">Pinned</h2>
                                    <Badge className="bg-muted text-muted-foreground border-0">
                                        {favoriteTenants.length}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {favoriteTenants.map(tenant => (
                                        <CleanWorkspaceCard
                                            key={tenant.id}
                                            tenant={tenant}
                                            onFavoriteToggle={() => handleToggleFavorite(tenant.id)}
                                            onNavigate={() => handleNavigate(tenant)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {regularTenants.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                                        <h2 className="text-xl font-semibold text-foreground">
                                            {favoriteTenants.length > 0 ? 'All Workspaces' : 'Your Workspaces'}
                                        </h2>
                                        <Badge className="bg-muted text-muted-foreground border-0">
                                            {regularTenants.length}
                                        </Badge>
                                    </div>

                                    <Select
                                        value={itemsPerPage.toString()}
                                        onValueChange={(v) => setItemsPerPage(Number(v))}
                                    >
                                        <SelectTrigger className="w-[120px] h-10 bg-muted/30 border-border text-foreground text-sm rounded-lg">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="12">Show 12</SelectItem>
                                            <SelectItem value="24">Show 24</SelectItem>
                                            <SelectItem value="48">Show 48</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {paginatedTenants.map(tenant => (
                                        <CleanWorkspaceCard
                                            key={tenant.id}
                                            tenant={tenant}
                                            onFavoriteToggle={() => handleToggleFavorite(tenant.id)}
                                            onNavigate={() => handleNavigate(tenant)}
                                        />
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-6">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="border-border bg-muted/30 hover:bg-muted text-foreground disabled:opacity-30"
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            Previous
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {[...Array(totalPages)].map((_, i) => {
                                                const page = i + 1;
                                                if (
                                                    page === 1 ||
                                                    page === totalPages ||
                                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <Button
                                                            key={page}
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setCurrentPage(page)}
                                                            className={cn(
                                                                "w-10 h-10 p-0",
                                                                page === currentPage
                                                                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-400"
                                                                    : "border-border bg-muted/30 hover:bg-muted text-muted-foreground"
                                                            )}
                                                        >
                                                            {page}
                                                        </Button>
                                                    );
                                                } else if (
                                                    page === currentPage - 2 ||
                                                    page === currentPage + 2
                                                ) {
                                                    return <span key={page} className="text-muted-foreground px-2">...</span>;
                                                }
                                                return null;
                                            })}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="border-border bg-muted/30 hover:bg-muted text-foreground disabled:opacity-30"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
