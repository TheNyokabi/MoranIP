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
  Shield, 
  Lock, 
  Key, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  Save,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface SecuritySettings {
  // Password Policies
  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  password_expiry_days: number;
  
  // Session Management
  session_timeout_minutes: number;
  max_concurrent_sessions: number;
  require_mfa: boolean;
  
  // Access Control
  ip_whitelist_enabled: boolean;
  ip_whitelist: string[];
  block_suspicious_activity: boolean;
  
  // Audit & Logging
  enable_audit_log: boolean;
  log_failed_login_attempts: boolean;
  log_sensitive_operations: boolean;
}

export default function SecuritySettingsPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const { user, currentTenant, token } = useAuthStore();
  const { securitySettings, fetchSecuritySettings, updateSecuritySettings, loading: storeLoading, error, clearError } = useModuleStore();
  
  const [settings, setSettings] = useState<SecuritySettings>({
    min_password_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special_chars: false,
    password_expiry_days: 90,
    session_timeout_minutes: 30,
    max_concurrent_sessions: 5,
    require_mfa: false,
    ip_whitelist_enabled: false,
    ip_whitelist: [],
    block_suspicious_activity: true,
    enable_audit_log: true,
    log_failed_login_attempts: true,
    log_sensitive_operations: true,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    if (currentTenant?.id) {
      fetchSecuritySettings(currentTenant.id);
    }
  }, [currentTenant?.id, fetchSecuritySettings]);

  // Update form data when settings are loaded
  useEffect(() => {
    if (securitySettings) {
      const settingsData: SecuritySettings = {
        min_password_length: securitySettings.min_password_length ?? 8,
        require_uppercase: securitySettings.require_uppercase ?? true,
        require_lowercase: securitySettings.require_lowercase ?? true,
        require_numbers: securitySettings.require_numbers ?? true,
        require_special_chars: securitySettings.require_special_chars ?? false,
        password_expiry_days: securitySettings.password_expiry_days ?? 90,
        session_timeout_minutes: securitySettings.session_timeout_minutes ?? 30,
        max_concurrent_sessions: securitySettings.max_concurrent_sessions ?? 5,
        require_mfa: securitySettings.require_mfa ?? false,
        ip_whitelist_enabled: securitySettings.ip_whitelist_enabled ?? false,
        ip_whitelist: securitySettings.ip_whitelist || [],
        block_suspicious_activity: securitySettings.block_suspicious_activity ?? true,
        enable_audit_log: securitySettings.enable_audit_log ?? true,
        log_failed_login_attempts: securitySettings.log_failed_login_attempts ?? true,
        log_sensitive_operations: securitySettings.log_sensitive_operations ?? true,
      };
      setSettings(settingsData);
      setHasUnsavedChanges(false);
    }
  }, [securitySettings]);

  const handleFieldChange = useCallback((field: keyof SecuritySettings, value: any) => {
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
      await updateSecuritySettings(currentTenant.id, settings);
      setHasUnsavedChanges(false);
      toast.success("Security Settings Saved", {
        description: "Your security policies have been updated successfully.",
      });
    } catch (error: any) {
      toast.error("Save Failed", {
        description: error.message || "Failed to save security settings. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant?.id, settings, updateSecuritySettings]);

  const handleAddIpAddress = () => {
    if (newIpAddress.trim() && !settings.ip_whitelist.includes(newIpAddress.trim())) {
      handleFieldChange('ip_whitelist', [...settings.ip_whitelist, newIpAddress.trim()]);
      setNewIpAddress('');
    }
  };

  const handleRemoveIpAddress = (ip: string) => {
    handleFieldChange('ip_whitelist', settings.ip_whitelist.filter(i => i !== ip));
  };

  if (storeLoading && !securitySettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
              <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-red-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
                  Security Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure security policies and access control
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
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
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
          {/* Password Policies */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Password Policies</CardTitle>
                  <CardDescription>Configure password requirements and expiration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="min_password_length" className="text-sm font-semibold">
                  Minimum Password Length
                </Label>
                <Input
                  id="min_password_length"
                  type="number"
                  min="6"
                  max="32"
                  value={settings.min_password_length}
                  onChange={(e) => handleFieldChange('min_password_length', parseInt(e.target.value) || 8)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 8-12 characters
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Password Requirements</Label>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="require_uppercase" className="cursor-pointer">Require Uppercase Letters</Label>
                    <p className="text-xs text-muted-foreground">At least one capital letter (A-Z)</p>
                  </div>
                  <Switch
                    id="require_uppercase"
                    checked={settings.require_uppercase}
                    onCheckedChange={(checked) => handleFieldChange('require_uppercase', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="require_lowercase" className="cursor-pointer">Require Lowercase Letters</Label>
                    <p className="text-xs text-muted-foreground">At least one lowercase letter (a-z)</p>
                  </div>
                  <Switch
                    id="require_lowercase"
                    checked={settings.require_lowercase}
                    onCheckedChange={(checked) => handleFieldChange('require_lowercase', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="require_numbers" className="cursor-pointer">Require Numbers</Label>
                    <p className="text-xs text-muted-foreground">At least one digit (0-9)</p>
                  </div>
                  <Switch
                    id="require_numbers"
                    checked={settings.require_numbers}
                    onCheckedChange={(checked) => handleFieldChange('require_numbers', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label htmlFor="require_special_chars" className="cursor-pointer">Require Special Characters</Label>
                    <p className="text-xs text-muted-foreground">At least one special character (!@#$%^&*)</p>
                  </div>
                  <Switch
                    id="require_special_chars"
                    checked={settings.require_special_chars}
                    onCheckedChange={(checked) => handleFieldChange('require_special_chars', checked)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="password_expiry_days" className="text-sm font-semibold">
                  Password Expiry (Days)
                </Label>
                <Input
                  id="password_expiry_days"
                  type="number"
                  min="0"
                  max="365"
                  value={settings.password_expiry_days}
                  onChange={(e) => handleFieldChange('password_expiry_days', parseInt(e.target.value) || 0)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable password expiry
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Status */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
              <CardTitle className="text-lg">Security Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Strong Password Policy</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {settings.require_mfa ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-sm">Multi-Factor Auth</span>
                  </div>
                  <Badge variant={settings.require_mfa ? "default" : "outline"}>
                    {settings.require_mfa ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Audit Logging</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {settings.ip_whitelist_enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm">IP Whitelist</span>
                  </div>
                  <Badge variant={settings.ip_whitelist_enabled ? "default" : "outline"}>
                    {settings.ip_whitelist_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Management */}
          <Card className="lg:col-span-2 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Session Management</CardTitle>
                  <CardDescription>Control user session timeouts and limits</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="session_timeout_minutes" className="text-sm font-semibold">
                    Session Timeout (Minutes)
                  </Label>
                  <Input
                    id="session_timeout_minutes"
                    type="number"
                    min="5"
                    max="480"
                    value={settings.session_timeout_minutes}
                    onChange={(e) => handleFieldChange('session_timeout_minutes', parseInt(e.target.value) || 30)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatic logout after inactivity
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_concurrent_sessions" className="text-sm font-semibold">
                    Max Concurrent Sessions
                  </Label>
                  <Input
                    id="max_concurrent_sessions"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.max_concurrent_sessions}
                    onChange={(e) => handleFieldChange('max_concurrent_sessions', parseInt(e.target.value) || 5)}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum active sessions per user
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="require_mfa" className="cursor-pointer font-semibold">Require Multi-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all users to enhance security
                  </p>
                </div>
                <Switch
                  id="require_mfa"
                  checked={settings.require_mfa}
                  onCheckedChange={(checked) => handleFieldChange('require_mfa', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card className="lg:col-span-3 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                  <UserCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Access Control</CardTitle>
                  <CardDescription>IP whitelisting and suspicious activity monitoring</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="ip_whitelist_enabled" className="cursor-pointer font-semibold">Enable IP Whitelist</Label>
                  <p className="text-sm text-muted-foreground">
                    Only allow access from specified IP addresses
                  </p>
                </div>
                <Switch
                  id="ip_whitelist_enabled"
                  checked={settings.ip_whitelist_enabled}
                  onCheckedChange={(checked) => handleFieldChange('ip_whitelist_enabled', checked)}
                />
              </div>

              {settings.ip_whitelist_enabled && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="192.168.1.1 or 192.168.1.0/24"
                      value={newIpAddress}
                      onChange={(e) => setNewIpAddress(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddIpAddress()}
                      className="flex-1"
                    />
                    <Button onClick={handleAddIpAddress} variant="outline">
                      Add IP
                    </Button>
                  </div>

                  {settings.ip_whitelist.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Allowed IP Addresses</Label>
                      <div className="flex flex-wrap gap-2">
                        {settings.ip_whitelist.map((ip) => (
                          <Badge key={ip} variant="outline" className="pr-1">
                            {ip}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleRemoveIpAddress(ip)}
                            >
                              ×
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="block_suspicious_activity" className="cursor-pointer font-semibold">Block Suspicious Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically block accounts after multiple failed login attempts
                  </p>
                </div>
                <Switch
                  id="block_suspicious_activity"
                  checked={settings.block_suspicious_activity}
                  onCheckedChange={(checked) => handleFieldChange('block_suspicious_activity', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Audit & Logging */}
          <Card className="lg:col-span-3 border-2 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg">
                  <Key className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">Audit & Logging</CardTitle>
                  <CardDescription>Track and log security events</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="enable_audit_log" className="cursor-pointer font-semibold">Enable Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Log all security-related events and user actions
                  </p>
                </div>
                <Switch
                  id="enable_audit_log"
                  checked={settings.enable_audit_log}
                  onCheckedChange={(checked) => handleFieldChange('enable_audit_log', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="log_failed_login_attempts" className="cursor-pointer font-semibold">Log Failed Login Attempts</Label>
                  <p className="text-sm text-muted-foreground">
                    Record all failed authentication attempts
                  </p>
                </div>
                <Switch
                  id="log_failed_login_attempts"
                  checked={settings.log_failed_login_attempts}
                  onCheckedChange={(checked) => handleFieldChange('log_failed_login_attempts', checked)}
                  disabled={!settings.enable_audit_log}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label htmlFor="log_sensitive_operations" className="cursor-pointer font-semibold">Log Sensitive Operations</Label>
                  <p className="text-sm text-muted-foreground">
                    Log operations like role changes, permission modifications, and data exports
                  </p>
                </div>
                <Switch
                  id="log_sensitive_operations"
                  checked={settings.log_sensitive_operations}
                  onCheckedChange={(checked) => handleFieldChange('log_sensitive_operations', checked)}
                  disabled={!settings.enable_audit_log}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
