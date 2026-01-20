"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Receipt,
    CreditCard,
    Wallet,
    PiggyBank,
    ArrowUpRight,
    ArrowDownRight,
    ChevronRight,
    Search,
    Plus,
    FileText,
    BarChart3,
    Calculator,
    BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mockStats = {
    totalRevenue: 12450000,
    totalExpenses: 8200000,
    netProfit: 4250000,
    accountsReceivable: 2800000,
    accountsPayable: 1500000,
    cashOnHand: 5200000,
};

const mockRecentTransactions = [
    { id: "1", type: "income", description: "Sales Invoice - Safaricom Ltd", amount: 850000, date: "Today", category: "Sales" },
    { id: "2", type: "expense", description: "Supplier Payment - ABC Materials", amount: 320000, date: "Today", category: "COGS" },
    { id: "3", type: "income", description: "Sales Invoice - Kenya Airways", amount: 620000, date: "Yesterday", category: "Sales" },
    { id: "4", type: "expense", description: "Office Rent - January", amount: 150000, date: "Yesterday", category: "Operating" },
    { id: "5", type: "income", description: "Sales Invoice - Naivas", amount: 480000, date: "2 days ago", category: "Sales" },
];

const quickActions = [
    { label: "Journal Entry", icon: BookOpen, href: "/journals/new", color: "from-blue-500 to-indigo-600" },
    { label: "Create Invoice", icon: Receipt, href: "/invoices/new", color: "from-emerald-500 to-teal-600" },
    { label: "Record Payment", icon: CreditCard, href: "/payments/new", color: "from-purple-500 to-pink-600" },
    { label: "Generate Report", icon: BarChart3, href: "/reports", color: "from-orange-500 to-red-600" },
];

const accountingModules = [
    { label: "Journal Entries", icon: BookOpen, href: "/journals", count: 156, color: "from-blue-400 to-indigo-500" },
    { label: "General Ledger", icon: FileText, href: "/gl-entries", count: 2450, color: "from-emerald-400 to-teal-500" },
    { label: "Chart of Accounts", icon: Calculator, href: "/chart-of-accounts", count: 85, color: "from-purple-400 to-pink-500" },
    { label: "Payments", icon: CreditCard, href: "/payments", count: 342, color: "from-amber-400 to-orange-500" },
];

export default function AccountingDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/accounting${path}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const profitMargin = ((mockStats.netProfit / mockStats.totalRevenue) * 100).toFixed(1);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Accounting
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Financial management and reporting
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => navigateTo("/journals/new")} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Journal Entry
                        </Button>
                    </div>
                </div>

                {/* Main Financial Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                        <CardContent className="pt-6 relative">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-5 w-5 opacity-80" />
                                <span className="text-sm font-medium opacity-80">Total Revenue</span>
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(mockStats.totalRevenue)}</p>
                            <div className="flex items-center mt-2 text-emerald-100 text-sm">
                                <ArrowUpRight className="h-4 w-4" />
                                <span>+18% vs last month</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-red-500 to-rose-600 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                        <CardContent className="pt-6 relative">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingDown className="h-5 w-5 opacity-80" />
                                <span className="text-sm font-medium opacity-80">Total Expenses</span>
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(mockStats.totalExpenses)}</p>
                            <div className="flex items-center mt-2 text-red-100 text-sm">
                                <ArrowUpRight className="h-4 w-4" />
                                <span>+5% vs last month</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                        <CardContent className="pt-6 relative">
                            <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="h-5 w-5 opacity-80" />
                                <span className="text-sm font-medium opacity-80">Net Profit</span>
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(mockStats.netProfit)}</p>
                            <div className="flex items-center mt-2 text-blue-100 text-sm">
                                <span>{profitMargin}% profit margin</span>
                            </div>
                        </CardContent>
                    </Card>
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

                {/* Secondary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Accounts Receivable</p>
                                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(mockStats.accountsReceivable)}</p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <Receipt className="h-6 w-6 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Accounts Payable</p>
                                    <p className="text-2xl font-bold text-red-600">{formatCurrency(mockStats.accountsPayable)}</p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <CreditCard className="h-6 w-6 text-red-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Cash on Hand</p>
                                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(mockStats.cashOnHand)}</p>
                                </div>
                                <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <Wallet className="h-6 w-6 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Transactions */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Recent Transactions</CardTitle>
                                    <CardDescription>Latest financial activities</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigateTo("/journals")}>
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {mockRecentTransactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center shadow-md",
                                                tx.type === "income"
                                                    ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                                                    : "bg-gradient-to-br from-red-400 to-rose-500"
                                            )}>
                                                {tx.type === "income" ? (
                                                    <ArrowDownRight className="h-5 w-5 text-white" />
                                                ) : (
                                                    <ArrowUpRight className="h-5 w-5 text-white" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{tx.description}</p>
                                                <p className="text-xs text-muted-foreground">{tx.date} • {tx.category}</p>
                                            </div>
                                        </div>
                                        <p className={cn(
                                            "font-bold",
                                            tx.type === "income" ? "text-emerald-600" : "text-red-600"
                                        )}>
                                            {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accounting Modules */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Accounting Modules</CardTitle>
                            <CardDescription>Access financial records</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {accountingModules.map((module) => {
                                    const Icon = module.icon;
                                    return (
                                        <div
                                            key={module.label}
                                            className="group flex items-center justify-between p-4 rounded-xl border hover:shadow-md cursor-pointer transition-all duration-200"
                                            onClick={() => navigateTo(module.href)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300",
                                                    module.color
                                                )}>
                                                    <Icon className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{module.label}</p>
                                                    <p className="text-sm text-muted-foreground">{module.count.toLocaleString()} entries</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
