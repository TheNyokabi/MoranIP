"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useTenantStore } from "@/store/tenant-store";
import { posApi, POSInvoice, POSItem, POSPaymentMode, POSInvoiceRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    FileText,
    Search,
    Filter,
    Loader2,
    Eye,
    Download,
    Printer,
    User,
    CreditCard,
    Receipt,
    X,
    ChevronLeft,
    ChevronRight,
    Building2,
    Calendar,
    ArrowDownToLine,
    Plus,
    Trash
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Status badge styling
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    "Paid": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
    "Unpaid": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    "Partially Paid": { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
    "Draft": { bg: "bg-white/5", text: "text-white/60", border: "border-white/10" },
    "Cancelled": { bg: "bg-white/5", text: "text-white/40", border: "border-white/10" },
    "Return": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
};

function formatCurrency(amount: number): string {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Initial Invoice State
const INITIAL_INVOICE: POSInvoiceRequest = {
    customer: "",
    customer_type: "Direct",
    pos_profile_id: "", // REQUIRED: Will need to be set from POS Profile selection
    items: [],
    payments: [],
    warehouse: "", // Will default to first available or settings
};

export default function InvoicesPage() {
    const params = useParams() as any;
    const { token } = useAuthStore();
    const { availableTenants } = useTenantStore();
    const [invoices, setInvoices] = useState<POSInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedInvoice, setSelectedInvoice] = useState<POSInvoice | null>(null);

    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newInvoice, setNewInvoice] = useState<POSInvoiceRequest>(INITIAL_INVOICE);
    const [availableItems, setAvailableItems] = useState<POSItem[]>([]);
    const [paymentModes, setPaymentModes] = useState<POSPaymentMode[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const currentTenant = availableTenants.find(t => t.code === params?.tenantSlug) || availableTenants[0];

    useEffect(() => {
        fetchInvoices();
    }, [token]);

    const fetchInvoices = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data: any = await posApi.getInvoices(token, 100);
            // Backend returns { invoices: [...] } but handle edge cases
            let invoiceList: POSInvoice[] = [];
            if (data && typeof data === 'object') {
                if (Array.isArray(data.invoices)) {
                    invoiceList = data.invoices;
                } else if (Array.isArray(data.data)) {
                    invoiceList = data.data;
                } else if (Array.isArray(data)) {
                    invoiceList = data;
                }
            } else if (Array.isArray(data)) {
                invoiceList = data;
            }
            setInvoices(invoiceList);
        } catch (error) {
            console.error("Failed to fetch invoices", error);
            toast.error("Failed to load invoices");
            setInvoices([]); // Ensure invoices is always an array
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOpen = async () => {
        setIsCreating(true);
        if (availableItems.length === 0 && token) {
            try {
                const [itemsData, modesData] = await Promise.all([
                    posApi.getItems(token),
                    posApi.getPaymentModes(token)
                ]);
                setAvailableItems(itemsData.items);
                setPaymentModes(modesData.payment_modes);
            } catch (error) {
                console.error("Failed to fetch dependencies", error);
                toast.error("Failed to load items or payment modes");
            }
        }
    };

    const handleAddItem = () => {
        setNewInvoice(prev => ({
            ...prev,
            items: [...prev.items, { item_code: "", qty: 1, rate: 0 }]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setNewInvoice(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        setNewInvoice(prev => {
            const updatedItems = [...prev.items];
            const item = { ...updatedItems[index] };

            if (field === "item_code") {
                const selectedItem = availableItems.find(i => i.item_code === value);
                item.item_code = value;
                if (selectedItem) {
                    item.rate = selectedItem.standard_rate;
                }
            } else {
                (item as any)[field] = value;
            }

            updatedItems[index] = item;
            return { ...prev, items: updatedItems };
        });
    };

    const calculateTotals = () => {
        const total = newInvoice.items.reduce((sum, item) => sum + (item.qty * (item.rate || 0)), 0);
        return total;
    };

    const handleSubmitInvoice = async () => {
        if (!token) return;

        // Validation
        if (!newInvoice.customer) {
            toast.error("Customer name is required");
            return;
        }
        if (newInvoice.items.length === 0) {
            toast.error("Add at least one item");
            return;
        }

        setIsSubmitting(true);
        try {
            // Auto add full payment for now (POS style) unless specified
            const total = calculateTotals();
            const invoicePayload = {
                ...newInvoice,
                payments: newInvoice.payments.length > 0 ? newInvoice.payments : [
                    { mode_of_payment: paymentModes[0]?.name || "Cash", amount: total }
                ]
            };

            await posApi.createInvoice(token, invoicePayload);
            toast.success("Invoice created successfully");
            setIsCreating(false);
            setNewInvoice(INITIAL_INVOICE);
            fetchInvoices();
        } catch (error) {
            console.error("Creation failed", error);
            toast.error("Failed to create invoice");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Ensure invoices is always an array
    const invoiceArray = Array.isArray(invoices) ? invoices : [];
    
    // Filter and search - ensure invoices is an array before filtering
    const filteredInvoices = invoiceArray.filter(inv => {
        const matchesSearch =
            (inv.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inv.customer || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Pagination
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const paginatedInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );
    
    // Summary stats
    const totalAmount = invoiceArray.reduce((sum, inv) => sum + (inv.grand_total || 0), 0);
    const paidCount = invoiceArray.filter(inv => inv.status === "Paid").length;
    const unpaidCount = invoiceArray.filter(inv => inv.status === "Unpaid").length;

    if (loading && !invoiceArray.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">Invoices</h1>
                    <p className="text-white/40 mt-1 text-lg">Manage and track your sales invoices</p>
                </div>
                <div className="relative z-10">
                    <Button onClick={handleCreateOpen} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/20 border-0">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Invoice
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="h-16 w-16 text-cyan-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Total Invoices</p>
                            <p className="text-2xl font-bold text-white">{invoiceArray.length}</p>
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Receipt className="h-16 w-16 text-emerald-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <Receipt className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Paid</p>
                            <p className="text-2xl font-bold text-white">{paidCount}</p>
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Receipt className="h-16 w-16 text-red-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                            <Receipt className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Unpaid</p>
                            <p className="text-2xl font-bold text-white">{unpaidCount}</p>
                        </div>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CreditCard className="h-16 w-16 text-blue-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Revenue</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(totalAmount)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 glass p-2 rounded-xl">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input
                        placeholder="Search invoices by number or customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-transparent border-0 text-white placeholder:text-white/30 focus-visible:ring-0"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Separator orientation="vertical" className="h-6 bg-white/10 hidden sm:block" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                        <option value="all" className="bg-gray-900">All Status</option>
                        <option value="Paid" className="bg-gray-900">Paid</option>
                        <option value="Unpaid" className="bg-gray-900">Unpaid</option>
                        <option value="Draft" className="bg-gray-900">Draft</option>
                    </select>
                </div>
            </div>

            {/* Invoice List */}
            <div className="glass rounded-2xl border border-white/5 overflow-hidden relative z-10">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="text-left p-4 font-medium text-sm text-white/50">Invoice #</th>
                            <th className="text-left p-4 font-medium text-sm text-white/50">Date</th>
                            <th className="text-left p-4 font-medium text-sm text-white/50">Customer</th>
                            <th className="text-left p-4 font-medium text-sm text-white/50">Items</th>
                            <th className="text-right p-4 font-medium text-sm text-white/50">Amount</th>
                            <th className="text-left p-4 font-medium text-sm text-white/50">Status</th>
                            <th className="text-right p-4 font-medium text-sm text-white/50">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-white/30">
                                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    No invoices found matching your criteria
                                </td>
                            </tr>
                        ) : (
                            paginatedInvoices.map((invoice) => {
                                const statusStyle = STATUS_STYLES[invoice.status] || STATUS_STYLES["Draft"];
                                return (
                                    <tr key={invoice.name} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <span className="font-mono text-sm font-medium text-white/80 group-hover:text-cyan-400 transition-colors">{invoice.name}</span>
                                        </td>
                                        <td className="p-4 text-sm text-white/60">
                                            {formatDate(invoice.posting_date)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-[10px] text-cyan-400">
                                                    {invoice.customer?.charAt(0) || "U"}
                                                </div>
                                                <span className="text-sm text-white/80">{invoice.customer || "Walk-in"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-white/60">
                                            {invoice.total_qty || invoice.items?.length || 0} items
                                        </td>
                                        <td className="p-4 text-right font-medium text-white">
                                            {formatCurrency(invoice.grand_total || 0)}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}>
                                                {invoice.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(invoice)} className="text-white/50 hover:text-cyan-400 hover:bg-cyan-500/10">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/5">
                        <p className="text-sm text-white/40">
                            Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="border-white/10 text-white hover:bg-white/10 disabled:opacity-30"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="border-white/10 text-white hover:bg-white/10 disabled:opacity-30"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Invoice Modal */}
            <AnimatePresence>
                {isCreating && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-4xl bg-[#1a1a24] border border-white/10 shadow-2xl rounded-xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="flex justify-between items-center p-6 border-b border-white/10">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-cyan-400" />
                                    New Invoice
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)} className="text-white/50 hover:text-white">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {/* Customer Details */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/60">Customer Name</label>
                                        <Input
                                            value={newInvoice.customer}
                                            onChange={e => setNewInvoice({ ...newInvoice, customer: e.target.value })}
                                            placeholder="Enter customer name..."
                                            className="bg-white/5 border-white/10 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-white/60">Customer Type</label>
                                        <select
                                            value={newInvoice.customer_type}
                                            onChange={e => setNewInvoice({ ...newInvoice, customer_type: e.target.value as any })}
                                            className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                        >
                                            <option value="Direct" className="bg-gray-900">Direct Customer</option>
                                            <option value="Fundi" className="bg-gray-900">Fundi</option>
                                            <option value="Sales Team" className="bg-gray-900">Sales Team</option>
                                            <option value="Wholesaler" className="bg-gray-900">Wholesaler</option>
                                        </select>
                                    </div>
                                </div>

                                <Separator className="bg-white/10" />

                                {/* Items Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-white">Items</h3>
                                        <Button variant="outline" size="sm" onClick={handleAddItem} className="border-white/10 text-white hover:bg-white/10">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Item
                                        </Button>
                                    </div>
                                    <div className="border border-white/10 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white/5 text-white/60">
                                                <tr>
                                                    <th className="text-left p-3">Item</th>
                                                    <th className="text-right p-3 w-24">Qty</th>
                                                    <th className="text-right p-3 w-32">Rate</th>
                                                    <th className="text-right p-3 w-32">Amount</th>
                                                    <th className="w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {newInvoice.items.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="p-3">
                                                            <select
                                                                value={item.item_code}
                                                                onChange={e => handleItemChange(index, 'item_code', e.target.value)}
                                                                className="w-full bg-transparent border-0 text-white focus:ring-0 p-0"
                                                            >
                                                                <option value="" className="bg-gray-900">Select Item</option>
                                                                {availableItems.map(i => (
                                                                    <option key={i.item_code} value={i.item_code} className="bg-gray-900">
                                                                        {i.item_name} ({i.item_code})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="p-3">
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={item.qty}
                                                                onChange={e => handleItemChange(index, 'qty', parseInt(e.target.value) || 0)}
                                                                className="h-8 bg-transparent text-right border-0 focus-visible:ring-0 p-0"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right text-white/70">
                                                            {formatCurrency(item.rate || 0)}
                                                        </td>
                                                        <td className="p-3 text-right font-medium text-white">
                                                            {formatCurrency((item.qty || 0) * (item.rate || 0))}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleRemoveItem(index)} className="text-white/30 hover:text-red-400">
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {newInvoice.items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-8 text-center text-white/30">
                                                            No items added. Click &quot;Add Item&quot; to start.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <div className="flex items-center gap-4 text-xl font-bold text-white">
                                            <span>Total:</span>
                                            <span>{formatCurrency(calculateTotals())}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                                <Button variant="ghost" onClick={() => setIsCreating(false)} className="text-white/60 hover:text-white">Cancel</Button>
                                <Button
                                    onClick={handleSubmitInvoice}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white min-w-[120px]"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Invoice"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Invoice Detail Modal - Printable (Existing) */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-3xl bg-[#1a1a24] border border-white/10 shadow-2xl rounded-xl max-h-[90vh] overflow-hidden flex flex-col print:max-h-none print:bg-white print:border-0 print:shadow-none print:rounded-none printable-content"
                    >
                        {/* ... Modal Content kept as is from previous step ... */}
                        <div className="flex justify-between items-center p-6 border-b border-white/10 print:hidden">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-cyan-400" />
                                    Invoice {selectedInvoice.name}
                                </h2>
                                <p className="text-white/40 text-sm mt-1">View invoice details and timeline</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={handlePrint} variant="outline" className="border-white/10 text-white hover:bg-white/10">
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(null)} className="text-white/50 hover:text-white">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Invoice Content - Printable */}
                        <div className="p-8 overflow-auto flex-1 bg-white text-gray-900 print:p-0 print:overflow-visible">

                            {/* Company Branding */}
                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-3">
                                    {/* Mock Logo Placeholder */}
                                    <div className="h-12 w-12 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-xl">
                                        {currentTenant?.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900">{currentTenant?.name}</h3>
                                        <p className="text-sm text-gray-500">Official Receipt</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedInvoice.name}</h2>
                                    <p className="text-sm text-gray-500">{formatDate(selectedInvoice.posting_date)}</p>
                                    <div className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-semibold ${selectedInvoice.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {selectedInvoice.status.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            <Separator className="my-6" />

                            {/* Customer & Info */}
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h4>
                                    <div className="text-sm text-gray-900">
                                        <p className="font-semibold">{selectedInvoice.customer}</p>
                                        <p>{selectedInvoice.customer_type}</p>
                                        {selectedInvoice.referral_code && (
                                            <p className="mt-1 text-xs text-gray-500">Ref: {selectedInvoice.referral_code}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Payment Details</h4>
                                    <div className="text-sm text-gray-900">
                                        {selectedInvoice.payments?.map((p, i) => (
                                            <div key={i}>
                                                <span className="font-medium">{p.mode_of_payment}</span>: {formatCurrency(p.amount)}
                                            </div>
                                        ))}
                                        {!selectedInvoice.payments?.length && <p>No payment recorded</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full mb-8">
                                <thead className="bg-gray-50 border-y border-gray-200">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-xs text-gray-600 uppercase">Item</th>
                                        <th className="text-right py-3 px-4 font-semibold text-xs text-gray-600 uppercase">Qty</th>
                                        <th className="text-right py-3 px-4 font-semibold text-xs text-gray-600 uppercase">Rate</th>
                                        <th className="text-right py-3 px-4 font-semibold text-xs text-gray-600 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedInvoice.items?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-3 px-4 text-sm text-gray-900">{item.item_code}</td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">{item.qty}</td>
                                            <td className="py-3 px-4 text-sm text-gray-900 text-right">{formatCurrency(item.rate || 0)}</td>
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">{formatCurrency((item.qty || 0) * (item.rate || 0))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="flex justify-end">
                                <div className="w-64 space-y-3">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(selectedInvoice.net_total || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Tax</span>
                                        <span>KES 0.00</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-lg font-bold text-gray-900">
                                        <span>Total</span>
                                        <span>{formatCurrency(selectedInvoice.grand_total || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-12 text-center text-xs text-gray-400 print:fixed print:bottom-8 print:left-0 print:w-full">
                                <p>Thank you for your business!</p>
                                <p className="mt-1">{currentTenant?.name} • Generated via MoranERP</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
