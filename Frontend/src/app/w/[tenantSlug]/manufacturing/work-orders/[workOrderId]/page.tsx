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
  Factory,
  Package,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Gauge,
  Zap,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface WorkOrder {
  name: string;
  item_code: string;
  item_name?: string;
  bom_no: string;
  qty: number;
  produced_qty?: number;
  status: 'Draft' | 'Not Started' | 'In Progress' | 'Completed' | 'Stopped';
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  production_item?: string;
  warehouse?: string;
  source_warehouse?: string;
  description?: string;
  total_consumed_material_cost?: number;
  total_time_in_mins?: number;
  creation: string;
  modified: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'Not Started': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Stopped': 'bg-red-100 text-red-800',
};

export default function WorkOrderDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const workOrderId = params.workOrderId as string;
  const tenantId = tenantSlug;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [formData, setFormData] = useState({
    item_code: '',
    item_name: '',
    bom_no: '',
    qty: 0,
    produced_qty: 0,
    total_time_in_mins: 0,
    status: 'Not Started' as const,
    planned_start_date: '',
    planned_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    warehouse: '',
    source_warehouse: '',
    description: '',
  });

  useEffect(() => {
    if (tenantId && workOrderId) {
      fetchWorkOrder();
    }
  }, [tenantId, workOrderId]);

  const fetchWorkOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/work-orders/${workOrderId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const woData = data.data || data;
        setWorkOrder(woData);
        setFormData({
          item_code: woData.item_code || '',
          item_name: woData.item_name || '',
          bom_no: woData.bom_no || '',
          qty: woData.qty || 0,
          produced_qty: woData.produced_qty || 0,
          total_time_in_mins: Number(woData.total_time_in_mins) || 0,
          status: woData.status || 'Not Started',
          planned_start_date: woData.planned_start_date || '',
          planned_end_date: woData.planned_end_date || '',
          actual_start_date: woData.actual_start_date || '',
          actual_end_date: woData.actual_end_date || '',
          warehouse: woData.warehouse || '',
          source_warehouse: woData.source_warehouse || '',
          description: woData.description || '',
        });
      } else {
        setError('Failed to load work order');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workOrder) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/work-orders/${workOrderId}`,
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
        await fetchWorkOrder();
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
    return <div className="p-8 text-center">Loading work order...</div>;
  }

  if (!workOrder) {
    return <ErrorHandler error="Work Order not found" />;
  }

  const completionPercentage = formData.qty > 0 
    ? Math.round(((formData.produced_qty || 0) / formData.qty) * 100)
    : 0;

  const plannedStart = formData.planned_start_date ? new Date(formData.planned_start_date) : null;
  const plannedEnd = formData.planned_end_date ? new Date(formData.planned_end_date) : null;
  const plannedDays = plannedStart && plannedEnd
    ? Math.ceil((plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const actualStart = formData.actual_start_date ? new Date(formData.actual_start_date) : null;
  const actualEnd = formData.actual_end_date ? new Date(formData.actual_end_date) : null;
  const actualDays = actualStart && actualEnd
    ? Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{workOrder.name}</h1>
            <p className="text-sm text-gray-600">
              🏭 {formData.item_name || formData.item_code}
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

      {/* Status Badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge className={STATUS_COLORS[formData.status] || 'bg-gray-100 text-gray-800'}>
          <Factory className="h-3 w-3 mr-1" />
          {formData.status}
        </Badge>
        <Badge className="bg-purple-100 text-purple-800">
          <Gauge className="h-3 w-3 mr-1" />
          {completionPercentage}% Complete
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Package className="h-4 w-4" />
              Quantity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formData.qty}</p>
            <p className="text-xs text-gray-500">units to produce</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Produced
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="number"
                value={formData.produced_qty}
                onChange={(e) =>
                  setFormData({ ...formData, produced_qty: parseFloat(e.target.value) || 0 })
                }
                min="0"
              />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">{formData.produced_qty || 0}</p>
                <p className="text-xs text-gray-500">units completed</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Gauge className="h-4 w-4" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{completionPercentage}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {formData.total_time_in_mins ? (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(formData.total_time_in_mins / 60)}h
                </p>
                <p className="text-xs text-gray-500">{formData.total_time_in_mins % 60}m</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Work Order Details</CardTitle>
          <CardDescription>Production execution and timeline</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Item Code</label>
                  {editMode ? (
                    <Input
                      value={formData.item_code}
                      onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                      disabled
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.item_code}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Item Name</label>
                  {editMode ? (
                    <Input
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.item_name || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">BOM Number</label>
                  {editMode ? (
                    <Input
                      value={formData.bom_no}
                      onChange={(e) => setFormData({ ...formData, bom_no: e.target.value })}
                      disabled
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.bom_no}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as any })
                      }
                    >
                      <option>Draft</option>
                      <option>Not Started</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                      <option>Stopped</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.status}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description</label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={4}
                    placeholder="Work order description..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">
                    {formData.description || '-'}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Planned Start Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.planned_start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, planned_start_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {plannedStart ? plannedStart.toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Planned End Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.planned_end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, planned_end_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {plannedEnd ? plannedEnd.toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Actual Start Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.actual_start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, actual_start_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {actualStart ? actualStart.toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Actual End Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.actual_end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, actual_end_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {actualEnd ? actualEnd.toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline Summary */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Planned Duration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-blue-900">{plannedDays} days</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Actual Duration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-purple-900">{actualDays > 0 ? actualDays : '-'} days</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Warehouse</label>
                  {editMode ? (
                    <Input
                      value={formData.warehouse}
                      onChange={(e) =>
                        setFormData({ ...formData, warehouse: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.warehouse || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Source Warehouse</label>
                  {editMode ? (
                    <Input
                      value={formData.source_warehouse}
                      onChange={(e) =>
                        setFormData({ ...formData, source_warehouse: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.source_warehouse || '-'}</p>
                  )}
                </div>
              </div>

              {/* Production Summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Total Quantity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-900">{formData.qty}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Produced</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-900">{formData.produced_qty || 0}</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-900">Remaining</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-900">
                      {Math.max(0, formData.qty - (formData.produced_qty || 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
