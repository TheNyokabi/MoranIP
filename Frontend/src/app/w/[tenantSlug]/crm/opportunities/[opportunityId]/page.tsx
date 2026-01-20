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
  Target,
  Calendar,
  User,
  TrendingUp,
  Briefcase,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface OpportunityStageProbability {
  [stage: string]: number;
}

interface Opportunity {
  name: string;
  opportunity_from: 'Lead' | 'Customer';
  party_name: string;
  opportunity_amount: number;
  currency?: string;
  probability: number;
  sales_stage: string;
  expected_close_date?: string;
  next_step?: string;
  title: string;
  with_items?: string;
  notes?: string;
  contact_by?: string;
  creation: string;
  modified: string;
}

const SALES_STAGES = [
  'Prospecting',
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Proposal',
  'Negotiation',
  'Closing',
];

const STAGE_COLORS: Record<string, string> = {
  'Prospecting': 'bg-blue-100 text-blue-800',
  'Qualification': 'bg-cyan-100 text-cyan-800',
  'Needs Analysis': 'bg-indigo-100 text-indigo-800',
  'Value Proposition': 'bg-purple-100 text-purple-800',
  'Proposal': 'bg-pink-100 text-pink-800',
  'Negotiation': 'bg-orange-100 text-orange-800',
  'Closing': 'bg-green-100 text-green-800',
};

