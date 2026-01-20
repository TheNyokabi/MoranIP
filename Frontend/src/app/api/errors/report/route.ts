import { NextRequest, NextResponse } from 'next/server';

/**
 * Error Reporting API Endpoint
 * Receives error reports from the frontend ErrorBoundary component
 * 
 * In production, this would forward errors to a service like Sentry,
 * LogRocket, or a custom error tracking backend.
 */
export async function POST(request: NextRequest) {
    try {
        const errorData = await request.json();

        // Log to server console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('[Error Report]', {
                error: errorData.error,
                url: errorData.url,
                timestamp: errorData.timestamp,
            });
        }

        // In production, forward to error tracking service
        if (process.env.NODE_ENV === 'production') {
            // Example: Forward to backend error logging endpoint
            const backendUrl = process.env.NEXT_PUBLIC_API_URL;
            if (backendUrl) {
                try {
                    await fetch(`${backendUrl}/api/errors/log`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...errorData,
                            source: 'frontend',
                            environment: process.env.NODE_ENV,
                        }),
                    });
                } catch {
                    // Silently fail - don't cause more errors
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch {
        // Always return success to prevent client-side error loops
        return NextResponse.json({ success: true });
    }
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
