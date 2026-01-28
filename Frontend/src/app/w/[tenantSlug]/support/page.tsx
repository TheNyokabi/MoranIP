"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Plus,
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
import { supportApi, type Issue } from "@/lib/api/support";

const statusConfig = {
    Open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
    Replied: { label: "Replied", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: MessageSquare },
    "On Hold": { label: "On Hold", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
    Resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
    Closed: { label: "Closed", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: CheckCircle2 },
};

const priorityColors = {
    High: "text-red-600 bg-red-100 dark:bg-red-900/30",
    Medium: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    Low: "text-slate-600 bg-slate-100 dark:bg-slate-800",
};

export default function SupportDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [tickets, setTickets] = useState<Issue[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchTickets() {
            try {
                const response = await supportApi.listIssues();
                setTickets(response.data || []);
            } catch (error) {
                console.error("Failed to fetch support tickets:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchTickets();
    }, []);

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/support${path}`);
    };

    // Stats
    const openTickets = tickets.filter(t => t.status === 'Open').length;
    const pendingResponse = tickets.filter(t => t.status === 'Open' || t.status === 'Replied').length; // Rough approximation
    const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch = ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ticket.customer || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getPriorityColor = (priority?: string) => {
        if (!priority) return priorityColors["Low"];
        return priorityColors[priority as keyof typeof priorityColors] || priorityColors["Low"];
    };

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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-slate-900">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Open Tickets</p>
                                    <p className="text-2xl font-bold text-blue-600">{openTickets}</p>
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
                                    <p className="text-sm text-muted-foreground">Pending / Active</p>
                                    <p className="text-2xl font-bold text-amber-600">{pendingResponse}</p>
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
                                    <p className="text-sm text-muted-foreground">Resolved</p>
                                    <p className="text-2xl font-bold text-emerald-600">{resolved}</p>
                                </div>
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
                        {["all", "Open", "Replied", "Resolved", "Closed"].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status === "all" ? "All" : status}
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
                            {isLoading ? (
                                <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No tickets found</div>
                            ) : (
                                filteredTickets.map((ticket) => {
                                    const status = statusConfig[ticket.status as keyof typeof statusConfig] || statusConfig.Open;
                                    const StatusIcon = status.icon;
                                    return (
                                        <div
                                            key={ticket.name}
                                            className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                            onClick={() => navigateTo(`/issues/${ticket.name}`)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", status.color)}>
                                                    <StatusIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm text-muted-foreground">{ticket.name}</span>
                                                        <Badge className={cn("text-xs", getPriorityColor(ticket.priority))}>
                                                            {ticket.priority || 'Low'}
                                                        </Badge>
                                                    </div>
                                                    <p className="font-medium">{ticket.subject}</p>
                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                        {ticket.customer && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {ticket.customer}
                                                            </span>
                                                        )}
                                                        {ticket.opening_date && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {ticket.opening_date}
                                                            </span>
                                                        )}
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
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/issues/${ticket.name}`); }}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateTo(`/issues/${ticket.name}/reply`); }}>
                                                            <MessageSquare className="h-4 w-4 mr-2" />
                                                            Reply
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
