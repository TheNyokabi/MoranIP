"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { erpNextApi, posApi, POSSalesPerson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Users,
    Search,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    TrendingUp,
    DollarSign,
    UserCheck,
    ShoppingBag,
    X,
    Save,
    Percent,
    Building
} from "lucide-react";
import { toast } from "sonner";

interface Customer {
    name: string;
    customer_name: string;
    customer_type: string;
    customer_group: string;
}

interface SalesStats {
    totalSales: number;
    totalOrders: number;
    topCustomers: Array<{ name: string; total: number }>;
    salesByType: Record<string, { count: number; total: number }>;
}

const PERSON_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
    "Fundi": { bg: "bg-orange-500/10", text: "text-orange-600" },
    "Sales Team": { bg: "bg-blue-500/10", text: "text-blue-600" },
    "Wholesaler": { bg: "bg-purple-500/10", text: "text-purple-600" },
};

function formatCurrency(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

export default function SalesPage() {
    const params = useParams() as any;
    const { token } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'salespersons'>('overview');
    const [loading, setLoading] = useState(true);

    // Data
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [salesPersons, setSalesPersons] = useState<POSSalesPerson[]>([]);
    const [stats, setStats] = useState<SalesStats>({
        totalSales: 0,
        totalOrders: 0,
        topCustomers: [],
        salesByType: {}
    });

    // Search
    const [searchQuery, setSearchQuery] = useState("");

    // Edit modals
    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
    const [isEditingSalesPerson, setIsEditingSalesPerson] = useState(false);
    const [editingSalesPerson, setEditingSalesPerson] = useState<Partial<POSSalesPerson> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchData = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [customersRes, salesPersonsRes, dailySummary] = await Promise.all([
                posApi.getCustomers(token),
                posApi.getSalesPersons(token),
                posApi.getDailySummary(token).catch(() => null)
            ]);

            setCustomers(customersRes.customers || []);
            setSalesPersons(salesPersonsRes.sales_persons || []);

            if (dailySummary) {
                setStats({
                    totalSales: dailySummary.total_sales || 0,
                    totalOrders: dailySummary.total_transactions || 0,
                    topCustomers: [],
                    salesByType: dailySummary.by_customer_type || {}
                });
            }
        } catch (error) {
            console.error("Failed to fetch sales data", error);
            toast.error("Failed to load sales data");
        } finally {
            setLoading(false);
        }
    };

    // Customer CRUD
    const handleCreateCustomer = () => {
        setEditingCustomer({
            customer_name: "",
            customer_type: "Company",
            customer_group: "Direct",
        });
        setIsEditingCustomer(true);
    };

    const handleEditCustomer = (customer: Customer) => {
        setEditingCustomer({ ...customer });
        setIsEditingCustomer(true);
    };

    const handleSaveCustomer = async () => {
        if (!token || !editingCustomer?.customer_name) return;
        setSaving(true);
        try {
            const isNew = !editingCustomer.name;
            if (isNew) {
                await posApi.createCustomer(token, {
                    customer_name: editingCustomer.customer_name,
                    customer_type: editingCustomer.customer_type,
                    customer_group: editingCustomer.customer_group,
                });
                toast.success("Customer created successfully");
            } else {
                await erpNextApi.updateResource(token, "Customer", editingCustomer.name!, editingCustomer);
                toast.success("Customer updated successfully");
            }
            setIsEditingCustomer(false);
            setEditingCustomer(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save customer", error);
            toast.error("Failed to save customer");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCustomer = async (name: string) => {
        if (!token || !confirm(`Delete customer ${name}?`)) return;
        try {
            await erpNextApi.deleteResource(token, "Customer", name);
            toast.success("Customer deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete customer");
        }
    };

    // Sales Person CRUD
    const handleCreateSalesPerson = () => {
        setEditingSalesPerson({
            sales_person_name: "",
            person_type: "Sales Team",
            commission_rate: 10,
            referral_prefix: "SLS-",
        });
        setIsEditingSalesPerson(true);
    };

    const handleEditSalesPerson = (sp: POSSalesPerson) => {
        setEditingSalesPerson({ ...sp });
        setIsEditingSalesPerson(true);
    };

    const handleSaveSalesPerson = async () => {
        if (!token || !editingSalesPerson?.sales_person_name) return;
        setSaving(true);
        try {
            const isNew = !salesPersons.find(sp => sp.name === editingSalesPerson.name);
            if (isNew) {
                await erpNextApi.createResource(token, "Sales Person", editingSalesPerson);
                toast.success("Sales person created successfully");
            } else {
                await erpNextApi.updateResource(token, "Sales Person", editingSalesPerson.name!, editingSalesPerson);
                toast.success("Sales person updated successfully");
            }
            setIsEditingSalesPerson(false);
            setEditingSalesPerson(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save sales person", error);
            toast.error("Failed to save sales person");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSalesPerson = async (name: string) => {
        if (!token || !confirm(`Delete sales person ${name}?`)) return;
        try {
            await erpNextApi.deleteResource(token, "Sales Person", name);
            toast.success("Sales person deleted");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete sales person");
        }
    };

    // Filter
    const filteredCustomers = Array.isArray(customers) ? customers.filter(c =>
        c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) : [];

    const filteredSalesPersons = Array.isArray(salesPersons) ? salesPersons.filter(sp =>
        sp.sales_person_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sp.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
                    <p className="text-muted-foreground">Manage customers, sales team, and track performance</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Today&apos;s Sales</p>
                                <p className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                                <ShoppingBag className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Orders</p>
                                <p className="text-2xl font-bold">{stats.totalOrders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                                <Building className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Customers</p>
                                <p className="text-2xl font-bold">{Array.isArray(customers) ? customers.length : 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600">
                                <UserCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Sales Team</p>
                                <p className="text-2xl font-bold">{Array.isArray(salesPersons) ? salesPersons.length : 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'customers'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Customers
                </button>
                <button
                    onClick={() => setActiveTab('salespersons')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'salespersons'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Sales Team
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales by Customer Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sales by Customer Type</CardTitle>
                            <CardDescription>Breakdown of today&apos;s sales</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {Object.keys(stats.salesByType).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    No sales data available for today
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(stats.salesByType).map(([type, data]) => (
                                        <div key={type} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Badge
                                                    variant="outline"
                                                    className={`${PERSON_TYPE_STYLES[type]?.bg || 'bg-gray-500/10'} ${PERSON_TYPE_STYLES[type]?.text || 'text-gray-600'} border-0`}
                                                >
                                                    {type}
                                                </Badge>
                                                <span className="text-sm text-muted-foreground">
                                                    {(data as any).count || 0} orders
                                                </span>
                                            </div>
                                            <span className="font-medium">
                                                {formatCurrency((data as any).total || 0)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Sales Persons */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sales Team Performance</CardTitle>
                            <CardDescription>Commission rates and targets</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {Array.isArray(salesPersons) ? salesPersons.slice(0, 5).map(sp => (
                                    <div key={sp.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                                                {sp.sales_person_name?.charAt(0) || "?"}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{sp.sales_person_name}</p>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${PERSON_TYPE_STYLES[sp.person_type]?.bg || ''} ${PERSON_TYPE_STYLES[sp.person_type]?.text || ''} border-0`}
                                                >
                                                    {sp.person_type}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium">{sp.commission_rate}%</p>
                                            <p className="text-xs text-muted-foreground">commission</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">No sales persons available</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Customers Tab */}
            {activeTab === 'customers' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Button onClick={handleCreateCustomer}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Customer
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCustomers.map(customer => (
                            <Card key={customer.name} className="group relative hover:border-primary/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <Building className="h-5 w-5" />
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCustomer(customer)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCustomer(customer.name)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-base">{customer.customer_name}</CardTitle>
                                    <CardDescription className="font-mono text-xs">{customer.name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-2">
                                        <Badge variant="outline">{customer.customer_type}</Badge>
                                        <Badge variant="secondary">{customer.customer_group}</Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Sales Persons Tab */}
            {activeTab === 'salespersons' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search sales team..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Button onClick={handleCreateSalesPerson}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Sales Person
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSalesPersons.map(sp => (
                            <Card key={sp.name} className="group relative hover:border-primary/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold">
                                            {sp.sales_person_name?.charAt(0) || "?"}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSalesPerson(sp)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteSalesPerson(sp.name)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardTitle className="text-base">{sp.sales_person_name}</CardTitle>
                                    <CardDescription className="font-mono text-xs">{sp.referral_prefix}{sp.name}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <Badge
                                            variant="outline"
                                            className={`${PERSON_TYPE_STYLES[sp.person_type]?.bg || ''} ${PERSON_TYPE_STYLES[sp.person_type]?.text || ''} border-0`}
                                        >
                                            {sp.person_type}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-sm font-medium">
                                            <Percent className="h-3 w-3 text-muted-foreground" />
                                            {sp.commission_rate}%
                                        </div>
                                    </div>
                                    {sp.volume_threshold && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Volume threshold: {sp.volume_threshold} units
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Customer Edit Modal */}
            {isEditingCustomer && editingCustomer && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-background shadow-xl">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{editingCustomer.name ? 'Edit Customer' : 'New Customer'}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setIsEditingCustomer(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Customer Name</label>
                                <Input
                                    value={editingCustomer.customer_name}
                                    onChange={e => setEditingCustomer({ ...editingCustomer, customer_name: e.target.value })}
                                    placeholder="ABC Company Ltd"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Type</label>
                                    <select
                                        value={editingCustomer.customer_type}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, customer_type: e.target.value })}
                                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                    >
                                        <option value="Company">Company</option>
                                        <option value="Individual">Individual</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Group</label>
                                    <select
                                        value={editingCustomer.customer_group}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, customer_group: e.target.value })}
                                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                    >
                                        <option value="Direct">Direct</option>
                                        <option value="Fundi">Fundi</option>
                                        <option value="Wholesaler">Wholesaler</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditingCustomer(false)}>Cancel</Button>
                                <Button onClick={handleSaveCustomer} disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save Customer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sales Person Edit Modal */}
            {isEditingSalesPerson && editingSalesPerson && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-background shadow-xl">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{editingSalesPerson.name && salesPersons.find(sp => sp.name === editingSalesPerson.name) ? 'Edit Sales Person' : 'New Sales Person'}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setIsEditingSalesPerson(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input
                                    value={editingSalesPerson.sales_person_name}
                                    onChange={e => setEditingSalesPerson({ ...editingSalesPerson, sales_person_name: e.target.value })}
                                    placeholder="John Kamau"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Person Type</label>
                                    <select
                                        value={editingSalesPerson.person_type}
                                        onChange={e => setEditingSalesPerson({ ...editingSalesPerson, person_type: e.target.value })}
                                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                                    >
                                        <option value="Sales Team">Sales Team</option>
                                        <option value="Fundi">Fundi</option>
                                        <option value="Wholesaler">Wholesaler</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Commission %</label>
                                    <Input
                                        type="number"
                                        value={editingSalesPerson.commission_rate}
                                        onChange={e => setEditingSalesPerson({ ...editingSalesPerson, commission_rate: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Referral Prefix</label>
                                    <Input
                                        value={editingSalesPerson.referral_prefix}
                                        onChange={e => setEditingSalesPerson({ ...editingSalesPerson, referral_prefix: e.target.value })}
                                        placeholder="SLS-"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Volume Threshold</label>
                                    <Input
                                        type="number"
                                        value={editingSalesPerson.volume_threshold || ''}
                                        onChange={e => setEditingSalesPerson({ ...editingSalesPerson, volume_threshold: parseInt(e.target.value) || undefined })}
                                        placeholder="100"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditingSalesPerson(false)}>Cancel</Button>
                                <Button onClick={handleSaveSalesPerson} disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
