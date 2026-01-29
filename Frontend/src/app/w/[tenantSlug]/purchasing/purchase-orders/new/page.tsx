"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    ChevronLeft,
    ChevronRight,
    Check,
    Users,
    Package,
    Calendar,
    FileText,
    Loader2,
    Plus,
    Trash2,
    Search,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { usePurchaseOrderStore } from "@/store/purchase-order-store";
import { NewItemSheet } from "@/components/purchasing/new-item-sheet";
import { ItemPriceUpdatePopover } from "@/components/purchasing/item-price-update-popover";
import { CommandPalette } from "@/components/purchasing/command-palette";
import { Sparkles } from "lucide-react";

interface PurchaseOrderItem {
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
    uom: string;
    warehouse: string;
}

interface PurchaseOrderForm {
    supplier_id: string;
    order_date: string;
    delivery_date: string;
    currency: string;
    items: PurchaseOrderItem[];
    payment_terms: string;
    notes: string;
}

const STEPS = [
    { id: 1, title: "Supplier", icon: Users, description: "Select supplier" },
    { id: 2, title: "Items", icon: Package, description: "Add items" },
    { id: 3, title: "Details", icon: Calendar, description: "Delivery & terms" },
    { id: 4, title: "Review", icon: FileText, description: "Review & submit" },
];

