'use client';

import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, Archive, Star, MoreHorizontal, Edit, Share } from 'lucide-react';

export interface SwipeAction {
    id: string;
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
    onClick: () => void;
}

interface SwipeActionsProps {
    children: React.ReactNode;
    leftActions?: SwipeAction[];
    rightActions?: SwipeAction[];
    /** Threshold in pixels to trigger action */
    threshold?: number;
    /** Whether swipe is disabled */
    disabled?: boolean;
    className?: string;
}

/**
 * Swipe Actions Component
 * 
 * Wraps content and reveals actions when swiped left or right.
 * 
 * @example
 * ```tsx
 * <SwipeActions
 *   rightActions={[
 *     { id: 'delete', icon: <Trash2 />, label: 'Delete', color: 'text-white', bgColor: 'bg-red-500', onClick: handleDelete },
 *     { id: 'archive', icon: <Archive />, label: 'Archive', color: 'text-white', bgColor: 'bg-gray-500', onClick: handleArchive },
 *   ]}
 * >
 *   <div className="p-4 bg-white">Your list item content</div>
 * </SwipeActions>
 * ```
 */
export function SwipeActions({
    children,
    leftActions = [],
    rightActions = [],
    threshold = 60,
    disabled = false,
    className,
}: SwipeActionsProps) {
    const [translateX, setTranslateX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (disabled) return;
            startX.current = e.touches[0].clientX;
            setIsDragging(true);
        },
        [disabled]
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (disabled || !isDragging) return;

            currentX.current = e.touches[0].clientX;
            const deltaX = currentX.current - startX.current;

            // Limit swipe distance
            const maxLeft = rightActions.length * -80;
            const maxRight = leftActions.length * 80;

            // Apply resistance at edges
            let newTranslateX = deltaX;
            if (deltaX < maxLeft) {
                newTranslateX = maxLeft + (deltaX - maxLeft) * 0.3;
            } else if (deltaX > maxRight) {
                newTranslateX = maxRight + (deltaX - maxRight) * 0.3;
            }

            setTranslateX(newTranslateX);
        },
        [disabled, isDragging, leftActions.length, rightActions.length]
    );

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);

        // Snap to action position or back to center
        if (translateX < -threshold && rightActions.length > 0) {
            // Snap to show right actions
            setTranslateX(rightActions.length * -80);
        } else if (translateX > threshold && leftActions.length > 0) {
            // Snap to show left actions
            setTranslateX(leftActions.length * 80);
        } else {
            // Snap back to center
            setTranslateX(0);
        }

        startX.current = 0;
        currentX.current = 0;
    }, [translateX, threshold, leftActions.length, rightActions.length]);

    const handleActionClick = (action: SwipeAction) => {
        action.onClick();
        setTranslateX(0);
    };

    const resetPosition = () => {
        setTranslateX(0);
    };

    return (
        <div
            ref={containerRef}
            className={cn('relative overflow-hidden', className)}
            onClick={translateX !== 0 ? resetPosition : undefined}
        >
            {/* Left Actions */}
            {leftActions.length > 0 && (
                <div className="absolute left-0 top-0 bottom-0 flex h-full">
                    {leftActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={cn(
                                'flex flex-col items-center justify-center w-20 h-full transition-opacity',
                                action.bgColor,
                                action.color
                            )}
                            style={{ opacity: translateX > 0 ? 1 : 0 }}
                        >
                            {action.icon}
                            <span className="text-xs mt-1">{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Right Actions */}
            {rightActions.length > 0 && (
                <div className="absolute right-0 top-0 bottom-0 flex h-full">
                    {rightActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={cn(
                                'flex flex-col items-center justify-center w-20 h-full transition-opacity',
                                action.bgColor,
                                action.color
                            )}
                            style={{ opacity: translateX < 0 ? 1 : 0 }}
                        >
                            {action.icon}
                            <span className="text-xs mt-1">{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div
                className={cn(
                    'relative bg-background transition-transform',
                    !isDragging && 'duration-200'
                )}
                style={{ transform: `translateX(${translateX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * Preset action configurations for common use cases
 */
export const swipeActionPresets = {
    delete: (onClick: () => void): SwipeAction => ({
        id: 'delete',
        icon: <Trash2 className="w-5 h-5" />,
        label: 'Delete',
        color: 'text-white',
        bgColor: 'bg-red-500',
        onClick,
    }),

    archive: (onClick: () => void): SwipeAction => ({
        id: 'archive',
        icon: <Archive className="w-5 h-5" />,
        label: 'Archive',
        color: 'text-white',
        bgColor: 'bg-gray-500',
        onClick,
    }),

    favorite: (onClick: () => void): SwipeAction => ({
        id: 'favorite',
        icon: <Star className="w-5 h-5" />,
        label: 'Favorite',
        color: 'text-white',
        bgColor: 'bg-yellow-500',
        onClick,
    }),

    edit: (onClick: () => void): SwipeAction => ({
        id: 'edit',
        icon: <Edit className="w-5 h-5" />,
        label: 'Edit',
        color: 'text-white',
        bgColor: 'bg-blue-500',
        onClick,
    }),

    share: (onClick: () => void): SwipeAction => ({
        id: 'share',
        icon: <Share className="w-5 h-5" />,
        label: 'Share',
        color: 'text-white',
        bgColor: 'bg-green-500',
        onClick,
    }),

    more: (onClick: () => void): SwipeAction => ({
        id: 'more',
        icon: <MoreHorizontal className="w-5 h-5" />,
        label: 'More',
        color: 'text-white',
        bgColor: 'bg-gray-400',
        onClick,
    }),
};

export default SwipeActions;
