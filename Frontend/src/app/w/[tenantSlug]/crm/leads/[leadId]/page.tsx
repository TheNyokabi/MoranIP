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
  Mail,
  Phone,
  Globe,
  MapPin,
  Building2,
  Star,
  Zap,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { Badge } from '@/components/ui/badge';

interface Lead {
  name: string;
  lead_name: string;
  email_id?: string;
  phone?: string;
  mobile_no?: string;
  company_name?: string;
  website?: string;
  status: 'Open' | 'Converted' | 'Junk' | 'Lost';
  lead_owner?: string;
  source?: string;
  industry?: string;
  country?: string;
  city?: string;
  rating?: number;
  notes?: string;
  creation: string;
  modified: string;
  days_as_lead?: number;
}

export default function LeadDetailPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const leadId = params.leadId as string;
  const tenantId = tenantSlug;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isConverting, setIsConverting] = useState(false);

  const [formData, setFormData] = useState({
    lead_name: '',
    email_id: '',
    phone: '',
    mobile_no: '',
    company_name: '',
    website: '',
    source: '',
    industry: '',
    status: 'Open' as const,
    country: '',
    city: '',
    rating: 0,
    notes: '',
  });

  useEffect(() => {
    if (tenantId && leadId) {
      fetchLead();
    }
  }, [tenantId, leadId]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/crm/leads/${leadId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const leadData = data.data || data;
        setLead(leadData);
        setFormData({
          lead_name: leadData.lead_name || '',
          email_id: leadData.email_id || '',
          phone: leadData.phone || '',
          mobile_no: leadData.mobile_no || '',
          company_name: leadData.company_name || '',
          website: leadData.website || '',
          source: leadData.source || '',
          industry: leadData.industry || '',
          status: leadData.status || 'Open',
          country: leadData.country || '',
          city: leadData.city || '',
          rating: leadData.rating || 0,
          notes: leadData.notes || '',
        });
      } else {
        setError('Failed to load lead');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/crm/leads/${leadId}`,
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
        await fetchLead();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!lead) return;
    setIsConverting(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/crm/leads/${leadId}/convert`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            to_customer: true,
            customer_name: formData.company_name || formData.lead_name,
          }),
        }
      );

      if (response.ok) {
        await fetchLead();
        alert('Lead converted to Customer successfully!');
      } else {
        setError('Failed to convert lead');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsConverting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading lead...</div>;
  }

  if (!lead) {
    return <ErrorHandler error="Lead not found" />;
  }

  const statusColors: Record<string, string> = {
    Open: 'bg-blue-100 text-blue-800',
    Converted: 'bg-green-100 text-green-800',
    Junk: 'bg-gray-100 text-gray-800',
    Lost: 'bg-red-100 text-red-800',
  };

  const createdDate = new Date(lead.creation);
  const modifiedDate = new Date(lead.modified);

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{lead.lead_name}</h1>
            <p className="text-sm text-gray-600">{lead.company_name || 'No company'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {lead.status === 'Open' && !editMode && (
            <>
              <Button onClick={() => setEditMode(true)} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleConvert} disabled={isConverting} className="bg-green-600">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isConverting ? 'Converting...' : 'Convert'}
              </Button>
            </>
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
      <div className="flex gap-2 flex-wrap">
        <Badge className={statusColors[lead.status]}>
          <Zap className="h-3 w-3 mr-1" />
          {lead.status}
        </Badge>
        {lead.rating && lead.rating > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Star className="h-3 w-3 mr-1" />
            {lead.rating}/5
          </Badge>
        )}
        {lead.source && (
          <Badge className="bg-purple-100 text-purple-800">
            Source: {lead.source}
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Mail className="h-4 w-4" />
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.email_id}
                onChange={(e) => setFormData({ ...formData, email_id: e.target.value })}
                placeholder="email@example.com"
              />
            ) : (
              <p className="text-sm font-medium break-all">{lead.email_id || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Phone
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            ) : (
              <p className="text-sm font-medium">{lead.phone || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Globe className="h-4 w-4" />
              Website
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="www.example.com"
              />
            ) : (
              <p className="text-sm font-medium text-blue-600 break-all">{lead.website || '-'}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Days as Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{lead.days_as_lead || 0}</p>
            <p className="text-xs text-gray-500">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Details</CardTitle>
          <CardDescription>Contact and company information</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Lead Name</label>
                  {editMode ? (
                    <Input
                      value={formData.lead_name}
                      onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.lead_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option>Open</option>
                      <option>Converted</option>
                      <option>Junk</option>
                      <option>Lost</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.status}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Mobile</label>
                  {editMode ? (
                    <Input
                      value={formData.mobile_no}
                      onChange={(e) => setFormData({ ...formData, mobile_no: e.target.value })}
                      placeholder="+1 234 567 8900"
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.mobile_no || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Source</label>
                  {editMode ? (
                    <Input
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="Web, Referral, Cold Call, etc."
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.source || '-'}</p>
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
                    placeholder="Additional notes about this lead..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">{formData.notes || '-'}</p>
                )}
              </div>
            </TabsContent>

            {/* Company Tab */}
            <TabsContent value="company" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Company Name</label>
                  {editMode ? (
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.company_name || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Industry</label>
                  {editMode ? (
                    <Input
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder="Technology, Healthcare, Finance, etc."
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.industry || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    City
                  </label>
                  {editMode ? (
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.city || '-'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  {editMode ? (
                    <Input
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.country || '-'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    Rating
                  </label>
                  {editMode ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                    >
                      <option value="0">Unrated</option>
                      <option value="1">1 Star</option>
                      <option value="2">2 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="5">5 Stars</option>
                    </select>
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">
                      {formData.rating > 0 ? `${formData.rating}/5 ⭐` : 'Unrated'}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-sm">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Created:</span>
                    <span className="font-medium">{createdDate.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Last Modified:</span>
                    <span className="font-medium">{modifiedDate.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Days as Lead:</span>
                    <span className="font-bold text-lg">{lead.days_as_lead || 0} days</span>
                  </div>
                </CardContent>
              </Card>

              {lead.lead_owner && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-900">Assigned To</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{lead.lead_owner}</p>
                  </CardContent>
                </Card>
              )}

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Lead Status Summary</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p>✓ Contact information captured</p>
                  <p>✓ Lead assigned to {lead.lead_owner || 'sales team'}</p>
                  <p>✓ Pending conversion to customer</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
