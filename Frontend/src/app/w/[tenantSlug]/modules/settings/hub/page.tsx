'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useModuleStore } from '@/store/module-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ErrorHandler } from '@/components/error-handler';
import {
  Settings,
  Building2,
  CreditCard,
  Zap,
  Globe,
  Shield,
  Bell,
  User,
  ArrowRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  FileText,
  Users,
  Sparkles,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function SettingsHub() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const { user, currentTenant } = useAuthStore();
  const { tenantSettings, fetchTenantSettings, loading, error, clearError } = useModuleStore();

  useEffect(() => {
    if (currentTenant?.id) {
      fetchTenantSettings(currentTenant.id);
    }
  }, [currentTenant?.id, fetchTenantSettings]);

  const settingsSections: Array<{
    icon: LucideIcon;
    title: string;
    description: string;
    color: string;
    action: () => void;
    comingSoon?: boolean;
  }> = [
    {
      icon: Building2,
      title: 'Company Settings',
      description: 'Manage company information, registration, and address',
      color: 'from-cyan-500 to-blue-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings?tab=company`),
    },
    {
      icon: Phone,
      title: 'Contact Information',
      description: 'Email, phone, website, and business address',
      color: 'from-blue-500 to-cyan-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings?tab=contact`),
    },
    {
      icon: CreditCard,
      title: 'Financial Settings',
      description: 'Configure currency, fiscal year, and accounting methods',
      color: 'from-emerald-500 to-teal-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings?tab=financial`),
    },
    {
      icon: Zap,
      title: 'Feature Configuration',
      description: 'Enable or disable modules for your organization',
      color: 'from-purple-500 to-pink-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings?tab=features`),
    },
    {
      icon: Globe,
      title: 'General Settings',
      description: 'Language, timezone, and system preferences',
      color: 'from-slate-500 to-gray-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings?tab=general`),
    },
    {
      icon: Shield,
      title: 'Security',
      description: 'Manage security policies and access control',
      color: 'from-red-500 to-orange-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings/security`),
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Configure notification preferences and alerts',
      color: 'from-yellow-500 to-amber-500',
      action: () => router.push(`/w/${tenantSlug}/modules/settings/notifications`),
    },
    {
      icon: User,
      title: 'Users & Roles',
      description: 'Manage team members and their roles',
      color: 'from-indigo-500 to-purple-500',
      action: () => router.push(`/w/${tenantSlug}/settings/members`),
    },
    {
      icon: Package,
      title: 'ERP Modules',
      description: 'Enable or disable ERP modules for your organization',
      color: 'from-blue-500 to-indigo-500',
      action: () => router.push(`/w/${tenantSlug}/settings/modules`),
    },
    {
      icon: Settings,
      title: 'Roles & Permissions',
      description: 'View system roles and their associated permissions',
      color: 'from-green-500 to-emerald-500',
      action: () => router.push(`/w/${tenantSlug}/settings/roles`),
    },
  ];

  // Calculate completion percentage
  const requiredFields = ['company_name', 'currency', 'timezone'];
  const completedFields = requiredFields.filter(field => tenantSettings?.[field]);
  const completionPercentage = Math.round((completedFields.length / requiredFields.length) * 100);

  // Count enabled features
  const enabledFeatures = [
    tenantSettings?.enable_invoicing,
    tenantSettings?.enable_pos,
    tenantSettings?.enable_inventory,
    tenantSettings?.enable_hr,
    tenantSettings?.enable_projects,
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
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl shadow-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Settings Hub
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your organization configuration and preferences
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/w/${tenantSlug}/modules/settings`)}
            className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700 text-white shadow-lg"
          >
            <Settings className="h-4 w-4 mr-2" />
            Open All Settings
          </Button>
        </div>

        {error && <ErrorHandler error={error} onDismiss={clearError} />}

        {loading && !tenantSettings ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Quick Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Organization</p>
                      <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 truncate">
                        {tenantSettings?.company_name || 'Not configured'}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Currency</p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {tenantSettings?.currency || 'KES'}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Active Features</p>
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        {enabledFeatures}/5
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-2 shadow-lg ${
                tenantSettings?.setup_completed
                  ? 'border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30'
                  : 'border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30'
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Setup Status</p>
                      <p className={`text-xl font-bold ${
                        tenantSettings?.setup_completed
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {tenantSettings?.setup_completed ? 'Complete' : 'In Progress'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      tenantSettings?.setup_completed
                        ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                        : 'bg-gradient-to-br from-amber-500 to-yellow-500'
                    }`}>
                      {tenantSettings?.setup_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <XCircle className="h-5 w-5 text-white" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Setup Progress */}
            <Card className="border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-50/50 to-purple-50/50 dark:from-cyan-950/20 dark:to-purple-950/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  Setup Progress
                </CardTitle>
                <CardDescription>
                  Complete the required fields to finish your organization setup
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Configuration Progress</span>
                  <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{completionPercentage}%</span>
                </div>
                <Progress value={completionPercentage} className="h-3" />
                <div className="flex flex-wrap gap-2 mt-2">
                  {requiredFields.map((field) => {
                    const isComplete = tenantSettings?.[field];
                    return (
                      <Badge
                        key={field}
                        variant={isComplete ? 'default' : 'outline'}
                        className={isComplete ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Settings Sections Grid */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                All Settings Sections
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {settingsSections.map((section, index) => {
                  const Icon = section.icon;
                  return (
                    <Card
                      key={index}
                      className={`group cursor-pointer border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                        section.comingSoon
                          ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-slate-800'
                          : 'border-transparent hover:border-cyan-300 dark:hover:border-cyan-700 bg-white dark:bg-slate-900 shadow-lg'
                      }`}
                      onClick={section.comingSoon ? undefined : section.action}
                    >
                      <CardHeader className="pb-3">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${section.color} w-fit mb-2 shadow-md group-hover:scale-110 transition-transform`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <CardTitle className="text-lg group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {section.title}
                        </CardTitle>
                        <CardDescription className="text-sm">{section.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {section.comingSoon ? (
                          <Badge variant="outline" className="w-full justify-center">
                            Coming Soon
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            className="w-full justify-between group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              section.action();
                            }}
                          >
                            Configure
                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Feature Status */}
            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Enabled Features</CardTitle>
                      <CardDescription>Modules currently active in your organization</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-1 border-purple-300 text-purple-600">
                    {enabledFeatures} Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    {
                      name: 'Invoicing',
                      enabled: tenantSettings?.enable_invoicing,
                      icon: FileText,
                      color: 'from-blue-500 to-cyan-500',
                    },
                    {
                      name: 'Inventory',
                      enabled: tenantSettings?.enable_inventory,
                      icon: Package,
                      color: 'from-green-500 to-emerald-500',
                    },
                    {
                      name: 'Point of Sale',
                      enabled: tenantSettings?.enable_pos,
                      icon: TrendingUp,
                      color: 'from-purple-500 to-pink-500',
                      shortName: 'POS',
                    },
                    {
                      name: 'Human Resources',
                      enabled: tenantSettings?.enable_hr,
                      icon: Users,
                      color: 'from-orange-500 to-red-500',
                      shortName: 'HR',
                    },
                    {
                      name: 'Projects',
                      enabled: tenantSettings?.enable_projects,
                      icon: Sparkles,
                      color: 'from-indigo-500 to-purple-500',
                    },
                  ].map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.name}
                        className={`p-4 border-2 rounded-xl transition-all ${
                          feature.enabled
                            ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-md'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60'
                        }`}
                      >
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${feature.color} w-fit mb-3`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-sm">{feature.shortName || feature.name}</div>
                            <div className="text-xs text-muted-foreground">{feature.name}</div>
                          </div>
                          {feature.enabled ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Company Info Preview */}
            {(tenantSettings?.email || tenantSettings?.phone || tenantSettings?.city) && (
              <Card className="border-2 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>Quick overview of your organization details</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tenantSettings?.email && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Email</div>
                          <div className="text-sm font-medium truncate">{tenantSettings.email}</div>
                        </div>
                      </div>
                    )}
                    {tenantSettings?.phone && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Phone</div>
                          <div className="text-sm font-medium truncate">{tenantSettings.phone}</div>
                        </div>
                      </div>
                    )}
                    {tenantSettings?.city && (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground">Location</div>
                          <div className="text-sm font-medium truncate">
                            {[tenantSettings.city, tenantSettings.country].filter(Boolean).join(', ')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