export default function NewPurchaseOrderPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuthStore();
    const {
        formData,
        updateHeader,
        addItem,
        removeItem,
        updateItem,
        calculateTotal,
        loading,
        setLoading
    } = usePurchaseOrderStore();

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [paymentTerms, setPaymentTerms] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCatalogOpen, setIsCatalogOpen] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch supporting data
    useEffect(() => {
        if (!token) return;
        const fetchData = async () => {
            try {
                const [suppliersRes, warehousesRes, termsRes] = await Promise.all([
                    apiClient.get('/api/purchases/suppliers'),
                    apiClient.get('/api/inventory/warehouses'),
                    apiClient.get('/api/purchases/payment-terms')
                ]);
                setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : suppliersRes.data.suppliers || []);
                setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : warehousesRes.data.warehouses || []);
                const terms = Array.isArray(termsRes.data) ? termsRes.data : (termsRes.data?.terms || []);
                setPaymentTerms(terms);
            } catch (error: any) {
                console.error('Error fetching data:', error);
            }
        };
        fetchData();
    }, [token]);

    // Search items
    useEffect(() => {
        if (!token) return;
        const fetchItems = async () => {
            try {
                const url = searchQuery
                    ? `/api/inventory/items?search=${encodeURIComponent(searchQuery)}&limit=15`
                    : `/api/inventory/items?limit=15`;
                const { data } = await apiClient.get(url);
                setItems(data.items || data.data || data || []);
            } catch (error) {
                console.error('Error fetching items:', error);
            }
        };
        const debounce = setTimeout(fetchItems, 300);
        return () => clearTimeout(debounce);
    }, [token, searchQuery, refreshTrigger]);

    const onAddItem = (item: any) => {
        // Handle both ERPNext and Moran normalized formats
        const itemData = item.data || item;
        const rate = itemData.valuation_rate || itemData.last_purchase_rate || itemData.standard_rate || 0;
        const qty = 1;
        addItem({
            item_code: itemData.item_code || itemData.name,
            item_name: itemData.item_name,
            qty: qty,
            rate: rate,
            amount: qty * rate,
            uom: itemData.stock_uom || itemData.uom || "Nos",
            warehouse: warehouses[0]?.name || warehouses[0]?.warehouse_name || ""
        });
        toast.info(`Added ${itemData.item_name}`);
        // Optionally refresh catalog to show the new item
        setRefreshTrigger(prev => prev + 1);
    };

    const handleSubmit = async () => {
        if (!formData.supplier_id) return toast.error("Please select a supplier");
        if (formData.items.length === 0) return toast.error("Please add at least one item");
        if (!formData.delivery_date) return toast.error("Please set a delivery date");

        setLoading(true);
        try {
            await apiClient.post('/api/purchases/orders', formData);
            toast.success('Purchase Order created successfully!');
            router.push(`/w/${params?.tenantSlug}/purchasing/purchase-orders`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30">
            <CommandPalette onAddItem={onAddItem} />
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
            </div>

            <div className="relative flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-white/5">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-white/10">
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                                New Purchase Order
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> Draft</span>
                                <span>•</span>
                                <span>{params?.tenantSlug}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" className="text-white/40 hover:text-white hover:bg-white/5 h-9">
                            Save as Draft
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 px-6 h-9 transition-all active:scale-95"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                            Process Order
                        </Button>
                    </div>
                </header>

                {/* Split Context */}
                <main className="flex-1 flex overflow-hidden">
                    {/* Left: Composer */}
                    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 scrollbar-hide">
                        {/* 1. Supplier & Basics */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Supplier Logistics</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="md:col-span-2 glass border-white/5 hover:border-white/10 transition-all overflow-hidden shadow-2xl">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-white/60 text-xs">Primary Supplier</Label>
                                            <select
                                                value={formData.supplier_id}
                                                onChange={(e) => updateHeader('supplier_id', e.target.value)}
                                                className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2.5 text-white focus:border-blue-500/50 outline-none transition-all appearance-none"
                                            >
                                                <option value="" className="bg-slate-900">Select source...</option>
                                                {suppliers.map(s => (
                                                    <option key={s.name} value={s.name} className="bg-slate-900">{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-white/60 text-xs text-balance">Expected Delivery</Label>
                                                <Input
                                                    type="date"
                                                    value={formData.delivery_date}
                                                    onChange={(e) => updateHeader('delivery_date', e.target.value)}
                                                    className="bg-white/5 border-white/5 text-white h-11 focus:border-blue-500/50"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-white/60 text-xs">Payment Basis</Label>
                                                <select
                                                    value={formData.payment_terms}
                                                    onChange={(e) => updateHeader('payment_terms', e.target.value)}
                                                    className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2.5 text-white focus:border-blue-500/50 h-11 transition-all appearance-none text-sm"
                                                >
                                                    <option value="" className="bg-slate-900">Immediate</option>
                                                    {paymentTerms.map(t => (
                                                        <option key={t} value={t} className="bg-slate-900">{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="glass border-white/5 bg-blue-500/5 flex flex-col justify-center items-center p-6 text-center group">
                                    <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Users className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <p className="text-xs text-white/40 mb-1">Supplier Group</p>
                                    <p className="font-semibold text-white">
                                        {suppliers.find(s => s.name === formData.supplier_id)?.supplier_group || 'Not Selected'}
                                    </p>
                                </Card>
                            </div>
                        </section>

                        {/* 2. Item Catalog & Search */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Inventory Catalog</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                                        className="text-white/40 hover:text-white"
                                    >
                                        {isCatalogOpen ? 'Collapse' : 'Expand'}
                                    </Button>
                                    <NewItemSheet onSuccess={onAddItem} />
                                </div>
                            </div>

                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                                <Input
                                    placeholder="Search global item master..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-12 bg-white/5 border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                                    <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-white/20">⌘</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-white/20">K</kbd>
                                </div>
                            </div>

                            <AnimatePresence>
                                {isCatalogOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-hidden"
                                    >
                                        {items.slice(0, 10).map((item) => (
                                            <motion.div
                                                key={item.item_code}
                                                whileHover={{ y: -4 }}
                                                className="glass border-white/5 hover:border-blue-500/30 p-4 rounded-xl cursor-pointer transition-all relative group shadow-lg"
                                                onClick={() => onAddItem(item)}
                                            >
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus className="h-4 w-4 text-blue-400" />
                                                </div>
                                                <p className="text-xs font-semibold text-white/80 line-clamp-1">{item.item_name}</p>
                                                <p className="text-[10px] text-white/40 mt-1 uppercase">{item.item_code}</p>
                                                <div className="mt-3 flex items-end justify-between">
                                                    <p className="text-blue-400 font-bold text-sm">
                                                        KES {item.valuation_rate?.toLocaleString() || '0'}
                                                    </p>
                                                    <p className="text-[10px] text-white/30">{item.stock_uom || 'Nos'}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </section>

                        {/* 3. Items Table */}
                        <section className="space-y-4 pb-20">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Order Lines</h2>
                            </div>

                            <div className="glass border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-white/5 text-white/30 text-[10px] uppercase tracking-widest text-left">
                                            <th className="px-6 py-4 font-semibold">Item Details</th>
                                            <th className="px-6 py-4 font-semibold text-right">Quantity</th>
                                            <th className="px-6 py-4 font-semibold text-right">Unit Rate</th>
                                            <th className="px-6 py-4 font-semibold text-right">Amount</th>
                                            <th className="px-6 py-4 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <AnimatePresence initial={false}>
                                            {formData.items.map((item, idx) => (
                                                <motion.tr
                                                    key={`${item.item_code}-${idx}`}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="group hover:bg-white/[0.02] transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="text-sm font-medium text-white">{item.item_name}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-white/30 uppercase">{item.item_code}</span>
                                                                <select
                                                                    value={item.warehouse}
                                                                    onChange={(e) => updateItem(idx, 'warehouse', e.target.value)}
                                                                    className="text-[10px] bg-white/5 border border-white/5 rounded px-2 py-0.5 text-blue-400 hover:border-blue-500/50 transition-all outline-none"
                                                                >
                                                                    {warehouses.map(w => (
                                                                        <option key={w.name} value={w.name} className="bg-slate-900">{w.warehouse_name || w.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end">
                                                            <Input
                                                                type="number"
                                                                value={item.qty}
                                                                onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                                                                className="w-20 text-right bg-white/5 border-white/5 text-white focus:ring-1 focus:ring-blue-500/50"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2 group/rate">
                                                            <Input
                                                                type="number"
                                                                value={item.rate}
                                                                onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                                                className="w-28 text-right bg-white/5 border-white/5 text-white focus:ring-1 focus:ring-blue-500/50 transition-all"
                                                            />
                                                            <div className="opacity-0 group-hover/rate:opacity-100 transition-opacity">
                                                                <ItemPriceUpdatePopover
                                                                    itemCode={item.item_code}
                                                                    itemName={item.item_name}
                                                                    currentRate={item.rate}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-bold text-white">
                                                            {(item.qty * item.rate).toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeItem(idx)}
                                                            className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                                {formData.items.length === 0 && (
                                    <div className="py-20 flex flex-col items-center justify-center text-center">
                                        <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Plus className="h-8 w-8 text-white/10" />
                                        </div>
                                        <h3 className="text-white/40 font-medium">Compose your order</h3>
                                        <p className="text-xs text-white/20 mt-1 max-w-[200px]">Search and add items from the catalog above to populate this table.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right: Sticky Summary */}
                    <aside className="w-80 border-l border-white/5 backdrop-blur-3xl bg-white/[0.02] p-8 flex flex-col gap-8 shadow-2xl relative z-20">
                        {/* AI Insight Placeholder */}
                        <section className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">MoranAI</span>
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed">
                                {formData.items.length === 0
                                    ? "Add items to see procurement insights and stock level predictions."
                                    : `Detected ${formData.items.length} unique SKUs. Market rates locally are trending 2.4% higher than last quarter.`
                                }
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Financial Summary</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/40">Net Amount</span>
                                    <span className="text-white font-medium">KES {calculateTotal().toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/40">Taxes (0%)</span>
                                    <span className="text-white font-medium">KES 0</span>
                                </div>
                                <Separator className="bg-white/5" />
                                <div className="pt-2">
                                    <span className="text-[10px] text-white/40 uppercase tracking-widest block mb-1">Grand Total</span>
                                    <p className="text-3xl font-black text-white tracking-tight">
                                        <span className="text-xs font-normal text-white/40 mr-1">KES</span>
                                        {calculateTotal().toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Internal Notes</h2>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => updateHeader('notes', e.target.value)}
                                placeholder="Instructions for the supplier or warehouse team..."
                                className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-xs text-white/60 placeholder:text-white/10 focus:border-blue-500/30 outline-none min-h-[120px] transition-all resize-none"
                            />
                        </section>

                        <section className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20">
                            <div className="flex items-center gap-3 mb-3 text-blue-400">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Check className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Ready to submit</span>
                            </div>
                            <p className="text-[10px] text-white/40 leading-relaxed">
                                Review the quantities and rates for accuracy. This will create a official draft in {params?.tenantSlug}.
                            </p>
                        </section>
                    </aside>
                </main>
            </div>
        </div>
    );
}
