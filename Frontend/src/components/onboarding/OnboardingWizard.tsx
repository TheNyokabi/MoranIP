/**
 * OnboardingWizard Component
 *
 * Note: This file previously contained corrupted/injected code.
 * This implementation is intentionally minimal and relies on the shared API client.
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

interface Template {
  code: string;
  name: string;
  description: string;
  modules: string[];
  is_system: boolean;
}

interface OnboardingStep {
  code: string;
  name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  module?: string;
  error?: string;
}

interface OnboardingStatus {
  status: 'NOT_STARTED' | 'DRAFT' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  template?: string;
  progress: number;
  current_step?: string;
  total_steps: number;
  completed_steps: number;
  steps: OnboardingStep[];
  error?: string;
}

interface OnboardingWizardProps {
  tenantId: string;
  onComplete?: () => void;
}

export function OnboardingWizard({ tenantId, onComplete }: OnboardingWizardProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [customConfigText, setCustomConfigText] = useState<string>('{}');
  const [activeTab, setActiveTab] = useState<'templates' | 'config' | 'progress'>('templates');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTemplates();
    void loadStatus();
  }, []);

  useEffect(() => {
    if (status?.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => void loadStatus(), 2000);
    return () => clearInterval(interval);
  }, [status?.status]);

  const parsedCustomConfig = useMemo(() => {
    const trimmed = customConfigText.trim();
    if (!trimmed || trimmed === '{}' || trimmed === 'null') return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, any>;
      return undefined;
    } catch {
      return null;
    }
  }, [customConfigText]);

  const loadTemplates = async () => {
    try {
      const data = await apiFetch<any>('/onboarding/templates');
      const systemTemplates = Array.isArray(data?.system_templates) ? data.system_templates : [];
      const customTemplates = Array.isArray(data?.custom_templates) ? data.custom_templates : [];
      setTemplates([...systemTemplates, ...customTemplates]);
      setError(null);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    }
  };

  const loadStatus = async () => {
    try {
      const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/status`);
      setStatus(data?.data || data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus({ status: 'NOT_STARTED', progress: 0, total_steps: 0, completed_steps: 0, steps: [] });
        return;
      }
      console.error('Failed to load status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
    }
  };

  const initiateOnboarding = async () => {
    setLoading(true);
    try {
      if (!selectedTemplate) {
        setError('Please select a template');
        return;
      }
      if (parsedCustomConfig === null) {
        setError('Custom config is not valid JSON');
        return;
      }

      await apiFetch(`/onboarding/tenants/${tenantId}/start`, {
        method: 'POST',
        body: JSON.stringify({
          template_code: selectedTemplate,
          custom_config: parsedCustomConfig || undefined,
        }),
      });
      await loadStatus();
      setActiveTab('progress');
      setError(null);
    } catch (err) {
      console.error('Failed to initiate onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate onboarding');
    } finally {
      setLoading(false);
    }
  };

  const beginOnboarding = async () => {
    setLoading(true);
    try {
      await apiFetch(`/onboarding/tenants/${tenantId}/begin`, { method: 'POST' });
      await loadStatus();
      setActiveTab('progress');
      setError(null);
    } catch (err) {
      console.error('Failed to begin onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to begin onboarding');
    } finally {
      setLoading(false);
    }
  };

  const executeNextStep = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/next-step`, { method: 'POST' });
      await loadStatus();
      if (data?.completed) onComplete?.();
      setError(null);
    } catch (err) {
      console.error('Failed to execute next step:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute next step');
    } finally {
      setLoading(false);
    }
  };

  const skipStep = async (stepCode: string) => {
    setLoading(true);
    try {
      await apiFetch(`/onboarding/tenants/${tenantId}/steps/${stepCode}/skip`, { method: 'POST' });
      await loadStatus();
      setError(null);
    } catch (err) {
      console.error('Failed to skip step:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip step');
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Onboarding Template</CardTitle>
              <CardDescription>Choose a pre-configured template, then proceed.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {templates.map((template) => (
                  <Card
                    key={template.code}
                    className={`cursor-pointer transition-all ${
                      selectedTemplate === template.code
                        ? 'ring-2 ring-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedTemplate(template.code)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="text-sm">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {template.modules?.slice?.(0, 8)?.map?.((module) => (
                          <span
                            key={module}
                            className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium"
                          >
                            {module}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {status.status === 'NOT_STARTED' && (
                <Button onClick={initiateOnboarding} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      Continue <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}

              {status.status === 'DRAFT' && (
                <Button onClick={beginOnboarding} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Begin Setup <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Config (Optional)</CardTitle>
              <CardDescription>Provide overrides as JSON. Leave as `{}` for defaults.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full min-h-[240px] rounded-md border bg-background p-3 font-mono text-sm"
                value={customConfigText}
                onChange={(e) => setCustomConfigText(e.target.value)}
              />
              {parsedCustomConfig === null && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>Custom config is not valid JSON.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Progress</CardTitle>
              <CardDescription>Status: {status.status}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={status.progress || 0} />

              <div className="flex gap-2">
                {status.status === 'IN_PROGRESS' && (
                  <Button onClick={executeNextStep} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Run Next Step
                  </Button>
                )}
                <Button variant="outline" onClick={() => void loadStatus()} disabled={loading}>
                  Refresh
                </Button>
              </div>

              {status.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{status.error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                {status.steps?.length ? (
                  status.steps.map((step) => (
                    <div key={step.code} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3">
                        {step.status === 'COMPLETED' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : step.status === 'FAILED' ? (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <div className="h-5 w-5" />
                        )}
                        <div>
                          <div className="font-medium">{step.name}</div>
                          <div className="text-sm text-muted-foreground">{step.status}</div>
                          {step.error ? <div className="text-sm text-red-600">{step.error}</div> : null}
                        </div>
                      </div>
                      {step.status === 'FAILED' || step.status === 'PENDING' ? (
                        <Button variant="outline" size="sm" onClick={() => void skipStep(step.code)} disabled={loading}>
                          Skip
                        </Button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No steps yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
