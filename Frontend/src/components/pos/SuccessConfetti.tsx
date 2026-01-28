'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiPiece {
    id: number;
    x: number;
    color: string;
    delay: number;
    rotation: number;
    scale: number;
}

interface SuccessConfettiProps {
    trigger: boolean;
    onComplete?: () => void;
    duration?: number;
}

const COLORS = [
    '#10B981', // emerald
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#F59E0B', // amber
    '#EF4444', // red
    '#EC4899', // pink
    '#06B6D4', // cyan
];

export function SuccessConfetti({
    trigger,
    onComplete,
    duration = 2000
}: SuccessConfettiProps) {
    const [pieces, setPieces] = React.useState<ConfettiPiece[]>([]);
    const [isActive, setIsActive] = React.useState(false);

    React.useEffect(() => {
        if (trigger && !isActive) {
            setIsActive(true);
            
            // Generate confetti pieces
            const newPieces: ConfettiPiece[] = [];
            for (let i = 0; i < 50; i++) {
                newPieces.push({
                    id: i,
                    x: Math.random() * 100, // percentage across screen
                    color: COLORS[Math.floor(Math.random() * COLORS.length)],
                    delay: Math.random() * 0.3,
                    rotation: Math.random() * 360,
                    scale: 0.5 + Math.random() * 0.5
                });
            }
            setPieces(newPieces);

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 50]);
            }

            // Clear after duration
            setTimeout(() => {
                setIsActive(false);
                setPieces([]);
                onComplete?.();
            }, duration);
        }
    }, [trigger, isActive, duration, onComplete]);

    return (
        <AnimatePresence>
            {isActive && (
                <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
                    {pieces.map((piece) => (
                        <motion.div
                            key={piece.id}
                            initial={{
                                opacity: 1,
                                x: `${piece.x}vw`,
                                y: '-10%',
                                rotate: piece.rotation,
                                scale: piece.scale
                            }}
                            animate={{
                                y: '110vh',
                                rotate: piece.rotation + 360 * (Math.random() > 0.5 ? 1 : -1),
                                opacity: [1, 1, 1, 0]
                            }}
                            transition={{
                                duration: 2 + Math.random(),
                                delay: piece.delay,
                                ease: 'easeIn'
                            }}
                            className="absolute"
                            style={{
                                width: 8 + Math.random() * 8,
                                height: 8 + Math.random() * 8,
                                backgroundColor: piece.color,
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px'
                            }}
                        />
                    ))}
                </div>
            )}
        </AnimatePresence>
    );
}

// Animated counter for quantity/price changes
interface AnimatedCounterProps {
    value: number;
    prefix?: string;
    suffix?: string;
    className?: string;
    duration?: number;
}

export function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    className = '',
    duration = 0.5
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = React.useState(value);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const prevValueRef = React.useRef(value);

    React.useEffect(() => {
        if (value !== prevValueRef.current) {
            setIsAnimating(true);
            
            // Animate to new value
            const startValue = prevValueRef.current;
            const endValue = value;
            const startTime = Date.now();
            const durationMs = duration * 1000;

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                
                // Easing function (ease-out)
                const eased = 1 - Math.pow(1 - progress, 3);
                
                const current = startValue + (endValue - startValue) * eased;
                setDisplayValue(Math.round(current * 100) / 100);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setDisplayValue(endValue);
                    setIsAnimating(false);
                }
            };

            requestAnimationFrame(animate);
            prevValueRef.current = value;
        }
    }, [value, duration]);

    return (
        <motion.span
            className={className}
            animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.2 }}
        >
            {prefix}{displayValue.toLocaleString()}{suffix}
        </motion.span>
    );
}

// Flying item animation (add to cart effect)
interface FlyingItemProps {
    trigger: boolean;
    startPosition: { x: number; y: number };
    endPosition: { x: number; y: number };
    children: React.ReactNode;
    onComplete?: () => void;
}

export function FlyingItem({
    trigger,
    startPosition,
    endPosition,
    children,
    onComplete
}: FlyingItemProps) {
    const [isFlying, setIsFlying] = React.useState(false);

    React.useEffect(() => {
        if (trigger && !isFlying) {
            setIsFlying(true);
        }
    }, [trigger, isFlying]);

    const handleComplete = () => {
        setIsFlying(false);
        onComplete?.();
    };

    return (
        <AnimatePresence>
            {isFlying && (
                <motion.div
                    initial={{
                        position: 'fixed',
                        left: startPosition.x,
                        top: startPosition.y,
                        opacity: 1,
                        scale: 1,
                        zIndex: 100
                    }}
                    animate={{
                        left: endPosition.x,
                        top: endPosition.y,
                        opacity: 0,
                        scale: 0.3
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                        duration: 0.5
                    }}
                    onAnimationComplete={handleComplete}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Pulse animation wrapper
interface PulseWrapperProps {
    trigger: boolean;
    children: React.ReactNode;
    color?: string;
}

export function PulseWrapper({
    trigger,
    children,
    color = 'rgba(16, 185, 129, 0.5)'
}: PulseWrapperProps) {
    return (
        <motion.div
            animate={trigger ? {
                boxShadow: [
                    `0 0 0 0 ${color}`,
                    `0 0 0 10px transparent`,
                    `0 0 0 0 transparent`
                ]
            } : {}}
            transition={{ duration: 0.5 }}
            className="rounded-xl"
        >
            {children}
        </motion.div>
    );
}

// Shake animation for errors
interface ShakeWrapperProps {
    trigger: boolean;
    children: React.ReactNode;
}

export function ShakeWrapper({ trigger, children }: ShakeWrapperProps) {
    return (
        <motion.div
            animate={trigger ? {
                x: [0, -10, 10, -10, 10, 0]
            } : {}}
            transition={{ duration: 0.4 }}
        >
            {children}
        </motion.div>
    );
}

export default SuccessConfetti;
