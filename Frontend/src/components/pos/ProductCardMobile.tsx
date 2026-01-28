'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Plus,
    Check,
    Package,
    AlertTriangle,
    XCircle,
    Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface POSItem {
    item_code: string;
    item_name: string;
    standard_rate: number;
    stock_uom: string;
    is_stock_item: boolean;
    description?: string;
    image?: string;
    stock_qty?: number;
    category?: string;
    is_favorite?: boolean;
}

interface ProductCardMobileProps {
    item: POSItem;
    onAdd: (item: POSItem) => void;
    onLongPress?: (item: POSItem) => void;
    cartQty?: number;
    currency?: string;
    disabled?: boolean;
}

export function ProductCardMobile({
    item,
    onAdd,
    onLongPress,
    cartQty = 0,
    currency = 'KES',
    disabled = false
}: ProductCardMobileProps) {
    const [showAdded, setShowAdded] = React.useState(false);
    const [isPressed, setIsPressed] = React.useState(false);
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
    const hasStock = !item.is_stock_item || (item.stock_qty && item.stock_qty > 0);
    const lowStock = item.is_stock_item && item.stock_qty && item.stock_qty > 0 && item.stock_qty <= 5;

    const handlePress = () => {
        if (disabled || !hasStock) return;
        setIsPressed(true);
        longPressTimer.current = setTimeout(() => {
            if (onLongPress) {
                onLongPress(item);
            }
            setIsPressed(false);
        }, 500);
    };

    const handleRelease = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        if (isPressed && hasStock && !disabled) {
            // Quick tap - add to cart
            onAdd(item);
            setShowAdded(true);
            setTimeout(() => setShowAdded(false), 800);
            
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }
        setIsPressed(false);
    };

    const handleCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        setIsPressed(false);
    };

    return (
        <motion.div
            className={cn(
                "relative rounded-xl overflow-hidden bg-zinc-800/50 border border-zinc-700/50",
                "transition-all duration-150 touch-manipulation select-none",
                hasStock && !disabled && "active:scale-95 cursor-pointer",
                !hasStock && "opacity-50 cursor-not-allowed",
                isPressed && "scale-95 bg-zinc-700/50"
            )}
            whileTap={hasStock && !disabled ? { scale: 0.95 } : {}}
            onTouchStart={handlePress}
            onTouchEnd={handleRelease}
            onTouchCancel={handleCancel}
            onMouseDown={handlePress}
            onMouseUp={handleRelease}
            onMouseLeave={handleCancel}
        >
            {/* Image Section */}
            <div className="relative aspect-square bg-zinc-900/50">
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.item_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-10 w-10 text-zinc-600" />
                    </div>
                )}

                {/* Stock Badge */}
                {item.is_stock_item && (
                    <div className="absolute top-2 right-2">
                        {!hasStock ? (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 gap-1">
                                <XCircle className="h-3 w-3" />
                                Out
                            </Badge>
                        ) : lowStock ? (
                            <Badge className="bg-amber-500/90 text-[10px] px-1.5 py-0.5 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {item.stock_qty}
                            </Badge>
                        ) : item.stock_qty ? (
                            <Badge className="bg-zinc-700/90 text-[10px] px-1.5 py-0.5">
                                {item.stock_qty}
                            </Badge>
                        ) : null}
                    </div>
                )}

                {/* Favorite Star */}
                {item.is_favorite && (
                    <div className="absolute top-2 left-2">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                    </div>
                )}

                {/* Cart Quantity Badge */}
                <AnimatePresence>
                    {cartQty > 0 && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute bottom-2 right-2"
                        >
                            <Badge className="bg-emerald-500 text-white font-bold min-w-[24px] h-6 flex items-center justify-center">
                                {cartQty}
                            </Badge>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Added Animation Overlay */}
                <AnimatePresence>
                    {showAdded && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            >
                                <Check className="h-10 w-10 text-white" />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Info Section */}
            <div className="p-3">
                <h3 className="text-sm font-medium text-white truncate leading-tight">
                    {item.item_name}
                </h3>
                <div className="flex items-center justify-between mt-1.5">
                    <p className="text-base font-bold text-emerald-400">
                        {currency} {item.standard_rate.toLocaleString()}
                    </p>
                    {hasStock && !disabled && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAdd(item);
                                setShowAdded(true);
                                setTimeout(() => setShowAdded(false), 800);
                            }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// Grid wrapper for products
export function ProductGrid({
    children,
    className
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn(
            "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3",
            className
        )}>
            {children}
        </div>
    );
}

export default ProductCardMobile;
