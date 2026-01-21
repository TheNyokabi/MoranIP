"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { authApi, erpNextApi, posApi, POSItem, POSWarehouse, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Package,
    Search,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    Filter,
    X,
    Warehouse,
    ArrowUpDown,
    AlertTriangle,
    CheckCircle,
    Boxes,
    TrendingUp,
    ScanLine,
    ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BulkUploadModal } from "@/components/shared/bulk-upload-modal";

interface InventoryItem extends POSItem {
    description?: string;
    brand?: string;
    stock_qty?: number;
}

interface StockEntry {
    name: string;
    docstatus: number;
    stock_entry_type: string;
    posting_date?: string;
    posting_time?: string;
    company: string;
    items: Array<{
        item_code: string;
        qty: number;
        s_warehouse?: string;
        t_warehouse?: string;
    }>;
}

type TabType = 'items' | 'warehouses' | 'stockEntries' | 'stockLedger';

const STOCK_STATUS = {
    low: { threshold: 10, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: ShieldAlert },
    medium: { threshold: 50, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: AlertTriangle },
    good: { threshold: Infinity, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
};

function getStockStatus(qty: number) {
    if (qty <= STOCK_STATUS.low.threshold) return STOCK_STATUS.low;
    if (qty <= STOCK_STATUS.medium.threshold) return STOCK_STATUS.medium;
    return STOCK_STATUS.good;
}

export default function InventoryPage() {
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const tenantId = tenantSlug; // Use tenantSlug as tenantId for API calls
    const { token, user } = useAuthStore();
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('items');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<POSWarehouse[]>([]);
    const [defaultWarehouse, setDefaultWarehouse] = useState<string | null>(null);
    const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
    const [stockLevelsByWarehouse, setStockLevelsByWarehouse] = useState<Record<string, Record<string, number>>>({});
    const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [stockAccountSuggestion, setStockAccountSuggestion] = useState<string | null>(null);

    const isGroupWarehouse = (warehouse: POSWarehouse) => warehouse?.is_group === 1 || warehouse?.is_group === true;
    const transactionWarehouses = warehouses.filter((warehouse) => !isGroupWarehouse(warehouse));
    const selectableWarehouses = transactionWarehouses.length ? transactionWarehouses : warehouses;
    const [warehouseTypes, setWarehouseTypes] = useState<string[]>([]);
    const [itemGroups, setItemGroups] = useState<Array<{ name: string; item_group_name: string; is_group: number }>>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [runningPreflight, setRunningPreflight] = useState(false);

    // Edit/Create State
    const [isEditing, setIsEditing] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
    const [isEditingWarehouse, setIsEditingWarehouse] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Partial<POSWarehouse> | null>(null);
    const [saving, setSaving] = useState(false);

    // Stock Entry Modal
    const [isCreatingStockEntry, setIsCreatingStockEntry] = useState(false);
    const [stockEntry, setStockEntry] = useState<{
        type: 'Material Receipt' | 'Material Issue' | 'Material Transfer';
        transfer_target_warehouse: string;
        items: Array<{ item_code: string; qty: number; warehouse: string; basic_rate?: number }>;
    }>({
        type: 'Material Receipt',
        transfer_target_warehouse: '',
        items: [{ item_code: '', qty: 0, warehouse: '', basic_rate: 0 }]
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            fetchData();
        }
    }, [token, mounted]);

    useEffect(() => {
        if (!token) return;
        let isMounted = true;
        authApi
            .getMemberships(token)
            .then(memberships => {
                if (!isMounted) return;
                const membership = memberships.find(
                    m => m.id === tenantId || m.code === tenantId || m.name === tenantSlug
                );
                const role = membership?.role;
                const admin = role === "ADMIN" || user?.isSuperAdmin;
                setIsAdmin(!!admin);
            })
            .catch(() => {
                if (!isMounted) return;
                setIsAdmin(!!user?.isSuperAdmin);
            });
        return () => {
            isMounted = false;
        };
    }, [token, tenantId, tenantSlug, user?.isSuperAdmin]);


    const fetchData = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [itemsResponse, warehousesResponse, stockEntriesResponse, stockSettingsResponse, stockAccountResponse, warehouseTypesResponse, itemGroupsResponse] = await Promise.all([
                erpNextApi.listResource<InventoryItem>(token, "Item", {
                    limit: "100",
                    fields: JSON.stringify(["item_code", "item_name", "item_group", "stock_uom", "standard_rate", "valuation_rate", "description", "brand"])
                }).catch(err => {
                    console.error("Failed to fetch items:", err);
                    return [];
                }),
                apiFetch<{ warehouses: POSWarehouse[] }>("/api/inventory/warehouses", {}, token)
                    .then(res => res.warehouses || [])
                    .catch(err => {
                        console.error("Failed to fetch warehouses:", err);
                        return [];
                    }),
                apiFetch<{ data?: StockEntry[]; entries?: StockEntry[] }>("/api/inventory/stock-entries?limit=50", {}, token)
                    .then(res => res.data || res.entries || [])
                    .catch(() => []),
                erpNextApi.getResource<any>(token, "Stock%20Settings", "Stock%20Settings").catch(err => {
                    console.error("Failed to fetch stock settings:", err);
                    return null;
                }),
                apiFetch<{ account: string | null }>("/api/inventory/stock-asset-account", {}, token).catch(() => ({ account: null })),
                apiFetch<{ warehouse_types: string[] }>("/api/inventory/warehouse-types", {}, token).catch(() => ({ warehouse_types: [] })),
                apiFetch<{ data: Array<{ name: string; item_group_name: string; is_group: number }> }>("/api/inventory/item-groups", {}, token).catch(() => ({ data: [] }))
            ]);

            // Handle different response structures
            const itemsData = itemsResponse;
            const warehousesData = warehousesResponse;
            const stockEntriesData = stockEntriesResponse;

            setItems(itemsData);
            setWarehouses(warehousesData);
            setStockEntries(stockEntriesData);
            setDefaultWarehouse(stockSettingsResponse?.data?.default_warehouse || null);
            setStockAccountSuggestion(stockAccountResponse?.account || null);
            setWarehouseTypes(warehouseTypesResponse?.warehouse_types || []);
            setItemGroups(itemGroupsResponse?.data || []);

            // Fetch stock levels for each item across all warehouses
            const levels: Record<string, number> = {};
            const levelsByWarehouse: Record<string, Record<string, number>> = {};

            for (const wh of warehousesData) {
                levelsByWarehouse[wh.name] = {};
            }

            const itemsToCheck = itemsData.length <= 50 ? itemsData : itemsData.slice(0, 20);
            for (const item of itemsToCheck) { // Small catalogs: show accurate totals
                let totalQty = 0;
                try {
                    // Get total stock across all warehouses
                    const stockData = await posApi.getItemStock(token, item.item_code);
                    totalQty = stockData?.qty || 0;
                    levels[item.item_code] = totalQty;

                    // Try to get per-warehouse breakdown
                    for (const wh of warehousesData) {
                        try {
                            const whStock = await posApi.getItemStock(token, item.item_code, wh.name);
                            levelsByWarehouse[wh.name][item.item_code] = whStock?.qty || 0;
                        } catch {
                            levelsByWarehouse[wh.name][item.item_code] = 0;
                        }
                    }
                } catch {
                    levels[item.item_code] = 0;
                }
            }
            setStockLevels(levels);
            setStockLevelsByWarehouse(levelsByWarehouse);
        } catch (error) {
            console.error("Failed to fetch inventory data", error);
            toast.error("Failed to load inventory");
        } finally {
            setLoading(false);
        }
    };

    const runAccountingPreflight = async () => {
        if (!token) return;
        setRunningPreflight(true);
        try {
            const result = await apiFetch<any>("/api/inventory/accounting-preflight", {}, token);
            const missingWarehouseAccounts = result?.warehouses?.missing_inventory_account?.length || 0;
            const hasStockAsset = !!result?.accounts?.stock_asset_account;
            const company = result?.company?.name || "(unknown company)";

            if (!result?.company?.exists) {
                toast.error(`Accounting preflight failed: company not found (${company})`);
                return;
            }

            if (!hasStockAsset || missingWarehouseAccounts > 0) {
                toast.warning(
                    `Accounting preflight warnings for ${company}: ` +
                    `${hasStockAsset ? "" : "missing Stock Asset account; "}` +
                    `${missingWarehouseAccounts > 0 ? `${missingWarehouseAccounts} warehouses missing inventory account` : ""}`.trim()
                );
            } else {
                toast.success(`Accounting preflight OK for ${company}`);
            }
        } catch (e: any) {
            toast.error(e?.message || "Failed to run accounting preflight");
        } finally {
            setRunningPreflight(false);
        }
    };

    // Item CRUD
    const handleCreateItem = () => {
        setEditingItem({
            item_code: "",
            item_name: "",
            item_group: "Products",
            stock_uom: "Nos",
            standard_rate: 0,
            default_warehouse: warehouses[0]?.name || ""
        });
        setIsEditing(true);
    };

    const handleEditItem = (item: InventoryItem) => {
        setEditingItem({ ...item });
        setIsEditing(true);
    };

    const handleSaveItem = async () => {
        if (!token || !editingItem || !editingItem.item_code) return;

        setSaving(true);
        try {
            const isNew = !items.find(i => i.item_code === editingItem.item_code);

            if (isNew) {
                await erpNextApi.createResource(token, "Item", editingItem);
                toast.success("Item created successfully");
            } else {
                await erpNextApi.updateResource(token, "Item", editingItem.item_code, editingItem);
                toast.success("Item updated successfully");
            }

            setIsEditing(false);
            setEditingItem(null);
            fetchData();
        } catch (error) {
            console.error("Failed to save item", error);
            toast.error("Failed to save item");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteItem = async (itemCode: string) => {
        if (!token || !confirm(`Are you sure you want to delete ${itemCode}?`)) return;

        try {
            await erpNextApi.deleteResource(token, "Item", itemCode);
            toast.success("Item deleted");
            fetchData();
        } catch (error) {
            console.error("Failed to delete item", error);
            toast.error("Failed to delete item");
        }
    };

    // Warehouse CRUD
    const handleCreateWarehouse = () => {
        setEditingWarehouse({
            name: "",
            warehouse_code: "",
            parent_warehouse: warehouses.find(w => w.is_group)?.name || "",
            is_group: false,
            disabled: false,
            warehouse_type: "",
            account: stockAccountSuggestion || ""
        });
        setIsEditingWarehouse(true);
    };

    const handleSaveWarehouse = async () => {
        if (!token || !editingWarehouse?.name || !tenantId) return;

        setSaving(true);
        try {
            // Use inventory API endpoint (company is auto-resolved by backend)
            await apiFetch(
                `/api/inventory/warehouses`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        warehouse_name: editingWarehouse.name,
                        warehouse_code: editingWarehouse.warehouse_code || editingWarehouse.name.substring(0, 3).toUpperCase(),
                        is_group: editingWarehouse.is_group ? 1 : 0,
                        parent_warehouse: editingWarehouse.parent_warehouse || undefined,
                        warehouse_type: editingWarehouse.warehouse_type || undefined,
                        account: editingWarehouse.account || undefined,
                        disabled: isAdmin ? (editingWarehouse.disabled ? 1 : 0) : undefined
                    })
                },
                token
            );
            toast.success("Warehouse created successfully");
            setIsEditingWarehouse(false);
            setEditingWarehouse(null);
            fetchData(); // Refresh the list
        } catch (error: any) {
            console.error("Failed to save warehouse", error);
            // Extract error message from API error
            let errorMessage = "Failed to save warehouse";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (error?.detail) {
                // FastAPI returns error.detail as string or object
                if (typeof error.detail === 'string') {
                    errorMessage = error.detail;
                } else if (error.detail?.message) {
                    errorMessage = error.detail.message;
                }
            }
            toast.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    // Stock Entry
    const handleCreateStockEntry = () => {
        const defaultWarehouse = selectableWarehouses[0]?.name || '';
        setStockEntry({
            type: 'Material Receipt',
            transfer_target_warehouse: '',
            items: [{ item_code: '', qty: 1, warehouse: defaultWarehouse, basic_rate: 0 }]
        });
        setIsCreatingStockEntry(true);
    };

    const handleSubmitStockEntry = async (entryName: string) => {
        if (!token) return;
        setSaving(true);
        try {
            await apiFetch(`/api/inventory/stock-entries/${encodeURIComponent(entryName)}/submit`, {
                method: 'POST'
            }, token);
            toast.success("Stock entry submitted");
            fetchData();
        } catch (error) {
            console.error("Failed to submit stock entry", error);
            toast.error("Failed to submit stock entry");
        } finally {
            setSaving(false);
        }
    };

    const handleAddStockEntryItem = () => {
        const defaultWarehouse = selectableWarehouses[0]?.name || '';
        setStockEntry(prev => ({
            ...prev,
            items: [...prev.items, { item_code: '', qty: 0, warehouse: defaultWarehouse, basic_rate: 0 }]
        }));
    };

    const handleSaveStockEntry = async () => {
        if (!token) return;

        // Validate all items have required fields
        const invalidItems = stockEntry.items.filter(item =>
            !item.item_code || item.qty <= 0 || !item.warehouse
        );

        if (invalidItems.length > 0) {
            toast.error("Please select an item, enter a quantity > 0, and select a warehouse for all items");
            return;
        }

        if (stockEntry.type === 'Material Receipt') {
            const invalidRates = stockEntry.items.filter(item => !item.basic_rate || item.basic_rate <= 0);
            if (invalidRates.length > 0) {
                toast.error('Please enter a Basic Rate > 0 for all receipt items');
                return;
            }
        }

        if (stockEntry.type === 'Material Transfer' && !stockEntry.transfer_target_warehouse) {
            toast.error('Please select a target warehouse for the transfer');
            return;
        }

        const hasGroupWarehouse = stockEntry.items.some(item => {
            const match = warehouses.find(wh => wh.name === item.warehouse || wh.warehouse_name === item.warehouse);
            return match ? isGroupWarehouse(match) : false;
        });
        const transferTargetIsGroup = stockEntry.type === 'Material Transfer'
            ? (() => {
                const match = warehouses.find(wh => wh.name === stockEntry.transfer_target_warehouse || wh.warehouse_name === stockEntry.transfer_target_warehouse);
                return match ? isGroupWarehouse(match) : false;
            })()
            : false;

        if (hasGroupWarehouse || transferTargetIsGroup) {
            toast.error('Please select a non-group (transaction) warehouse');
            return;
        }

        setSaving(true);
        try {
            // Build items based on stock entry type:
            // - Material Receipt: Receiving INTO warehouse (t_warehouse only)
            // - Material Issue: Taking FROM warehouse (s_warehouse only)
            // - Material Transfer: Moving BETWEEN warehouses (both s_warehouse and t_warehouse)
            const sourceWarehouses = new Set(stockEntry.items.map(i => i.warehouse).filter(Boolean));

            const entryData: any = {
                stock_entry_type: stockEntry.type,
                items: stockEntry.items.map(item => {
                    const baseItem: any = {
                        item_code: item.item_code,
                        qty: item.qty,
                    };

                    if (stockEntry.type === 'Material Receipt') {
                        baseItem.basic_rate = item.basic_rate;
                    }

                    if (stockEntry.type === 'Material Receipt') {
                        // Receiving INTO inventory - only target warehouse needed
                        baseItem.t_warehouse = item.warehouse;
                    } else if (stockEntry.type === 'Material Issue') {
                        // Issuing FROM inventory - only source warehouse needed
                        baseItem.s_warehouse = item.warehouse;
                    } else if (stockEntry.type === 'Material Transfer') {
                        // Transferring - source warehouse required, target is where we move TO
                        baseItem.s_warehouse = item.warehouse;
                        baseItem.t_warehouse = stockEntry.transfer_target_warehouse;
                    }

                    return baseItem;
                }),
            };

            // Populate optional parent-level warehouses when unambiguous.
            if (stockEntry.type === 'Material Receipt' && sourceWarehouses.size === 1) {
                entryData.to_warehouse = Array.from(sourceWarehouses)[0];
            }
            if (stockEntry.type === 'Material Issue' && sourceWarehouses.size === 1) {
                entryData.from_warehouse = Array.from(sourceWarehouses)[0];
            }
            if (stockEntry.type === 'Material Transfer') {
                entryData.to_warehouse = stockEntry.transfer_target_warehouse;
                if (sourceWarehouses.size === 1) {
                    entryData.from_warehouse = Array.from(sourceWarehouses)[0];
                }
            }

            // Create draft via backend inventory API (enforces ERPNext warehouse requirements)
            const created = await apiFetch<{ data: { name: string } }>(
                `/api/inventory/stock-entries`,
                { method: 'POST', body: JSON.stringify(entryData) },
                token
            );

            // Submit the entry to update stock levels
            await apiFetch(`/api/inventory/stock-entries/${encodeURIComponent(created.data.name)}/submit`, {
                method: 'POST'
            }, token);

            // Optional: verify posting artifacts (GL + Stock Ledger) exist in ERPNext
            try {
                const posting = await apiFetch<{ gl_entries: any[]; stock_ledger_entries: any[] }>(
                    `/api/inventory/stock-entries/${encodeURIComponent(created.data.name)}/posting`,
                    { method: 'GET' },
                    token
                );
                const glCount = posting?.gl_entries?.length ?? 0;
                const sleCount = posting?.stock_ledger_entries?.length ?? 0;
                toast.success(`Posted to ledgers (GL ${glCount}, SLE ${sleCount})`);
            } catch (e) {
                // Non-blocking: submission already succeeded
                toast.message('Submitted, but could not verify ledger posting');
            }

            toast.success("Stock entry created and submitted");
            setIsCreatingStockEntry(false);
            fetchData();
        } catch (error: any) {
            console.error("Failed to create stock entry", error);
            toast.error(error?.message || "Failed to create stock entry");
        } finally {
            setSaving(false);
        }
    };

    // Filter items
    const filteredItems = items.filter(item =>
        item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Summary stats
    const totalItems = items.length;
    const lowStockItems = Object.entries(stockLevels).filter(([, qty]) => qty <= 10).length;
    const totalWarehouses = warehouses.length;
    const totalStockValue = items.reduce((sum, item) => {
        const qty = stockLevels[item.item_code] || 0;
        return sum + (qty * (item.valuation_rate || 0));
    }, 0);

    // Prevent hydration mismatch by not rendering loading state until mounted
    if (!mounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]" suppressHydrationWarning>
                <div className="h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (loading && !items.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Ambient Glow - Only visible in dark mode */}
            <div className="fixed inset-0 pointer-events-none hidden dark:block">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <div className="relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent dark:from-white dark:to-white/60">Inventory</h1>
                        <p className="text-muted-foreground mt-1 text-lg">Manage products, stock levels, and warehouses</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <BulkUploadModal entityType="inventory" onSuccess={fetchData} />
                        <Button
                            variant="outline"
                            onClick={runAccountingPreflight}
                            disabled={runningPreflight}
                            className="border-border hover:bg-muted text-foreground"
                            data-testid="inventory-run-accounting-preflight"
                        >
                            {runningPreflight && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Accounting Check
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCreateStockEntry}
                            className="border-border hover:bg-muted text-foreground"
                            data-testid="inventory-open-stock-entry"
                        >
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Stock Entry
                        </Button>
                        <Button
                            onClick={handleCreateItem}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                            data-testid="inventory-open-add-item"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                <div className="light-mode-card p-6 rounded-2xl relative overflow-hidden group dark:glass">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Boxes className="h-16 w-16 text-primary dark:text-cyan-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 dark:bg-cyan-500/10 flex items-center justify-center text-primary dark:text-cyan-400">
                            <Boxes className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Items</p>
                            <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                        </div>
                    </div>
                </div>

                <div className="light-mode-card p-6 rounded-2xl relative overflow-hidden group dark:glass">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldAlert className="h-16 w-16 text-orange-500 dark:text-orange-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 dark:text-orange-400">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Low Stock</p>
                            <p className="text-2xl font-bold text-foreground">{lowStockItems}</p>
                        </div>
                    </div>
                </div>

                <div className="light-mode-card p-6 rounded-2xl relative overflow-hidden group dark:glass">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Warehouse className="h-16 w-16 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 dark:text-purple-400">
                            <Warehouse className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Warehouses</p>
                            <p className="text-2xl font-bold text-foreground">{totalWarehouses}</p>
                        </div>
                    </div>
                </div>

                <div className="light-mode-card p-6 rounded-2xl relative overflow-hidden group dark:glass">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-16 w-16 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Stock Value</p>
                            <p className="text-xl font-bold text-foreground">KES {totalStockValue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="light-mode-card rounded-2xl border border-border p-6 min-h-[500px] relative z-10 dark:glass dark:border-border dark:border-white/5">
                {/* Tabs */}
                <div className="flex items-center gap-6 border-b border-border dark:border-border dark:border-white/10 mb-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('items')}
                        className={`pb-4 text-sm font-medium border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'items'
                            ? 'border-primary text-primary dark:border-cyan-500 dark:text-cyan-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        data-testid="inventory-tab-items"
                    >
                        <Boxes className="h-4 w-4 inline mr-2" />
                        Item Catalog
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`pb-4 text-sm font-medium border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'warehouses'
                            ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        data-testid="inventory-tab-warehouses"
                    >
                        <Warehouse className="h-4 w-4 inline mr-2" />
                        Warehouses
                    </button>
                    <button
                        onClick={() => setActiveTab('stockEntries')}
                        className={`pb-4 text-sm font-medium border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'stockEntries'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        data-testid="inventory-tab-stock-entries"
                    >
                        <ArrowUpDown className="h-4 w-4 inline mr-2" />
                        Stock Entries
                    </button>
                    <button
                        onClick={() => setActiveTab('stockLedger')}
                        className={`pb-4 text-sm font-medium border-b-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'stockLedger'
                            ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        data-testid="inventory-tab-stock-ledger"
                    >
                        <ScanLine className="h-4 w-4 inline mr-2" />
                        Stock Ledger
                    </button>
                </div>

                {/* Items Tab */}
                {activeTab === 'items' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {/* Filters */}
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search items by name or code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary dark:bg-card dark:bg-white/5 dark:border-border dark:border-white/10 dark:text-foreground dark:placeholder:text-muted-foreground"
                                    data-testid="inventory-item-search"
                                />
                            </div>
                            <Button
                                variant={showLowStockOnly ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                                className={showLowStockOnly
                                    ? "bg-orange-500/20 border-orange-500/50 text-orange-700 hover:bg-orange-500/30 dark:text-orange-300"
                                    : "border-border hover:bg-muted text-foreground"
                                }
                            >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Low Stock Only
                            </Button>
                            <Button variant="outline" size="icon" className="border-border hover:bg-muted text-foreground">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Items Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems
                                .filter(item => !showLowStockOnly || (stockLevels[item.item_code] || 0) <= 10)
                                .map((item) => {
                                    const stockQty = stockLevels[item.item_code] ?? 0;
                                    const stockStatus = getStockStatus(stockQty);
                                    const StatusIcon = stockStatus.icon;

                                    return (
                                        <div
                                            key={item.item_code}
                                            className="group relative rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-muted/50 dark:bg-card dark:bg-white/5 dark:border-border dark:border-white/10 dark:hover:border-cyan-500/30 dark:hover:bg-muted dark:bg-white/10 transition-all duration-300 overflow-hidden shadow-sm dark:shadow-none"
                                            data-testid="inventory-item-card"
                                            data-item-code={item.item_code}
                                        >
                                            <div className="p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="h-10 w-10 rounded-lg bg-muted dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 flex items-center justify-center text-foreground dark:text-foreground border border-border dark:border-border dark:border-white/10">
                                                        <Package className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 dark:text-muted-foreground dark:hover:text-cyan-400 dark:hover:bg-cyan-500/10"
                                                            onClick={() => handleEditItem(item)}
                                                            data-testid={`inventory-item-edit-${item.item_code}`}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-500/10"
                                                            onClick={() => handleDeleteItem(item.item_code)}
                                                            data-testid={`inventory-item-delete-${item.item_code}`}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <h3 className="font-semibold text-foreground truncate mb-1" title={item.item_name}>
                                                    {item.item_name}
                                                </h3>
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Badge variant="outline" className="border-border text-muted-foreground text-[10px] h-5 dark:border-border dark:border-white/10 dark:text-muted-foreground">
                                                        {item.item_code}
                                                    </Badge>
                                                    <Badge variant="secondary" className="bg-muted text-foreground text-[10px] h-5 hover:bg-muted/80 dark:bg-muted dark:bg-white/10 dark:text-foreground dark:hover:bg-muted/80 dark:bg-white/20">
                                                        {item.stock_uom}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-end justify-between pt-3 border-t border-border dark:border-border dark:border-white/5">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Price</p>
                                                        <p className="text-lg font-bold text-foreground">
                                                            <span className="text-primary text-xs mr-0.5 dark:text-cyan-400">KES</span>
                                                            {item.standard_rate?.toLocaleString() ?? 0}
                                                        </p>
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${stockStatus.border} ${stockStatus.bg}`}>
                                                        <StatusIcon className={`h-3 w-3 ${stockStatus.color}`} />
                                                        <span className={`text-xs font-medium ${stockStatus.color}`}>{stockQty}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </motion.div>
                )}

                {/* Warehouses Tab */}
                {activeTab === 'warehouses' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <BulkUploadModal entityType="warehouses" onSuccess={fetchData} />
                            <Button
                                onClick={handleCreateWarehouse}
                                className="bg-purple-600 hover:bg-purple-700 text-foreground border-0"
                                data-testid="inventory-open-add-warehouse"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Warehouse
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {warehouses.map((warehouse) => (
                                <div
                                    key={warehouse.name}
                                    className="rounded-xl bg-card dark:bg-white/5 border border-border dark:border-white/10 p-5 hover:border-purple-500/30 transition-colors shadow-sm dark:shadow-none"
                                    data-testid="inventory-warehouse-card"
                                    data-warehouse-name={warehouse.name}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                            <Warehouse className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground text-lg">{warehouse.name}</h3>
                                            <p className="font-mono text-xs text-muted-foreground">
                                                {warehouse.warehouse_code || warehouse.warehouse_name || warehouse.name}
                                            </p>
                                        </div>
                                        {defaultWarehouse && warehouse.name === defaultWarehouse && (
                                            <Badge className="ml-auto bg-blue-500/10 text-blue-500 border border-blue-500/30">
                                                Default
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Company</span>
                                            <span className="text-foreground">{warehouse.company}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Status</span>
                                            <Badge variant="outline" className={warehouse.disabled
                                                ? "border-red-500/50 text-red-400 bg-red-500/10"
                                                : "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                                            }>
                                                {warehouse.disabled ? "Disabled" : "Active"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Stock Entries Tab */}
                {activeTab === 'stockEntries' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex justify-end">
                            <Button
                                onClick={handleCreateStockEntry}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                data-testid="inventory-open-new-stock-entry"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Stock Entry
                            </Button>
                        </div>

                        {stockEntries.length === 0 ? (
                            <div className="text-center py-12">
                                <ArrowUpDown className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                                <p className="text-muted-foreground">No stock entries yet</p>
                                <p className="text-muted-foreground text-sm mt-1">Create your first stock entry to track inventory movements</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {stockEntries.map((entry) => (
                                    <div key={entry.name} className="rounded-xl bg-card dark:bg-white/5 border border-border dark:border-white/10 p-4 hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                    {entry.stock_entry_type === 'Material Receipt' && <TrendingUp className="h-5 w-5" />}
                                                    {entry.stock_entry_type === 'Material Issue' && <ArrowUpDown className="h-5 w-5 rotate-180" />}
                                                    {entry.stock_entry_type === 'Material Transfer' && <ArrowUpDown className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-foreground">{entry.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{entry.stock_entry_type}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={
                                                    entry.docstatus === 1
                                                        ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                                                        : "border-yellow-500/50 text-yellow-400 bg-yellow-500/10"
                                                }>
                                                    {entry.docstatus === 1 ? 'Submitted' : 'Draft'}
                                                </Badge>
                                                {entry.docstatus !== 1 && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSubmitStockEntry(entry.name)}
                                                        disabled={saving}
                                                        className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                                                    >
                                                        Submit
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <span className="font-medium mr-2">Items:</span>
                                                <span className="text-foreground">{(entry as any).items_count ?? entry.items?.length ?? 0} items</span>
                                            </div>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <span className="font-medium mr-2">Total Qty:</span>
                                                <span className="text-foreground">{(entry as any).total_qty ?? 0}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <span className="font-medium mr-2">Company:</span>
                                                <span className="text-foreground">{entry.company || '-'}</span>
                                            </div>
                                            {entry.posting_date && (
                                                <div className="flex items-center text-sm text-muted-foreground">
                                                    <span className="font-medium mr-2">Date:</span>
                                                    <span className="text-foreground">{new Date(entry.posting_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Stock Ledger Tab - Multi-warehouse view */}
                {activeTab === 'stockLedger' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Stock Ledger</h3>
                                <p className="text-sm text-muted-foreground">View stock levels across all warehouses</p>
                            </div>
                            <div className="relative max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border dark:border-white/10">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item Code</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Item Name</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Group</th>
                                        {warehouses.map(wh => (
                                            <th key={wh.name} className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                                                {wh.warehouse_code}
                                            </th>
                                        ))}
                                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems
                                        .filter(item => !showLowStockOnly || (stockLevels[item.item_code] || 0) <= 10)
                                        .map((item) => {
                                            const totalQty = stockLevels[item.item_code] || 0;
                                            const totalValue = totalQty * (item.valuation_rate || 0);
                                            const stockStatus = getStockStatus(totalQty);

                                            return (
                                                <tr
                                                    key={item.item_code}
                                                    className="border-b border-border dark:border-white/5 hover:bg-muted/50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                                    onClick={() => setSelectedItem(item)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <span className="font-mono text-sm text-foreground">{item.item_code}</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-sm text-foreground">{item.item_name}</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="outline" className="border-border dark:border-white/10 text-muted-foreground text-xs">
                                                            {item.item_group}
                                                        </Badge>
                                                    </td>
                                                    {warehouses.map(wh => {
                                                        const whQty = stockLevelsByWarehouse[wh.name]?.[item.item_code] || 0;
                                                        return (
                                                            <td key={wh.name} className="py-3 px-4 text-right">
                                                                <span className="text-sm text-foreground">{whQty}</span>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="py-3 px-4 text-right">
                                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${stockStatus.bg} ${stockStatus.border} border`}>
                                                            <span className={`text-sm font-medium ${stockStatus.color}`}>{totalQty}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="text-sm font-medium text-emerald-400">
                                                            KES {totalValue.toLocaleString()}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        {/* Item Detail Popup */}
                        {selectedItem && (
                            <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
                                <Card className="w-full max-w-2xl bg-card border-border shadow-2xl" onClick={e => e.stopPropagation()}>
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="text-foreground">{selectedItem.item_name}</CardTitle>
                                                <p className="text-sm text-muted-foreground font-mono mt-1">{selectedItem.item_code}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground hover:bg-muted dark:bg-white/10">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Item Group</p>
                                                <p className="text-foreground font-medium">{selectedItem.item_group}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">UOM</p>
                                                <p className="text-foreground font-medium">{selectedItem.stock_uom}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Selling Price</p>
                                                <p className="text-foreground font-medium">KES {selectedItem.standard_rate?.toLocaleString()}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground uppercase tracking-wider">Valuation Rate</p>
                                                <p className="text-foreground font-medium">KES {selectedItem.valuation_rate?.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <Separator className="bg-muted dark:bg-white/10" />

                                        <div>
                                            <h4 className="text-sm font-semibold text-foreground mb-3">Stock by Warehouse</h4>
                                            <div className="space-y-2">
                                                {warehouses.map(wh => {
                                                    const qty = stockLevelsByWarehouse[wh.name]?.[selectedItem.item_code] || 0;
                                                    const value = qty * (selectedItem.valuation_rate || 0);
                                                    const status = getStockStatus(qty);

                                                    return (
                                                        <div key={wh.name} className="flex items-center justify-between p-3 rounded-lg bg-card dark:bg-white/5 border border-border dark:border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <Warehouse className="h-4 w-4 text-purple-400" />
                                                                <div>
                                                                    <p className="text-sm text-foreground font-medium">{wh.name}</p>
                                                                    <p className="text-xs text-muted-foreground">{wh.warehouse_code}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <p className={`text-sm font-semibold ${status.color}`}>{qty} {selectedItem.stock_uom}</p>
                                                                    <p className="text-xs text-muted-foreground">KES {value.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-border dark:border-white/10">
                                            <span className="text-sm font-medium text-muted-foreground">Total Stock</span>
                                            <span className="text-lg font-bold text-primary dark:text-cyan-400">
                                                {stockLevels[selectedItem.item_code] || 0} {selectedItem.stock_uom}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Modals - Using default shadcn styles but dark */}
            {/* Item Edit Modal */}
            {isEditing && editingItem && (
                <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="inventory-item-modal">
                    <Card className="w-full max-w-lg bg-card border-border shadow-2xl">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-foreground">{items.find(i => i.item_code === editingItem.item_code) ? 'Edit Item' : 'New Item'}</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditing(false)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-item-modal-close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* ... Form fields styled for dark mode ... */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Item Code</label>
                                    <Input
                                        className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                        value={editingItem.item_code}
                                        onChange={e => setEditingItem({ ...editingItem, item_code: e.target.value })}
                                        disabled={!!items.find(i => i.item_code === editingItem.item_code)}
                                        placeholder="ITEM-001"
                                        data-testid="inventory-item-code"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Item Group</label>
                                    <select
                                        className="w-full px-3 py-2 bg-card dark:bg-white/5 border border-border dark:border-white/10 rounded-lg text-foreground"
                                        value={editingItem.item_group || ""}
                                        onChange={e => setEditingItem({ ...editingItem, item_group: e.target.value })}
                                        data-testid="inventory-item-group"
                                    >
                                        <option value="">Select Item Group</option>
                                        {itemGroups
                                            .filter(g => g.is_group === 0) // Only show leaf nodes (not groups)
                                            .map(group => (
                                                <option key={group.name} value={group.name}>
                                                    {group.item_group_name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Item Name</label>
                                <Input
                                    className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                    value={editingItem.item_name}
                                    onChange={e => setEditingItem({ ...editingItem, item_name: e.target.value })}
                                    placeholder="Premium Paint 4L"
                                    data-testid="inventory-item-name"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Selling Price</label>
                                    <Input
                                        className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                        type="number"
                                        value={editingItem.standard_rate}
                                        onChange={e => setEditingItem({ ...editingItem, standard_rate: parseFloat(e.target.value) })}
                                        data-testid="inventory-item-selling-price"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">UOM</label>
                                    <Input
                                        className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                        value={editingItem.stock_uom}
                                        onChange={e => setEditingItem({ ...editingItem, stock_uom: e.target.value })}
                                        data-testid="inventory-item-uom"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Default Warehouse</label>
                                <select
                                    value={editingItem.default_warehouse}
                                    onChange={e => setEditingItem({ ...editingItem, default_warehouse: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    data-testid="inventory-item-default-warehouse"
                                >
                                    {warehouses.map(wh => (
                                        <option key={wh.name} value={wh.name}>{wh.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditing(false)}
                                    className="text-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-item-cancel"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveItem}
                                    disabled={saving}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    data-testid="inventory-item-save"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save Item
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Warehouse Edit Modal */}
            {isEditingWarehouse && editingWarehouse && (
                <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="inventory-warehouse-modal">
                    <Card className="w-full max-w-md bg-card border-border shadow-2xl">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-foreground">New Warehouse</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsEditingWarehouse(false)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-warehouse-modal-close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Warehouse Name</label>
                                <Input
                                    className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                    value={editingWarehouse.name}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })}
                                    placeholder="Main Store"
                                    data-testid="inventory-warehouse-name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Code/Abbreviation</label>
                                <Input
                                    className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                    value={editingWarehouse.warehouse_code || ''}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, warehouse_code: e.target.value })}
                                    placeholder="MPS (optional)"
                                    data-testid="inventory-warehouse-code"
                                />
                                <p className="text-xs text-muted-foreground">Leave empty to auto-generate from warehouse name</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Parent Warehouse</label>
                                <select
                                    value={editingWarehouse.parent_warehouse || ''}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, parent_warehouse: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                                    data-testid="inventory-warehouse-parent"
                                >
                                    <option value="">None (root)</option>
                                    {warehouses
                                        .filter(wh => wh.is_group)
                                        .map(wh => (
                                            <option key={wh.name} value={wh.name}>{wh.name}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Warehouse Type</label>
                                <select
                                    value={editingWarehouse.warehouse_type || ''}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, warehouse_type: e.target.value || undefined })}
                                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                                    data-testid="inventory-warehouse-type"
                                >
                                    <option value="">None</option>
                                    {warehouseTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Stock Asset Account</label>
                                <Input
                                    className="bg-card dark:bg-white/5 border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground"
                                    value={editingWarehouse.account || ''}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, account: e.target.value })}
                                    placeholder="1400 - Inventory - ACME Ltd (optional)"
                                    data-testid="inventory-warehouse-account"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Required when perpetual inventory is enabled.
                                    {stockAccountSuggestion && (
                                        <span className="ml-2">
                                            Suggested: <span className="font-mono">{stockAccountSuggestion}</span>
                                        </span>
                                    )}
                                </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                    type="checkbox"
                                    checked={!!editingWarehouse.is_group}
                                    onChange={e => setEditingWarehouse({ ...editingWarehouse, is_group: e.target.checked })}
                                    className="h-4 w-4 rounded border-border"
                                    data-testid="inventory-warehouse-is-group"
                                />
                                Group warehouse (cannot hold stock)
                            </label>
                            {isAdmin ? (
                                <label className="flex items-center gap-2 text-sm text-foreground">
                                    <input
                                        type="checkbox"
                                        checked={!!editingWarehouse.disabled}
                                        onChange={e => setEditingWarehouse({ ...editingWarehouse, disabled: e.target.checked })}
                                        className="h-4 w-4 rounded border-border"
                                        data-testid="inventory-warehouse-disabled"
                                    />
                                    Disabled (inactive)
                                </label>
                            ) : (
                                <p className="text-xs text-muted-foreground">Only admins can disable warehouses.</p>
                            )}
                            <div className="pt-4 flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditingWarehouse(false)}
                                    className="text-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-warehouse-cancel"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveWarehouse}
                                    disabled={saving}
                                    className="bg-purple-600 hover:bg-purple-500 text-white"
                                    data-testid="inventory-warehouse-save"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Create Warehouse
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Stock Entry Modal */}
            {isCreatingStockEntry && (
                <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="inventory-stock-entry-modal">
                    <Card className="w-full max-w-2xl bg-card border-border shadow-2xl max-h-[90vh] overflow-auto">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-foreground">New Stock Entry</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsCreatingStockEntry(false)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-stock-entry-modal-close"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardDescription className="text-muted-foreground">Add stock to inventory or transfer between warehouses</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Entry Type</label>
                                <select
                                    value={stockEntry.type}
                                    onChange={e => setStockEntry(prev => ({ ...prev, type: e.target.value as typeof stockEntry.type }))}
                                    className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                                    data-testid="inventory-stock-entry-type"
                                >
                                    <option value="Material Receipt" className="bg-gray-900">Material Receipt (Stock In)</option>
                                    <option value="Material Issue" className="bg-gray-900">Material Issue (Stock Out)</option>
                                    <option value="Material Transfer" className="bg-gray-900">Material Transfer</option>
                                </select>
                            </div>

                            {stockEntry.type === 'Material Transfer' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Target Warehouse</label>
                                    <select
                                        value={stockEntry.transfer_target_warehouse}
                                        onChange={e => setStockEntry(prev => ({ ...prev, transfer_target_warehouse: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm"
                                        data-testid="inventory-stock-entry-transfer-target"
                                    >
                                        <option value="">Select target warehouse</option>
                                        {selectableWarehouses.map(wh => (
                                            <option key={wh.name} value={wh.name} className="bg-gray-900">{wh.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">Stock will be moved into this warehouse.</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground">Items</label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddStockEntryItem}
                                        className="border-border dark:border-white/10 text-foreground hover:bg-card dark:bg-white/5"
                                        data-testid="inventory-stock-entry-add-line"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add Item
                                    </Button>
                                </div>
                                {stockEntry.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`grid ${stockEntry.type === 'Material Receipt' ? 'grid-cols-4' : 'grid-cols-3'} gap-2 p-3 bg-card dark:bg-white/5 rounded-lg border border-border dark:border-white/5`}
                                        data-testid={`inventory-stock-entry-line-${idx}`}
                                    >
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Item</label>
                                            <select
                                                value={item.item_code}
                                                onChange={e => {
                                                    const newItems = [...stockEntry.items];
                                                    newItems[idx].item_code = e.target.value;
                                                    setStockEntry(prev => ({ ...prev, items: newItems }));
                                                }}
                                                className="w-full h-8 px-2 rounded-md border border-border bg-background dark:bg-black/20 text-foreground text-sm"
                                                data-testid={`inventory-stock-entry-item-${idx}`}
                                            >
                                                <option value="">Select item</option>
                                                {items.map(i => (
                                                    <option key={i.item_code} value={i.item_code}>{i.item_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">Quantity</label>
                                            <Input
                                                type="number"
                                                className="h-8 bg-background dark:bg-black/20 border-border text-foreground"
                                                value={item.qty}
                                                onChange={e => {
                                                    const newItems = [...stockEntry.items];
                                                    newItems[idx].qty = parseInt(e.target.value) || 0;
                                                    setStockEntry(prev => ({ ...prev, items: newItems }));
                                                }}
                                                data-testid={`inventory-stock-entry-qty-${idx}`}
                                            />
                                        </div>

                                        {stockEntry.type === 'Material Receipt' && (
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Basic Rate</label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    className="h-8 bg-background dark:bg-black/20 border-border text-foreground"
                                                    value={item.basic_rate ?? 0}
                                                    onChange={e => {
                                                        const newItems = [...stockEntry.items];
                                                        newItems[idx].basic_rate = Number(e.target.value) || 0;
                                                        setStockEntry(prev => ({ ...prev, items: newItems }));
                                                    }}
                                                    data-testid={`inventory-stock-entry-basic-rate-${idx}`}
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground">
                                                {stockEntry.type === 'Material Receipt' ? 'Target Warehouse' :
                                                    stockEntry.type === 'Material Issue' ? 'Source Warehouse' :
                                                        'Source Warehouse'}
                                            </label>
                                            <select
                                                value={item.warehouse}
                                                onChange={e => {
                                                    const newItems = [...stockEntry.items];
                                                    newItems[idx].warehouse = e.target.value;
                                                    setStockEntry(prev => ({ ...prev, items: newItems }));
                                                }}
                                                className="w-full h-8 px-2 rounded-md border border-border bg-background dark:bg-black/20 text-foreground text-sm"
                                                data-testid={`inventory-stock-entry-warehouse-${idx}`}
                                            >
                                                <option value="">Select warehouse</option>
                                                {selectableWarehouses.map(wh => (
                                                    <option key={wh.name} value={wh.name} className="bg-gray-900">{wh.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsCreatingStockEntry(false)}
                                    className="text-foreground hover:text-foreground hover:bg-muted dark:bg-white/10"
                                    data-testid="inventory-stock-entry-cancel"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveStockEntry}
                                    disabled={saving}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                                    data-testid="inventory-stock-entry-save"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Create & Submit
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
