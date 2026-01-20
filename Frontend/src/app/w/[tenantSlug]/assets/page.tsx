"use client";

import { useState } from "react";
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
    ChevronRight,
    Search,
    Calendar,
    DollarSign,
    TrendingUp,
    AlertTriangle,
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
import { cn } from "@/lib/utils";

const mockStats = {
    totalAssets: 156,
    totalValue: 24500000,
    maintenanceDue: 8,
    depreciated: 12,
};

const mockAssets = [
    { id: "AST-001", name: "Toyota Hilux - KCH 543X", category: "Vehicles", status: "active", location: "Nairobi HQ", value: 3500000, purchaseDate: "2024-03-15" },
    { id: "AST-002", name: "MacBook Pro 16\"", category: "IT Equipment", status: "active", location: "Finance Dept", value: 350000, purchaseDate: "2024-06-20" },
    { id: "AST-003", name: "Industrial Generator 50KVA", category: "Machinery", status: "maintenance", location: "Factory", value: 1200000, purchaseDate: "2023-01-10" },
    { id: "AST-004", name: "Office Building - Mombasa", category: "Property", status: "active", location: "Mombasa", value: 15000000, purchaseDate: "2020-05-01" },
    { id: "AST-005", name: "Dell Server Rack", category: "IT Equipment", status: "depreciated", location: "Server Room", value: 800000, purchaseDate: "2019-08-22" },
];

const categoryIcons = {
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
};

export default function AssetsDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/assets${path}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const filteredAssets = mockAssets.filter(asset =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                                    <p className="text-2xl font-bold">{mockStats.totalAssets}</p>
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
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(mockStats.totalValue)}</p>
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
                                    <p className="text-2xl font-bold text-amber-600">{mockStats.maintenanceDue}</p>
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
                                    <p className="text-2xl font-bold">{mockStats.depreciated}</p>
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
                                    {filteredAssets.map((asset) => {
                                        const status = statusConfig[asset.status as keyof typeof statusConfig];
                                        const CategoryIcon = categoryIcons[asset.category as keyof typeof categoryIcons] || Building2;
                                        return (
                                            <tr
                                                key={asset.id}
                                                className="hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => navigateTo(`/${asset.id}`)}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                                            <CategoryIcon className="h-5 w-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{asset.name}</p>
                                                            <p className="text-sm text-muted-foreground font-mono">{asset.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">{asset.category}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{asset.location}</td>
                                                <td className="py-3 px-4 text-right font-medium">{formatCurrency(asset.value)}</td>
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
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.id}`); }}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View Details
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.id}/edit`); }}>
                                                                <Edit className="h-4 w-4 mr-2" />
                                                                Edit Asset
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/${asset.id}/maintenance`); }}>
                                                                <Wrench className="h-4 w-4 mr-2" />
                                                                Log Maintenance
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
