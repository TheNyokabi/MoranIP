"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Factory,
    Hammer,
    Cog,
    Package,
    ClipboardList,
    TrendingUp,
    Clock,
    ChevronRight,
    Search,
    Plus,
    AlertCircle,
    CheckCircle2,
    Timer,
    Layers,
    ArrowUpRight,
    Settings2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const mockStats = {
    activeWorkOrders: 8,
    completedToday: 3,
    pendingMaterials: 2,
    efficiency: 94,
    totalBOMs: 45,
    productionValue: 2850000,
};

const mockActiveWorkOrders = [
    { id: "WO-001", product: "Office Chair Premium", quantity: 50, progress: 72, dueDate: "Today", status: "in_progress", priority: "high" },
    { id: "WO-002", product: "Executive Desk", quantity: 20, progress: 45, dueDate: "Tomorrow", status: "in_progress", priority: "medium" },
    { id: "WO-003", product: "Filing Cabinet 3-Drawer", quantity: 100, progress: 15, dueDate: "Jan 25", status: "pending_materials", priority: "low" },
    { id: "WO-004", product: "Conference Table 8-Seater", quantity: 5, progress: 90, dueDate: "Today", status: "quality_check", priority: "high" },
];

const mockRecentBOMs = [
    { id: "BOM-001", name: "Office Chair Premium", components: 15, cost: 12500, lastUpdated: "2 hours ago" },
    { id: "BOM-002", name: "Executive Desk", components: 22, cost: 35000, lastUpdated: "Yesterday" },
    { id: "BOM-003", name: "Filing Cabinet 3-Drawer", components: 18, cost: 8500, lastUpdated: "3 days ago" },
];

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
};

const priorityColors = {
    high: "border-l-red-500",
    medium: "border-l-amber-500",
    low: "border-l-slate-400",
};

export default function ManufacturingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/manufacturing${path}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
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
                                placeholder="Search work orders..."
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
                                <span className="text-3xl font-bold mt-2">{mockStats.activeWorkOrders}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Done Today</span>
                                </div>
                                <span className="text-3xl font-bold mt-2 text-emerald-600">{mockStats.completedToday}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</span>
                                </div>
                                <span className="text-3xl font-bold mt-2 text-amber-600">{mockStats.pendingMaterials}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Efficiency</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.efficiency}%</span>
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
                                <span className="text-3xl font-bold mt-2">{mockStats.totalBOMs}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Production</span>
                                </div>
                                <span className="text-2xl font-bold mt-2">{formatCurrency(mockStats.productionValue)}</span>
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
                                {mockActiveWorkOrders.map((wo) => {
                                    const StatusIcon = statusConfig[wo.status as keyof typeof statusConfig].icon;
                                    return (
                                        <div
                                            key={wo.id}
                                            className={cn(
                                                "p-4 rounded-xl border-l-4 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200",
                                                priorityColors[wo.priority as keyof typeof priorityColors]
                                            )}
                                            onClick={() => navigateTo(`/work-orders/${wo.id}`)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shadow-md">
                                                        <Hammer className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{wo.product}</p>
                                                        <p className="text-sm text-muted-foreground">{wo.id} • {wo.quantity} units</p>
                                                    </div>
                                                </div>
                                                <Badge className={cn("text-xs", statusConfig[wo.status as keyof typeof statusConfig].color)}>
                                                    <StatusIcon className="h-3 w-3 mr-1" />
                                                    {statusConfig[wo.status as keyof typeof statusConfig].label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between text-sm mb-1">
                                                        <span className="text-muted-foreground">Progress</span>
                                                        <span className="font-medium">{wo.progress}%</span>
                                                    </div>
                                                    <Progress value={wo.progress} className="h-2" />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Due</p>
                                                    <p className={cn(
                                                        "text-sm font-medium",
                                                        wo.dueDate === "Today" ? "text-red-600" : ""
                                                    )}>{wo.dueDate}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
                                {mockRecentBOMs.map((bom) => (
                                    <div
                                        key={bom.id}
                                        className="p-4 rounded-xl border hover:shadow-md cursor-pointer transition-all duration-200"
                                        onClick={() => navigateTo(`/bom/${bom.id}`)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white shadow-md">
                                                    <Layers className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{bom.name}</p>
                                                    <p className="text-sm text-muted-foreground">{bom.id}</p>
                                                </div>
                                            </div>
                                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(bom.cost)}</p>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{bom.components} components</span>
                                            <span>Updated {bom.lastUpdated}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Navigation Cards */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/work-orders")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <ClipboardList className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Work Orders</h3>
                                    <p className="text-sm text-muted-foreground">Manage production jobs</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/bom")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Layers className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Bill of Materials</h3>
                                    <p className="text-sm text-muted-foreground">Product specifications</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/work-centers")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Factory className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Work Centers</h3>
                                    <p className="text-sm text-muted-foreground">Production facilities</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
