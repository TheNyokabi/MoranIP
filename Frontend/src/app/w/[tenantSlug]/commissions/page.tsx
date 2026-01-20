"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    DollarSign,
    Users,
    Calendar,
    Download,
    Filter,
    ChevronRight,
    Award,
    Target,
    Wallet,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CommissionRecord {
    id: string;
    salesPerson: string;
    period: string;
    totalSales: number;
    commissionRate: number;
    commissionAmount: number;
    status: "pending" | "approved" | "paid";
    paidDate?: string;
}

// Mock data - will be replaced with API call
const mockCommissions: CommissionRecord[] = [
    {
        id: "1",
        salesPerson: "John Kamau",
        period: "January 2026",
        totalSales: 450000,
        commissionRate: 5,
        commissionAmount: 22500,
        status: "paid",
        paidDate: "2026-02-05",
    },
    {
        id: "2",
        salesPerson: "Mary Wanjiku",
        period: "January 2026",
        totalSales: 320000,
        commissionRate: 5,
        commissionAmount: 16000,
        status: "approved",
    },
    {
        id: "3",
        salesPerson: "Peter Ochieng",
        period: "January 2026",
        totalSales: 280000,
        commissionRate: 4.5,
        commissionAmount: 12600,
        status: "pending",
    },
    {
        id: "4",
        salesPerson: "Jane Akinyi",
        period: "January 2026",
        totalSales: 180000,
        commissionRate: 4,
        commissionAmount: 7200,
        status: "pending",
    },
];

const statusConfig = {
    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    approved: { label: "Approved", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    paid: { label: "Paid", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

export default function CommissionsPage() {
    const params = useParams();
    const tenantSlug = params.tenantSlug as string;
    const [period, setPeriod] = useState("this_month");
    const [statusFilter, setStatusFilter] = useState("all");

    const filteredCommissions = mockCommissions.filter(
        (c) => statusFilter === "all" || c.status === statusFilter
    );

    const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalSales = filteredCommissions.reduce((sum, c) => sum + c.totalSales, 0);
    const pendingPayouts = filteredCommissions
        .filter((c) => c.status !== "paid")
        .reduce((sum, c) => sum + c.commissionAmount, 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Commissions</h1>
                    <p className="text-muted-foreground mt-1">
                        Track and manage sales team commissions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="last_month">Last Month</SelectItem>
                            <SelectItem value="this_quarter">This Quarter</SelectItem>
                            <SelectItem value="this_year">This Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Commissions</p>
                                <p className="text-2xl font-bold">{formatCurrency(totalCommissions)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Sales</p>
                                <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Wallet className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                                <p className="text-2xl font-bold">{formatCurrency(pendingPayouts)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <Users className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Sales Team</p>
                                <p className="text-2xl font-bold">{mockCommissions.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
                <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                >
                    All
                </Button>
                <Button
                    variant={statusFilter === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("pending")}
                >
                    Pending
                </Button>
                <Button
                    variant={statusFilter === "approved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("approved")}
                >
                    Approved
                </Button>
                <Button
                    variant={statusFilter === "paid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("paid")}
                >
                    Paid
                </Button>
            </div>

            {/* Commissions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Commission Records</CardTitle>
                    <CardDescription>
                        Sales performance and commission payouts for the selected period
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                                        Sales Person
                                    </th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                                        Period
                                    </th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                                        Total Sales
                                    </th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                                        Rate
                                    </th>
                                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                                        Commission
                                    </th>
                                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                                        Status
                                    </th>
                                    <th className="py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCommissions.map((record) => (
                                    <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-sm font-medium">
                                                        {record.salesPerson.split(" ").map((n) => n[0]).join("")}
                                                    </span>
                                                </div>
                                                <span className="font-medium">{record.salesPerson}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-muted-foreground">{record.period}</td>
                                        <td className="py-4 px-4 text-right font-medium">
                                            {formatCurrency(record.totalSales)}
                                        </td>
                                        <td className="py-4 px-4 text-right text-muted-foreground">
                                            {record.commissionRate}%
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-green-600">
                                            {formatCurrency(record.commissionAmount)}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <Badge className={cn("text-xs", statusConfig[record.status].color)}>
                                                {statusConfig[record.status].label}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Button variant="ghost" size="sm">
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Top Performers */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Top Performers</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {mockCommissions.slice(0, 3).map((record, index) => (
                        <Card key={record.id} className="relative overflow-hidden">
                            <div className={cn(
                                "absolute top-0 right-0 h-20 w-20 -mr-6 -mt-6 rounded-full",
                                index === 0 ? "bg-yellow-500/20" :
                                    index === 1 ? "bg-gray-400/20" : "bg-orange-400/20"
                            )} />
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold",
                                        index === 0 ? "bg-yellow-500" :
                                            index === 1 ? "bg-gray-400" : "bg-orange-400"
                                    )}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-medium">{record.salesPerson}</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            {formatCurrency(record.totalSales)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
