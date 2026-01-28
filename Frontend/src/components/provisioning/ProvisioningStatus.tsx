'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch, ApiError, provisioningApi, ProvisioningConfig, ProvisioningStatus as ProvisioningStatusType } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProvisioningStepIndicator } from './ProvisioningStepIndicator';

interface ProvisioningStatusProps {
    tenantId: string
    onComplete?: () => void
    onError?: (error: string) => void
    autoRefresh?: boolean
    refreshInterval?: number
    startConfig?: ProvisioningConfig
}

const STEP_NAMES: Record<string, string> = {
    'step_0_engine_check': 'Engine Health Check',
    'step_2_company': 'Create Company',
    'step_3_chart_of_accounts': 'Import Chart of Accounts',
    'step_4_warehouses': 'Create Warehouses',
    'step_5_settings': 'Configure Settings',
    'step_6_items': 'Create Demo Items',
    'step_7_customer': 'Create Default Customer',
    'step_8_pos_profile': 'Create POS Profile',
    'step_9_pos_session': 'Open POS Session',
};

export function ProvisioningStatus({
    tenantId,
    onComplete,
    onError,
    autoRefresh = true,
    refreshInterval = 2000,
    startConfig,
}: ProvisioningStatusProps) {
    const { token } = useAuthStore();
    const [status, setStatus] = useState<ProvisioningStatusType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logsOpen, setLogsOpen] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [hasNotifiedError, setHasNotifiedError] = useState(false);
    const [hasNotifiedComplete, setHasNotifiedComplete] = useState(false);
    const [showHealthAction, setShowHealthAction] = useState(false);
    const [engineHealth, setEngineHealth] = useState<any | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const [healthError, setHealthError] = useState<string | null>(null);

    const fetchStatus = async () => {
        try {
            const data = await provisioningApi.getProvisioningStatus(tenantId, token || undefined);
            const previousStatus = status?.status;
            setStatus(data);
            setError(null);

            // Call callbacks only once when status changes
            if (data.status === 'COMPLETED' && onComplete && !hasNotifiedComplete) {
                setHasNotifiedComplete(true);
                onComplete();
            } else if (data.status === 'FAILED' && onError && !hasNotifiedError && previousStatus !== 'FAILED') {
                setHasNotifiedError(true);
                const errorMsg = data.errors && data.errors.length > 0
                    ? `${data.errors[0]?.step || 'Unknown step'}: ${data.errors[0]?.error || 'Provisioning failed'}`
                    : (data as any).message || 'Provisioning failed';
                onError(errorMsg);
            } else if (data.status === 'PARTIAL' && previousStatus !== 'PARTIAL') {
                // PARTIAL status means provisioning completed but with non-critical warnings
                // Don't call onError - this is not a failure, just a warning
                // Log as warning instead of error
                if (data.errors && data.errors.length > 0) {
                    console.warn('Provisioning completed with warnings:', data.errors.map(e => `${e.step}: ${e.error}`).join(', '));
                } else {
                    console.warn('Provisioning completed with warnings: Some non-critical steps may have failed');
                }
                // Reset error notification flag since PARTIAL is not an error
                setHasNotifiedError(false);
            }

            // Reset notification flags if status changes back to in progress
            if (data.status === 'IN_PROGRESS' && (previousStatus === 'FAILED' || previousStatus === 'PARTIAL')) {
                setHasNotifiedError(false);
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to fetch provisioning status';
            setError(errorMessage);
            // Only notify on first error fetch failure
            if (onError && !hasNotifiedError) {
                setHasNotifiedError(true);
                onError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const data = await provisioningApi.getProvisioningLogs(tenantId, token || undefined);
            setLogs(data.logs || []);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    };

    useEffect(() => {
        fetchStatus();
        if (logsOpen) {
            fetchLogs();
        }
    }, [tenantId, logsOpen]);

    useEffect(() => {
        if (!autoRefresh || !status) return;

        const isInProgress = status.status === 'IN_PROGRESS';
        if (!isInProgress) return;

        const interval = setInterval(() => {
            fetchStatus();
            if (logsOpen) {
                fetchLogs();
            }
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, status?.status, logsOpen, refreshInterval]);

    const handleRetry = async () => {
        setLoading(true);
        setHasNotifiedError(false); // Reset error notification
        try {
            await provisioningApi.retryProvisioning(tenantId, undefined, token || undefined);
            await fetchStatus();
        } catch (err: any) {
            setError(err.message || 'Failed to retry provisioning');
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = async () => {
        setLoading(true);
        setHasNotifiedError(false); // Reset error notification
        try {
            await provisioningApi.continueProvisioning(tenantId, token || undefined);
            await fetchStatus();
        } catch (err: any) {
            setError(err.message || 'Failed to continue provisioning');
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        setLoading(true);
        setError(null);
        setShowHealthAction(false);
        setEngineHealth(null);
        setHealthError(null);
        try {
            const config = startConfig || {
                include_demo_data: false,
                pos_store_enabled: true,
            };
            await provisioningApi.startProvisioning(tenantId, config, token || undefined);
            await fetchStatus();
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to start provisioning';
            setError(errorMessage);
            const isEngineUnstable = err instanceof ApiError
                ? err.status === 503 && err.rawError?.detail?.type === 'engine_unstable'
                : errorMessage.includes('Engine not stable');
            setShowHealthAction(isEngineUnstable);
            if (onError) {
                onError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCheckEngineHealth = async () => {
        setHealthLoading(true);
        setHealthError(null);
        try {
            const data = await apiFetch<any>('/erpnext/health', {}, token || undefined);
            setEngineHealth(data);
        } catch (err: any) {
            setHealthError(err.message || 'Failed to check server status');
        } finally {
            setHealthLoading(false);
        }
    };

    if (loading && !status) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading provisioning status...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error && !status) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                    {showHealthAction && (
                        <div className="mt-4 space-y-2">
                            <Button size="sm" variant="outline" onClick={handleCheckEngineHealth} disabled={healthLoading}>
                                {healthLoading ? 'Checking server status...' : 'Check Server Status'}
                            </Button>
                            {healthError && <p className="text-xs text-destructive">{healthError}</p>}
                            {engineHealth && (
                                <div className="text-xs text-muted-foreground">
                                    <div>Status: {engineHealth.authenticated ? 'authenticated' : 'not authenticated'}</div>
                                    <div>Message: {engineHealth.message || 'No details provided'}</div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    if (!status) return null;

    const getStatusBadge = () => {
        switch (status.status) {
            case 'COMPLETED':
                return (
                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                    </Badge>
                );
            case 'FAILED':
                return (
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                    </Badge>
                );
            case 'IN_PROGRESS':
                return (
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        In Progress
                    </Badge>
                );
            case 'PARTIAL':
                return (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Partial
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline">
                        {status.status}
                    </Badge>
                );
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Provisioning Status
                            {getStatusBadge()}
                        </CardTitle>
                        <CardDescription>
                            {status.status === 'COMPLETED'
                                ? 'Workspace is ready for POS operations'
                                : status.status === 'FAILED'
                                    ? 'Provisioning encountered errors'
                                    : status.status === 'PARTIAL'
                                        ? 'Provisioning completed with warnings. Workspace is functional but some optional steps may have failed.'
                                        : status.status === 'IN_PROGRESS'
                                            ? `Step ${status.steps_completed + 1} of ${status.total_steps}: ${STEP_NAMES[status.current_step || ''] || status.current_step}`
                                            : 'Provisioning not started'}
                        </CardDescription>
                    </div>
                    {status.status === 'IN_PROGRESS' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchStatus()}
                            disabled={loading}
                        >
                            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                            {status.steps_completed} of {status.total_steps} steps completed ({Math.round(status.progress)}%)
                        </span>
                    </div>
                    <Progress value={status.progress || 0} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{status.steps_completed} of {status.total_steps} steps completed</span>
                        {status.started_at && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Started {new Date(status.started_at).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Current Step */}
                {status.current_step && status.status === 'IN_PROGRESS' && (
                    <div className="rounded-lg border p-3 bg-muted/50">
                        <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="font-medium">
                                {STEP_NAMES[status.current_step] || status.current_step}
                            </span>
                        </div>
                    </div>
                )}

                {/* Errors / Warnings */}
                {(status.errors && status.errors.length > 0) || (status.status === 'FAILED' && (!status.errors || status.errors.length === 0)) ? (
                    <div className={cn(
                        "rounded-lg border p-3",
                        status.status === 'PARTIAL'
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-destructive/50 bg-destructive/10"
                    )}>
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className={cn(
                                "h-4 w-4",
                                status.status === 'PARTIAL' ? "text-amber-500" : "text-destructive"
                            )} />
                            <span className={cn(
                                "text-sm font-medium",
                                status.status === 'PARTIAL' ? "text-amber-500" : "text-destructive"
                            )}>
                                {status.status === 'PARTIAL' ? 'Warnings' : 'Errors'}
                            </span>
                        </div>
                        {status.errors && status.errors.length > 0 ? (
                            <ul className={cn(
                                "space-y-1 text-sm",
                                status.status === 'PARTIAL' ? "text-amber-400" : "text-destructive"
                            )}>
                                {status.errors.map((err, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <span className="text-muted-foreground">•</span>
                                        <span>
                                            <span className="font-medium">{STEP_NAMES[err.step] || err.step}:</span>{' '}
                                            {err.error}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={cn(
                                "text-sm",
                                status.status === 'PARTIAL' ? "text-amber-400" : "text-destructive"
                            )}>
                                {status.status === 'PARTIAL'
                                    ? 'Provisioning completed with warnings. Workspace is functional but some optional steps may have failed.'
                                    : `Provisioning failed. ${status.current_step ? `Last attempted step: ${STEP_NAMES[status.current_step] || status.current_step}` : 'Please check the logs for details.'}`
                                }
                            </p>
                        )}
                        {(status.status === 'FAILED' || status.status === 'PARTIAL') && (
                            <div className="mt-3 flex flex-col gap-2">
                                <div className="text-xs text-muted-foreground mb-1">
                                    Choose an action:
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleContinue}
                                        disabled={loading}
                                        className="flex-1"
                                    >
                                        <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                                        Continue
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRetry}
                                        disabled={loading}
                                        className="flex-1"
                                    >
                                        <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                                        Retry All
                                    </Button>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    <div>• <strong>Continue:</strong> Resumes from the failed step (keeps completed steps)</div>
                                    <div>• <strong>Retry All:</strong> Clears all failed steps and retries from beginning</div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                        <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                        {showHealthAction && (
                            <div className="mt-3 space-y-2">
                                <Button size="sm" variant="outline" onClick={handleCheckEngineHealth} disabled={healthLoading}>
                                    {healthLoading ? 'Checking server status...' : 'Check Server Status'}
                                </Button>
                                {healthError && <p className="text-xs text-destructive">{healthError}</p>}
                                {engineHealth && (
                                    <div className="text-xs text-muted-foreground">
                                        <div>Status: {engineHealth.authenticated ? 'authenticated' : 'not authenticated'}</div>
                                        <div>Message: {engineHealth.message || 'No details provided'}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Success Message */}
                {status.status === 'COMPLETED' && (
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                        <div className="flex items-center gap-2 text-sm text-green-400">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Workspace is fully provisioned and ready for POS operations!</span>
                        </div>
                    </div>
                )}

                {/* Start Provisioning Button for NOT_STARTED */}
                {status.status === 'NOT_STARTED' && (
                    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-sm text-amber-400">
                                <AlertCircle className="h-4 w-4" />
                                <span className="font-medium">Provisioning has not been started</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Start the provisioning process to set up your workspace for POS operations. This will create the company, warehouses, and POS profile in ERPNext.
                            </p>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleStart}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Start Provisioning
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Logs */}
                <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                            <span>View Logs</span>
                            {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                        <div className="rounded-lg border p-3 bg-muted/50 max-h-64 overflow-y-auto">
                            {logs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No logs available</p>
                            ) : (
                                <div className="space-y-2">
                                    {logs.map((log, idx) => (
                                        <ProvisioningStepIndicator
                                            key={idx}
                                            step={log.step}
                                            status={log.status}
                                            message={log.message}
                                            error={log.error}
                                            duration={log.duration_ms}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    );
}
