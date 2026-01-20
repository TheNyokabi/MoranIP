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
  Zap,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Clipboard,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface ProductionPlan {
  name: string;
  company: string;
  fiscal_year?: string;
  sales_order?: string;
  status: 'Draft' | 'In Process' | 'Completed' | 'Cancelled';
  planned_start_date?: string;
  planned_end_date?: string;
  total_planned_qty?: number;
  total_produced_qty?: number;
  creation: string;
  modified: string;
  mr_qty?: number;
  purchase_request_created?: boolean;
  wo_created?: boolean;
  description?: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-gray-100 text-gray-800',
  'In Process': 'bg-blue-100 text-blue-800',
  'Completed': 'bg-green-100 text-green-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function ProductionPlanDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const planId = params.planId as string;
  const tenantId = tenantSlug;

  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [formData, setFormData] = useState({
    company: '',
    fiscal_year: '',
    sales_order: '',
    status: 'Draft' as const,
    planned_start_date: '',
    planned_end_date: '',
    total_planned_qty: 0,
    total_produced_qty: 0,
    description: '',
  });

  useEffect(() => {
    if (tenantId && planId) {
      fetchPlan();
    }
  }, [tenantId, planId]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/production-plans/${planId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const planData = data.data || data;
        setPlan(planData);
        setFormData({
          company: planData.company || '',
          fiscal_year: planData.fiscal_year || '',
          sales_order: planData.sales_order || '',
          status: planData.status || 'Draft',
          planned_start_date: planData.planned_start_date || '',
          planned_end_date: planData.planned_end_date || '',
          total_planned_qty: planData.total_planned_qty || 0,
          total_produced_qty: planData.total_produced_qty || 0,
          description: planData.description || '',
        });
      } else {
        setError('Failed to load production plan');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/production-plans/${planId}`,
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
        await fetchPlan();
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
    return <div className="p-8 text-center">Loading production plan...</div>;
  }

  if (!plan) {
    return <ErrorHandler error="Production Plan not found" />;
  }

  const completionPercentage = formData.total_planned_qty > 0
    ? Math.round(((formData.total_produced_qty || 0) / formData.total_planned_qty) * 100)
    : 0;

  const plannedStart = formData.planned_start_date ? new Date(formData.planned_start_date) : null;
  const plannedEnd = formData.planned_end_date ? new Date(formData.planned_end_date) : null;
  const plannedDays = plannedStart && plannedEnd
    ? Math.ceil((plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const remaining = Math.max(0, formData.total_planned_qty - (formData.total_produced_qty || 0));

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{plan.name}</h1>
            <p className="text-sm text-gray-600">
              🏢 {formData.company || 'Company'} • {plan.fiscal_year || 'FY'}
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
          <Zap className="h-3 w-3 mr-1" />
          {formData.status}
        </Badge>
        <Badge className="bg-purple-100 text-purple-800">
          <TrendingUp className="h-3 w-3 mr-1" />
          {completionPercentage}% Complete
        </Badge>
        {plan.wo_created && (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Work Orders Created
          </Badge>
        )}
        {plan.purchase_request_created && (
          <Badge className="bg-blue-100 text-blue-800">
            <Clipboard className="h-3 w-3 mr-1" />
            PR Created
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Package className="h-4 w-4" />
              Planned Qty
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="number"
                value={formData.total_planned_qty}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    total_planned_qty: parseFloat(e.target.value) || 0,
                  })
                }
              />
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {formData.total_planned_qty}
                </p>
                <p className="text-xs text-gray-500">units planned</p>
              </>
            )}
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
                value={formData.total_produced_qty}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    total_produced_qty: parseFloat(e.target.value) || 0,
                  })
                }
                min="0"
              />
            ) : (
              <>
                <p className="text-2xl font-bold text-green-600">
                  {formData.total_produced_qty || 0}
                </p>
                <p className="text-xs text-gray-500">units produced</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
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
              <AlertCircle className="h-4 w-4" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{remaining}</p>
            <p className="text-xs text-gray-500">units remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Production Plan Details</CardTitle>
          <CardDescription>Planned schedule and inventory</CardDescription>
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
                  <label className="text-sm font-medium text-gray-700">Company</label>
                  {editMode ? (
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.company}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Fiscal Year</label>
                  {editMode ? (
                    <Input
                      value={formData.fiscal_year}
                      onChange={(e) =>
                        setFormData({ ...formData, fiscal_year: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.fiscal_year || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Sales Order</label>
                  {editMode ? (
                    <Input
                      value={formData.sales_order}
                      onChange={(e) =>
                        setFormData({ ...formData, sales_order: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.sales_order || '-'}</p>
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
                      <option>In Process</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
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
                    placeholder="Production plan description..."
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
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Planned Start Date
                  </label>
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
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Planned End Date
                  </label>
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
              </div>

              {/* Timeline Summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
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
                    <CardTitle className="text-sm text-purple-900">Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(plan.creation).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-pink-50 border-pink-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-pink-900">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(plan.modified).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              {/* Material Request & Work Order Status */}
              <div className="grid grid-cols-2 gap-4">
                <Card className={plan.purchase_request_created ? 'bg-green-50 border-green-200' : 'bg-gray-50'}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Material Request</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plan.purchase_request_created ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Created
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Created</Badge>
                    )}
                  </CardContent>
                </Card>

                <Card className={plan.wo_created ? 'bg-green-50 border-green-200' : 'bg-gray-50'}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Work Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plan.wo_created ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Created
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Created</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Production Summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Planned Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-900">
                      {formData.total_planned_qty}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Produced Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-900">
                      {formData.total_produced_qty || 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-900">Remaining</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-900">{remaining}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Completion Status */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 mt-6">
                <CardHeader>
                  <CardTitle className="text-sm">Completion Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Overall Progress</span>
                    <span className="text-lg font-bold text-blue-600">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-3 rounded-full transition-all"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-600">
                    {formData.total_produced_qty || 0} of {formData.total_planned_qty} units
                    completed
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
