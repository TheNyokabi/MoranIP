"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Briefcase,
    FolderKanban,
    Users,
    Calendar,
    Clock,
    CheckCircle2,
    Circle,
    Timer,
    Plus,
    ChevronRight,
    Search,
    Target,
    TrendingUp,
    AlertCircle,
    LayoutGrid,
    List,
    Filter,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const mockStats = {
    activeProjects: 12,
    completedTasks: 156,
    pendingTasks: 28,
    overdueTasks: 5,
    teamMembers: 24,
    totalBudget: 15600000,
};

const mockProjects = [
    {
        id: "1",
        name: "E-commerce Platform Redesign",
        client: "Safaricom Ltd",
        status: "in_progress",
        progress: 72,
        budget: 4500000,
        spent: 3240000,
        dueDate: "Feb 15, 2026",
        team: 6,
        tasks: { total: 45, completed: 32 },
        color: "from-blue-500 to-indigo-600"
    },
    {
        id: "2",
        name: "Mobile Banking App",
        client: "Equity Bank",
        status: "in_progress",
        progress: 45,
        budget: 8200000,
        spent: 3690000,
        dueDate: "Mar 30, 2026",
        team: 8,
        tasks: { total: 68, completed: 31 },
        color: "from-emerald-500 to-teal-600"
    },
    {
        id: "3",
        name: "POS System Integration",
        client: "Naivas",
        status: "on_hold",
        progress: 25,
        budget: 2800000,
        spent: 700000,
        dueDate: "Apr 10, 2026",
        team: 4,
        tasks: { total: 32, completed: 8 },
        color: "from-amber-500 to-orange-600"
    },
    {
        id: "4",
        name: "HR Management System",
        client: "KCB Group",
        status: "completed",
        progress: 100,
        budget: 3500000,
        spent: 3420000,
        dueDate: "Jan 10, 2026",
        team: 5,
        tasks: { total: 52, completed: 52 },
        color: "from-purple-500 to-pink-600"
    },
];

const mockRecentTasks = [
    { id: "1", title: "Design homepage mockups", project: "E-commerce Platform", status: "completed", priority: "high", assignee: "John K." },
    { id: "2", title: "Implement user authentication", project: "Mobile Banking App", status: "in_progress", priority: "high", assignee: "Mary W." },
    { id: "3", title: "Database schema review", project: "HR Management System", status: "completed", priority: "medium", assignee: "Peter O." },
    { id: "4", title: "API documentation", project: "POS System", status: "pending", priority: "low", assignee: "Jane A." },
    { id: "5", title: "Payment gateway integration", project: "Mobile Banking App", status: "in_progress", priority: "high", assignee: "David K." },
];

const statusConfig = {
    in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    on_hold: { label: "On Hold", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    pending: { label: "Pending", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const priorityColors = {
    high: "text-red-600 bg-red-100 dark:bg-red-900/30",
    medium: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    low: "text-slate-600 bg-slate-100 dark:bg-slate-800",
};

const taskStatusIcons = {
    completed: CheckCircle2,
    in_progress: Timer,
    pending: Circle,
};

export default function ProjectsDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/projects${path}`);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
            notation: "compact",
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                            Projects
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage projects, tasks, and timesheets
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search projects..."
                                className="pl-10 w-[200px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center border rounded-lg p-1 bg-slate-100 dark:bg-slate-800">
                            <Button
                                variant={viewMode === "grid" ? "secondary" : "ghost"}
                                size="sm"
                                className="px-3"
                                onClick={() => setViewMode("grid")}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === "list" ? "secondary" : "ghost"}
                                size="sm"
                                className="px-3"
                                onClick={() => setViewMode("list")}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button onClick={() => navigateTo("/new")} className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700">
                            <Plus className="h-4 w-4 mr-2" />
                            New Project
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs text-muted-foreground">Active</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.activeProjects}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs text-muted-foreground">Completed</span>
                                </div>
                                <span className="text-3xl font-bold mt-2 text-emerald-600">{mockStats.completedTasks}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Timer className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs text-muted-foreground">Pending</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.pendingTasks}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-xs text-muted-foreground">Overdue</span>
                                </div>
                                <span className="text-3xl font-bold mt-2 text-red-600">{mockStats.overdueTasks}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs text-muted-foreground">Team</span>
                                </div>
                                <span className="text-3xl font-bold mt-2">{mockStats.teamMembers}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-6">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                    <span className="text-xs text-muted-foreground">Budget</span>
                                </div>
                                <span className="text-2xl font-bold mt-2">{formatCurrency(mockStats.totalBudget)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Projects Grid */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Active Projects</h2>
                        <Button variant="ghost" size="sm" onClick={() => navigateTo("")}>
                            View All
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                    <div className={cn(
                        "grid gap-4",
                        viewMode === "grid" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                    )}>
                        {mockProjects.map((project) => (
                            <Card
                                key={project.id}
                                className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                                onClick={() => navigateTo(`/${project.id}`)}
                            >
                                <div className={cn("h-2 bg-gradient-to-r", project.color)} />
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{project.name}</h3>
                                            <p className="text-sm text-muted-foreground">{project.client}</p>
                                        </div>
                                        <Badge className={cn("text-xs", statusConfig[project.status as keyof typeof statusConfig].color)}>
                                            {statusConfig[project.status as keyof typeof statusConfig].label}
                                        </Badge>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Progress */}
                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-2">
                                                <span className="text-muted-foreground">Progress</span>
                                                <span className="font-medium">{project.progress}%</span>
                                            </div>
                                            <Progress value={project.progress} className="h-2" />
                                        </div>

                                        {/* Stats Row */}
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Target className="h-4 w-4" />
                                                <span>{project.tasks.completed}/{project.tasks.total} tasks</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Users className="h-4 w-4" />
                                                <span>{project.team} members</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                <span>{project.dueDate}</span>
                                            </div>
                                        </div>

                                        {/* Budget */}
                                        <div className="flex items-center justify-between pt-3 border-t">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Budget</p>
                                                <p className="font-semibold">{formatCurrency(project.budget)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Spent</p>
                                                <p className={cn(
                                                    "font-semibold",
                                                    project.spent / project.budget > 0.9 ? "text-red-600" : "text-emerald-600"
                                                )}>
                                                    {formatCurrency(project.spent)} ({Math.round(project.spent / project.budget * 100)}%)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Recent Tasks */}
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Recent Tasks</CardTitle>
                                <CardDescription>Latest task updates across projects</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => navigateTo("/tasks")}>
                                View All Tasks
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {mockRecentTasks.map((task) => {
                                const StatusIcon = taskStatusIcons[task.status as keyof typeof taskStatusIcons];
                                return (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 hover:shadow-md cursor-pointer transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <StatusIcon className={cn(
                                                "h-5 w-5",
                                                task.status === "completed" && "text-emerald-600",
                                                task.status === "in_progress" && "text-blue-600",
                                                task.status === "pending" && "text-slate-400"
                                            )} />
                                            <div>
                                                <p className={cn(
                                                    "font-medium",
                                                    task.status === "completed" && "line-through text-muted-foreground"
                                                )}>{task.title}</p>
                                                <p className="text-sm text-muted-foreground">{task.project}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge className={cn("text-xs", priorityColors[task.priority as keyof typeof priorityColors])}>
                                                {task.priority}
                                            </Badge>
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                                                {task.assignee.split(" ").map(n => n[0]).join("")}
                                            </div>
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
