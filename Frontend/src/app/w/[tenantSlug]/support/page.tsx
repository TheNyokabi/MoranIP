"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    HeadphonesIcon,
    AlertCircle,
    CheckCircle2,
    Clock,
    Plus,
    ChevronRight,
    Search,
    MessageSquare,
    User,
    Calendar,
    MoreVertical,
    Eye,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const mockStats = {
    openTickets: 12,
    pendingResponse: 5,
    resolvedToday: 8,
    avgResponseTime: "2.5 hrs",
};

const mockTickets = [
    { id: "TKT-001", subject: "Cannot login to system", customer: "John Kamau", status: "open", priority: "high", created: "2 hours ago", assignee: "Support Team" },
    { id: "TKT-002", subject: "Invoice not generating correctly", customer: "Mary Wanjiku", status: "pending", priority: "medium", created: "5 hours ago", assignee: "Jane A." },
    { id: "TKT-003", subject: "Request for feature enhancement", customer: "Safaricom Ltd", status: "open", priority: "low", created: "Yesterday", assignee: "Unassigned" },
    { id: "TKT-004", subject: "Payment gateway timeout", customer: "Kenya Airways", status: "in_progress", priority: "high", created: "Yesterday", assignee: "David K." },
    { id: "TKT-005", subject: "Report export issue", customer: "Naivas", status: "resolved", priority: "medium", created: "2 days ago", assignee: "Peter O." },
];

const statusConfig = {
    open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
    pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
    in_progress: { label: "In Progress", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Clock },
    resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
};

const priorityColors = {
    high: "text-red-600 bg-red-100 dark:bg-red-900/30",
    medium: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    low: "text-slate-600 bg-slate-100 dark:bg-slate-800",
};

export default function SupportDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/support${path}`);
    };

    const filteredTickets = mockTickets.filter(ticket => {
        const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.customer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Support
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage customer tickets and support requests
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => navigateTo("/issues/new")} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                            <Plus className="h-4 w-4 mr-2" />
                            New Ticket
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Open Tickets</p>
                                    <p className="text-2xl font-bold text-blue-600">{mockStats.openTickets}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <AlertCircle className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Pending Response</p>
                                    <p className="text-2xl font-bold text-amber-600">{mockStats.pendingResponse}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <Clock className="h-5 w-5 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Resolved Today</p>
                                    <p className="text-2xl font-bold text-emerald-600">{mockStats.resolvedToday}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Avg Response</p>
                                    <p className="text-2xl font-bold text-purple-600">{mockStats.avgResponseTime}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <HeadphonesIcon className="h-5 w-5 text-purple-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search tickets..."
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["all", "open", "pending", "in_progress", "resolved"].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === "all" ? "All" : status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Tickets List */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Support Tickets</CardTitle>
                        <CardDescription>Manage and respond to customer issues</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {filteredTickets.map((ticket) => {
                                const status = statusConfig[ticket.status as keyof typeof statusConfig];
                                const StatusIcon = status.icon;
                                return (
                                    <div
                                        key={ticket.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                        onClick={() => navigateTo(`/issues/${ticket.id}`)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", status.color)}>
                                                <StatusIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm text-muted-foreground">{ticket.id}</span>
                                                    <Badge className={cn("text-xs", priorityColors[ticket.priority as keyof typeof priorityColors])}>
                                                        {ticket.priority}
                                                    </Badge>
                                                </div>
                                                <p className="font-medium">{ticket.subject}</p>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {ticket.customer}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {ticket.created}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
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
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/issues/${ticket.id}`); }}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/issues/${ticket.id}/reply`); }}>
                                                        <MessageSquare className="h-4 w-4 mr-2" />
                                                        Reply
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
