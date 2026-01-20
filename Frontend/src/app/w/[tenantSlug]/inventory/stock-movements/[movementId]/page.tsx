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
  Package,
  Warehouse,
  Calendar,
  User,
  AlertCircle,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface StockMovement {
  name: string;
  item_code: string;
  item_name?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  qty: number;
  docstatus?: number;
  posting_date?: string;
  posting_time?: string;
  reason_for_issue?: string;
  notes?: string;
  creation: string;
  modified: string;
}

const STATUS_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-800',
  1: 'bg-green-100 text-green-800',
  2: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Submitted',
  2: 'Cancelled',
};

export default function StockMovementDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const movementId = params.movementId as string;
  const tenantId = tenantSlug;

  const [movement, setMovement] = useState<StockMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    from_warehouse: '',
    to_warehouse: '',
    qty: 0,
    posting_date: '',
    posting_time: '',
    reason_for_issue: '',
    notes: '',
  });

  useEffect(() => {
    if (tenantId && movementId) {
      fetchMovement();
    }
  }, [tenantId, movementId]);

  const fetchMovement = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/stock-movements/${movementId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const movData = data.data || data;
        setMovement(movData);
        setFormData({
          item_code: movData.item_code || '',
          item_name: movData.item_name || '',
          from_warehouse: movData.from_warehouse || '',
          to_warehouse: movData.to_warehouse || '',
          qty: movData.qty || 0,
          posting_date: movData.posting_date || '',
          posting_time: movData.posting_time || '',
          reason_for_issue: movData.reason_for_issue || '',
          notes: movData.notes || '',
        });
      } else {
        setError('Failed to load stock movement');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!movement) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/stock-movements/${movementId}`,
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
        await fetchMovement();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading stock movement...</div>;
  }

  if (!movement) {
    return <ErrorHandler error="Stock Movement not found" />;
  }

  const postingDate = formData.posting_date ? new Date(formData.posting_date) : null;
  const status = movement.docstatus || 0;
  const isSubmitted = status === 1;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{movement.name}</h1>
            <p className="text-sm text-gray-600">
              📦 {formData.item_name || formData.item_code}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isSubmitted && !editMode && (
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
        <Badge className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}>
          {STATUS_LABELS[status] || 'Unknown'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Package className="h-4 w-4" />
              Item Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{formData.item_code}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Warehouse className="h-4 w-4" />
              From Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.from_warehouse}
                onChange={(e) =>
                  setFormData({ ...formData, from_warehouse: e.target.value })
                }
                size={30}
              />
            ) : (
              <p className="text-sm font-medium">{formData.from_warehouse || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Warehouse className="h-4 w-4" />
              To Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.to_warehouse}
                onChange={(e) =>
                  setFormData({ ...formData, to_warehouse: e.target.value })
                }
                size={30}
              />
            ) : (
              <p className="text-sm font-medium">{formData.to_warehouse || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Hash className="h-4 w-4" />
              Quantity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="number"
                value={formData.qty}
                onChange={(e) =>
                  setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })
                }
              />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{formData.qty}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Movement Details</CardTitle>
          <CardDescription>Warehouse transfer information</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="info">Information</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Item Name</label>
                  {editMode ? (
                    <Input
                      value={formData.item_name}
                      onChange={(e) =>
                        setFormData({ ...formData, item_name: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.item_name || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Posting Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.posting_date}
                      onChange={(e) =>
                        setFormData({ ...formData, posting_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {postingDate ? postingDate.toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Posting Time</label>
                  {editMode ? (
                    <Input
                      type="time"
                      value={formData.posting_time}
                      onChange={(e) =>
                        setFormData({ ...formData, posting_time: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.posting_time || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Reason for Issue</label>
                  {editMode ? (
                    <Input
                      value={formData.reason_for_issue}
                      onChange={(e) =>
                        setFormData({ ...formData, reason_for_issue: e.target.value })
                      }
                      placeholder="Transfer reason"
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {formData.reason_for_issue || '-'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    placeholder="Additional notes..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">
                    {formData.notes || '-'}
                  </p>
                )}
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
                      {new Date(movement.creation).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {new Date(movement.modified).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge className={STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}>
                      {STATUS_LABELS[status] || 'Unknown'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
                <CardHeader>
                  <CardTitle className="text-sm">Movement Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>✓ Item: {formData.item_code}</p>
                  <p>✓ Quantity: {formData.qty} units</p>
                  <p>✓ From: {formData.from_warehouse || 'Not specified'}</p>
                  <p>✓ To: {formData.to_warehouse || 'Not specified'}</p>
                  <p>✓ Status: {STATUS_LABELS[status] || 'Unknown'}</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
