'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  DollarSign,
  User,
  Calendar,
  Truck,
  ShoppingCart,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface SalesOrderItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface SalesOrder {
  name: string;
  customer_name: string;
  customer: string;
  order_date?: string;
  delivery_date?: string;
  total: number;
  grand_total?: number;
  status?: 'Draft' | 'Open' | 'Partially Delivered' | 'Delivered' | 'Cancelled';
  items?: SalesOrderItem[];
  creation: string;
  modified: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Open': 'bg-blue-100 text-blue-800',
  'Partially Delivered': 'bg-yellow-100 text-yellow-800',
  'Delivered': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function SalesOrderDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const salesOrderId = params.salesOrderId as string;
  const tenantId = tenantSlug;

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('items');

  const [formData, setFormData] = useState({
    customer_name: '',
    customer: '',
    order_date: '',
    delivery_date: '',
    total: 0,
    items: [] as SalesOrderItem[],
  });

  useEffect(() => {
    if (tenantId && salesOrderId) {
      fetchOrder();
    }
  }, [tenantId, salesOrderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/sales/sales-orders/${salesOrderId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const orderData = data.data || data;
        setOrder(orderData);
        setFormData({
          customer_name: orderData.customer_name || '',
          customer: orderData.customer || '',
          order_date: orderData.order_date || '',
          delivery_date: orderData.delivery_date || '',
          total: orderData.total || orderData.grand_total || 0,
          items: orderData.items || [],
        });
      } else {
        setError('Failed to load sales order');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/sales/sales-orders/${salesOrderId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        setEditMode(false);
        await fetchOrder();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item_code: '', item_name: '', qty: 1, rate: 0, amount: 0 }],
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    const item = newItems[index];
    (item as any)[field] = value;
    if (field === 'qty' || field === 'rate') {
      item.amount = item.qty * item.rate;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return <div className="p-8 text-center">Loading sales order...</div>;
  }

  if (!order) {
    return <ErrorHandler error="Sales Order not found" />;
  }

  const orderDate = formData.order_date ? new Date(formData.order_date) : null;
  const deliveryDate = formData.delivery_date ? new Date(formData.delivery_date) : null;
  const daysToDeliver = deliveryDate ? Math.ceil((deliveryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
  const totalAmount = formData.items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{order.name}</h1>
            <p className="text-sm text-gray-600">
              👥 {formData.customer_name || formData.customer}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editMode && (
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

      {error && <ErrorHandler error={error} />}

      {/* Status Badge */}
      <div className="flex gap-2">
        <Badge className={STATUS_COLORS[order.status || 'Open'] || 'bg-gray-100 text-gray-800'}>
          <ShoppingCart className="h-3 w-3 mr-1" />
          {order.status || 'Open'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <User className="h-4 w-4" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
              />
            ) : (
              <p className="text-sm font-medium">{formData.customer_name}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Order Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="date"
                value={formData.order_date}
                onChange={(e) =>
                  setFormData({ ...formData, order_date: e.target.value })
                }
              />
            ) : (
              <p className="text-sm font-medium">
                {orderDate ? orderDate.toLocaleDateString() : '-'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Truck className="h-4 w-4" />
              Delivery Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="date"
                value={formData.delivery_date}
                onChange={(e) =>
                  setFormData({ ...formData, delivery_date: e.target.value })
                }
              />
            ) : (
              <div>
                <p className="text-sm font-medium">
                  {deliveryDate ? deliveryDate.toLocaleDateString() : '-'}
                </p>
                {daysToDeliver !== null && (
                  <p className={`text-xs ${daysToDeliver < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {daysToDeliver < 0 ? `${Math.abs(daysToDeliver)} days overdue` : `${daysToDeliver} days`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              ${totalAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>Items and delivery information</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="info">Information</TabsTrigger>
            </TabsList>

            {/* Items Tab */}
            <TabsContent value="items" className="space-y-4">
              {editMode && (
                <Button onClick={addItem} className="w-full">
                  + Add Item
                </Button>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Item Code</th>
                      <th className="text-left py-2 px-2">Item Name</th>
                      <th className="text-right py-2 px-2">Qty</th>
                      <th className="text-right py-2 px-2">Rate</th>
                      <th className="text-right py-2 px-2">Amount</th>
                      {editMode && <th className="text-center py-2 px-2">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2">
                          {editMode ? (
                            <Input
                              value={item.item_code}
                              onChange={(e) =>
                                updateItem(idx, 'item_code', e.target.value)
                              }
                              className="text-xs"
                            />
                          ) : (
                            item.item_code
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {editMode ? (
                            <Input
                              value={item.item_name}
                              onChange={(e) =>
                                updateItem(idx, 'item_name', e.target.value)
                              }
                              className="text-xs"
                            />
                          ) : (
                            item.item_name
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          {editMode ? (
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={(e) =>
                                updateItem(idx, 'qty', parseFloat(e.target.value) || 0)
                              }
                              className="text-xs text-right"
                            />
                          ) : (
                            item.qty
                          )}
                        </td>
                        <td className="text-right py-3 px-2">
                          {editMode ? (
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) =>
                                updateItem(idx, 'rate', parseFloat(e.target.value) || 0)
                              }
                              className="text-xs text-right"
                            />
                          ) : (
                            `$${item.rate.toFixed(2)}`
                          )}
                        </td>
                        <td className="text-right py-3 px-2 font-medium">
                          ${item.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </td>
                        {editMode && (
                          <td className="text-center py-3 px-2">
                            <Button
                              onClick={() => removeItem(idx)}
                              variant="ghost"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="font-bold border-t-2">
                      <td colSpan={4} className="text-right py-3 px-2">
                        Total:
                      </td>
                      <td className="text-right py-3 px-2">
                        ${totalAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Customer</label>
                  {editMode ? (
                    <Input
                      value={formData.customer}
                      onChange={(e) =>
                        setFormData({ ...formData, customer: e.target.value })
                      }
                      disabled
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.customer}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Items Count</label>
                  <p className="p-2 bg-gray-50 rounded">{formData.items.length} items</p>
                </div>
              </div>
            </TabsContent>

            {/* Information Tab */}
            <TabsContent value="info" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {new Date(order.creation).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {new Date(order.modified).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-bold text-lg">
                      ${totalAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>✓ Order ID: {order.name}</p>
                  <p>✓ Customer: {formData.customer_name}</p>
                  <p>✓ Items: {formData.items.length}</p>
                  <p>✓ Total: ${totalAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                  <p>✓ Status: {order.status || 'Open'}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
