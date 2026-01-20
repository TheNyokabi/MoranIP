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
  Plus,
  Trash2,
  Eye,
  DollarSign,
  AlertCircle,
  Check,
  Clock,
  CreditCard,
  User,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

interface PaymentReference {
  name: string;
  reference_doctype: string;
  reference_name: string;
  allocated_amount: number;
  invoice_amount?: number;
  invoice_date?: string;
  customer?: string;
  outstanding_amount?: number;
}

interface PaymentEntry {
  name: string;
  payment_type: 'Receive' | 'Pay';
  party_type: 'Customer' | 'Supplier';
  party: string;
  party_name?: string;
  posting_date: string;
  reference_no: string;
  reference_date?: string;
  docstatus: 0 | 1 | 2;
  status: string;
  paid_amount: number;
  received_amount: number;
  total_allocated_amount: number;
  mode_of_payment?: string;
  bank_account?: string;
  remarks?: string;
  references: PaymentReference[];
  currency?: string;
  company?: string;
}

export default function PaymentDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const paymentId = params.paymentId as string;
  const tenantId = tenantSlug;

  const [payment, setPayment] = useState<PaymentEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('references');

  const [formData, setFormData] = useState({
    party: '',
    reference_no: '',
    reference_date: '',
    mode_of_payment: '',
    remarks: '',
    paid_amount: 0,
    received_amount: 0,
  });

  const [references, setReferences] = useState<PaymentReference[]>([]);
  const [newReference, setNewReference] = useState({
    reference_name: '',
    allocated_amount: 0,
  });

  useEffect(() => {
    if (tenantId && paymentId) {
      fetchPayment();
    }
  }, [tenantId, paymentId]);

  const fetchPayment = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/payment-entries/${paymentId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const paymentData = data.data || data;
        setPayment(paymentData);
        setReferences(paymentData.references || []);
        setFormData({
          party: paymentData.party || '',
          reference_no: paymentData.reference_no || '',
          reference_date: paymentData.reference_date || '',
          mode_of_payment: paymentData.mode_of_payment || '',
          remarks: paymentData.remarks || '',
          paid_amount: paymentData.paid_amount || 0,
          received_amount: paymentData.received_amount || 0,
        });
      } else {
        setError('Failed to load payment');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!payment) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/payment-entries/${paymentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            ...formData,
            references: references,
          }),
        }
      );

      if (response.ok) {
        setEditMode(false);
        await fetchPayment();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddReference = () => {
    if (!newReference.reference_name) return;
    
    const reference: PaymentReference = {
      name: `${payment?.name}-${references.length + 1}`,
      reference_doctype: 'Sales Invoice',
      reference_name: newReference.reference_name,
      allocated_amount: newReference.allocated_amount,
    };
    
    setReferences([...references, reference]);
    setNewReference({ reference_name: '', allocated_amount: 0 });
  };

  const handleRemoveReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  const handleReferenceChange = (index: number, field: string, value: any) => {
    const updated = [...references];
    updated[index] = { ...updated[index], [field]: value };
    setReferences(updated);
  };

  const totalAllocated = references.reduce((sum, r) => sum + (r.allocated_amount || 0), 0);
  const balance = (payment?.paid_amount || 0) + (payment?.received_amount || 0) - totalAllocated;

  if (loading) {
    return <div className="p-8 text-center">Loading payment...</div>;
  }

  if (!payment) {
    return <ErrorHandler error="Payment not found" />;
  }

  const isDraft = payment.docstatus === 0;
  const isSubmitted = payment.docstatus === 1;
  const isReceive = payment.payment_type === 'Receive';

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{payment.name}</h1>
            <p className="text-sm text-gray-600">
              {isReceive ? 'Payment Received' : 'Payment Made'} from {payment.party_name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && !editMode && (
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

      {/* Status Badges */}
      <div className="flex gap-2">
        {isSubmitted && (
          <Badge className="bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        )}
        {isDraft && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        )}
        <Badge className={isReceive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          <CreditCard className="h-3 w-3 mr-1" />
          {isReceive ? 'Receive' : 'Pay'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Party</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-gray-900">{payment.party_name}</p>
            <p className="text-xs text-gray-500">{payment.party_type}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Payment Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-gray-900">{new Date(payment.posting_date).toLocaleDateString()}</p>
            <p className="text-xs text-gray-500">{payment.reference_no}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {(isReceive ? payment.received_amount : payment.paid_amount).toLocaleString('en-US', {
                style: 'currency',
                currency: payment.currency || 'USD',
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Allocated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {totalAllocated.toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'USD' })}
            </p>
            <p className={`text-xs ${balance === 0 ? 'text-green-600' : 'text-orange-600'}`}>
              Balance: {balance.toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'USD' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
          <CardDescription>Invoice allocations and payment information</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="references">Invoices</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* Invoices Tab */}
            <TabsContent value="references" className="space-y-4">
              {editMode && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <h3 className="font-semibold text-sm">Add Invoice Reference</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Invoice Number"
                      value={newReference.reference_name}
                      onChange={(e) => setNewReference({ ...newReference, reference_name: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Allocated Amount"
                      value={newReference.allocated_amount}
                      onChange={(e) => setNewReference({ ...newReference, allocated_amount: parseFloat(e.target.value) })}
                    />
                    <Button onClick={handleAddReference} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Invoice</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Invoice Amount</th>
                      <th className="text-right p-2">Outstanding</th>
                      <th className="text-right p-2">Allocated</th>
                      {editMode && <th className="text-center p-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {references.map((ref, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2 font-medium text-blue-600">{ref.reference_name}</td>
                        <td className="p-2 text-gray-600">
                          {ref.invoice_date ? new Date(ref.invoice_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="text-right p-2">
                          {(ref.invoice_amount || 0).toLocaleString('en-US', {
                            style: 'currency',
                            currency: payment.currency || 'USD',
                          })}
                        </td>
                        <td className="text-right p-2">
                          {(ref.outstanding_amount || 0).toLocaleString('en-US', {
                            style: 'currency',
                            currency: payment.currency || 'USD',
                          })}
                        </td>
                        <td className="text-right p-2 font-semibold">
                          {editMode ? (
                            <Input
                              type="number"
                              className="w-32 ml-auto"
                              value={ref.allocated_amount}
                              onChange={(e) => handleReferenceChange(idx, 'allocated_amount', parseFloat(e.target.value))}
                            />
                          ) : (
                            ref.allocated_amount.toLocaleString('en-US', {
                              style: 'currency',
                              currency: payment.currency || 'USD',
                            })
                          )}
                        </td>
                        {editMode && (
                          <td className="text-center p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveReference(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {references.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  No invoices allocated to this payment yet
                </div>
              )}
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Payment Type</label>
                  <p className="p-2 bg-gray-50 rounded font-semibold">{payment.payment_type}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Party Type</label>
                  <p className="p-2 bg-gray-50 rounded">{payment.party_type}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Mode of Payment</label>
                  {editMode ? (
                    <Input
                      value={formData.mode_of_payment}
                      onChange={(e) => setFormData({ ...formData, mode_of_payment: e.target.value })}
                      placeholder="Cash, Check, Transfer, etc."
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.mode_of_payment || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Bank Account</label>
                  <p className="p-2 bg-gray-50 rounded">{payment.bank_account || '-'}</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium text-gray-700">Remarks</label>
                  {editMode ? (
                    <textarea
                      className="w-full p-2 border rounded"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.remarks || '-'}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              <Card className={`bg-gradient-to-br ${isReceive ? 'from-green-50 to-green-100' : 'from-red-50 to-red-100'} border-${isReceive ? 'green' : 'red'}-300`}>
                <CardHeader>
                  <CardTitle className={`${isReceive ? 'text-green-900' : 'text-red-900'}`}>
                    {isReceive ? 'Amount Received' : 'Amount Paid'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-4xl font-bold ${isReceive ? 'text-green-900' : 'text-red-900'}`}>
                    {(isReceive ? payment.received_amount : payment.paid_amount).toLocaleString('en-US', {
                      style: 'currency',
                      currency: payment.currency || 'USD',
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">Allocation Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Allocated</span>
                    <span className="text-xl font-bold">{totalAllocated.toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'USD' })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Amount Received/Paid</span>
                    <span>{(isReceive ? payment.received_amount : payment.paid_amount).toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'USD' })}</span>
                  </div>
                  <div className={`border-t-2 pt-3 flex justify-between items-center ${balance === 0 ? 'border-green-300' : 'border-orange-300'}`}>
                    <span className="font-bold">Balance</span>
                    <span className={`text-xl font-bold ${balance === 0 ? 'text-green-900' : 'text-orange-900'}`}>
                      {balance.toLocaleString('en-US', { style: 'currency', currency: payment.currency || 'USD' })}
                    </span>
                  </div>
                  {balance !== 0 && (
                    <div className="bg-orange-50 p-3 rounded border border-orange-200">
                      <p className="text-sm text-orange-800">
                        ⚠️ Unallocated balance exists. Please adjust allocations or add more invoices.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-sm">Invoice Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{references.length}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
