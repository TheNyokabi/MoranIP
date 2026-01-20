'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore, findTenantBySlug } from '@/store/tenant-store';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Save, AlertCircle } from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';

interface Company {
  name: string;
  company_name: string;
  company_code: string;
  company_type: string;
  default_currency: string;
  country: string;
  date_of_incorporation: string;
  is_group: boolean;
  company_logo: string;
}

export default function CompanySetupPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { currentTenant } = useAuthStore();
  const { availableTenants } = useTenantStore();

  const [tenantId, setTenantId] = useState<string | null>(null);
  
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    company_code: '',
    company_type: 'Individual',
    default_currency: 'KES',
    country: 'Kenya',
    date_of_incorporation: '',
    company_logo: '',
    phone: '',
    email: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    tax_id: '',
  });

  useEffect(() => {
    const tenant = findTenantBySlug(tenantSlug, availableTenants);
    if (tenant?.id) {
      setTenantId(tenant.id);
      return;
    }

    if (currentTenant?.id) {
      const currentSlug = currentTenant.code || currentTenant.id;
      if (currentSlug === tenantSlug || currentTenant.id === tenantSlug) {
        setTenantId(currentTenant.id);
        return;
      }
    }

    if (tenantSlug && tenantSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      setTenantId(tenantSlug);
    }
  }, [tenantSlug, availableTenants, currentTenant]);

  useEffect(() => {
    if (tenantId) fetchCompany();
  }, [tenantId]);

  const fetchCompany = async () => {
    setLoading(true);
    try {
      if (!tenantId) return;
      const data = await apiFetch<any>(`/tenants/${tenantId}/erp/accounting/companies`);
      const companies = Array.isArray(data) ? data : data.data || [];
      if (companies.length > 0) {
        setCompany(companies[0]);
        setFormData({
          company_name: companies[0].company_name || '',
          company_code: companies[0].company_code || '',
          company_type: companies[0].company_type || 'Individual',
          default_currency: companies[0].default_currency || 'KES',
          country: companies[0].country || 'Kenya',
          date_of_incorporation: companies[0].date_of_incorporation || '',
          company_logo: companies[0].company_logo || '',
          phone: '',
          email: '',
          website: '',
          address_line1: '',
          address_line2: '',
          city: '',
          postal_code: '',
          tax_id: '',
        });
      }
    } catch (err) {
      setError('Failed to load company information');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompany = async () => {
    setIsSaving(true);
    try {
      if (!tenantId) {
        setError('Tenant not resolved yet');
        return;
      }

      const method = company ? 'PUT' : 'POST';
      const endpoint = company
        ? `/tenants/${tenantId}/erp/accounting/companies/${encodeURIComponent(company.name)}`
        : `/tenants/${tenantId}/erp/accounting/companies`;

      await apiFetch(endpoint, {
        method,
        body: JSON.stringify(formData),
      });

      setError(null);
      await fetchCompany();
    } catch (err) {
      setError('Failed to save company information');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const currencies = ['KES', 'USD', 'EUR', 'GBP', 'INR'];
  const companyTypes = ['Individual', 'Partnership', 'Private Limited', 'Public Limited', 'Cooperative'];
  const countries = ['Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Company Setup</h1>
          <p className="text-gray-600 mt-1">Configure your company information and details</p>
        </div>
        <Button onClick={handleSaveCompany} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      {/* Company Status Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Company Name</p>
              <p className="text-lg font-semibold">{formData.company_name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Currency</p>
              <p className="text-lg font-semibold">{formData.default_currency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Country</p>
              <p className="text-lg font-semibold">{formData.country}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Information</TabsTrigger>
          <TabsTrigger value="financial">Financial Settings</TabsTrigger>
          <TabsTrigger value="address">Address & Contact</TabsTrigger>
        </TabsList>

        {/* Basic Information */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Company Information</CardTitle>
              <CardDescription>
                Essential company details for legal and operational purposes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8">Loading company information...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Company Name *</label>
                      <Input
                        value={formData.company_name}
                        onChange={(e) =>
                          setFormData({ ...formData, company_name: e.target.value })
                        }
                        placeholder="e.g., Acme Corporation"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Company Code</label>
                      <Input
                        value={formData.company_code}
                        onChange={(e) =>
                          setFormData({ ...formData, company_code: e.target.value })
                        }
                        placeholder="e.g., ACM"
                        className="mt-2"
                        disabled={!!company}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Company Type *</label>
                      <select
                        value={formData.company_type}
                        onChange={(e) =>
                          setFormData({ ...formData, company_type: e.target.value })
                        }
                        className="w-full mt-2 border rounded p-2"
                      >
                        {companyTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Date of Incorporation</label>
                      <Input
                        type="date"
                        value={formData.date_of_incorporation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            date_of_incorporation: e.target.value,
                          })
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tax ID / Registration Number</label>
                    <Input
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      placeholder="e.g., P001234567B"
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Settings */}
        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Configuration</CardTitle>
              <CardDescription>Set default currency and accounting parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Default Currency *</label>
                  <select
                    value={formData.default_currency}
                    onChange={(e) =>
                      setFormData({ ...formData, default_currency: e.target.value })
                    }
                    className="w-full mt-2 border rounded p-2"
                  >
                    {currencies.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    Cannot be changed after first transaction
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Country *</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full mt-2 border rounded p-2"
                  >
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Card className="bg-yellow-50 border-yellow-200 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Important</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      Currency and country settings affect tax calculations, accounting standards, and
                      regulatory compliance. These settings are critical and may affect existing data.
                    </p>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address & Contact */}
        <TabsContent value="address" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Address & Contact Information</CardTitle>
              <CardDescription>Company office location and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+254 20 XXXX XXXX"
                    className="mt-2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-sm font-medium">Website</label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.company.com"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Street Address Line 1</label>
                <Input
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  placeholder="Building and street name"
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Street Address Line 2</label>
                <Input
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="Apt, suite, unit number"
                  className="mt-2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Nairobi"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Postal Code</label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="Postal code"
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
