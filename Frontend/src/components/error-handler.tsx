import { AlertCircle, CheckCircle, Clock, Lock, Server, Zap, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface StructuredErrorProps {
  error?: {
    type?:
      | 'validation_error'
      | 'authentication_failed'
      | 'permission_denied'
      | 'conflict'
      | 'erp_error'
      | 'timeout'
      | 'engine_unavailable'
      | 'internal_error'
      | 'module_error'
      | 'data_not_found'
      | 'rbac_violation'
      | 'tenant_error';
    message: string;
    status_code?: number;
  } | string | null;
  title?: string;
  onDismiss?: () => void;
}

export function ErrorHandler({
  error,
  title = 'Error',
  onDismiss,
}: StructuredErrorProps) {
  if (!error) return null;

  // Handle string errors
  if (typeof error === 'string') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="font-medium">{error}</div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-xs mt-2 underline hover:opacity-75"
            >
              Dismiss
            </button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const getErrorDetails = () => {
    switch (error.type) {
      case 'validation_error':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          description: `Validation Error: ${error.message}`,
          hint: 'Please check your input and try again',
        };
      case 'authentication_failed':
        return {
          icon: Lock,
          variant: 'destructive' as const,
          description: 'Authentication Failed',
          hint: 'Your session may have expired. Please log in again.',
        };
      case 'permission_denied':
      case 'rbac_violation':
        return {
          icon: Lock,
          variant: 'destructive' as const,
          description: 'Permission Denied',
          hint: 'You do not have permission to perform this action',
        };
      case 'conflict':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          description: 'Conflict Error',
          hint: 'This resource may already exist or there is a constraint violation',
        };
      case 'timeout':
        return {
          icon: Clock,
          variant: 'destructive' as const,
          description: 'Request Timeout',
          hint: 'The request took too long. Please try again.',
        };
      case 'engine_unavailable':
        return {
          icon: Server,
          variant: 'destructive' as const,
          description: 'ERP Engine Unavailable',
          hint: 'The ERP system is currently unavailable. Please try again later.',
        };
      case 'module_error':
        return {
          icon: Database,
          variant: 'destructive' as const,
          description: 'Module Error',
          hint: 'An error occurred in the module. Please try again.',
        };
      case 'data_not_found':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          description: 'Data Not Found',
          hint: 'The requested resource could not be found',
        };
      case 'tenant_error':
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          description: 'Tenant Error',
          hint: 'An error occurred with your tenant configuration',
        };
      case 'internal_error':
        return {
          icon: Zap,
          variant: 'destructive' as const,
          description: 'Internal Server Error',
          hint: 'An unexpected error occurred. Please contact support.',
        };
      case 'erp_error':
      default:
        return {
          icon: AlertCircle,
          variant: 'destructive' as const,
          description: `ERP Error (${error.status_code || 'Unknown'})`,
          hint: error.message || 'An error occurred in the ERP system',
        };
    }
  };

  const details = getErrorDetails();
  const Icon = details.icon;

  return (
    <Alert variant={details.variant} className="mb-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="font-medium">{details.description}</div>
        <div className="text-sm mt-1">{details.hint}</div>
        {error.message && error.type !== 'erp_error' && (
          <div className="text-xs mt-2 opacity-75">{error.message}</div>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs mt-2 underline hover:opacity-75"
          >
            Dismiss
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Success message handler
export function SuccessMessage({ message }: { message: string }) {
  return (
    <Alert className="bg-green-50 border-green-200 mb-4">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-900">Success</AlertTitle>
      <AlertDescription className="text-green-800">{message}</AlertDescription>
    </Alert>
  );
}
