"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Factory,
    Hammer,
    Package,
    ClipboardList,
    TrendingUp,
    ChevronRight,
    Search,
    Plus,
    AlertCircle,
    CheckCircle2,
    Timer,
    Layers,
    Settings2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { manufacturingApi, type WorkOrder, type BOM } from "@/lib/api/manufacturing";

const quickActions = [
    { label: "New Work Order", icon: ClipboardList, href: "/work-orders/new", color: "from-orange-500 to-red-600" },
    { label: "Create BOM", icon: Layers, href: "/bom/new", color: "from-blue-500 to-indigo-600" },
    { label: "Work Centers", icon: Factory, href: "/work-centers", color: "from-emerald-500 to-teal-600" },
    { label: "Operations", icon: Settings2, href: "/operations", color: "from-purple-500 to-pink-600" },
];

const statusConfig = {
    in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Timer },
    pending_materials: { label: "Pending Materials", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertCircle },
    quality_check: { label: "Quality Check", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: CheckCircle2 },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: Layers },
    submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
    stopped: { label: "Stopped", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
};

export default function ManufacturingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [boms, setBoms] = useState<BOM[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [woData, bomData] = await Promise.all([
                    manufacturingApi.listWorkOrders(),
                    manufacturingApi.listBOMs()
                ]);
                setWorkOrders(woData.data || []);
                setBoms(bomData.data || []);
            } catch (error) {
                console.error("Failed to fetch manufacturing data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/manufacturing${path}`);
    };

    // Calculate stats
    const activeWorkOrders = workOrders.filter(wo => wo.status !== 'Completed' && wo.status !== 'Cancelled' && wo.status !== 'Stopped');
    const completedOrders = workOrders.filter(wo => wo.status === 'Completed');
    const totalBOMs = boms.length;

    const filteredWorkOrders = activeWorkOrders.filter(wo =>
        wo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wo.item_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wo.production_item || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusConfig = (status: string) => {
        const normalized = status?.toLowerCase().replace(" ", "_") || 'draft';
        if (normalized.includes('progress')) return statusConfig.in_progress;
        if (normalized.includes('material')) return statusConfig.pending_materials;
        if (normalized.includes('quality')) return statusConfig.quality_check;
        if (normalized === 'completed') return statusConfig.completed;
        if (normalized === 'stopped') return statusConfig.stopped;
        if (normalized === 'submitted') return statusConfig.submitted;
        return statusConfig.draft;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Manufacturing
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage production, BOMs, and work orders
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search active orders..."
                                className="pl-10 w-[250px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => navigateTo("/work-orders/new")} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
                            <Plus className="h-4 w-4 mr-2" />
                            New Work Order
                        </Button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Card
                                key={action.label}
                                className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                                onClick={() => navigateTo(action.href)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300",
                                            action.color
                                        )}>
                                            <Icon className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-sm">{action.label}</span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform inline-block ml-1" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4 text-orange-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Orders</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{activeWorkOrders.length}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Completed</span>
                                </div>
                                <span className="text-3xl font-bold mt-2 text-emerald-600">{completedOrders.length}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total BOMs</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{totalBOMs}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Active Work Orders */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Active Work Orders</CardTitle>
                                    <CardDescription>Current production jobs</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigateTo("/work-orders")}>
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="text-center py-8 text-muted-foreground">Loading work orders...</div>
                                ) : filteredWorkOrders.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No active work orders</div>
                                ) : (
                                    filteredWorkOrders.slice(0, 5).map((wo) => {
                                        const status = getStatusConfig(wo.status);
                                        const StatusIcon = status.icon;
                                        return (
                                            <div
                                                key={wo.name}
                                                className="p-4 rounded-xl border-l-4 border-l-slate-400 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                                onClick={() => navigateTo(`/work-orders/${wo.name}`)}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shadow-md">
                                                            <Hammer className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold">{wo.item_name || wo.production_item}</p>
                                                            <p className="text-sm text-muted-foreground">{wo.name} • {wo.qty} units</p>
                                                        </div>
                                                    </div>
                                                    <Badge className={cn("text-xs", status.color)}>
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent BOMs */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Bill of Materials</CardTitle>
                                    <CardDescription>Product assembly specifications</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigateTo("/bom")}>
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="text-center py-8 text-muted-foreground">Loading BOMs...</div>
                                ) : boms.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No BOMs found</div>
                                ) : (
                                    boms.slice(0, 5).map((bom) => (
                                        <div
                                            key={bom.name}
                                            className="p-4 rounded-xl border hover:shadow-md cursor-pointer transition-all duration-200"
                                            onClick={() => navigateTo(`/bom/${bom.name}`)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-md">
                                                        <Layers className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{bom.item_name || bom.item}</p>
                                                        <p className="text-sm text-muted-foreground">{bom.name}</p>
                                                    </div>
                                                </div>
                                                <p className="text-lg font-bold text-emerald-600">{bom.quantity} units</p>
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <Badge variant={bom.is_active ? "default" : "secondary"}>
                                                    {bom.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
