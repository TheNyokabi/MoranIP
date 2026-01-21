'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UsePullToRefreshOptions {
    /** Minimum distance (in pixels) to pull before triggering refresh */
    threshold?: number;
    /** Maximum pull distance (in pixels) */
    maxPull?: number;
    /** Whether pull-to-refresh is enabled */
    enabled?: boolean;
}

interface UsePullToRefreshReturn {
    /** Current pull distance (0 when not pulling) */
    pullDistance: number;
    /** Whether currently refreshing */
    isRefreshing: boolean;
    /** Whether user is actively pulling */
    isPulling: boolean;
    /** Progress percentage (0-100) */
    progress: number;
    /** Bind these to your scrollable container */
    handlers: {
        onTouchStart: (e: TouchEvent | React.TouchEvent) => void;
        onTouchMove: (e: TouchEvent | React.TouchEvent) => void;
        onTouchEnd: () => void;
    };
    /** Ref to attach to the scrollable container */
    containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for implementing pull-to-refresh functionality
 * 
 * @example
 * ```tsx
 * const { pullDistance, isRefreshing, progress, handlers, containerRef } = usePullToRefresh(async () => {
 *   await refetch();
 * });
 * 
 * return (
 *   <div ref={containerRef} {...handlers}>
 *     {pullDistance > 0 && <RefreshIndicator progress={progress} isRefreshing={isRefreshing} pullDistance={pullDistance} />}
 *     <YourContent />
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh(
    onRefresh: () => Promise<void>,
    options: UsePullToRefreshOptions = {}
): UsePullToRefreshReturn {
    const { threshold = 80, maxPull = 120, enabled = true } = options;

    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    const progress = Math.min((pullDistance / threshold) * 100, 100);

    const handleTouchStart = useCallback(
        (e: TouchEvent | React.TouchEvent) => {
            if (!enabled || isRefreshing) return;

            const touch = 'touches' in e ? e.touches[0] : e;
            startY.current = touch.clientY;

            // Only enable pull-to-refresh when scrolled to top
            const container = containerRef.current;
            if (container && container.scrollTop === 0) {
                setIsPulling(true);
            }
        },
        [enabled, isRefreshing]
    );

    const handleTouchMove = useCallback(
        (e: TouchEvent | React.TouchEvent) => {
            if (!enabled || isRefreshing || !isPulling) return;

            const touch = 'touches' in e ? e.touches[0] : e;
            currentY.current = touch.clientY;

            const delta = currentY.current - startY.current;

            // Only pull down, not up
            if (delta > 0) {
                // Apply resistance - the further you pull, the harder it gets
                const resistance = 0.5;
                const distance = Math.min(delta * resistance, maxPull);
                setPullDistance(distance);

                // Prevent default scroll behavior when pulling
                if ('preventDefault' in e) {
                    e.preventDefault();
                }
            }
        },
        [enabled, isRefreshing, isPulling, maxPull]
    );

    const handleTouchEnd = useCallback(async () => {
        if (!enabled || isRefreshing) return;

        setIsPulling(false);

        if (pullDistance >= threshold) {
            setIsRefreshing(true);
            setPullDistance(threshold); // Hold at threshold during refresh

            try {
                await onRefresh();
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            // Animate back to 0
            setPullDistance(0);
        }

        startY.current = 0;
        currentY.current = 0;
    }, [enabled, isRefreshing, pullDistance, threshold, onRefresh]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            setIsPulling(false);
            setPullDistance(0);
        };
    }, []);

    return {
        pullDistance,
        isRefreshing,
        isPulling,
        progress,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        },
        containerRef,
    };
}

export default usePullToRefresh;
