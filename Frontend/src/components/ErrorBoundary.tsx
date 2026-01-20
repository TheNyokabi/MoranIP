'use client';

import { Component, ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('Error boundary caught:', error, errorInfo);

        // Log to error tracking service in production
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to error tracking service (e.g., Sentry)
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const error = this.state.error;
            const isApiError = error instanceof ApiError;

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="mt-4 text-lg font-medium text-center text-gray-900">
                            {isApiError ? 'Request Failed' : 'Something went wrong'}
                        </h3>
                        <p className="mt-2 text-sm text-center text-gray-600">
                            {error?.message || 'An unexpected error occurred'}
                        </p>
                        {isApiError && (error as ApiError).status && (
                            <p className="mt-1 text-xs text-center text-gray-500">
                                Error code: {(error as ApiError).status}
                            </p>
                        )}
                        <div className="mt-6">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
