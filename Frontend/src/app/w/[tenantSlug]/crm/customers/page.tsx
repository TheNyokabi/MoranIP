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
    Filter,
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
    SlidersHorizontal,
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

interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    type: "Enterprise" | "SME" | "Individual";
    status: "active" | "inactive" | "prospect";
    territory: string;
    totalRevenue: number;
    lastContact: string;
    createdAt: string;
}

const mockCustomers: Customer[] = [
    { id: "1", name: "Safaricom PLC", email: "business@safaricom.co.ke", phone: "+254 722 000 000", type: "Enterprise", status: "active", territory: "Nairobi", totalRevenue: 8500000, lastContact: "2 hours ago", createdAt: "2024-01-15" },
    { id: "2", name: "Kenya Airways", email: "corporate@kenya-airways.com", phone: "+254 711 024 747", type: "Enterprise", status: "active", territory: "Nairobi", totalRevenue: 6200000, lastContact: "1 day ago", createdAt: "2024-02-20" },
    { id: "3", name: "Equity Bank", email: "partnerships@equitybank.co.ke", phone: "+254 763 063 000", type: "Enterprise", status: "prospect", territory: "Nairobi", totalRevenue: 0, lastContact: "3 days ago", createdAt: "2025-01-10" },
    { id: "4", name: "Twiga Foods", email: "sales@twiga.com", phone: "+254 700 000 123", type: "SME", status: "active", territory: "Nairobi", totalRevenue: 1800000, lastContact: "1 week ago", createdAt: "2024-06-05" },
    { id: "5", name: "Naivas Supermarkets", email: "procurement@naivas.co.ke", phone: "+254 722 111 222", type: "Enterprise", status: "active", territory: "Nationwide", totalRevenue: 4500000, lastContact: "2 days ago", createdAt: "2024-03-18" },
    { id: "6", name: "Java House", email: "operations@javahouseafrica.com", phone: "+254 733 444 555", type: "SME", status: "active", territory: "East Africa", totalRevenue: 2200000, lastContact: "5 days ago", createdAt: "2024-04-22" },
    { id: "7", name: "James Mwangi", email: "jmwangi@email.com", phone: "+254 712 345 678", type: "Individual", status: "inactive", territory: "Nairobi", totalRevenue: 150000, lastContact: "1 month ago", createdAt: "2024-08-10" },
    { id: "8", name: "Carrefour Kenya", email: "business@carrefour.co.ke", phone: "+254 700 567 890", type: "Enterprise", status: "active", territory: "Nairobi", totalRevenue: 3800000, lastContact: "4 days ago", createdAt: "2024-05-14" },
];

const statusColors = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    inactive: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    prospect: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const typeColors = {
    Enterprise: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    SME: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Individual: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

export default function CustomersListPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredCustomers = mockCustomers.filter((customer) => {
        const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customer.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || customer.status === statusFilter;
        const matchesType = typeFilter === "all" || customer.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Link href={`/w/${tenantSlug}/crm`} className="hover:text-foreground transition-colors">
                        CRM
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-foreground font-medium">Customers</span>
                </div>

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Customers</h1>
                        <p className="text-muted-foreground mt-1">
                            {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} found
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                            onClick={() => router.push(`/w/${tenantSlug}/crm/customers/new`)}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Customer
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
                                    placeholder="Search by name or email..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="prospect">Prospect</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full md:w-[150px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                                    <SelectItem value="SME">SME</SelectItem>
                                    <SelectItem value="Individual">Individual</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon">
                                <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Customers Table */}
                <Card className="border-0 shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Customer</th>
                                    <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contact</th>
                                    <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Type</th>
                                    <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="text-left py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Territory</th>
                                    <th className="text-right py-4 px-6 font-semibold text-sm text-muted-foreground uppercase tracking-wider">Revenue</th>
                                    <th className="py-4 px-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredCustomers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/w/${tenantSlug}/crm/customers/${customer.id}`)}
                                    >
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold shadow-md">
                                                    {customer.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{customer.name}</p>
                                                    <p className="text-sm text-muted-foreground">{customer.lastContact}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-muted-foreground">{customer.email}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-muted-foreground">{customer.phone}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <Badge className={cn("text-xs font-medium", typeColors[customer.type])}>
                                                {customer.type}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-6">
                                            <Badge className={cn("text-xs font-medium capitalize", statusColors[customer.status])}>
                                                {customer.status}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{customer.territory}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <p className={cn(
                                                "font-bold",
                                                customer.totalRevenue > 0 ? "text-emerald-600" : "text-muted-foreground"
                                            )}>
                                                {customer.totalRevenue > 0 ? formatCurrency(customer.totalRevenue) : "—"}
                                            </p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/w/${tenantSlug}/crm/customers/${customer.id}`); }}>
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/w/${tenantSlug}/crm/customers/${customer.id}/edit`); }}>
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
                            Showing {filteredCustomers.length} of {mockCustomers.length} customers
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
            </div>
        </div>
    );
}
