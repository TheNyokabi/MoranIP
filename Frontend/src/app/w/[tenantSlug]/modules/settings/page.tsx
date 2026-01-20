'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useModuleStore } from '@/store/module-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ErrorHandler } from '@/components/error-handler';
import { 
  Building2, 
  DollarSign, 
  Globe, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Save,
  Upload,
  AlertCircle,
  Zap,
  Users,
  Package,
  TrendingUp,
  FileText,
  Calendar,
  Clock,
  Image as ImageIcon,
  Eye,
  Edit2,
  X,
  Check,
  Sparkles
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface SettingsFormData {
  // Company Information
  company_name?: string;
  legal_name?: string;
  business_type?: string;
  registration_number?: string;
  tax_id?: string;
  
  // Contact Information
  email?: string;
  phone?: string;
  website?: string;
  
  // Address
  street_address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  
  // Financial Settings
  currency: string;
  fiscal_year_start_month: number;
  accounting_method: string;
  
  // Business Settings
  industry?: string;
  employees_count?: number;
  annual_revenue?: string;
  
  // Feature Toggles
  enable_invoicing: boolean;
  enable_pos: boolean;
  enable_inventory: boolean;
  enable_hr: boolean;
  enable_projects: boolean;
  
  // Configuration
  logo_url?: string;
  language: string;
  timezone: string;
  setup_completed: boolean;
}

export default function SettingsPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const { user, currentTenant, token } = useAuthStore();
  const { tenantSettings, fetchTenantSettings, updateTenantSettings, loading, error, clearError } = useModuleStore();
  
  const [formData, setFormData] = useState<SettingsFormData>({
    currency: 'KES',
    fiscal_year_start_month: 1,
    accounting_method: 'accrual',
    enable_invoicing: true,
    enable_pos: false,
    enable_inventory: true,
    enable_hr: false,
    enable_projects: false,
    language: 'en',
    timezone: 'Africa/Nairobi',
    setup_completed: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  const [isEditMode, setIsEditMode] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Read initial tab from URL hash or default to 'company'
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['company', 'contact', 'financial', 'features', 'general', 'preview'].includes(hash)) {
        setActiveTab(hash);
      }
    }
  }, []);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${value}`);
    }
  };

  // Fetch settings on mount
  useEffect(() => {
    if (currentTenant?.id) {
      fetchTenantSettings(currentTenant.id);
    }
  }, [currentTenant?.id, fetchTenantSettings]);

  // Update form data when settings are loaded
  useEffect(() => {
    if (tenantSettings) {
      const settingsData: SettingsFormData = {
        company_name: tenantSettings.company_name || '',
        legal_name: tenantSettings.legal_name || '',
        business_type: tenantSettings.business_type || '',
        registration_number: tenantSettings.registration_number || '',
        tax_id: tenantSettings.tax_id || '',
        email: tenantSettings.email || '',
        phone: tenantSettings.phone || '',
        website: tenantSettings.website || '',
        street_address: tenantSettings.street_address || '',
        city: tenantSettings.city || '',
        state_province: tenantSettings.state_province || '',
        postal_code: tenantSettings.postal_code || '',
        country: tenantSettings.country || '',
        currency: tenantSettings.currency || 'KES',
        fiscal_year_start_month: tenantSettings.fiscal_year_start_month || 1,
        accounting_method: tenantSettings.accounting_method || 'accrual',
        industry: tenantSettings.industry || '',
        employees_count: tenantSettings.employees_count || undefined,
        annual_revenue: tenantSettings.annual_revenue || '',
        enable_invoicing: tenantSettings.enable_invoicing ?? true,
        enable_pos: tenantSettings.enable_pos ?? false,
        enable_inventory: tenantSettings.enable_inventory ?? true,
        enable_hr: tenantSettings.enable_hr ?? false,
        enable_projects: tenantSettings.enable_projects ?? false,
        logo_url: tenantSettings.logo_url || '',
        language: tenantSettings.language || 'en',
        timezone: tenantSettings.timezone || 'Africa/Nairobi',
        setup_completed: tenantSettings.setup_completed ?? false,
      };
      setFormData(settingsData);
      setHasUnsavedChanges(false);
      if (tenantSettings.updated_at) {
        setLastSaved(new Date(tenantSettings.updated_at));
      }
    }
  }, [tenantSettings]);

  const handleFieldChange = useCallback((field: keyof SettingsFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentTenant?.id) {
      toast.error("Tenant ID is missing");
      return;
    }

    setIsSaving(true);
    try {
      // Clean up form data: ensure proper types and handle empty values
      const cleanedData: any = {};
      
      // Company Information - company_name is required, others optional
      if (formData.company_name) {
        cleanedData.company_name = formData.company_name.trim() || null;
      }
      if (formData.legal_name?.trim()) cleanedData.legal_name = formData.legal_name.trim();
      if (formData.business_type?.trim()) cleanedData.business_type = formData.business_type.trim();
      if (formData.registration_number?.trim()) cleanedData.registration_number = formData.registration_number.trim();
      if (formData.tax_id?.trim()) cleanedData.tax_id = formData.tax_id.trim();
      
      // Contact Information
      if (formData.email?.trim()) cleanedData.email = formData.email.trim();
      if (formData.phone?.trim()) cleanedData.phone = formData.phone.trim();
      if (formData.website?.trim()) cleanedData.website = formData.website.trim();
      
      // Address
      if (formData.street_address?.trim()) cleanedData.street_address = formData.street_address.trim();
      if (formData.city?.trim()) cleanedData.city = formData.city.trim();
      if (formData.state_province?.trim()) cleanedData.state_province = formData.state_province.trim();
      if (formData.postal_code?.trim()) cleanedData.postal_code = formData.postal_code.trim();
      if (formData.country?.trim()) cleanedData.country = formData.country.trim();
      
      // Financial Settings - always include required fields
      cleanedData.currency = formData.currency || 'KES';
      cleanedData.fiscal_year_start_month = typeof formData.fiscal_year_start_month === 'number' 
        ? formData.fiscal_year_start_month 
        : (Number(formData.fiscal_year_start_month) || 1);
      cleanedData.accounting_method = formData.accounting_method || 'accrual';
      
      // Business Settings
      if (formData.industry?.trim()) cleanedData.industry = formData.industry.trim();
      if (formData.employees_count !== undefined && formData.employees_count !== null) {
        const empCount = Number(formData.employees_count);
        if (!isNaN(empCount) && empCount >= 0) {
          cleanedData.employees_count = empCount;
        }
      }
      if (formData.annual_revenue?.trim()) cleanedData.annual_revenue = formData.annual_revenue.trim();
      
      // Feature Toggles - always include
      cleanedData.enable_invoicing = Boolean(formData.enable_invoicing ?? true);
      cleanedData.enable_pos = Boolean(formData.enable_pos ?? false);
      cleanedData.enable_inventory = Boolean(formData.enable_inventory ?? true);
      cleanedData.enable_hr = Boolean(formData.enable_hr ?? false);
      cleanedData.enable_projects = Boolean(formData.enable_projects ?? false);
      
      // Configuration
      if (formData.logo_url?.trim()) cleanedData.logo_url = formData.logo_url.trim();
      cleanedData.language = formData.language || 'en';
      cleanedData.timezone = formData.timezone || 'Africa/Nairobi';
      cleanedData.setup_completed = Boolean(formData.setup_completed ?? false);

      await updateTenantSettings(currentTenant.id, cleanedData);
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      setIsEditMode(false);
      
      toast.success("Settings Saved", {
        description: "Your organization settings have been saved successfully.",
      });
    } catch (error: any) {
      console.error('Save error details:', error);
      const errorMessage = error?.message || error?.detail || "Failed to save settings. Please try again.";
      toast.error("Save Failed", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant?.id, formData, updateTenantSettings, toast]);

  const handleCancel = useCallback(() => {
    // Reset form data to last saved state
    if (tenantSettings) {
      const settingsData: SettingsFormData = {
        company_name: tenantSettings.company_name || '',
        legal_name: tenantSettings.legal_name || '',
        business_type: tenantSettings.business_type || '',
        registration_number: tenantSettings.registration_number || '',
        tax_id: tenantSettings.tax_id || '',
        email: tenantSettings.email || '',
        phone: tenantSettings.phone || '',
        website: tenantSettings.website || '',
        street_address: tenantSettings.street_address || '',
        city: tenantSettings.city || '',
        state_province: tenantSettings.state_province || '',
        postal_code: tenantSettings.postal_code || '',
        country: tenantSettings.country || '',
        currency: tenantSettings.currency || 'KES',
        fiscal_year_start_month: tenantSettings.fiscal_year_start_month || 1,
        accounting_method: tenantSettings.accounting_method || 'accrual',
        industry: tenantSettings.industry || '',
        employees_count: tenantSettings.employees_count || undefined,
        annual_revenue: tenantSettings.annual_revenue || '',
        enable_invoicing: tenantSettings.enable_invoicing ?? true,
        enable_pos: tenantSettings.enable_pos ?? false,
        enable_inventory: tenantSettings.enable_inventory ?? true,
        enable_hr: tenantSettings.enable_hr ?? false,
        enable_projects: tenantSettings.enable_projects ?? false,
        logo_url: tenantSettings.logo_url || '',
        language: tenantSettings.language || 'en',
        timezone: tenantSettings.timezone || 'Africa/Nairobi',
        setup_completed: tenantSettings.setup_completed ?? false,
      };
      setFormData(settingsData);
    }
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  }, [tenantSettings]);

  // Calculate completion percentage
  const requiredFields = ['company_name', 'currency', 'timezone'];
  const completedFields = requiredFields.filter(field => formData[field as keyof SettingsFormData]);
  const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

  // Count enabled features
  const enabledFeatures = [
    formData.enable_invoicing,
    formData.enable_pos,
    formData.enable_inventory,
    formData.enable_hr,
    formData.enable_projects,
  ].filter(Boolean).length;

  if (!user) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-cyan-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl shadow-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
        <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Organization Settings
          </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure your company profile and preferences
          </p>
        </div>
          </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved changes
              </Badge>
            )}
            {lastSaved && !hasUnsavedChanges && (
              <span className="text-xs text-muted-foreground">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isEditMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="border-slate-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 text-white shadow-lg"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditMode(true)}
                className="border-slate-300"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
      </div>

        {/* Progress Indicator */}
        <Card className="border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-50/50 to-purple-50/50 dark:from-cyan-950/20 dark:to-purple-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Setup Progress</span>
              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedFields.length} of {requiredFields.length} required fields completed
            </p>
          </CardContent>
        </Card>

      {error && <ErrorHandler error={error} onDismiss={clearError} />}

      {loading && !tenantSettings ? (
          <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:grid-cols-6 h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <TabsTrigger value="company" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Building2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Company</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Phone className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Contact</span>
              </TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Financial</span>
              </TabsTrigger>
              <TabsTrigger value="features" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Zap className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Features</span>
              </TabsTrigger>
              <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Globe className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:shadow-md">
                <Eye className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
            </TabsList>

            {/* Company Tab */}
            <TabsContent value="company" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-cyan-50 to-purple-50 dark:from-cyan-950/30 dark:to-purple-950/30 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                    <div>
                      <CardTitle className="text-xl">Company Information</CardTitle>
                      <CardDescription>Essential details about your organization</CardDescription>
                </div>
              </div>
            </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="company_name" className="text-sm font-semibold flex items-center gap-2">
                        Company Name <span className="text-red-500">*</span>
                      </Label>
                  <Input
                        id="company_name"
                    value={formData.company_name || ''}
                        onChange={(e) => handleFieldChange('company_name', e.target.value)}
                        placeholder="Enter company name"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                      {formData.company_name && (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Valid
                        </p>
                      )}
                </div>

                    <div className="space-y-2">
                      <Label htmlFor="legal_name" className="text-sm font-semibold">Legal Name</Label>
                      <Input
                        id="legal_name"
                        value={formData.legal_name || ''}
                        onChange={(e) => handleFieldChange('legal_name', e.target.value)}
                        placeholder="Legal business name"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business_type" className="text-sm font-semibold">Business Type</Label>
                      <Select
                        value={formData.business_type || ''}
                        onValueChange={(value) => handleFieldChange('business_type', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sole Proprietor">Sole Proprietor</SelectItem>
                          <SelectItem value="Partnership">Partnership</SelectItem>
                          <SelectItem value="Limited Company">Limited Company</SelectItem>
                          <SelectItem value="PLC">Public Limited Company (PLC)</SelectItem>
                          <SelectItem value="LLC">Limited Liability Company (LLC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="industry" className="text-sm font-semibold">Industry</Label>
                      <Input
                        id="industry"
                        value={formData.industry || ''}
                        onChange={(e) => handleFieldChange('industry', e.target.value)}
                        placeholder="e.g., Technology, Retail, Manufacturing"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="registration_number" className="text-sm font-semibold">Registration Number</Label>
                      <Input
                        id="registration_number"
                        value={formData.registration_number || ''}
                        onChange={(e) => handleFieldChange('registration_number', e.target.value)}
                        placeholder="Company registration number"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax_id" className="text-sm font-semibold">Tax ID / VAT Number</Label>
                      <Input
                        id="tax_id"
                        value={formData.tax_id || ''}
                        onChange={(e) => handleFieldChange('tax_id', e.target.value)}
                        placeholder="Tax identification number"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="employees_count" className="text-sm font-semibold">Number of Employees</Label>
                      <Input
                        id="employees_count"
                        type="number"
                        min="0"
                        value={formData.employees_count ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleFieldChange('employees_count', value === '' ? undefined : (value ? parseInt(value, 10) : undefined));
                        }}
                        placeholder="0"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="annual_revenue" className="text-sm font-semibold">Annual Revenue Range</Label>
                      <Select
                        value={formData.annual_revenue || ''}
                        onValueChange={(value) => handleFieldChange('annual_revenue', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue placeholder="Select revenue range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Under 1M">Under 1M</SelectItem>
                          <SelectItem value="1M-5M">1M - 5M</SelectItem>
                          <SelectItem value="5M-10M">5M - 10M</SelectItem>
                          <SelectItem value="10M-50M">10M - 50M</SelectItem>
                          <SelectItem value="50M-100M">50M - 100M</SelectItem>
                          <SelectItem value="100M+">100M+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
            </Card>
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-b">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                      <Phone className="h-5 w-5 text-white" />
                      </div>
                    <div>
                      <CardTitle className="text-xl">Contact Information</CardTitle>
                      <CardDescription>How to reach your organization</CardDescription>
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        placeholder="company@example.com"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        value={formData.phone || ''}
                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                        placeholder="+254 700 000 000"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="website" className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </Label>
                      <Input
                        id="website"
                        value={formData.website || ''}
                        onChange={(e) => handleFieldChange('website', e.target.value)}
                        placeholder="https://www.example.com"
                        disabled={!isEditMode}
                        className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <CardTitle className="text-lg mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                      Business Address
                    </CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="street_address" className="text-sm font-semibold">Street Address</Label>
                      <Input
                          id="street_address"
                        value={formData.street_address || ''}
                          onChange={(e) => handleFieldChange('street_address', e.target.value)}
                          placeholder="123 Main Street, Building Name"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-semibold">City</Label>
                      <Input
                          id="city"
                        value={formData.city || ''}
                          onChange={(e) => handleFieldChange('city', e.target.value)}
                        placeholder="Nairobi"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                      <div className="space-y-2">
                        <Label htmlFor="state_province" className="text-sm font-semibold">State/Province</Label>
                      <Input
                          id="state_province"
                        value={formData.state_province || ''}
                          onChange={(e) => handleFieldChange('state_province', e.target.value)}
                          placeholder="County/State"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                      <div className="space-y-2">
                        <Label htmlFor="postal_code" className="text-sm font-semibold">Postal Code</Label>
                      <Input
                          id="postal_code"
                        value={formData.postal_code || ''}
                          onChange={(e) => handleFieldChange('postal_code', e.target.value)}
                        placeholder="00100"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                    </div>

                      <div className="space-y-2">
                        <Label htmlFor="country" className="text-sm font-semibold">Country</Label>
                      <Input
                          id="country"
                        value={formData.country || ''}
                          onChange={(e) => handleFieldChange('country', e.target.value)}
                        placeholder="Kenya"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                      />
                      </div>
                    </div>
                  </div>
                </CardContent>
            </Card>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                      <DollarSign className="h-5 w-5 text-white" />
                      </div>
                    <div>
                      <CardTitle className="text-xl">Financial Configuration</CardTitle>
                      <CardDescription>Accounting and fiscal year settings</CardDescription>
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currency" className="text-sm font-semibold flex items-center gap-2">
                        Currency <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.currency}
                        onValueChange={(value) => handleFieldChange('currency', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="UGX">UGX - Ugandan Shilling</SelectItem>
                          <SelectItem value="TZS">TZS - Tanzanian Shilling</SelectItem>
                          <SelectItem value="ETB">ETB - Ethiopian Birr</SelectItem>
                          <SelectItem value="RWF">RWF - Rwandan Franc</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Currency for all financial transactions
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fiscal_year_start_month" className="text-sm font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Fiscal Year Start
                      </Label>
                      <Select
                        value={formData.fiscal_year_start_month.toString()}
                        onValueChange={(value) => handleFieldChange('fiscal_year_start_month', parseInt(value))}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                            <SelectItem key={month} value={month.toString()}>
                              {new Date(2024, month - 1).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Month when your fiscal year begins
                      </p>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="accounting_method" className="text-sm font-semibold">Accounting Method</Label>
                      <Select
                        value={formData.accounting_method}
                        onValueChange={(value) => handleFieldChange('accounting_method', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accrual">
                    <div>
                              <div className="font-medium">Accrual Accounting</div>
                              <div className="text-xs text-muted-foreground">Record transactions when they occur</div>
                    </div>
                          </SelectItem>
                          <SelectItem value="cash">
                    <div>
                              <div className="font-medium">Cash Accounting</div>
                              <div className="text-xs text-muted-foreground">Record transactions when cash is received/paid</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        How transactions are recorded in your books
                      </p>
                    </div>
                  </div>

                  {/* Financial Summary Card */}
                  <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formData.currency}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Base Currency</div>
                        </div>
                        <div className="text-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                            {new Date(2024, formData.fiscal_year_start_month - 1).toLocaleString('default', { month: 'short' })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Fiscal Year Start</div>
                        </div>
                        <div className="text-center p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 capitalize">
                            {formData.accounting_method}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Accounting Method</div>
                    </div>
                  </div>
                </CardContent>
            </Card>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b">
                  <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                        <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                        <CardTitle className="text-xl">Module Features</CardTitle>
                  <CardDescription>Enable or disable modules for your organization</CardDescription>
                </div>
                    </div>
                    <Badge variant="outline" className="text-lg px-4 py-1 border-purple-300 text-purple-600">
                      {enabledFeatures} Active
                    </Badge>
              </div>
            </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {[
                      {
                        name: 'enable_invoicing',
                        label: 'Invoicing & Billing',
                        description: 'Create, send, and track invoices. Manage billing cycles and payment tracking.',
                        icon: FileText,
                        color: 'from-blue-500 to-cyan-500',
                        enabled: formData.enable_invoicing,
                      },
                      {
                        name: 'enable_inventory',
                        label: 'Inventory Management',
                        description: 'Track stock levels, manage warehouses, and handle stock movements.',
                        icon: Package,
                        color: 'from-green-500 to-emerald-500',
                        enabled: formData.enable_inventory,
                      },
                      {
                        name: 'enable_pos',
                        label: 'Point of Sale (POS)',
                        description: 'Sell products at physical locations with receipt printing and payment processing.',
                        icon: TrendingUp,
                        color: 'from-purple-500 to-pink-500',
                        enabled: formData.enable_pos,
                      },
                      {
                        name: 'enable_hr',
                        label: 'Human Resources',
                        description: 'Manage employees, attendance, leaves, payroll, and HR processes.',
                        icon: Users,
                        color: 'from-orange-500 to-red-500',
                        enabled: formData.enable_hr,
                      },
                      {
                        name: 'enable_projects',
                        label: 'Project Management',
                        description: 'Plan projects, track tasks, manage timelines, and monitor progress.',
                        icon: Sparkles,
                        color: 'from-indigo-500 to-purple-500',
                        enabled: formData.enable_projects,
                      },
                    ].map((module) => {
                      const Icon = module.icon;
                      return (
                <div
                  key={module.name}
                          className={`group relative overflow-hidden rounded-xl border-2 p-5 transition-all duration-300 ${
                            module.enabled
                              ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 shadow-lg'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                          } ${isEditMode ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                          onClick={() => {
                            if (isEditMode) {
                              handleFieldChange(module.name as keyof SettingsFormData, !module.enabled);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className={`p-3 rounded-lg bg-gradient-to-br ${module.color} shadow-md`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{module.label}</h3>
                                  {module.enabled && (
                                    <Badge className="bg-green-500 text-white">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  )}
                    </div>
                                <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                </div>
                            <Switch
                              checked={module.enabled}
                              onCheckedChange={(checked) => {
                                if (isEditMode) {
                                  handleFieldChange(module.name as keyof SettingsFormData, checked);
                                }
                              }}
                              disabled={!isEditMode}
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
            </CardContent>
          </Card>
            </TabsContent>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg">
                      <Globe className="h-5 w-5 text-white" />
                      </div>
                    <div>
                      <CardTitle className="text-xl">General Settings</CardTitle>
                      <CardDescription>Localization and system preferences</CardDescription>
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Timezone <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.timezone}
                        onValueChange={(value) => handleFieldChange('timezone', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                          <SelectItem value="Africa/Kampala">Africa/Kampala (EAT)</SelectItem>
                          <SelectItem value="Africa/Dar_es_Salaam">Africa/Dar es Salaam (EAT)</SelectItem>
                          <SelectItem value="Africa/Addis_Ababa">Africa/Addis Ababa (EAT)</SelectItem>
                          <SelectItem value="Africa/Kigali">Africa/Kigali (CAT)</SelectItem>
                          <SelectItem value="Africa/Johannesburg">Africa/Johannesburg (SAST)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                          <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        All dates and times will be displayed in this timezone
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language" className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Language
                      </Label>
                      <Select
                        value={formData.language}
                        onValueChange={(value) => handleFieldChange('language', value)}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="h-11 border-2 focus:border-cyan-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish (Español)</SelectItem>
                          <SelectItem value="fr">French (Français)</SelectItem>
                          <SelectItem value="sw">Swahili (Kiswahili)</SelectItem>
                          <SelectItem value="am">Amharic (አማርኛ)</SelectItem>
                          <SelectItem value="rw">Kinyarwanda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="logo_url" className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Company Logo URL
                      </Label>
                      <div className="flex gap-3">
                      <Input
                          id="logo_url"
                        value={formData.logo_url || ''}
                          onChange={(e) => handleFieldChange('logo_url', e.target.value)}
                        placeholder="https://example.com/logo.png"
                          disabled={!isEditMode}
                          className="h-11 border-2 focus:border-cyan-500 transition-colors"
                        />
                        <Button
                          variant="outline"
                          disabled={!isEditMode}
                          className="border-2"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                      {formData.logo_url && (
                        <div className="mt-2 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <img
                            src={formData.logo_url}
                            alt="Company logo"
                            className="h-16 w-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                      <div className="space-y-1">
                        <Label htmlFor="setup_completed" className="text-sm font-semibold cursor-pointer">
                          Setup Completion Status
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Mark your organization setup as complete when all required information has been provided
                        </p>
                      </div>
                      <Switch
                        id="setup_completed"
                        checked={formData.setup_completed}
                        onCheckedChange={(checked) => handleFieldChange('setup_completed', checked)}
                        disabled={!isEditMode}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                  </div>
                </CardContent>
            </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-6 mt-6">
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-cyan-50 to-purple-50 dark:from-cyan-950/30 dark:to-purple-950/30 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
                      <Eye className="h-5 w-5 text-white" />
            </div>
                    <div>
                      <CardTitle className="text-xl">Organization Preview</CardTitle>
                      <CardDescription>How your organization information will appear</CardDescription>
          </div>
        </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Company Card Preview */}
                    <div className="p-6 border-2 rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-lg">
                      <div className="flex items-start gap-4">
                        {formData.logo_url ? (
                          <img
                            src={formData.logo_url}
                            alt="Company logo"
                            className="h-20 w-20 object-contain rounded-lg border-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white border-2">
                            {formData.company_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold mb-1">{formData.company_name || 'Company Name'}</h2>
                          {formData.legal_name && (
                            <p className="text-sm text-muted-foreground mb-2">{formData.legal_name}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.business_type && (
                              <Badge variant="outline">{formData.business_type}</Badge>
                            )}
                            {formData.industry && (
                              <Badge variant="outline">{formData.industry}</Badge>
                            )}
                            <Badge className="bg-cyan-600">{formData.currency}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info Preview */}
                    {(formData.email || formData.phone || formData.website) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {formData.email && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                            <div className="font-medium">{formData.email}</div>
                          </div>
                        )}
                        {formData.phone && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Phone className="h-4 w-4" />
                              Phone
                            </div>
                            <div className="font-medium">{formData.phone}</div>
                          </div>
                        )}
                        {formData.website && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <Globe className="h-4 w-4" />
                              Website
                            </div>
                            <div className="font-medium truncate">{formData.website}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Address Preview */}
                    {(formData.street_address || formData.city || formData.country) && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          Address
                        </div>
                        <div className="space-y-1">
                          {formData.street_address && <div>{formData.street_address}</div>}
                          <div>
                            {[formData.city, formData.state_province, formData.postal_code].filter(Boolean).join(', ')}
                          </div>
                          {formData.country && <div className="font-medium">{formData.country}</div>}
                        </div>
                      </div>
                    )}

                    {/* Features Preview */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Enabled Features ({enabledFeatures}/5)
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                          { name: 'Invoicing', enabled: formData.enable_invoicing },
                          { name: 'Inventory', enabled: formData.enable_inventory },
                          { name: 'POS', enabled: formData.enable_pos },
                          { name: 'HR', enabled: formData.enable_hr },
                          { name: 'Projects', enabled: formData.enable_projects },
                        ].map((feature) => (
                          <div
                            key={feature.name}
                            className={`p-3 border-2 rounded-lg text-center transition-all ${
                              feature.enabled
                                ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-50'
                            }`}
                          >
                            <div className={`text-xs font-medium ${feature.enabled ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                              {feature.name}
                            </div>
                            <div className="text-xs mt-1">
                              {feature.enabled ? (
                                <CheckCircle2 className="h-4 w-4 mx-auto text-green-500" />
                              ) : (
                                <X className="h-4 w-4 mx-auto text-slate-400" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Settings Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                          {formData.currency}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Currency</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400 capitalize">
                          {formData.timezone.split('/').pop()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Timezone</div>
                      </div>
                      <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <div className={`text-2xl font-bold ${formData.setup_completed ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {formData.setup_completed ? '✓' : '○'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Setup Status</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
