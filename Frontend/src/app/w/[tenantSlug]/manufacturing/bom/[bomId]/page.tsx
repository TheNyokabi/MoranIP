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
  Package,
  Layers,
  DollarSign,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

interface BOMComponent {
  name: string;
  item_code: string;
  item_name: string;
  description?: string;
  qty: number;
  stock_uom: string;
  rate: number;
  amount: number;
  standard_rate?: number;
}

interface BOM {
  name: string;
  item: string;
  item_name: string;
  description?: string;
  quantity: number;
  uom: string;
  docstatus: 0 | 1 | 2;
  items: BOMComponent[];
  total_cost: number;
  total_material_cost: number;
  total_labor_cost: number;
  costing_method?: string;
  company?: string;
  currency?: string;
  enabled: boolean;
}

export default function BOMDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const bomId = params.bomId as string;
  const tenantId = tenantSlug;

  const [bom, setBom] = useState<BOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('components');
  const [editingComponents, setEditingComponents] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    company: '',
    enabled: true,
  });

  const [components, setComponents] = useState<BOMComponent[]>([]);
  const [newComponent, setNewComponent] = useState({
    item_code: '',
    qty: 1,
    rate: 0,
  });

  useEffect(() => {
    if (tenantId && bomId) {
      fetchBOM();
    }
  }, [tenantId, bomId]);

  const fetchBOM = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/bom/${bomId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const bomData = data.data || data;
        setBom(bomData);
        setComponents(bomData.items || []);
        setFormData({
          description: bomData.description || '',
          company: bomData.company || '',
          enabled: bomData.enabled !== false,
        });
      } else {
        setError('Failed to load BOM');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!bom) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/manufacturing/bom/${bomId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            description: formData.description,
            company: formData.company,
            enabled: formData.enabled,
            items: components,
          }),
        }
      );

      if (response.ok) {
        setEditMode(false);
        await fetchBOM();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComponent = () => {
    if (!newComponent.item_code) return;
    
    const component: BOMComponent = {
      name: `${bom?.name}-${components.length + 1}`,
      item_code: newComponent.item_code,
      item_name: newComponent.item_code,
      qty: newComponent.qty,
      stock_uom: 'Nos',
      rate: newComponent.rate,
      amount: newComponent.qty * newComponent.rate,
    };
    
    setComponents([...components, component]);
    setNewComponent({ item_code: '', qty: 1, rate: 0 });
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleComponentChange = (index: number, field: string, value: any) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'qty' || field === 'rate') {
      updated[index].amount = updated[index].qty * updated[index].rate;
    }
    
    setComponents(updated);
  };

  const totalMaterialCost = components.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalLaborCost = bom?.total_labor_cost || 0;
  const totalCost = totalMaterialCost + totalLaborCost;
  const perUnitCost = bom ? totalCost / bom.quantity : 0;

  if (loading) {
    return <div className="p-8 text-center">Loading BOM...</div>;
  }

  if (!bom) {
    return <ErrorHandler error="BOM not found" />;
  }

  const isDraft = bom.docstatus === 0;
  const isSubmitted = bom.docstatus === 1;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{bom.name}</h1>
            <p className="text-sm text-gray-600">BOM for {bom.item_name}</p>
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

      {/* Status Badge */}
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
        {bom.enabled && (
          <Badge className="bg-blue-100 text-blue-800">
            <Check className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Item Code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{bom.item}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Base Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{bom.quantity}</p>
            <p className="text-xs text-gray-500">{bom.uom}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Material Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {totalMaterialCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
            </p>
            <p className="text-xs text-gray-500">{components.length} components</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Per Unit Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {perUnitCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
            </p>
            <p className="text-xs text-gray-500">{bom.costing_method || 'Fifo'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>BOM Details</CardTitle>
          <CardDescription>Bill of Materials and component breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="costing">Costing</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            {/* Components Tab */}
            <TabsContent value="components" className="space-y-4">
              {editMode && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <h3 className="font-semibold text-sm">Add Component</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      placeholder="Item Code"
                      value={newComponent.item_code}
                      onChange={(e) => setNewComponent({ ...newComponent, item_code: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={newComponent.qty}
                      onChange={(e) => setNewComponent({ ...newComponent, qty: parseFloat(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="Rate"
                      value={newComponent.rate}
                      onChange={(e) => setNewComponent({ ...newComponent, rate: parseFloat(e.target.value) })}
                    />
                    <Button onClick={handleAddComponent} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Item Code</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">UOM</th>
                      <th className="text-right p-2">Rate</th>
                      <th className="text-right p-2">Amount</th>
                      {editMode && <th className="text-center p-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {components.map((component, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2 font-medium text-blue-600">{component.item_code}</td>
                        <td className="p-2 text-gray-600">{component.item_name}</td>
                        <td className="text-right p-2">
                          {editMode ? (
                            <Input
                              type="number"
                              className="w-20 ml-auto"
                              value={component.qty}
                              onChange={(e) => handleComponentChange(idx, 'qty', parseFloat(e.target.value))}
                            />
                          ) : (
                            component.qty
                          )}
                        </td>
                        <td className="text-right p-2">{component.stock_uom}</td>
                        <td className="text-right p-2">
                          {editMode ? (
                            <Input
                              type="number"
                              className="w-24 ml-auto"
                              value={component.rate}
                              onChange={(e) => handleComponentChange(idx, 'rate', parseFloat(e.target.value))}
                            />
                          ) : (
                            component.rate.toFixed(2)
                          )}
                        </td>
                        <td className="text-right p-2 font-semibold">
                          {component.amount.toFixed(2)}
                        </td>
                        {editMode && (
                          <td className="text-center p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveComponent(idx)}
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

              <div className="flex justify-end gap-2 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-600">Total Material Cost</p>
                  <p className="text-2xl font-bold">
                    {totalMaterialCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Costing Tab */}
            <TabsContent value="costing" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Material Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-900">
                      {totalMaterialCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-900">Labor Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-orange-900">
                      {totalLaborCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-300">
                <CardHeader>
                  <CardTitle className="text-green-900">Total Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Material Cost</span>
                    <span>{totalMaterialCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Labor Cost</span>
                    <span>{totalLaborCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}</span>
                  </div>
                  <div className="border-t-2 border-green-300 pt-3 flex justify-between items-center">
                    <span className="font-bold">Total Cost for {bom.quantity} {bom.uom}</span>
                    <span className="text-2xl font-bold text-green-900">
                      {totalCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}
                    </span>
                  </div>
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <p className="text-sm text-green-800">
                      Per unit cost: <span className="font-bold">{perUnitCost.toLocaleString('en-US', { style: 'currency', currency: bom.currency || 'USD' })}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  {editMode ? (
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.description || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Company</label>
                  {editMode ? (
                    <Input
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.company || '-'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {isSubmitted && <Badge className="bg-green-100 text-green-800">Submitted</Badge>}
                    {isDraft && <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>}
                    {bom.enabled && <Badge className="bg-blue-100 text-blue-800">Enabled</Badge>}
                  </div>
                </div>
              </div>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm text-blue-900 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Components Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Total Components: <span className="font-bold">{components.length}</span></p>
                  <p>Costing Method: <span className="font-bold">{bom.costing_method || 'FIFO'}</span></p>
                  <p>Currency: <span className="font-bold">{bom.currency || 'USD'}</span></p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
