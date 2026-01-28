'use client';

import * as React from 'react';

/**
 * Custom gesture hooks for mobile-first POS interface
 */

// Long press hook
interface UseLongPressOptions {
    onLongPress: () => void;
    onPress?: () => void;
    delay?: number;
}

export function useLongPress({
    onLongPress,
    onPress,
    delay = 500
}: UseLongPressOptions) {
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = React.useRef(false);

    const start = React.useCallback(() => {
        isLongPressRef.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            onLongPress();
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, delay);
    }, [onLongPress, delay]);

    const clear = React.useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (!isLongPressRef.current && onPress) {
            onPress();
        }
        isLongPressRef.current = false;
    }, [onPress]);

    const cancel = React.useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        isLongPressRef.current = false;
    }, []);

    return {
        onTouchStart: start,
        onTouchEnd: clear,
        onTouchCancel: cancel,
        onMouseDown: start,
        onMouseUp: clear,
        onMouseLeave: cancel
    };
}

// Pull to refresh hook
interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80
}: UsePullToRefreshOptions) {
    const [isPulling, setIsPulling] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [pullDistance, setPullDistance] = React.useState(0);
    const startYRef = React.useRef(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        const container = containerRef.current;
        if (!container || container.scrollTop > 0) return;
        
        startYRef.current = e.touches[0].clientY;
        setIsPulling(true);
    }, []);

    const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
        if (!isPulling || isRefreshing) return;
        
        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, currentY - startYRef.current);
        
        // Apply resistance
        const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(resistedDistance);
    }, [isPulling, isRefreshing, threshold]);

    const handleTouchEnd = React.useCallback(async () => {
        if (!isPulling) return;
        
        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
        
        setIsPulling(false);
        setPullDistance(0);
    }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

    return {
        containerRef,
        isPulling,
        isRefreshing,
        pullDistance,
        pullProgress: Math.min(pullDistance / threshold, 1),
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd
        }
    };
}

// Swipe detection hook
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface UseSwipeOptions {
    onSwipe?: (direction: SwipeDirection) => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
}

export function useSwipe({
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50
}: UseSwipeOptions) {
    const startRef = React.useRef<{ x: number; y: number } | null>(null);

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        startRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }, []);

    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (!startRef.current) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const deltaX = endX - startRef.current.x;
        const deltaY = endY - startRef.current.y;
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        let direction: SwipeDirection = null;

        if (absX > absY && absX > threshold) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else if (absY > absX && absY > threshold) {
            direction = deltaY > 0 ? 'down' : 'up';
        }

        if (direction) {
            onSwipe?.(direction);
            
            switch (direction) {
                case 'left':
                    onSwipeLeft?.();
                    break;
                case 'right':
                    onSwipeRight?.();
                    break;
                case 'up':
                    onSwipeUp?.();
                    break;
                case 'down':
                    onSwipeDown?.();
                    break;
            }
        }

        startRef.current = null;
    }, [onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

    return {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd
    };
}

// Pinch zoom hook
interface UsePinchOptions {
    onPinchIn?: () => void;
    onPinchOut?: () => void;
    threshold?: number;
}

export function usePinch({
    onPinchIn,
    onPinchOut,
    threshold = 1.2
}: UsePinchOptions) {
    const initialDistanceRef = React.useRef<number | null>(null);

    const getDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            initialDistanceRef.current = getDistance(e.touches);
        }
    }, []);

    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (initialDistanceRef.current !== null && e.changedTouches.length === 2) {
            const finalDistance = getDistance(e.changedTouches);
            const ratio = finalDistance / initialDistanceRef.current;

            if (ratio > threshold) {
                onPinchOut?.();
            } else if (ratio < 1 / threshold) {
                onPinchIn?.();
            }
        }
        initialDistanceRef.current = null;
    }, [onPinchIn, onPinchOut, threshold]);

    return {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd
    };
}

// Haptic feedback helper
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (!navigator.vibrate) return;
    
    switch (type) {
        case 'light':
            navigator.vibrate(10);
            break;
        case 'medium':
            navigator.vibrate(30);
            break;
        case 'heavy':
            navigator.vibrate(50);
            break;
    }
}
