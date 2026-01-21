'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

/**
 * Pull-to-Refresh Indicator Component
 * 
 * Use with the usePullToRefresh hook to show visual feedback during pull gesture.
 */
interface RefreshIndicatorProps {
    progress: number;
    isRefreshing: boolean;
    pullDistance: number;
    className?: string;
}

export function RefreshIndicator({
    progress,
    isRefreshing,
    pullDistance,
    className,
}: RefreshIndicatorProps) {
    if (pullDistance === 0 && !isRefreshing) return null;

    return (
        <div
            className={cn(
                'flex items-center justify-center py-4 transition-opacity overflow-hidden',
                className
            )}
            style={{
                height: `${pullDistance}px`,
                opacity: progress / 100,
            }}
        >
            <div
                className={cn(
                    'w-8 h-8 border-2 border-primary rounded-full border-t-transparent',
                    isRefreshing && 'animate-spin'
                )}
                style={{
                    transform: isRefreshing ? 'none' : `rotate(${progress * 3.6}deg)`,
                }}
            />
            {!isRefreshing && progress >= 100 && (
                <span className="ml-2 text-sm text-muted-foreground">Release to refresh</span>
            )}
            {isRefreshing && (
                <span className="ml-2 text-sm text-muted-foreground">Refreshing...</span>
            )}
        </div>
    );
}

export default RefreshIndicator;
