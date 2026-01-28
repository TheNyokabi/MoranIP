"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Package, Save } from "lucide-react";
import { getSuppliers, createPurchaseReceipt, getPurchaseOrders } from "@/lib/api/purchases";
import type { Supplier, PurchaseReceiptItem, PurchaseOrder } from "@/lib/types/purchases";
import { toast } from "sonner";

interface ReceiptItem {
    item_code: string;
    item_name: string;
    qty: number;
    warehouse: string;
    rate: number;
}

export default function NewPurchaseReceiptPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [supplierId, setSupplierId] = useState("");
    const [purchaseOrderId, setPurchaseOrderId] = useState("");
    const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<ReceiptItem[]>([]);
    
    // New item form
    const [newItemCode, setNewItemCode] = useState("");
    const [newItemName, setNewItemName] = useState("");
    const [newQty, setNewQty] = useState(1);
    const [newWarehouse, setNewWarehouse] = useState("Stores - M");
    const [newRate, setNewRate] = useState(0);

    useEffect(() => {
        async function loadData() {
            try {
                const [suppliersData, ordersData] = await Promise.all([
                    getSuppliers({ limit: 100 }),
                    getPurchaseOrders({ limit: 100, status: "To Receive" })
                ]);
                setSuppliers(suppliersData);
                setPurchaseOrders(ordersData);
            } catch (error) {
                console.error("Failed to load data:", error);
                toast.error("Failed to load suppliers and orders");
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    // Auto-populate items from purchase order
    useEffect(() => {
        if (purchaseOrderId) {
            const order = purchaseOrders.find(o => o.id === purchaseOrderId || o.name === purchaseOrderId);
            if (order) {
                setSupplierId(order.supplier_id);
                // Map order items to receipt items
                const receiptItems: ReceiptItem[] = (order.items || []).map(item => ({
                    item_code: item.item_code,
                    item_name: item.item_code, // Use item_code as name if not available
                    qty: item.qty,
                    warehouse: newWarehouse,
                    rate: item.rate,
                }));
                setItems(receiptItems);
            }
        }
    }, [purchaseOrderId, purchaseOrders, newWarehouse]);

    const addItem = () => {
        if (!newItemCode || newQty <= 0) {
            toast.error("Please enter item code and quantity");
            return;
        }
        setItems([...items, {
            item_code: newItemCode,
            item_name: newItemName || newItemCode,
            qty: newQty,
            warehouse: newWarehouse,
            rate: newRate,
        }]);
        // Reset form
        setNewItemCode("");
        setNewItemName("");
        setNewQty(1);
        setNewRate(0);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!supplierId) {
            toast.error("Please select a supplier");
            return;
        }
        if (items.length === 0) {
            toast.error("Please add at least one item");
            return;
        }

        try {
            setIsSaving(true);
            const receiptItems: PurchaseReceiptItem[] = items.map(item => ({
                item_code: item.item_code,
                qty: item.qty,
                warehouse: item.warehouse,
                rate: item.rate,
            }));

            await createPurchaseReceipt({
                supplier_id: supplierId,
                purchase_order_id: purchaseOrderId || undefined,
                posting_date: postingDate,
                items: receiptItems,
            });

            toast.success("Purchase receipt created successfully");
            router.push(`/w/${tenantSlug}/purchasing/receipts`);
        } catch (error: any) {
            console.error("Failed to create receipt:", error);
            toast.error(error?.message || "Failed to create purchase receipt");
        } finally {
            setIsSaving(false);
        }
    };

    const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.rate), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">New Purchase Receipt</h1>
                    <p className="text-muted-foreground">Receive goods into inventory</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8">Loading...</div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Receipt Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Receipt Details</CardTitle>
                            <CardDescription>Basic information about the receipt</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>From Purchase Order (Optional)</Label>
                                <Select value={purchaseOrderId} onValueChange={setPurchaseOrderId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a purchase order..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No Purchase Order</SelectItem>
                                        {purchaseOrders.map((order) => (
                                            <SelectItem key={order.id} value={order.id}>
                                                {order.name || order.id} - {order.supplier_id}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Supplier *</Label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select supplier..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Posting Date</Label>
                                <Input
                                    type="date"
                                    value={postingDate}
                                    onChange={(e) => setPostingDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Default Warehouse</Label>
                                <Input
                                    value={newWarehouse}
                                    onChange={(e) => setNewWarehouse(e.target.value)}
                                    placeholder="e.g., Stores - M"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Add Item */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Item</CardTitle>
                            <CardDescription>Add items to receive</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Item Code *</Label>
                                    <Input
                                        value={newItemCode}
                                        onChange={(e) => setNewItemCode(e.target.value)}
                                        placeholder="e.g., ITEM-001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Item Name</Label>
                                    <Input
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantity *</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={newQty}
                                        onChange={(e) => setNewQty(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rate</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={newRate}
                                        onChange={(e) => setNewRate(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <Button onClick={addItem} className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Items to Receive ({items.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No items added. Add items above or select a purchase order.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.item_code}</TableCell>
                                            <TableCell>{item.item_name}</TableCell>
                                            <TableCell>{item.warehouse}</TableCell>
                                            <TableCell className="text-right">{item.qty}</TableCell>
                                            <TableCell className="text-right">{item.rate.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{(item.qty * item.rate).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex justify-between items-center mt-4 pt-4 border-t">
                                <span className="text-lg font-semibold">Total Amount</span>
                                <span className="text-2xl font-bold">KES {totalAmount.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving || items.length === 0}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Create Receipt"}
                </Button>
            </div>
        </div>
    );
}
