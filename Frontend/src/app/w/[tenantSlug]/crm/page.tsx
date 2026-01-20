"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    UserPlus,
    Target,
    TrendingUp,
    Clock,
    ChevronRight,
    Search,
    Filter,
    MoreHorizontal,
    Phone,
    Mail,
    Building2,
    DollarSign,
    Star,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const mockStats = {
    totalCustomers: 156,
    activeLeads: 24,
    opportunities: 18,
    conversionRate: 32,
    revenueThisMonth: 2450000,
    newCustomersThisMonth: 12,
};

const mockRecentCustomers = [
    { id: "1", name: "Safaricom Ltd", type: "Enterprise", status: "active", value: 850000, lastContact: "2 hours ago" },
    { id: "2", name: "Kenya Airways", type: "Enterprise", status: "active", value: 620000, lastContact: "1 day ago" },
    { id: "3", name: "Equity Bank", type: "Enterprise", status: "prospect", value: 0, lastContact: "3 days ago" },
    { id: "4", name: "Twiga Foods", type: "SME", status: "active", value: 180000, lastContact: "1 week ago" },
];

const mockTopOpportunities = [
    { id: "1", name: "ERP Implementation", customer: "Safaricom Ltd", value: 2500000, stage: "Negotiation", probability: 75 },
    { id: "2", name: "POS System Upgrade", customer: "Naivas Supermarkets", value: 1800000, stage: "Proposal", probability: 60 },
    { id: "3", name: "HR Module Setup", customer: "KCB Group", value: 950000, stage: "Qualification", probability: 40 },
];

const quickActions = [
    { label: "Add Customer", icon: UserPlus, href: "/customers/new", color: "from-emerald-500 to-teal-600" },
    { label: "New Lead", icon: Target, href: "/leads/new", color: "from-blue-500 to-indigo-600" },
    { label: "Create Opportunity", icon: TrendingUp, href: "/opportunities/new", color: "from-purple-500 to-pink-600" },
    { label: "Log Activity", icon: Clock, href: "/activities/new", color: "from-orange-500 to-red-600" },
];

export default function CRMDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/crm${path}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Customer Relationship Management
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage leads, customers, and sales opportunities
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search customers..."
                                className="pl-10 w-[250px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => navigateTo("/customers/new")} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Customer
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
                                    <Users className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Customers</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.totalCustomers}</span>
                                <div className="flex items-center mt-1 text-emerald-600 text-xs">
                                    <ArrowUpRight className="h-3 w-3" />
                                    <span>+{mockStats.newCustomersThisMonth} this month</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Active Leads</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.activeLeads}</span>
                                <div className="flex items-center mt-1 text-muted-foreground text-xs">
                                    <span>In pipeline</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Opportunities</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.opportunities}</span>
                                <div className="flex items-center mt-1 text-purple-600 text-xs">
                                    <ArrowUpRight className="h-3 w-3" />
                                    <span>+5 this week</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Star className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conversion</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.conversionRate}%</span>
                                <div className="flex items-center mt-1 text-emerald-600 text-xs">
                                    <ArrowUpRight className="h-3 w-3" />
                                    <span>+3% vs last month</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 md:col-span-2">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Revenue This Month</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{formatCurrency(mockStats.revenueThisMonth)}</span>
                                <div className="flex items-center mt-1 text-emerald-600 text-xs">
                                    <ArrowUpRight className="h-3 w-3" />
                                    <span>+18% vs last month</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Customers */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Recent Customers</CardTitle>
                                    <CardDescription>Latest customer interactions</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigateTo("/customers")}>
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {mockRecentCustomers.map((customer) => (
                                    <div
                                        key={customer.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        onClick={() => navigateTo(`/customers/${customer.id}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg">
                                                {customer.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{customer.name}</p>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Badge variant="secondary" className="text-xs">{customer.type}</Badge>
                                                    <span>•</span>
                                                    <span>{customer.lastContact}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {customer.value > 0 ? (
                                                <p className="font-bold text-emerald-600">{formatCurrency(customer.value)}</p>
                                            ) : (
                                                <Badge variant="outline" className="text-amber-600 border-amber-200">Prospect</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Opportunities */}
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg">Top Opportunities</CardTitle>
                                    <CardDescription>Highest value deals in pipeline</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => navigateTo("/opportunities")}>
                                    View All
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {mockTopOpportunities.map((opp) => (
                                    <div
                                        key={opp.id}
                                        className="p-4 rounded-xl border hover:shadow-md cursor-pointer transition-all duration-200"
                                        onClick={() => navigateTo(`/opportunities/${opp.id}`)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="font-semibold">{opp.name}</p>
                                                <p className="text-sm text-muted-foreground">{opp.customer}</p>
                                            </div>
                                            <p className="text-lg font-bold text-emerald-600">{formatCurrency(opp.value)}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Badge
                                                className={cn(
                                                    "text-xs",
                                                    opp.stage === "Negotiation" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                                                    opp.stage === "Proposal" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                                                    opp.stage === "Qualification" && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                                                )}
                                            >
                                                {opp.stage}
                                            </Badge>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all",
                                                            opp.probability >= 70 ? "bg-emerald-500" :
                                                                opp.probability >= 50 ? "bg-blue-500" : "bg-amber-500"
                                                        )}
                                                        style={{ width: `${opp.probability}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium">{opp.probability}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Navigation Cards */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/customers")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Users className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Customers</h3>
                                    <p className="text-sm text-muted-foreground">Manage customer records</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/leads")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Target className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Leads</h3>
                                    <p className="text-sm text-muted-foreground">Track sales leads</p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="group cursor-pointer border-0 shadow-lg hover:shadow-xl transition-all duration-300" onClick={() => navigateTo("/opportunities")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <TrendingUp className="h-7 w-7 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">Opportunities</h3>
                                    <p className="text-sm text-muted-foreground">Sales pipeline</p>
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
