"use client";

import { useCallback, useState, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
    children: ReactNode;
    onRefresh: () => Promise<void>;
    disabled?: boolean;
    threshold?: number;
}

/**
 * Pull-to-refresh wrapper component for mobile list pages.
 * Wraps content and triggers refresh callback when user pulls down.
 */
export function PullToRefresh({
    children,
    onRefresh,
    disabled = false,
    threshold = 80,
}: PullToRefreshProps) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [startY, setStartY] = useState(0);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled || isRefreshing) return;

        // Only enable pull-to-refresh when scrolled to top
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 0) return;

        setStartY(e.touches[0].clientY);
        setIsPulling(true);
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || disabled || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, (currentY - startY) * 0.5); // Dampen the movement
        setPullDistance(Math.min(distance, threshold * 1.5));
    }, [isPulling, startY, disabled, isRefreshing, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling || disabled) return;

        setIsPulling(false);

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold); // Lock at threshold while refreshing

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, threshold, onRefresh, disabled, isRefreshing]);

    const progress = Math.min(pullDistance / threshold, 1);
    const showIndicator = pullDistance > 10 || isRefreshing;

    return (
        <div
            className="relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            {showIndicator && (
                <div
                    className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
                    style={{
                        top: Math.min(pullDistance - 40, threshold - 20),
                        opacity: progress,
                        transition: isPulling ? 'none' : 'all 0.2s ease-out'
                    }}
                >
                    <div className={cn(
                        "h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center",
                        isRefreshing && "animate-pulse"
                    )}>
                        <RefreshCw
                            className={cn(
                                "h-5 w-5 text-primary transition-transform",
                                isRefreshing && "animate-spin"
                            )}
                            style={{
                                transform: isRefreshing ? undefined : `rotate(${progress * 180}deg)`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Content with pull offset */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isPulling ? 'none' : 'transform 0.2s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
}
