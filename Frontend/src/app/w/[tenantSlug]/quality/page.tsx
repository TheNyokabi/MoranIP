"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    ClipboardCheck,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Plus,
    ChevronRight,
    Search,
    Calendar,
    User,
    Package,
    MoreVertical,
    Eye,
    FileText,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const mockStats = {
    totalInspections: 245,
    passed: 220,
    failed: 15,
    pending: 10,
    passRate: 90,
};

const mockInspections = [
    { id: "QC-001", product: "Office Chair Premium", batch: "BCH-2024-001", inspector: "John K.", status: "passed", date: "Today", score: 98 },
    { id: "QC-002", product: "Executive Desk", batch: "BCH-2024-002", inspector: "Mary W.", status: "passed", date: "Today", score: 95 },
    { id: "QC-003", product: "Filing Cabinet", batch: "BCH-2024-003", inspector: "Peter O.", status: "failed", date: "Yesterday", score: 72 },
    { id: "QC-004", product: "Conference Table", batch: "BCH-2024-004", inspector: "Jane A.", status: "pending", date: "Yesterday", score: null },
    { id: "QC-005", product: "Printer Paper A4", batch: "BCH-2024-005", inspector: "David K.", status: "passed", date: "2 days ago", score: 100 },
];

const statusConfig = {
    passed: { label: "Passed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertTriangle },
};

export default function QualityDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/quality${path}`);
    };

    const filteredInspections = mockInspections.filter(inspection => {
        const matchesSearch = inspection.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inspection.batch.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || inspection.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Quality Control
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage inspections and quality standards
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => navigateTo("/inspections/new")} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                            <Plus className="h-4 w-4 mr-2" />
                            New Inspection
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <ClipboardCheck className="h-6 w-6 text-blue-600 mb-2" />
                                <p className="text-2xl font-bold">{mockStats.totalInspections}</p>
                                <p className="text-xs text-muted-foreground">Total Inspections</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
                                <p className="text-2xl font-bold text-emerald-600">{mockStats.passed}</p>
                                <p className="text-xs text-muted-foreground">Passed</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <XCircle className="h-6 w-6 text-red-600 mb-2" />
                                <p className="text-2xl font-bold text-red-600">{mockStats.failed}</p>
                                <p className="text-xs text-muted-foreground">Failed</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <AlertTriangle className="h-6 w-6 text-amber-600 mb-2" />
                                <p className="text-2xl font-bold text-amber-600">{mockStats.pending}</p>
                                <p className="text-xs text-muted-foreground">Pending</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 md:col-span-1 col-span-2">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <p className="text-sm text-muted-foreground mb-2">Pass Rate</p>
                                <p className="text-3xl font-bold text-purple-600">{mockStats.passRate}%</p>
                                <Progress value={mockStats.passRate} className="w-full mt-2 h-2" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search inspections..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["all", "passed", "failed", "pending"].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Inspections List */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Recent Inspections</CardTitle>
                        <CardDescription>Quality control inspection records</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {filteredInspections.map((inspection) => {
                                const status = statusConfig[inspection.status as keyof typeof statusConfig];
                                const StatusIcon = status.icon;
                                return (
                                    <div
                                        key={inspection.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                        onClick={() => navigateTo(`/inspections/${inspection.id}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", status.color)}>
                                                <StatusIcon className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm text-muted-foreground">{inspection.id}</span>
                                                    <span className="text-sm text-muted-foreground">•</span>
                                                    <span className="font-mono text-sm text-muted-foreground">{inspection.batch}</span>
                                                </div>
                                                <p className="font-medium">{inspection.product}</p>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {inspection.inspector}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {inspection.date}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {inspection.score !== null && (
                                                <div className="text-right">
                                                    <p className={cn(
                                                        "text-2xl font-bold",
                                                        inspection.score >= 90 ? "text-emerald-600" :
                                                            inspection.score >= 75 ? "text-amber-600" : "text-red-600"
                                                    )}>
                                                        {inspection.score}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Score</p>
                                                </div>
                                            )}
                                            <Badge variant="outline" className={status.color}>
                                                {status.label}
                                            </Badge>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/inspections/${inspection.id}`); }}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/inspections/${inspection.id}/report`); }}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Generate Report
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
