"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { getSuppliers, createPurchaseInvoice } from "@/lib/api/purchases";
import type { Supplier, PurchaseInvoiceItem } from "@/lib/types/purchases";

export default function NewPurchaseInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = params.tenantSlug as string;
  const linkedReceiptId = searchParams.get("receipt");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    supplier_id: "",
    bill_no: "",
    bill_date: new Date().toISOString().split("T")[0],
    due_date: "",
    items: [] as PurchaseInvoiceItem[],
  });

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const data = await getSuppliers();
        setSuppliers(data || []);
      } catch (error) {
        console.error("Failed to load suppliers:", error);
        toast.error("Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    }
    loadSuppliers();
  }, []);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { item_code: "", qty: 1, rate: 0, amount: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof PurchaseInvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate amount
    if (field === "qty" || field === "rate") {
      newItems[index].amount = newItems[index].qty * newItems[index].rate;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.amount || item.qty * item.rate), 0);
  };

  const handleSubmit = async () => {
    if (!formData.supplier_id) {
      toast.error("Please select a supplier");
      return;
    }
    if (!formData.bill_no) {
      toast.error("Please enter a bill number");
      return;
    }
    if (formData.items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    try {
      setIsSaving(true);
      await createPurchaseInvoice({
        supplier_id: formData.supplier_id,
        bill_no: formData.bill_no,
        bill_date: formData.bill_date,
        items: formData.items,
      });
      toast.success("Purchase invoice created successfully");
      router.push(`/w/${tenantSlug}/purchasing/invoices`);
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error("Failed to create purchase invoice");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            New Purchase Invoice
          </h1>
          <p className="text-muted-foreground">Record a supplier invoice</p>
        </div>
      </div>

      {/* Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingSuppliers ? "Loading..." : "Select supplier"} />
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
              <Label htmlFor="bill_no">Bill Number *</Label>
              <Input
                id="bill_no"
                value={formData.bill_no}
                onChange={(e) => setFormData({ ...formData, bill_no: e.target.value })}
                placeholder="Supplier invoice number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_date">Bill Date *</Label>
              <Input
                id="bill_date"
                type="date"
                value={formData.bill_date}
                onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {linkedReceiptId && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Linked Receipt:</span> {linkedReceiptId}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Invoice Items</CardTitle>
          <Button onClick={addItem} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          {formData.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No items added yet</p>
              <Button onClick={addItem} className="mt-2" variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Rate</TableHead>
                    <TableHead className="w-32">Amount</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.item_code}
                          onChange={(e) => updateItem(index, "item_code", e.target.value)}
                          placeholder="Item code"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItem(index, "qty", parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        KES {(item.amount || item.qty * item.rate).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {formData.items.length > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">KES {calculateTotal().toLocaleString()}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices`)}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Create Invoice
        </Button>
      </div>
    </div>
  );
}
