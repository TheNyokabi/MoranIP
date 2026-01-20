'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/loading-spinner';
import { ErrorHandler } from '@/components/error-handler';
import {
    Building2,
    Users,
    Briefcase,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Pause,
    Play,
    Save,
    Database,
    Layers,
    Server,
    Loader2,
    ArrowLeft,
    ArrowRight,
    Info,
    Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { useModuleStore } from '@/store/module-store';
import { apiFetch, ApiError } from '@/lib/api';

interface WorkspaceType {
    code: string;
    name: string;
    description: string;
    icon: React.ElementType;
    engine: string;
    color: string;
    recommendedTemplate: string;
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
    workspace_type?: string;
    template?: string;
    engine?: string;
    progress: number;
    current_step?: string;
    total_steps: number;
    completed_steps: number;
    steps?: OnboardingStep[];
    error?: string;
    started_at?: string;
    completed_at?: string;
}

interface EnhancedOnboardingWizardProps {
    tenantId: string;
    tenantSlug?: string;
    onComplete?: () => void;
}

const WORKSPACE_TYPES: WorkspaceType[] = [
    {
        code: 'SACCO',
        name: 'SACCO / Cooperative',
        description: 'Savings and Credit Cooperative Organizations',
        icon: Users,
        engine: 'cbs', // Fineract/CBS
        color: 'from-blue-500 to-cyan-600',
        recommendedTemplate: 'ENTERPRISE'
    },
    {
        code: 'ENTERPRISE',
        name: 'Enterprise',
        description: 'Large organizations requiring full ERP capabilities',
        icon: Building2,
        engine: 'erpnext', // Priority ERPNext
        color: 'from-purple-500 to-pink-600',
        recommendedTemplate: 'ENTERPRISE'
    },
    {
        code: 'SME',
        name: 'Small & Medium Enterprise',
        description: 'Growing businesses with moderate complexity',
        icon: Briefcase,
        engine: 'odoo', // Odoo or ERPNext
        color: 'from-emerald-500 to-teal-600',
        recommendedTemplate: 'SME'
    },
    {
        code: 'STARTUP',
        name: 'Startup',
        description: 'Small businesses with basic requirements',
        icon: Sparkles,
        engine: 'odoo',
        color: 'from-orange-500 to-amber-600',
        recommendedTemplate: 'STARTUP'
    }
];

export function EnhancedOnboardingWizard({ tenantId, tenantSlug, onComplete }: EnhancedOnboardingWizardProps) {
    const router = useRouter();
    const { token } = useAuthStore();
    const { fetchTenantSettings } = useModuleStore();
    
    const [currentStep, setCurrentStep] = useState<'workspace' | 'template' | 'settings' | 'progress'>('workspace');
    const [selectedWorkspaceType, setSelectedWorkspaceType] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Load existing onboarding status on mount
    useEffect(() => {
        loadStatus();
    }, [tenantId]);

    // Auto-detect current step based on status
    useEffect(() => {
        if (status) {
            if (status.status === 'NOT_STARTED') {
                setCurrentStep('workspace');
            } else if (status.status === 'DRAFT' && !status.workspace_type) {
                setCurrentStep('workspace');
            } else if (status.status === 'DRAFT' && status.workspace_type && !status.template) {
                setCurrentStep('template');
            } else if (status.status === 'DRAFT' && status.workspace_type && status.template) {
                setCurrentStep('settings');
            } else if (status.status === 'PAUSED' || status.status === 'IN_PROGRESS') {
                setCurrentStep('progress');
                // Restore selections from status
                if (status.workspace_type) setSelectedWorkspaceType(status.workspace_type);
                if (status.template) setSelectedTemplate(status.template);
            } else if (status.status === 'COMPLETED') {
                setCurrentStep('progress');
            }
        }
    }, [status]);

    const loadStatus = async () => {
        try {
            const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/status`);
            setStatus(data?.data || data);
            setError(null);
        } catch (err: any) {
            if (err instanceof ApiError && err.status === 404) {
                setStatus({ status: 'NOT_STARTED', progress: 0, total_steps: 0, completed_steps: 0, steps: [] });
                return;
            }
            console.error('Failed to load onboarding status:', err);
            setError(err?.message || 'Failed to load onboarding status');
        }
    };

    const handleWorkspaceTypeSelect = (workspaceType: string) => {
        setSelectedWorkspaceType(workspaceType);
        const workspace = WORKSPACE_TYPES.find(w => w.code === workspaceType);
        if (workspace && !selectedTemplate) {
            setSelectedTemplate(workspace.recommendedTemplate);
        }
    };

    const handleInitiateOnboarding = async () => {
        if (!selectedWorkspaceType) {
            toast.error('Please select a workspace type');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/start`, {
                method: 'POST',
                body: JSON.stringify({
                    workspace_type: selectedWorkspaceType,
                    template_code: selectedTemplate || undefined
                })
            });
            toast.success('Onboarding initiated successfully', {
                description: `Engine: ${data.engine?.toUpperCase() || 'Default'}`
            });

            await loadStatus();
            setCurrentStep('settings');
        } catch (err: any) {
            setError(err.message || 'Failed to initiate onboarding');
            toast.error('Failed to initiate onboarding', {
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAndPause = async () => {
        if (!status || status.status !== 'IN_PROGRESS') {
            toast.error('Cannot pause. Onboarding is not in progress.');
            return;
        }

        setSaving(true);
        try {
            await apiFetch(`/onboarding/tenants/${tenantId}/pause`, { method: 'POST' });

            toast.success('Onboarding paused', {
                description: 'Your progress has been saved. You can resume anytime.'
            });

            await loadStatus();
        } catch (err: any) {
            toast.error('Failed to pause onboarding', {
                description: err.message
            });
        } finally {
            setSaving(false);
        }
    };

    const handleResume = async () => {
        if (!status || status.status !== 'PAUSED') {
            toast.error('No paused onboarding found');
            return;
        }

        setLoading(true);
        try {
            await apiFetch(`/onboarding/tenants/${tenantId}/resume`, { method: 'POST' });

            toast.success('Onboarding resumed', {
                description: 'Continuing from where you left off...'
            });

            await loadStatus();
        } catch (err: any) {
            toast.error('Failed to resume onboarding', {
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleBeginOnboarding = async () => {
        setLoading(true);
        try {
            await apiFetch(`/onboarding/tenants/${tenantId}/begin`, { method: 'POST' });

            await loadStatus();
            setCurrentStep('progress');
        } catch (err: any) {
            toast.error('Failed to begin onboarding', {
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNextStep = async () => {
        setLoading(true);
        try {
            const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/next-step`, { method: 'POST' });
            if (data.completed) {
                toast.success('Onboarding completed!', {
                    description: 'Your workspace is ready to use.'
                });
                if (onComplete) onComplete();
                if (tenantSlug) {
                    setTimeout(() => router.push(`/w/${tenantSlug}`), 2000);
                }
            }

            await loadStatus();
        } catch (err: any) {
            toast.error('Failed to execute step', {
                description: err.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSkipStep = async (stepCode: string) => {
        try {
            await apiFetch(`/onboarding/tenants/${tenantId}/steps/${stepCode}/skip`, { method: 'POST' });

            await loadStatus();
        } catch (err: any) {
            toast.error('Failed to skip step', {
                description: err.message
            });
        }
    };

    if (!status) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <LoadingSpinner />
            </div>
        );
    }

    // Step 1: Workspace Type Selection
    if (currentStep === 'workspace') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="max-w-5xl mx-auto p-6 space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Welcome to MoranERP
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Let&apos;s set up your workspace. First, tell us about your organization type.
                        </p>
                    </div>

                    {error && <ErrorHandler error={error} onDismiss={() => setError(null)} />}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {WORKSPACE_TYPES.map((workspace) => {
                            const Icon = workspace.icon;
                            const isSelected = selectedWorkspaceType === workspace.code;
                            return (
                                <Card
                                    key={workspace.code}
                                    className={`cursor-pointer transition-all duration-200 border-2 ${
                                        isSelected
                                            ? 'border-blue-500 shadow-xl scale-105 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30'
                                            : 'border-slate-200 hover:border-blue-300 hover:shadow-lg dark:border-slate-800'
                                    }`}
                                    onClick={() => handleWorkspaceTypeSelect(workspace.code)}
                                >
                                    <CardHeader>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`p-3 rounded-xl bg-gradient-to-br ${workspace.color}`}>
                                                <Icon className="h-6 w-6 text-white" />
                                            </div>
                                            {isSelected && (
                                                <Badge className="bg-blue-600 text-white">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Selected
                                                </Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-xl">{workspace.name}</CardTitle>
                                        <CardDescription className="text-sm mt-2">
                                            {workspace.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Server className="h-4 w-4" />
                                                <span>Engine: <strong>{workspace.engine.toUpperCase()}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Zap className="h-4 w-4" />
                                                <span>Template: <strong>{workspace.recommendedTemplate}</strong></span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {selectedWorkspaceType && (
                        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3">
                                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                                            Engine Selection
                                        </p>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            {selectedWorkspaceType === 'SACCO' 
                                                ? 'SACCO workspaces use CBS (Fineract) for core banking operations.'
                                                : selectedWorkspaceType === 'ENTERPRISE'
                                                ? 'Enterprise workspaces use ERPNext as the primary engine, with Odoo as fallback.'
                                                : 'This workspace type uses Odoo as the default engine.'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-between items-center">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                if (tenantSlug) router.push(`/w/${tenantSlug}`);
                                else router.push('/dashboard');
                            }}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>
                        <Button
                            onClick={handleInitiateOnboarding}
                            disabled={!selectedWorkspaceType || loading}
                            size="lg"
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Setting Up...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Template Selection (can be auto-selected)
    if (currentStep === 'template') {
        const templates = ['STARTUP', 'SME', 'ENTERPRISE'];
        const workspace = WORKSPACE_TYPES.find(w => w.code === selectedWorkspaceType);

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold">Select Onboarding Template</h1>
                        <p className="text-muted-foreground">
                            Choose a template that matches your needs. Recommended: <strong>{workspace?.recommendedTemplate}</strong>
                        </p>
                    </div>

                    <div className="grid gap-4">
                        {templates.map((template) => (
                            <Card
                                key={template}
                                className={`cursor-pointer transition-all ${
                                    selectedTemplate === template
                                        ? 'border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30'
                                        : 'hover:border-purple-300'
                                }`}
                                onClick={() => setSelectedTemplate(template)}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{template}</CardTitle>
                                        {selectedTemplate === template && (
                                            <CheckCircle2 className="h-5 w-5 text-purple-600" />
                                        )}
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>

                    <div className="flex justify-between">
                        <Button variant="ghost" onClick={() => setCurrentStep('workspace')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <Button
                            onClick={handleInitiateOnboarding}
                            disabled={!selectedTemplate || loading}
                            size="lg"
                        >
                            Continue
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 3: Settings Configuration (integrated with settings page)
    if (currentStep === 'settings') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold">Configure Your Workspace</h1>
                        <p className="text-muted-foreground">
                            Set up your company information and preferences. You can complete this later in Settings.
                        </p>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                            You can configure detailed settings later. Click Save & Continue to proceed with default settings,
                            or configure now by navigating to Settings.
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Setup</CardTitle>
                            <CardDescription>
                                Workspace Type: <strong>{selectedWorkspaceType}</strong> • Engine: <strong>{status?.engine?.toUpperCase() || 'DEFAULT'}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Basic configuration will be set up. You can customize everything later in Settings.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (tenantSlug) {
                                            router.push(`/w/${tenantSlug}/modules/settings/hub`);
                                        }
                                    }}
                                    className="w-full"
                                >
                                    Configure Settings Now
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button variant="ghost" onClick={() => setCurrentStep('workspace')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <Button
                            onClick={handleBeginOnboarding}
                            disabled={loading}
                            size="lg"
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    Begin Onboarding
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 4: Progress Tracking
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div className="text-center space-y-2 mb-8">
                    <h1 className="text-3xl font-bold">Onboarding Progress</h1>
                    <p className="text-muted-foreground">
                        {status.status === 'PAUSED' 
                            ? 'Your onboarding is paused. Resume whenever you\'re ready.'
                            : status.status === 'COMPLETED'
                            ? 'Onboarding completed successfully!'
                            : 'We\'re setting up your workspace. This may take a few minutes.'}
                    </p>
                </div>

                {/* Progress Overview */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Setup Progress</CardTitle>
                                <CardDescription>
                                    {status.workspace_type && (
                                        <span className="mr-3">Workspace: <strong>{status.workspace_type}</strong></span>
                                    )}
                                    {status.engine && (
                                        <span>Engine: <strong>{status.engine.toUpperCase()}</strong></span>
                                    )}
                                </CardDescription>
                            </div>
                            {status.status === 'PAUSED' && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                                    <Pause className="h-3 w-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">Overall Progress</span>
                                <span className="text-muted-foreground">{status.progress.toFixed(0)}%</span>
                            </div>
                            <Progress value={status.progress} className="h-3" />
                            <p className="text-xs text-muted-foreground text-center">
                                {status.completed_steps} of {status.total_steps} steps completed
                            </p>
                        </div>

                        {status.status === 'FAILED' && status.error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{status.error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Steps List */}
                        {status.steps && status.steps.length > 0 ? (
                            <div className="space-y-3 mt-6">
                                <h3 className="font-semibold text-sm">Onboarding Steps</h3>
                                {status.steps.map((step, index) => (
                                    <StepCard
                                        key={step.code || index}
                                        step={step}
                                        index={index + 1}
                                        isActive={status.current_step === step.code}
                                        onSkip={() => handleSkipStep(step.code)}
                                    />
                                ))}
                            </div>
                        ) : status.total_steps > 0 && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    {status.total_steps} steps configured. Details will appear once onboarding begins.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (tenantSlug) router.push(`/w/${tenantSlug}`);
                            else router.push('/dashboard');
                        }}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {status.status === 'COMPLETED' ? 'Go to Dashboard' : 'Save & Exit'}
                    </Button>

                    <div className="flex gap-3">
                        {status.status === 'PAUSED' && (
                            <Button
                                onClick={handleResume}
                                disabled={loading}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                            >
                                <Play className="h-4 w-4 mr-2" />
                                Resume
                            </Button>
                        )}

                        {status.status === 'IN_PROGRESS' && (
                            <>
                                <Button
                                    onClick={handleSaveAndPause}
                                    disabled={saving}
                                    variant="outline"
                                >
                                    <Pause className="h-4 w-4 mr-2" />
                                    {saving ? 'Saving...' : 'Pause'}
                                </Button>
                                <Button
                                    onClick={handleNextStep}
                                    disabled={loading}
                                    size="lg"
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Executing...
                                        </>
                                    ) : (
                                        <>
                                            Execute Next Step
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </>
                        )}

                        {status.status === 'DRAFT' && (
                            <Button
                                onClick={handleBeginOnboarding}
                                disabled={loading}
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        Begin Setup
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        )}

                        {status.status === 'COMPLETED' && (
                            <Button
                                onClick={() => {
                                    if (tenantSlug) router.push(`/w/${tenantSlug}`);
                                    else router.push('/dashboard');
                                }}
                                size="lg"
                                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                            >
                                Go to Workspace
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StepCard({
    step,
    index,
    isActive,
    onSkip
}: {
    step: OnboardingStep;
    index: number;
    isActive: boolean;
    onSkip: () => void;
}) {
    const getStatusIcon = () => {
        switch (step.status) {
            case 'COMPLETED':
                return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'FAILED':
                return <AlertCircle className="h-5 w-5 text-red-600" />;
            case 'IN_PROGRESS':
                return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
            case 'SKIPPED':
                return <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-dashed" />;
            default:
                return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
        }
    };

    const getStatusBadge = () => {
        switch (step.status) {
            case 'COMPLETED':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Completed</Badge>;
            case 'FAILED':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Failed</Badge>;
            case 'IN_PROGRESS':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">In Progress</Badge>;
            case 'SKIPPED':
                return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Skipped</Badge>;
            default:
                return <Badge variant="outline">Pending</Badge>;
        }
    };

    return (
        <div
            className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                isActive
                    ? 'bg-primary/5 border-primary shadow-md'
                    : step.status === 'COMPLETED'
                    ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                    : 'bg-muted/30 border-muted'
            }`}
        >
            <div className="flex-shrink-0 pt-0.5">
                {getStatusIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-muted-foreground">#{index}</span>
                    <h4 className="font-medium">{step.name}</h4>
                    {getStatusBadge()}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{step.code}</p>
                {step.module && (
                    <Badge variant="outline" className="mt-2 text-xs">
                        {step.module}
                    </Badge>
                )}
                {step.error && (
                    <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-xs">{step.error}</AlertDescription>
                    </Alert>
                )}
            </div>
            {step.status === 'PENDING' && (
                <Button variant="ghost" size="sm" onClick={onSkip}>
                    Skip
                </Button>
            )}
        </div>
    );
}