export default function OpportunityDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const opportunityId = params.opportunityId as string;
  const tenantId = tenantSlug;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [formData, setFormData] = useState({
    title: '',
    opportunity_from: 'Lead' as Opportunity['opportunity_from'],
    party_name: '',
    opportunity_amount: 0,
    probability: 50,
    sales_stage: 'Prospecting',
    expected_close_date: '',
    next_step: '',
    contact_by: '',
    notes: '',
    with_items: '',
  });

  useEffect(() => {
    if (tenantId && opportunityId) {
      fetchOpportunity();
    }
  }, [tenantId, opportunityId]);

  const fetchOpportunity = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/crm/opportunities/${opportunityId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const oppData = data.data || data;
        setOpportunity(oppData);
        setFormData({
          title: oppData.title || '',
          opportunity_from: oppData.opportunity_from || 'Lead',
          party_name: oppData.party_name || '',
          opportunity_amount: oppData.opportunity_amount || 0,
          probability: oppData.probability || 50,
          sales_stage: oppData.sales_stage || 'Prospecting',
          expected_close_date: oppData.expected_close_date || '',
          next_step: oppData.next_step || '',
          contact_by: oppData.contact_by || '',
          notes: oppData.notes || '',
          with_items: oppData.with_items || '',
        });
      } else {
        setError('Failed to load opportunity');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!opportunity) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/crm/opportunities/${opportunityId}`,
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
        await fetchOpportunity();
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
    return <div className="p-8 text-center">Loading opportunity...</div>;
  }

  if (!opportunity) {
    return <ErrorHandler error="Opportunity not found" />;
  }

  const expectedClose = opportunity.expected_close_date
    ? new Date(opportunity.expected_close_date)
    : null;
  const daysUntilClose = expectedClose
    ? Math.ceil((expectedClose.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const expectedRevenue = (opportunity.opportunity_amount * opportunity.probability) / 100;

  const stageIndex = SALES_STAGES.indexOf(opportunity.sales_stage);
  const stageProgress = stageIndex >= 0 ? ((stageIndex + 1) / SALES_STAGES.length) * 100 : 0;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{opportunity.title}</h1>
            <p className="text-sm text-gray-600">
              {opportunity.party_name} • {opportunity.opportunity_from}
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
        <Badge className={STAGE_COLORS[opportunity.sales_stage] || 'bg-gray-100 text-gray-800'}>
          <Target className="h-3 w-3 mr-1" />
          {opportunity.sales_stage}
        </Badge>
        <Badge className="bg-purple-100 text-purple-800">
          <TrendingUp className="h-3 w-3 mr-1" />
          {opportunity.probability}%
        </Badge>
        <Badge variant="outline">
          {opportunity.opportunity_from === 'Lead' ? '🎯 Lead' : '👥 Customer'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Opportunity Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                type="number"
                value={formData.opportunity_amount}
                onChange={(e) =>
                  setFormData({ ...formData, opportunity_amount: parseFloat(e.target.value) })
                }
              />
            ) : (
              <p className="text-2xl font-bold text-gray-900">
                ${opportunity.opportunity_amount?.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Probability
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <select
                className="w-full p-2 border rounded"
                value={formData.probability}
                onChange={(e) =>
                  setFormData({ ...formData, probability: parseInt(e.target.value) })
                }
              >
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{opportunity.probability}%</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              Expected Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              ${expectedRevenue?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">Amount × Probability</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Close Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {daysUntilClose !== null ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{daysUntilClose}</p>
                <p className="text-xs text-gray-500">days remaining</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No target date set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Pipeline Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sales Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{opportunity.sales_stage}</span>
              <span className="text-xs text-gray-500">{stageProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
            <div className="flex gap-1 mt-4">
              {SALES_STAGES.map((stage) => (
                <div
                  key={stage}
                  className={`flex-1 h-6 rounded text-xs flex items-center justify-center cursor-pointer transition-colors ${
                    stage === opportunity.sales_stage
                      ? 'bg-blue-600 text-white'
                      : SALES_STAGES.indexOf(stage) < stageIndex
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={() => {
                    if (editMode) {
                      setFormData({ ...formData, sales_stage: stage });
                    }
                  }}
                  title={stage}
                >
                  {stage.split(' ')[0][0]}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
          <CardDescription>Deal tracking and timeline</CardDescription>
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
                  <label className="text-sm font-medium text-gray-700">Opportunity Title</label>
                  {editMode ? (
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Party Name</label>
                  {editMode ? (
                    <Input
                      value={formData.party_name}
                      onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                      disabled
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.party_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.opportunity_from}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          opportunity_from: e.target.value as Opportunity['opportunity_from'],
                        })
                      }
                    >
                      <option value="Lead">Lead</option>
                      <option value="Customer">Customer</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.opportunity_from}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Sales Stage</label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.sales_stage}
                      onChange={(e) =>
                        setFormData({ ...formData, sales_stage: e.target.value })
                      }
                    >
                      {SALES_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.sales_stage}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Next Step</label>
                {editMode ? (
                  <Input
                    value={formData.next_step}
                    onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                    placeholder="e.g., Schedule product demo"
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded">{formData.next_step || '-'}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    placeholder="Additional notes about this opportunity..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">
                    {formData.notes || '-'}
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
                    Expected Close Date
                  </label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.expected_close_date}
                      onChange={(e) =>
                        setFormData({ ...formData, expected_close_date: e.target.value })
                      }
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {formData.expected_close_date
                        ? new Date(formData.expected_close_date).toLocaleDateString()
                        : '-'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Contact By
                  </label>
                  {editMode ? (
                    <Input
                      value={formData.contact_by}
                      onChange={(e) => setFormData({ ...formData, contact_by: e.target.value })}
                      placeholder="Name or team"
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.contact_by || '-'}</p>
                  )}
                </div>
              </div>

              {/* Timeline Cards */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(opportunity.creation).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-900">Modified</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{new Date(opportunity.modified).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">With Items</label>
                  {editMode ? (
                    <Input
                      value={formData.with_items}
                      onChange={(e) => setFormData({ ...formData, with_items: e.target.value })}
                      placeholder="Item codes or names"
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.with_items || '-'}</p>
                  )}
                </div>
              </div>

              {/* Deal Summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-900">Base Amount</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-blue-900">
                      ${opportunity.opportunity_amount?.toLocaleString('en-US', {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-900">Win Probability</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-amber-900">{opportunity.probability}%</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-900">Expected Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-green-900">
                      ${expectedRevenue?.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
