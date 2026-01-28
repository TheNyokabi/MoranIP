"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Building2,
    Laptop,
    Car,
    Wrench,
    Plus,
    Search,
    DollarSign,
    TrendingUp,
    MoreVertical,
    Eye,
    Edit,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency } from "@/lib/utils";
import { assetsApi, type Asset } from "@/lib/api/assets";

const categoryIcons: Record<string, any> = {
    Vehicles: Car,
    "IT Equipment": Laptop,
    Machinery: Wrench,
    Property: Building2,
};

const statusConfig = {
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    maintenance: { label: "Maintenance", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    depreciated: { label: "Depreciated", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
    disposed: { label: "Disposed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
    submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

export default function AssetsDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchAssets() {
            try {
                const response = await assetsApi.listAssets();
                setAssets(response.data || []);
            } catch (error) {
                console.error("Failed to fetch assets:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchAssets();
    }, []);

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/assets${path}`);
    };

    // Calculate dynamic stats
    const totalAssets = assets.length;
    const totalValue = assets.reduce((acc, asset) => acc + (asset.current_value || asset.purchase_amount || 0), 0);
    const maintenanceDue = assets.filter(a => a.status === 'In Maintenance' || a.status === 'Maintenance').length; // Adjust based on actual ERP statuses
    const depreciated = assets.filter(a => a.status === 'Fully Depreciated' || a.status === 'Partially Depreciated').length;

    const filteredAssets = assets.filter(asset =>
        asset.asset_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.asset_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusConfig = (status: string) => {
        const normalized = status?.toLowerCase() || 'draft';
        if (normalized.includes('active') || normalized === 'submitted') return statusConfig.active;
        if (normalized.includes('maintenance')) return statusConfig.maintenance;
        if (normalized.includes('depreciated')) return statusConfig.depreciated;
        if (normalized.includes('sold') || normalized.includes('scrapped')) return statusConfig.disposed;
        return statusConfig.draft;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Assets
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage fixed assets and maintenance schedules
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => navigateTo("/new")} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Asset
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Assets</p>
                                    <p className="text-2xl font-bold">{totalAssets}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Value</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalValue)}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <DollarSign className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Maintenance Due</p>
                                    <p className="text-2xl font-bold text-amber-600">{maintenanceDue}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <Wrench className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Depreciated</p>
                                    <p className="text-2xl font-bold">{depreciated}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-slate-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search assets..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={() => navigateTo("/maintenance")}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Maintenance Log
                    </Button>
                </div>

                {/* Assets List */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Asset Register</CardTitle>
                        <CardDescription>All registered fixed assets</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Asset</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Location</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                                        <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Loading assets...
                                            </td>
                                        </tr>
                                    ) : filteredAssets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No assets found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAssets.map((asset) => {
                                            const status = getStatusConfig(asset.status);
                                            const CategoryIcon = categoryIcons[asset.asset_category] || Building2;
                                            return (
                                                <tr
                                                    key={asset.name}
                                                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                                                    onClick={() => navigateTo(`/${asset.name}`)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                                                <CategoryIcon className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium">{asset.asset_name}</p>
                                                                <p className="text-sm text-muted-foreground font-mono">{asset.name}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">{asset.asset_category}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{asset.location || "N/A"}</td>
                                                    <td className="py-3 px-4 text-right font-medium">{formatCurrency(asset.current_value || asset.purchase_amount || 0)}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <Badge className={cn("text-xs", status.color)}>
                                                            {status.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button variant="ghost" size="icon">
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.name}`); }}>
                                                                    <Eye className="h-4 w-4 mr-2" />
                                                                    View Details
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.name}/edit`); }}>
                                                                    <Edit className="h-4 w-4 mr-2" />
                                                                    Edit Asset
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.name}/maintenance`); }}>
                                                                    <Wrench className="h-4 w-4 mr-2" />
                                                                    Log Maintenance
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
