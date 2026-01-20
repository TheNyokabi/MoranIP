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
    Search,
    MoreHorizontal,
    Phone,
    Mail,
    MapPin,
    Building2,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    Edit,
    Trash2,
    Briefcase,
    Calendar,
    LayoutGrid,
    List,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Employee {
    id: string;
    name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
    status: "active" | "inactive" | "on_leave";
    joinDate: string;
    avatar?: string;
}

const mockEmployees: Employee[] = [
    { id: "1", name: "John Kamau", email: "john.kamau@company.com", phone: "+254 722 111 222", designation: "Senior Software Engineer", department: "Engineering", status: "active", joinDate: "2023-03-15" },
    { id: "2", name: "Mary Wanjiku", email: "mary.wanjiku@company.com", phone: "+254 733 222 333", designation: "Sales Manager", department: "Sales", status: "active", joinDate: "2022-08-20" },
    { id: "3", name: "Peter Ochieng", email: "peter.ochieng@company.com", phone: "+254 711 333 444", designation: "Operations Lead", department: "Operations", status: "on_leave", joinDate: "2023-01-10" },
    { id: "4", name: "Jane Akinyi", email: "jane.akinyi@company.com", phone: "+254 722 444 555", designation: "Finance Manager", department: "Finance", status: "active", joinDate: "2021-06-05" },
    { id: "5", name: "Alice Mwangi", email: "alice.mwangi@company.com", phone: "+254 733 555 666", designation: "HR Manager", department: "Human Resources", status: "active", joinDate: "2022-02-28" },
    { id: "6", name: "David Kiprotich", email: "david.kiprotich@company.com", phone: "+254 711 666 777", designation: "Marketing Specialist", department: "Marketing", status: "active", joinDate: "2024-01-15" },
    { id: "7", name: "Sarah Njeri", email: "sarah.njeri@company.com", phone: "+254 722 777 888", designation: "Software Developer", department: "Engineering", status: "active", joinDate: "2024-06-01" },
    { id: "8", name: "Michael Otieno", email: "michael.otieno@company.com", phone: "+254 733 888 999", designation: "Product Manager", department: "Product", status: "inactive", joinDate: "2023-09-10" },
];

const statusConfig = {
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    inactive: { label: "Inactive", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
    on_leave: { label: "On Leave", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

const departmentColors: Record<string, string> = {
    Engineering: "from-blue-400 to-indigo-500",
    Sales: "from-emerald-400 to-teal-500",
    Operations: "from-orange-400 to-red-500",
    Finance: "from-violet-400 to-purple-500",
    "Human Resources": "from-pink-400 to-rose-500",
    Marketing: "from-cyan-400 to-blue-500",
    Product: "from-amber-400 to-orange-500",
};

export default function EmployeesListPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");

    const departments = [...new Set(mockEmployees.map((e) => e.department))];

    const filteredEmployees = mockEmployees.filter((employee) => {
        const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            employee.designation.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter;
        const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
        return matchesSearch && matchesDepartment && matchesStatus;
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const getDepartmentColor = (dept: string) => departmentColors[dept] || "from-slate-400 to-slate-500";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href={`/w/${tenantSlug}/hr`} className="hover:text-foreground transition-colors">
                        Human Resources
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-foreground font-medium">Employees</span>
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Employees</h1>
                        <p className="text-muted-foreground mt-1">
                            {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""} found
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button
                            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                            onClick={() => router.push(`/w/${tenantSlug}/hr/employees/new`)}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Employee
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card className="mb-6 border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search employees..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="on_leave">On Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Grid View */}
                {viewMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredEmployees.map((employee) => (
                            <Card
                                key={employee.id}
                                className="group border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                                onClick={() => router.push(`/w/${tenantSlug}/hr/employees/${employee.id}`)}
                            >
                                <div className={cn("h-2 bg-gradient-to-r", getDepartmentColor(employee.department))} />
                                <CardContent className="p-6">
                                    <div className="flex flex-col items-center text-center">
                                        <div className={cn(
                                            "h-20 w-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300",
                                            getDepartmentColor(employee.department)
                                        )}>
                                            {employee.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                        </div>
                                        <h3 className="font-bold text-lg">{employee.name}</h3>
                                        <p className="text-sm text-muted-foreground">{employee.designation}</p>
                                        <Badge className={cn("mt-3", statusConfig[employee.status].color)}>
                                            {statusConfig[employee.status].label}
                                        </Badge>
                                        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                                            <Building2 className="h-4 w-4" />
                                            <span>{employee.department}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* List View */}
                {viewMode === "list" && (
                    <Card className="border-0 shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                                        <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Employee</th>
                                        <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact</th>
                                        <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Department</th>
                                        <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Joined</th>
                                        <th className="py-4 px-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredEmployees.map((employee) => (
                                        <tr
                                            key={employee.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/w/${tenantSlug}/hr/employees/${employee.id}`)}
                                        >
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold shadow-md",
                                                        getDepartmentColor(employee.department)
                                                    )}>
                                                        {employee.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold">{employee.name}</p>
                                                        <p className="text-sm text-muted-foreground">{employee.designation}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{employee.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{employee.phone}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    <span>{employee.department}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <Badge className={cn("text-xs font-medium", statusConfig[employee.status].color)}>
                                                    {statusConfig[employee.status].label}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{formatDate(employee.joinDate)}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/w/${tenantSlug}/hr/employees/${employee.id}`); }}>
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Profile
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/w/${tenantSlug}/hr/employees/${employee.id}/edit`); }}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-sm text-muted-foreground">
                                Showing {filteredEmployees.length} of {mockEmployees.length} employees
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled>
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Previous
                                </Button>
                                <Button variant="outline" size="sm" className="px-3">1</Button>
                                <Button variant="outline" size="sm" disabled>
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
