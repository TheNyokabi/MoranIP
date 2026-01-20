"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    UserPlus,
    Building2,
    Calendar,
    Clock,
    TrendingUp,
    FileText,
    ChevronRight,
    Briefcase,
    GraduationCap,
    Award,
    PalmtreeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data - will be replaced with API calls
const mockStats = {
    totalEmployees: 48,
    activeEmployees: 45,
    departments: 6,
    openPositions: 3,
    pendingLeaves: 5,
    attendanceToday: 42,
};

const mockDepartments = [
    { name: "Engineering", count: 15, head: "John Kamau" },
    { name: "Sales", count: 12, head: "Mary Wanjiku" },
    { name: "Operations", count: 8, head: "Peter Ochieng" },
    { name: "Finance", count: 6, head: "Jane Akinyi" },
    { name: "HR", count: 4, head: "Alice Mwangi" },
    { name: "Marketing", count: 3, head: "David Kiprotich" },
];

const mockRecentActivities = [
    { type: "join", name: "Sarah Njeri", role: "Software Developer", date: "2 days ago" },
    { type: "leave", name: "Michael Otieno", leaveType: "Annual Leave", days: 5, date: "Today" },
    { type: "promotion", name: "Grace Wambui", from: "Junior", to: "Senior Developer", date: "1 week ago" },
    { type: "leave", name: "James Maina", leaveType: "Sick Leave", days: 2, date: "Yesterday" },
];

const mockPendingApprovals = [
    { id: "1", type: "Leave Request", employee: "Michael Otieno", details: "Annual Leave - 5 days", status: "pending" },
    { id: "2", type: "Leave Request", employee: "James Maina", details: "Sick Leave - 2 days", status: "pending" },
    { id: "3", type: "Expense Claim", employee: "Sarah Njeri", details: "Travel - KES 15,000", status: "pending" },
];

const quickActions = [
    { label: "Add Employee", icon: UserPlus, href: "/employees/new", color: "text-green-600" },
    { label: "View Attendance", icon: Clock, href: "/attendance", color: "text-blue-600" },
    { label: "Leave Requests", icon: PalmtreeIcon, href: "/leave", color: "text-orange-600" },
    { label: "Departments", icon: Building2, href: "/departments", color: "text-purple-600" },
];

export default function HRDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;

    const navigateTo = (path: string) => {
        router.push(`/w/${tenantSlug}/hr${path}`);
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Human Resources</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your team, departments, and HR operations
                    </p>
                </div>
                <Button onClick={() => navigateTo("/employees/new")}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Employee
                </Button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                        <Card
                            key={action.label}
                            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                            onClick={() => navigateTo(action.href)}
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", action.color)}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <span className="font-medium">{action.label}</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold">{mockStats.totalEmployees}</span>
                            <span className="text-xs text-muted-foreground">Total Employees</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-green-600">{mockStats.activeEmployees}</span>
                            <span className="text-xs text-muted-foreground">Active Today</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-blue-600">{mockStats.departments}</span>
                            <span className="text-xs text-muted-foreground">Departments</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-purple-600">{mockStats.openPositions}</span>
                            <span className="text-xs text-muted-foreground">Open Positions</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-orange-600">{mockStats.pendingLeaves}</span>
                            <span className="text-xs text-muted-foreground">Pending Leaves</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold">{mockStats.attendanceToday}</span>
                            <span className="text-xs text-muted-foreground">Attendance Today</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Departments */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Departments</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => navigateTo("/departments")}>
                                View All
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {mockDepartments.map((dept) => (
                                <div
                                    key={dept.name}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                                    onClick={() => navigateTo(`/departments/${dept.name.toLowerCase()}`)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Building2 className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{dept.name}</p>
                                            <p className="text-xs text-muted-foreground">{dept.head}</p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary">{dept.count}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Pending Approvals */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Pending Approvals</CardTitle>
                            <Badge variant="destructive">{mockPendingApprovals.length}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {mockPendingApprovals.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">{item.type}</span>
                                        <Badge variant="outline" className="text-xs">Pending</Badge>
                                    </div>
                                    <p className="text-sm">{item.employee}</p>
                                    <p className="text-xs text-muted-foreground">{item.details}</p>
                                    <div className="flex gap-2 mt-3">
                                        <Button size="sm" className="flex-1">Approve</Button>
                                        <Button size="sm" variant="outline" className="flex-1">Reject</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {mockRecentActivities.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center mt-0.5",
                                        activity.type === "join" ? "bg-green-100 dark:bg-green-900/30" :
                                            activity.type === "leave" ? "bg-orange-100 dark:bg-orange-900/30" :
                                                "bg-purple-100 dark:bg-purple-900/30"
                                    )}>
                                        {activity.type === "join" && <UserPlus className="h-4 w-4 text-green-600" />}
                                        {activity.type === "leave" && <PalmtreeIcon className="h-4 w-4 text-orange-600" />}
                                        {activity.type === "promotion" && <Award className="h-4 w-4 text-purple-600" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{activity.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {activity.type === "join" && `Joined as ${activity.role}`}
                                            {activity.type === "leave" && `${activity.leaveType} - ${activity.days} days`}
                                            {activity.type === "promotion" && `Promoted from ${activity.from} to ${activity.to}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">{activity.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Employee Directory Link */}
            <Card className="mt-6">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold">Employee Directory</h3>
                                <p className="text-sm text-muted-foreground">
                                    View and manage all employee records
                                </p>
                            </div>
                        </div>
                        <Button onClick={() => navigateTo("/employees")}>
                            View All Employees
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
