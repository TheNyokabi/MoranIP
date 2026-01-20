'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useModuleStore } from '@/store/module-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ErrorHandler } from '@/components/error-handler';
import { 
  Bell, 
  Mail,
  MessageSquare,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Save,
  ArrowLeft,
  Settings,
  User,
  ShoppingCart,
  DollarSign,
  Package,
  Calendar,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettings {
  // Email Notifications
  email_enabled: boolean;
  email_new_user_invite: boolean;
  email_role_changes: boolean;
  email_payment_received: boolean;
  email_invoice_generated: boolean;
  email_order_status_change: boolean;
  email_low_stock_alert: boolean;
  email_monthly_report: boolean;
  
  // In-App Notifications
  in_app_enabled: boolean;
  in_app_new_messages: boolean;
  in_app_task_assignments: boolean;
  in_app_approval_requests: boolean;
  in_app_system_updates: boolean;
  
  // SMS Notifications
  sms_enabled: boolean;
  sms_order_confirmation: boolean;
  sms_payment_received: boolean;
  sms_important_alerts: boolean;
  
  // Push Notifications
  push_enabled: boolean;
  push_instant_alerts: boolean;
  push_daily_summary: boolean;
  
  // Notification Preferences
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  digest_frequency: 'none' | 'daily' | 'weekly';
}

export default function NotificationsSettingsPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const { user, currentTenant, token } = useAuthStore();
  const { notificationSettings, fetchNotificationSettings, updateNotificationSettings, loading: storeLoading, error, clearError } = useModuleStore();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    email_enabled: true,
    email_new_user_invite: true,
    email_role_changes: true,
    email_payment_received: true,
    email_invoice_generated: true,
    email_order_status_change: true,
    email_low_stock_alert: true,
    email_monthly_report: true,
    in_app_enabled: true,
    in_app_new_messages: true,
    in_app_task_assignments: true,
    in_app_approval_requests: true,
    in_app_system_updates: true,
    sms_enabled: false,
    sms_order_confirmation: false,
    sms_payment_received: false,
    sms_important_alerts: false,
    push_enabled: true,
    push_instant_alerts: true,
    push_daily_summary: false,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    digest_frequency: 'daily',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    if (currentTenant?.id) {
      fetchNotificationSettings(currentTenant.id);
    }
  }, [currentTenant?.id, fetchNotificationSettings]);

  // Update form data when settings are loaded
  useEffect(() => {
    if (notificationSettings) {
      const settingsData: NotificationSettings = {
        email_enabled: notificationSettings.email_enabled ?? true,
        email_new_user_invite: notificationSettings.email_new_user_invite ?? true,
        email_role_changes: notificationSettings.email_role_changes ?? true,
        email_payment_received: notificationSettings.email_payment_received ?? true,
        email_invoice_generated: notificationSettings.email_invoice_generated ?? true,
        email_order_status_change: notificationSettings.email_order_status_change ?? true,
        email_low_stock_alert: notificationSettings.email_low_stock_alert ?? true,
        email_monthly_report: notificationSettings.email_monthly_report ?? true,
        in_app_enabled: notificationSettings.in_app_enabled ?? true,
        in_app_new_messages: notificationSettings.in_app_new_messages ?? true,
        in_app_task_assignments: notificationSettings.in_app_task_assignments ?? true,
        in_app_approval_requests: notificationSettings.in_app_approval_requests ?? true,
        in_app_system_updates: notificationSettings.in_app_system_updates ?? true,
        sms_enabled: notificationSettings.sms_enabled ?? false,
        sms_order_confirmation: notificationSettings.sms_order_confirmation ?? false,
        sms_payment_received: notificationSettings.sms_payment_received ?? false,
        sms_important_alerts: notificationSettings.sms_important_alerts ?? false,
        push_enabled: notificationSettings.push_enabled ?? true,
        push_instant_alerts: notificationSettings.push_instant_alerts ?? true,
        push_daily_summary: notificationSettings.push_daily_summary ?? false,
        quiet_hours_enabled: notificationSettings.quiet_hours_enabled ?? false,
        quiet_hours_start: notificationSettings.quiet_hours_start || '22:00',
        quiet_hours_end: notificationSettings.quiet_hours_end || '08:00',
        digest_frequency: (notificationSettings.digest_frequency || 'daily') as 'none' | 'daily' | 'weekly',
      };
      setSettings(settingsData);
      setHasUnsavedChanges(false);
    }
  }, [notificationSettings]);

  const handleFieldChange = useCallback((field: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({
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
      await updateNotificationSettings(currentTenant.id, settings);
      setHasUnsavedChanges(false);
      toast.success("Notification Settings Saved", {
        description: "Your notification preferences have been updated successfully.",
      });
    } catch (error: any) {
      toast.error("Save Failed", {
        description: error.message || "Failed to save notification settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant?.id, settings, updateNotificationSettings]);

  if (storeLoading && !notificationSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-yellow-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/w/${tenantSlug}/modules/settings/hub`)}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  Notification Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure how and when you receive notifications
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved changes
              </Badge>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white shadow-lg"
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
          </div>
        </div>

        {error && <ErrorHandler error={error} onDismiss={clearError} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email Notifications */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Email Notifications</CardTitle>
                    <CardDescription>Configure email notification preferences</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.email_enabled}
                  onCheckedChange={(checked) => handleFieldChange('email_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.email_enabled && (
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NotificationToggle
                    icon={<User className="h-4 w-4" />}
                    label="New User Invites"
                    description="When users are invited to your workspace"
                    checked={settings.email_new_user_invite}
                    onCheckedChange={(checked) => handleFieldChange('email_new_user_invite', checked)}
                  />
                  <NotificationToggle
                    icon={<Settings className="h-4 w-4" />}
                    label="Role Changes"
                    description="When user roles are modified"
                    checked={settings.email_role_changes}
                    onCheckedChange={(checked) => handleFieldChange('email_role_changes', checked)}
                  />
                  <NotificationToggle
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Payment Received"
                    description="When payments are received"
                    checked={settings.email_payment_received}
                    onCheckedChange={(checked) => handleFieldChange('email_payment_received', checked)}
                  />
                  <NotificationToggle
                    icon={<FileText className="h-4 w-4" />}
                    label="Invoice Generated"
                    description="When new invoices are created"
                    checked={settings.email_invoice_generated}
                    onCheckedChange={(checked) => handleFieldChange('email_invoice_generated', checked)}
                  />
                  <NotificationToggle
                    icon={<ShoppingCart className="h-4 w-4" />}
                    label="Order Status Changes"
                    description="When order status is updated"
                    checked={settings.email_order_status_change}
                    onCheckedChange={(checked) => handleFieldChange('email_order_status_change', checked)}
                  />
                  <NotificationToggle
                    icon={<Package className="h-4 w-4" />}
                    label="Low Stock Alerts"
                    description="When inventory levels are low"
                    checked={settings.email_low_stock_alert}
                    onCheckedChange={(checked) => handleFieldChange('email_low_stock_alert', checked)}
                  />
                  <NotificationToggle
                    icon={<Calendar className="h-4 w-4" />}
                    label="Monthly Reports"
                    description="Monthly summary reports"
                    checked={settings.email_monthly_report}
                    onCheckedChange={(checked) => handleFieldChange('email_monthly_report', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Notification Summary */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
              <CardTitle className="text-lg">Active Channels</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Email</span>
                  </div>
                  <Badge variant={settings.email_enabled ? "default" : "outline"}>
                    {settings.email_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">In-App</span>
                  </div>
                  <Badge variant={settings.in_app_enabled ? "default" : "outline"}>
                    {settings.in_app_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-green-500" />
                    <span className="text-sm">SMS</span>
                  </div>
                  <Badge variant={settings.sms_enabled ? "default" : "outline"}>
                    {settings.sms_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Push</span>
                  </div>
                  <Badge variant={settings.push_enabled ? "default" : "outline"}>
                    {settings.push_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* In-App Notifications */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">In-App Notifications</CardTitle>
                    <CardDescription>Notifications shown within the application</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.in_app_enabled}
                  onCheckedChange={(checked) => handleFieldChange('in_app_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.in_app_enabled && (
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NotificationToggle
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="New Messages"
                    description="When you receive new messages"
                    checked={settings.in_app_new_messages}
                    onCheckedChange={(checked) => handleFieldChange('in_app_new_messages', checked)}
                  />
                  <NotificationToggle
                    icon={<User className="h-4 w-4" />}
                    label="Task Assignments"
                    description="When tasks are assigned to you"
                    checked={settings.in_app_task_assignments}
                    onCheckedChange={(checked) => handleFieldChange('in_app_task_assignments', checked)}
                  />
                  <NotificationToggle
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    label="Approval Requests"
                    description="When approval is required"
                    checked={settings.in_app_approval_requests}
                    onCheckedChange={(checked) => handleFieldChange('in_app_approval_requests', checked)}
                  />
                  <NotificationToggle
                    icon={<AlertCircle className="h-4 w-4" />}
                    label="System Updates"
                    description="System notifications and updates"
                    checked={settings.in_app_system_updates}
                    onCheckedChange={(checked) => handleFieldChange('in_app_system_updates', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* SMS Notifications */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                    <Smartphone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">SMS Notifications</CardTitle>
                    <CardDescription>Text message notifications (charges may apply)</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.sms_enabled}
                  onCheckedChange={(checked) => handleFieldChange('sms_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.sms_enabled && (
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NotificationToggle
                    icon={<ShoppingCart className="h-4 w-4" />}
                    label="Order Confirmations"
                    description="Confirm when orders are placed"
                    checked={settings.sms_order_confirmation}
                    onCheckedChange={(checked) => handleFieldChange('sms_order_confirmation', checked)}
                  />
                  <NotificationToggle
                    icon={<DollarSign className="h-4 w-4" />}
                    label="Payment Received"
                    description="Notify when payments are received"
                    checked={settings.sms_payment_received}
                    onCheckedChange={(checked) => handleFieldChange('sms_payment_received', checked)}
                  />
                  <NotificationToggle
                    icon={<AlertCircle className="h-4 w-4" />}
                    label="Important Alerts"
                    description="Critical system alerts only"
                    checked={settings.sms_important_alerts}
                    onCheckedChange={(checked) => handleFieldChange('sms_important_alerts', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Push Notifications */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg">
                    <Bell className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Push Notifications</CardTitle>
                    <CardDescription>Browser and mobile push notifications</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.push_enabled}
                  onCheckedChange={(checked) => handleFieldChange('push_enabled', checked)}
                />
              </div>
            </CardHeader>
            {settings.push_enabled && (
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NotificationToggle
                    icon={<Bell className="h-4 w-4" />}
                    label="Instant Alerts"
                    description="Receive immediate push notifications"
                    checked={settings.push_instant_alerts}
                    onCheckedChange={(checked) => handleFieldChange('push_instant_alerts', checked)}
                  />
                  <NotificationToggle
                    icon={<Calendar className="h-4 w-4" />}
                    label="Daily Summary"
                    description="Daily digest of activities"
                    checked={settings.push_daily_summary}
                    onCheckedChange={(checked) => handleFieldChange('push_daily_summary', checked)}
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Notification Preferences */}
          <Card className="lg:col-span-3 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Notification Preferences</CardTitle>
                  <CardDescription>Manage when and how often you receive notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="quiet_hours_enabled" className="cursor-pointer font-semibold">Enable Quiet Hours</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable notifications during specific hours
                  </p>
                </div>
                <Switch
                  id="quiet_hours_enabled"
                  checked={settings.quiet_hours_enabled}
                  onCheckedChange={(checked) => handleFieldChange('quiet_hours_enabled', checked)}
                />
              </div>

              {settings.quiet_hours_enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_start">Quiet Hours Start</Label>
                    <Input
                      id="quiet_hours_start"
                      type="time"
                      value={settings.quiet_hours_start}
                      onChange={(e) => handleFieldChange('quiet_hours_start', e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_end">Quiet Hours End</Label>
                    <Input
                      id="quiet_hours_end"
                      type="time"
                      value={settings.quiet_hours_end}
                      onChange={(e) => handleFieldChange('quiet_hours_end', e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="digest_frequency" className="text-sm font-semibold">Email Digest Frequency</Label>
                <select
                  id="digest_frequency"
                  value={settings.digest_frequency}
                  onChange={(e) => handleFieldChange('digest_frequency', e.target.value as 'none' | 'daily' | 'weekly')}
                  className="w-full h-11 px-3 border-2 border-input rounded-md bg-background focus:border-yellow-500 transition-colors"
                >
                  <option value="none">No Digest</option>
                  <option value="daily">Daily Digest</option>
                  <option value="weekly">Weekly Digest</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  How often to receive summary emails of notifications
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper component for notification toggles
function NotificationToggle({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="flex-1 space-y-1">
          <Label htmlFor={label} className="cursor-pointer font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="ml-4"
      />
    </div>
  );
}
