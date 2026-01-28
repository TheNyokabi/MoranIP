'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Building2,
  Calendar,
  Truck,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { 
  getPurchaseOrder, 
  updatePurchaseOrder, 
  submitPurchaseOrder, 
  cancelPurchaseOrder 
} from '@/lib/api/purchases';
import type { PurchaseOrder as PurchaseOrderType } from '@/lib/types/purchases';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Open': 'bg-blue-100 text-blue-800',
  'To Receive': 'bg-yellow-100 text-yellow-800',
  'To Receive and Bill': 'bg-yellow-100 text-yellow-800',
  'Partially Received': 'bg-orange-100 text-orange-800',
  'Completed': 'bg-green-100 text-green-800',
  'Received': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const purchaseOrderId = params.purchaseOrderId as string;

  const [order, setOrder] = useState<PurchaseOrderType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    order_date: '',
    items: [] as any[],
  });

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrder(purchaseOrderId);
      setOrder(data);
      setFormData({
        order_date: data.order_date || data.transaction_date || '',
        items: data.items || [],
      });
    } catch (error) {
      console.error('Failed to load order:', error);
      toast.error('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleSave = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      await updatePurchaseOrder(order.id, {
        order_date: formData.order_date,
        items: formData.items,
      });
      toast.success('Changes saved');
      setEditMode(false);
      loadOrder();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!order) return;
    setIsSubmitting(true);
    try {
      await submitPurchaseOrder(order.id);
      toast.success('Purchase order submitted');
      loadOrder();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    setIsSubmitting(true);
    try {
      await cancelPurchaseOrder(order.id);
      toast.success('Purchase order cancelled');
      loadOrder();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'qty' || field === 'rate') {
      newItems[index].amount = newItems[index].qty * newItems[index].rate;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const getDocStatus = () => {
    const docstatus = (order as any)?.docstatus ?? 0;
    if (docstatus === 1) return { label: 'Submitted', canSubmit: false, canCancel: true };
    if (docstatus === 2) return { label: 'Cancelled', canSubmit: false, canCancel: false };
    return { label: 'Draft', canSubmit: true, canCancel: false };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-4">The purchase order could not be found.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const docStatus = getDocStatus();
  const totalAmount = formData.items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  const orderStatus = order.status || docStatus.label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{order.name || order.id}</h1>
              <Badge className={STATUS_COLORS[orderStatus] || 'bg-gray-100 text-gray-800'}>
                {orderStatus}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {order.supplier_name || order.supplier_id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {docStatus.canSubmit && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Submit Order
            </Button>
          )}
          {docStatus.canCancel && (
            <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel Order
            </Button>
          )}
          {!editMode && docStatus.canSubmit && (
            <Button onClick={() => setEditMode(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {editMode && (
            <>
              <Button onClick={() => setEditMode(false)} variant="ghost">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {(orderStatus === 'To Receive' || orderStatus === 'To Receive and Bill' || orderStatus === 'Submitted') && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">Ready to Receive</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This order is ready for goods receipt. Create a purchase receipt to update inventory.
                  </p>
                </div>
              </div>
              <Button onClick={() => router.push(`/w/${tenantSlug}/purchasing/receipts/new?order=${order.id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-semibold">{order.supplier_name || order.supplier_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                {editMode ? (
                  <Input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-semibold">{order.order_date || order.transaction_date || '-'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Items</p>
                <p className="font-semibold">{formData.items.length} items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(order.grand_total || order.total_amount || totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
          <CardDescription>Items included in this purchase order</CardDescription>
        </CardHeader>
        <CardContent>
          {formData.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items in this order
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {editMode && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {editMode ? (
                        <Input
                          value={item.item_code}
                          onChange={(e) => updateItem(idx, 'item_code', e.target.value)}
                          className="w-40"
                        />
                      ) : (
                        item.item_code
                      )}
                    </TableCell>
                    <TableCell>{item.uom || 'Nos'}</TableCell>
                    <TableCell className="text-right">
                      {editMode ? (
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))}
                          className="w-20 text-right"
                        />
                      ) : (
                        item.qty
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editMode ? (
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))}
                          className="w-24 text-right"
                        />
                      ) : (
                        formatCurrency(item.rate)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.qty * item.rate)}
                    </TableCell>
                    {editMode && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4} className="text-right">Total:</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
                  {editMode && <TableCell></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
