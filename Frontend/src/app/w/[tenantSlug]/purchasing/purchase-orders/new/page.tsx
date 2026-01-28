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
import { ArrowLeft, Plus, Trash2, ShoppingCart, Save } from "lucide-react";
import { getSuppliers, createPurchaseOrder } from "@/lib/api/purchases";
import type { Supplier, PurchaseOrderItem } from "@/lib/types/purchases";
import { toast } from "sonner";

interface OrderItem {
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
    uom: string;
}

export default function NewPurchaseOrderPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [supplierId, setSupplierId] = useState("");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [currency, setCurrency] = useState("KES");
    const [items, setItems] = useState<OrderItem[]>([]);
    
    // New item form
    const [newItemCode, setNewItemCode] = useState("");
    const [newItemName, setNewItemName] = useState("");
    const [newQty, setNewQty] = useState(1);
    const [newRate, setNewRate] = useState(0);
    const [newUom, setNewUom] = useState("Nos");

    useEffect(() => {
        async function loadData() {
            try {
                const suppliersData = await getSuppliers({ limit: 100 });
                setSuppliers(suppliersData);
            } catch (error) {
                console.error("Failed to load suppliers:", error);
                toast.error("Failed to load suppliers");
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    const addItem = () => {
        if (!newItemCode || newQty <= 0 || newRate <= 0) {
            toast.error("Please enter item code, quantity, and rate");
            return;
        }
        setItems([...items, {
            item_code: newItemCode,
            item_name: newItemName || newItemCode,
            qty: newQty,
            rate: newRate,
            uom: newUom,
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

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        setItems(updated);
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
            const orderItems: PurchaseOrderItem[] = items.map(item => ({
                item_code: item.item_code,
                qty: item.qty,
                rate: item.rate,
                uom: item.uom,
                amount: item.qty * item.rate,
            }));

            await createPurchaseOrder({
                supplier_id: supplierId,
                order_date: orderDate,
                currency: currency,
                items: orderItems,
            });

            toast.success("Purchase order created successfully");
            router.push(`/w/${tenantSlug}/purchasing`);
        } catch (error: any) {
            console.error("Failed to create order:", error);
            toast.error(error?.message || "Failed to create purchase order");
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
                    <h1 className="text-3xl font-bold tracking-tight">New Purchase Order</h1>
                    <p className="text-muted-foreground">Create a new order for goods from a supplier</p>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8">Loading...</div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Order Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Details</CardTitle>
                            <CardDescription>Basic information about the order</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                <Label>Order Date</Label>
                                <Input
                                    type="date"
                                    value={orderDate}
                                    onChange={(e) => setOrderDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Add Item */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Item</CardTitle>
                            <CardDescription>Add items to the order</CardDescription>
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
                            <div className="grid grid-cols-3 gap-4">
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
                                    <Label>Rate *</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={newRate}
                                        onChange={(e) => setNewRate(Number(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>UOM</Label>
                                    <Select value={newUom} onValueChange={setNewUom}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Nos">Nos</SelectItem>
                                            <SelectItem value="Kg">Kg</SelectItem>
                                            <SelectItem value="Ltr">Ltr</SelectItem>
                                            <SelectItem value="Box">Box</SelectItem>
                                            <SelectItem value="Pack">Pack</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                        <ShoppingCart className="h-5 w-5" />
                        Order Items ({items.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No items added yet. Add items above to build your order.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>UOM</TableHead>
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
                                            <TableCell>{item.uom}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={item.qty}
                                                    onChange={(e) => updateItem(index, 'qty', Number(e.target.value))}
                                                    className="w-20 text-right"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={item.rate}
                                                    onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                                                    className="w-24 text-right"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {currency} {(item.qty * item.rate).toFixed(2)}
                                            </TableCell>
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
                                <span className="text-2xl font-bold">{currency} {totalAmount.toFixed(2)}</span>
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
                    {isSaving ? "Saving..." : "Create Order"}
                </Button>
            </div>
        </div>
    );
}
