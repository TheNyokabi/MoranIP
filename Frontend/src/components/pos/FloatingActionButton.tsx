'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ShoppingCart,
    Scan,
    UserPlus,
    Percent,
    PauseCircle,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
    onClick: () => void;
}

interface FloatingActionButtonProps {
    cartCount: number;
    cartTotal: number;
    onCartClick: () => void;
    onBarcodeClick?: () => void;
    onNewCustomerClick?: () => void;
    onDiscountClick?: () => void;
    onHoldSaleClick?: () => void;
    currency?: string;
    className?: string;
}

export function FloatingActionButton({
    cartCount,
    cartTotal,
    onCartClick,
    onBarcodeClick,
    onNewCustomerClick,
    onDiscountClick,
    onHoldSaleClick,
    currency = 'KES',
    className
}: FloatingActionButtonProps) {
    const [showMenu, setShowMenu] = React.useState(false);
    const [isLongPressing, setIsLongPressing] = React.useState(false);
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

    const quickActions: QuickAction[] = [
        {
            id: 'barcode',
            label: 'Scan',
            icon: Scan,
            color: 'bg-blue-500',
            onClick: () => {
                onBarcodeClick?.();
                setShowMenu(false);
            }
        },
        {
            id: 'customer',
            label: 'Customer',
            icon: UserPlus,
            color: 'bg-purple-500',
            onClick: () => {
                onNewCustomerClick?.();
                setShowMenu(false);
            }
        },
        {
            id: 'discount',
            label: 'Discount',
            icon: Percent,
            color: 'bg-amber-500',
            onClick: () => {
                onDiscountClick?.();
                setShowMenu(false);
            }
        },
        {
            id: 'hold',
            label: 'Hold',
            icon: PauseCircle,
            color: 'bg-zinc-600',
            onClick: () => {
                onHoldSaleClick?.();
                setShowMenu(false);
            }
        }
    ].filter(action => {
        // Only include actions that have handlers
        if (action.id === 'barcode' && !onBarcodeClick) return false;
        if (action.id === 'customer' && !onNewCustomerClick) return false;
        if (action.id === 'discount' && !onDiscountClick) return false;
        if (action.id === 'hold' && !onHoldSaleClick) return false;
        return true;
    });

    const handlePressStart = () => {
        longPressTimer.current = setTimeout(() => {
            setIsLongPressing(true);
            setShowMenu(true);
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 400);
    };

    const handlePressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        if (!isLongPressing) {
            // Quick tap - open cart
            onCartClick();
        }
        setIsLongPressing(false);
    };

    const handleCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        setIsLongPressing(false);
    };

    // Calculate positions for radial menu
    const getActionPosition = (index: number, total: number) => {
        const startAngle = -135; // Start from top-left
        const endAngle = -45; // End at top-right
        const angleStep = (endAngle - startAngle) / (total - 1);
        const angle = startAngle + (index * angleStep);
        const radian = (angle * Math.PI) / 180;
        const radius = 80;
        
        return {
            x: Math.cos(radian) * radius,
            y: Math.sin(radian) * radius
        };
    };

    return (
        <div className={cn("fixed bottom-6 right-6 z-50 lg:hidden", className)}>
            {/* Backdrop for menu */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                        onClick={() => setShowMenu(false)}
                    />
                )}
            </AnimatePresence>

            {/* Quick Actions Menu */}
            <AnimatePresence>
                {showMenu && (
                    <>
                        {quickActions.map((action, index) => {
                            const pos = getActionPosition(index, quickActions.length);
                            return (
                                <motion.div
                                    key={action.id}
                                    initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                                    animate={{ 
                                        scale: 1, 
                                        opacity: 1, 
                                        x: pos.x, 
                                        y: pos.y 
                                    }}
                                    exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                                    transition={{ 
                                        type: 'spring', 
                                        stiffness: 400, 
                                        damping: 20,
                                        delay: index * 0.05
                                    }}
                                    className="absolute bottom-0 right-0 z-50"
                                >
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-14 h-14 rounded-full shadow-xl flex flex-col items-center justify-center gap-0.5",
                                            action.color,
                                            "hover:opacity-90 text-white"
                                        )}
                                        onClick={action.onClick}
                                    >
                                        <action.icon className="h-5 w-5" />
                                        <span className="text-[9px] font-medium">{action.label}</span>
                                    </Button>
                                </motion.div>
                            );
                        })}
                    </>
                )}
            </AnimatePresence>

            {/* Main FAB */}
            <motion.div
                className="relative z-50"
                whileTap={!showMenu ? { scale: 0.9 } : {}}
            >
                <Button
                    className={cn(
                        "w-16 h-16 rounded-full shadow-2xl",
                        showMenu 
                            ? "bg-zinc-700 hover:bg-zinc-600" 
                            : "bg-emerald-600 hover:bg-emerald-500",
                        "flex items-center justify-center transition-colors"
                    )}
                    onTouchStart={!showMenu ? handlePressStart : undefined}
                    onTouchEnd={!showMenu ? handlePressEnd : undefined}
                    onTouchCancel={handleCancel}
                    onMouseDown={!showMenu ? handlePressStart : undefined}
                    onMouseUp={!showMenu ? handlePressEnd : undefined}
                    onMouseLeave={handleCancel}
                    onClick={showMenu ? () => setShowMenu(false) : undefined}
                >
                    {showMenu ? (
                        <X className="h-6 w-6 text-white" />
                    ) : (
                        <ShoppingCart className="h-6 w-6 text-white" />
                    )}
                </Button>

                {/* Cart Count Badge */}
                <AnimatePresence>
                    {cartCount > 0 && !showMenu && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-1 -right-1"
                        >
                            <Badge className="bg-red-500 text-white font-bold min-w-[24px] h-6 flex items-center justify-center text-xs">
                                {cartCount > 99 ? '99+' : cartCount}
                            </Badge>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cart Total (shown below FAB) */}
                <AnimatePresence>
                    {cartCount > 0 && !showMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                        >
                            <span className="text-xs font-bold text-white bg-zinc-800/90 px-2 py-0.5 rounded-full">
                                {currency} {cartTotal.toLocaleString()}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Long Press Hint */}
            {quickActions.length > 0 && !showMenu && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
                    <span className="text-[10px] text-zinc-500">Hold for menu</span>
                </div>
            )}
        </div>
    );
}

export default FloatingActionButton;
