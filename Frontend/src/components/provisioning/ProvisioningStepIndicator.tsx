'use client';

import { CheckCircle2, XCircle, Loader2, Clock, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProvisioningStepIndicatorProps {
    step: string
    status: string
    message?: string
    error?: string
    duration?: number
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

export function ProvisioningStepIndicator({
    step,
    status,
    message,
    error,
    duration,
}: ProvisioningStepIndicatorProps) {
    const getStatusIcon = () => {
        switch (status) {
            case 'completed':
            case 'exists':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'skipped':
                return <SkipForward className="h-4 w-4 text-amber-500" />;
            case 'in_progress':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            default:
                return <Clock className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusBadge = () => {
        switch (status) {
            case 'completed':
            case 'exists':
                return (
                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                        Completed
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 text-xs">
                        Failed
                    </Badge>
                );
            case 'skipped':
                return (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10 text-xs">
                        Skipped
                    </Badge>
                );
            case 'in_progress':
                return (
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs">
                        In Progress
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="text-xs">
                        Pending
                    </Badge>
                );
        }
    };

    return (
        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="mt-0.5">{getStatusIcon()}</div>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                        {STEP_NAMES[step] || step}
                    </span>
                    {getStatusBadge()}
                </div>
                {message && (
                    <p className="text-xs text-muted-foreground">{message}</p>
                )}
                {error && (
                    <p className="text-xs text-destructive">{error}</p>
                )}
                {duration !== undefined && duration > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Duration: {(duration / 1000).toFixed(2)}s
                    </p>
                )}
            </div>
        </div>
    );
}
