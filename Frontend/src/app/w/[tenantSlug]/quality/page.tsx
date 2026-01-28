"use client";

import { useState, useEffect } from "react";
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
    Search,
    Calendar,
    User,
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
import { qualityApi, type QualityInspection } from "@/lib/api/quality";

const statusConfig = {
    passed: { label: "Passed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertTriangle },
    submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: ClipboardCheck },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle },
};

export default function QualityDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [inspections, setInspections] = useState<QualityInspection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchInspections() {
            try {
                const response = await qualityApi.listInspections();
                setInspections(response.data || []);
            } catch (error) {
                console.error("Failed to fetch inspections:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchInspections();
    }, []);

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/quality${path}`);
    };

    // Calculate stats
    const totalInspections = inspections.length;
    const passed = inspections.filter(i => i.status === 'Passed' || i.status === 'passed').length;
    const failed = inspections.filter(i => i.status === 'Failed' || i.status === 'failed' || i.status === 'Rejected').length;
    const pending = inspections.filter(i => !['Passed', 'passed', 'Failed', 'failed', 'Rejected', 'Cancelled'].includes(i.status)).length;

    const passRate = totalInspections > 0
        ? Math.round((passed / (passed + failed + (pending > 0 ? 0 : 1)) * 100)) || 0 // Avoid NaN if 0 total
        : 0;

    const filteredInspections = inspections.filter(inspection => {
        const searchText = searchQuery.toLowerCase();
        const matchesSearch =
            inspection.name.toLowerCase().includes(searchText) ||
            (inspection.item_code || "").toLowerCase().includes(searchText) ||
            (inspection.item_name || "").toLowerCase().includes(searchText) ||
            (inspection.inspection_type || "").toLowerCase().includes(searchText);

        const statusLower = inspection.status.toLowerCase();
        const matchesStatus = statusFilter === "all" || statusLower === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusConfig = (status: string) => {
        const normalized = status.toLowerCase();
        if (normalized === 'passed') return statusConfig.passed;
        if (normalized === 'failed' || normalized === 'rejected') return statusConfig.failed;
        if (normalized === 'submitted') return statusConfig.submitted;
        if (normalized === 'cancelled') return statusConfig.cancelled;
        return statusConfig.pending;
    };

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
                                <p className="text-2xl font-bold">{totalInspections}</p>
                                <p className="text-xs text-muted-foreground">Total Inspections</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600 mb-2" />
                                <p className="text-2xl font-bold text-emerald-600">{passed}</p>
                                <p className="text-xs text-muted-foreground">Passed</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-white dark:from-red-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <XCircle className="h-6 w-6 text-red-600 mb-2" />
                                <p className="text-2xl font-bold text-red-600">{failed}</p>
                                <p className="text-xs text-muted-foreground">Failed/Rejected</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <AlertTriangle className="h-6 w-6 text-amber-600 mb-2" />
                                <p className="text-2xl font-bold text-amber-600">{pending}</p>
                                <p className="text-xs text-muted-foreground">Pending</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900 md:col-span-1 col-span-2">
                        <CardContent className="pt-6">
                            <div className="flex flex-col items-center">
                                <p className="text-sm text-muted-foreground mb-2">Pass Rate</p>
                                <p className="text-3xl font-bold text-purple-600">{passRate}%</p>
                                <Progress value={passRate} className="w-full mt-2 h-2" />
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
                            {isLoading ? (
                                <div className="text-center py-8 text-muted-foreground">Loading inspections...</div>
                            ) : filteredInspections.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No inspections found</div>
                            ) : (
                                filteredInspections.map((inspection) => {
                                    const status = getStatusConfig(inspection.status);
                                    const StatusIcon = status.icon;
                                    return (
                                        <div
                                            key={inspection.name}
                                            className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                            onClick={() => navigateTo(`/inspections/${inspection.name}`)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", status.color)}>
                                                    <StatusIcon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm text-muted-foreground">{inspection.name}</span>
                                                        <span className="text-sm text-muted-foreground">•</span>
                                                        <span className="font-mono text-sm text-muted-foreground">{inspection.inspection_type}</span>
                                                    </div>
                                                    <p className="font-medium">{inspection.item_name || inspection.item_code || "Unknown Item"}</p>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        {inspection.submitted_by && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {inspection.submitted_by}
                                                            </span>
                                                        )}
                                                        {inspection.inspection_date && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {inspection.inspection_date}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
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
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/inspections/${inspection.name}`); }}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
