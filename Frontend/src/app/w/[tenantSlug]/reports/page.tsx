"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Download,
    Calendar,
    BarChart3,
    TrendingUp,
    Users,
    Package,
    DollarSign,
    Filter,
    RefreshCw,
    FileSpreadsheet,
    Printer,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ReportCard {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    category: "sales" | "inventory" | "finance" | "hr";
    status: "available" | "coming_soon";
}

const reports: ReportCard[] = [
    {
        id: "sales-summary",
        title: "Sales Summary",
        description: "Daily, weekly, and monthly sales overview with trends",
        icon: TrendingUp,
        category: "sales",
        status: "available",
    },
    {
        id: "sales-by-product",
        title: "Sales by Product",
        description: "Product performance analysis and top sellers",
        icon: BarChart3,
        category: "sales",
        status: "available",
    },
    {
        id: "sales-by-person",
        title: "Sales by Sales Person",
        description: "Individual salesperson performance metrics",
        icon: Users,
        category: "sales",
        status: "available",
    },
    {
        id: "inventory-valuation",
        title: "Inventory Valuation",
        description: "Current stock value by warehouse and category",
        icon: Package,
        category: "inventory",
        status: "available",
    },
    {
        id: "stock-movement",
        title: "Stock Movement",
        description: "Track stock in/out movements over time",
        icon: RefreshCw,
        category: "inventory",
        status: "available",
    },
    {
        id: "profit-loss",
        title: "Profit & Loss",
        description: "Income, expenses, and net profit summary",
        icon: DollarSign,
        category: "finance",
        status: "coming_soon",
    },
    {
        id: "accounts-receivable",
        title: "Accounts Receivable",
        description: "Outstanding customer invoices and aging",
        icon: FileText,
        category: "finance",
        status: "coming_soon",
    },
    {
        id: "attendance-summary",
        title: "Attendance Summary",
        description: "Employee attendance and leave tracking",
        icon: Calendar,
        category: "hr",
        status: "coming_soon",
    },
];

const categories = [
    { value: "all", label: "All Reports" },
    { value: "sales", label: "Sales" },
    { value: "inventory", label: "Inventory" },
    { value: "finance", label: "Finance" },
    { value: "hr", label: "HR" },
];

export default function ReportsPage() {
    const params = useParams();
    const tenantSlug = params.tenantSlug as string;
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [dateRange, setDateRange] = useState("this_month");

    const filteredReports = reports.filter(
        (report) => selectedCategory === "all" || report.category === selectedCategory
    );

    const handleGenerateReport = (reportId: string) => {
        // TODO: Implement report generation
        console.log(`Generating report: ${reportId}`);
    };

    const handleExportReport = (reportId: string, format: "pdf" | "csv" | "excel") => {
        // TODO: Implement report export
        console.log(`Exporting ${reportId} as ${format}`);
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Reports</h1>
                    <p className="text-muted-foreground mt-1">
                        Generate and export business reports
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="this_week">This Week</SelectItem>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="this_quarter">This Quarter</SelectItem>
                            <SelectItem value="this_year">This Year</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((category) => (
                    <Button
                        key={category.value}
                        variant={selectedCategory === category.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(category.value)}
                    >
                        {category.label}
                    </Button>
                ))}
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map((report) => {
                    const Icon = report.icon;
                    const isAvailable = report.status === "available";

                    return (
                        <Card
                            key={report.id}
                            className={cn(
                                "relative overflow-hidden transition-all hover:shadow-md",
                                !isAvailable && "opacity-60"
                            )}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    {!isAvailable && (
                                        <Badge variant="secondary" className="text-xs">
                                            Coming Soon
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg mt-3">{report.title}</CardTitle>
                                <CardDescription>{report.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="flex-1"
                                        disabled={!isAvailable}
                                        onClick={() => handleGenerateReport(report.id)}
                                    >
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        View
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!isAvailable}
                                        onClick={() => handleExportReport(report.id, "pdf")}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!isAvailable}
                                        onClick={() => handleExportReport(report.id, "excel")}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Quick Stats */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Reports Generated</p>
                                <p className="text-2xl font-bold">24</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Download className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Exports This Month</p>
                                <p className="text-2xl font-bold">156</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Scheduled Reports</p>
                                <p className="text-2xl font-bold">3</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Printer className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Print Jobs</p>
                                <p className="text-2xl font-bold">12</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
