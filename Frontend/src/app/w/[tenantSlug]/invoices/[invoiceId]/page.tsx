'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Download,
  Mail,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  User,
  Check,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

interface InvoiceItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  description?: string;
}

interface Invoice {
  name: string;
  customer: string;
  customer_name?: string;
  posting_date: string;
  due_date: string;
  docstatus: 0 | 1 | 2;
  status: string;
  grand_total: number;
  total_before_tax: number;
  total_tax: number;
  outstanding_amount: number;
  items: InvoiceItem[];
  remarks?: string;
  company?: string;
  currency?: string;
}

export default function InvoiceDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const invoiceId = params.invoiceId as string;
  const tenantId = tenantSlug;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [editingItems, setEditingItems] = useState(false);

  const [formData, setFormData] = useState({
    customer: '',
    posting_date: '',
    due_date: '',
    remarks: '',
  });

  useEffect(() => {
    if (tenantId && invoiceId) {
      fetchInvoice();
    }
  }, [tenantId, invoiceId]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const invoiceData = data.data || data;
        setInvoice(invoiceData);
        setFormData({
          customer: invoiceData.customer || '',
          posting_date: invoiceData.posting_date || '',
          due_date: invoiceData.due_date || '',
          remarks: invoiceData.remarks || '',
        });
        // Fetch timeline and payments
        await Promise.all([fetchTimeline(), fetchPayments()]);
      } else {
        setError('Failed to load invoice');
      }
    } catch (err) {
      setError('Failed to load invoice');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}/timeline`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setTimeline(data.data || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}/payments`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setPayments(data.data || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
  };

  const handleSaveInvoice = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}`,
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
        await fetchInvoice();
      } else {
        setError('Failed to save invoice');
      }
    } catch (err) {
      setError('Failed to save invoice');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitInvoice = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        await fetchInvoice();
      } else {
        setError('Failed to submit invoice');
      }
    } catch (err) {
      setError('Failed to submit invoice');
      console.error(err);
    }
  };

  const handleCancelInvoice = async () => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/sales-invoices/${invoiceId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        await fetchInvoice();
      } else {
        setError('Failed to cancel invoice');
      }
    } catch (err) {
      setError('Failed to cancel invoice');
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      'Not Billed': 'default',
      'Paid': 'success',
      'Overdue': 'destructive',
      'Partially Paid': 'warning',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getDocStatusBadge = (docstatus: number) => {
    const statuses = ['Draft', 'Submitted', 'Cancelled'] as const;
    const variants = ['secondary', 'default', 'destructive'] as const;
    return (
      <Badge variant={(variants[docstatus] ?? 'secondary') as any}>
        {statuses[docstatus] ?? 'Draft'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Invoice not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemColumns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'qty', label: 'Qty' },
    { key: 'rate', label: 'Rate' },
    { key: 'amount', label: 'Amount' },
  ];

  const paymentColumns = [
    { key: 'name', label: 'Payment ID' },
    { key: 'posting_date', label: 'Date' },
    { key: 'paid_amount', label: 'Amount Paid' },
    { key: 'payment_type', label: 'Type' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Invoice {invoice.name}</h1>
            <p className="text-gray-600 mt-1">{invoice.customer_name}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveInvoice}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setFormData({
                    customer: invoice.customer || '',
                    posting_date: invoice.posting_date || '',
                    due_date: invoice.due_date || '',
                    remarks: invoice.remarks || '',
                  });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Button>
              {invoice.docstatus === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getDocStatusBadge(invoice.docstatus)}
              {getStatusBadge(invoice.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoice.grand_total.toFixed(2)}</div>
            <p className="text-sm text-gray-600">Invoice Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {invoice.outstanding_amount.toFixed(2)}
            </div>
            <p className="text-sm text-gray-600">Amount Due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-medium">{invoice.customer_name}</div>
            <p className="text-sm text-gray-600">{invoice.customer}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Line Items</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Customer</label>
                      <Input
                        value={formData.customer}
                        onChange={(e) =>
                          setFormData({ ...formData, customer: e.target.value })
                        }
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Posting Date</label>
                      <Input
                        type="date"
                        value={formData.posting_date}
                        onChange={(e) =>
                          setFormData({ ...formData, posting_date: e.target.value })
                        }
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Due Date</label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Currency</label>
                      <Input value={invoice.currency || 'KES'} disabled className="mt-2" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                      className="w-full mt-2 border rounded p-2 text-sm"
                      rows={4}
                      placeholder="Internal notes..."
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Customer</p>
                    <p className="text-lg font-medium">{invoice.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Invoice Date</p>
                    <p className="text-lg font-medium">{invoice.posting_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="text-lg font-medium">{invoice.due_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Currency</p>
                    <p className="text-lg font-medium">{invoice.currency || 'KES'}</p>
                  </div>
                  {invoice.remarks && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-600">Remarks</p>
                      <p className="text-base">{invoice.remarks}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Line Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {invoice.docstatus === 0 && !editingItems && (
                <Button
                  size="sm"
                  onClick={() => setEditingItems(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <DataTable columns={itemColumns} data={invoice.items || []} />

              {/* Totals */}
              <div className="mt-6 space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">
                    {(invoice.total_before_tax || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span className="font-medium">
                    {(invoice.total_tax || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{invoice.grand_total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">
                    {invoice.grand_total.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {invoice.outstanding_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              {payments.length > 0 ? (
                <div className="mt-4">
                  <h3 className="font-semibold mb-3">Payments Received</h3>
                  <DataTable columns={paymentColumns} data={payments} />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No payments recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.length > 0 ? (
                  timeline.map((entry: any, idx: number) => (
                    <div key={idx} className="flex gap-4 pb-4 border-b last:border-b-0">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{entry.action || 'Activity'}</p>
                        <p className="text-sm text-gray-600">{entry.by || 'System'}</p>
                        <p className="text-xs text-gray-500">{entry.timestamp || 'N/A'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No activity yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      {invoice.docstatus === 0 && !editMode && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Button onClick={handleSubmitInvoice} className="gap-2">
                <Check className="h-4 w-4" />
                Submit Invoice
              </Button>
              <Button variant="outline" onClick={handleCancelInvoice}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
