'use client';

import * as React from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    ChevronUp,
    X,
    CreditCard,
    Wallet,
    Smartphone,
    Undo2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CartItem {
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
    total: number;
    image?: string;
}

interface BottomSheetCartProps {
    cart: CartItem[];
    onUpdateQty: (itemCode: string, delta: number) => void;
    onRemoveItem: (itemCode: string) => void;
    onClearCart: () => void;
    onCheckout: (paymentMethod: string) => void;
    cartTotal: number;
    cartVat: number;
    cartGrandTotal: number;
    isProcessing?: boolean;
    currency?: string;
}

const PAYMENT_MODES = [
    { value: 'Cash', label: 'Cash', icon: Wallet, color: 'bg-emerald-500 hover:bg-emerald-600' },
    { value: 'Mpesa', label: 'M-Pesa', icon: Smartphone, color: 'bg-green-500 hover:bg-green-600' },
    { value: 'Pesalink', label: 'Card', icon: CreditCard, color: 'bg-blue-500 hover:bg-blue-600' },
];

// Swipeable Cart Item Component
function SwipeableCartItem({
    item,
    onUpdateQty,
    onRemove,
    currency = 'KES'
}: {
    item: CartItem;
    onUpdateQty: (delta: number) => void;
    onRemove: () => void;
    currency?: string;
}) {
    const x = useMotionValue(0);
    const background = useTransform(
        x,
        [-100, 0],
        ['rgba(239, 68, 68, 1)', 'rgba(239, 68, 68, 0)']
    );
    const opacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (info.offset.x < -100) {
            onRemove();
        }
    };

    return (
        <div className="relative overflow-hidden rounded-lg mb-2">
            {/* Delete background */}
            <motion.div
                className="absolute inset-y-0 right-0 flex items-center justify-end px-4 rounded-lg"
                style={{ background }}
            >
                <motion.div style={{ opacity }}>
                    <Trash2 className="h-5 w-5 text-white" />
                </motion.div>
            </motion.div>

            {/* Swipeable content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -120, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="relative bg-zinc-800/80 backdrop-blur-sm rounded-lg p-3 touch-pan-y"
            >
                <div className="flex items-center gap-3">
                    {/* Product image placeholder */}
                    <div className="w-12 h-12 rounded-lg bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        {item.image ? (
                            <img src={item.image} alt={item.item_name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                            <ShoppingCart className="h-5 w-5 text-zinc-400" />
                        )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.item_name}</p>
                        <p className="text-xs text-zinc-400">{currency} {item.rate.toLocaleString()}</p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-zinc-700 hover:bg-zinc-600"
                            onClick={() => onUpdateQty(-1)}
                        >
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-bold text-white">{item.qty}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => onUpdateQty(1)}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Item total */}
                    <div className="text-right min-w-[70px]">
                        <p className="text-sm font-bold text-emerald-400">
                            {currency} {item.total.toLocaleString()}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function BottomSheetCart({
    cart,
    onUpdateQty,
    onRemoveItem,
    onClearCart,
    onCheckout,
    cartTotal,
    cartVat,
    cartGrandTotal,
    isProcessing = false,
    currency = 'KES'
}: BottomSheetCartProps) {
    const [open, setOpen] = React.useState(false);
    const [showUndo, setShowUndo] = React.useState(false);
    const [lastRemoved, setLastRemoved] = React.useState<CartItem | null>(null);

    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const handleRemove = (item: CartItem) => {
        setLastRemoved(item);
        onRemoveItem(item.item_code);
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 5000);
    };

    const handleUndo = () => {
        if (lastRemoved) {
            // Re-add the item - this would need to be handled by parent
            setShowUndo(false);
            setLastRemoved(null);
        }
    };

    return (
        <>
            {/* Peek View - Always visible when cart has items */}
            <AnimatePresence>
                {cartCount > 0 && !open && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
                    >
                        <div 
                            className="bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 px-4 py-3 cursor-pointer"
                            onClick={() => setOpen(true)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <ShoppingCart className="h-6 w-6 text-emerald-400" />
                                        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-emerald-500 text-xs">
                                            {cartCount}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-400">{cartCount} items</p>
                                        <p className="text-sm font-bold text-white">{currency} {cartGrandTotal.toLocaleString()}</p>
                                    </div>
                                </div>
                                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 gap-2">
                                    <span>Checkout</span>
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Full Bottom Sheet */}
            <Drawer.Root open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/60 z-50" />
                    <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-2xl bg-zinc-900 border-t border-zinc-800 max-h-[90vh]">
                        {/* Handle */}
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-700 my-3" />

                        {/* Header */}
                        <div className="px-4 pb-3 border-b border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-emerald-400" />
                                    <Drawer.Title className="text-lg font-bold text-white">
                                        Cart ({cartCount})
                                    </Drawer.Title>
                                </div>
                                <div className="flex items-center gap-2">
                                    {cart.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            onClick={onClearCart}
                                        >
                                            Clear All
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Cart Items */}
                        <ScrollArea className="flex-1 px-4 py-3">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                                    <ShoppingCart className="h-12 w-12 mb-3 opacity-50" />
                                    <p className="text-sm">Your cart is empty</p>
                                    <p className="text-xs mt-1">Tap products to add them</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-xs text-zinc-500 mb-2">Swipe left to remove</p>
                                    {cart.map((item) => (
                                        <SwipeableCartItem
                                            key={item.item_code}
                                            item={item}
                                            onUpdateQty={(delta) => onUpdateQty(item.item_code, delta)}
                                            onRemove={() => handleRemove(item)}
                                            currency={currency}
                                        />
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Totals & Checkout */}
                        {cart.length > 0 && (
                            <div className="px-4 py-4 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-lg">
                                {/* Totals */}
                                <div className="space-y-1 mb-4">
                                    <div className="flex justify-between text-sm text-zinc-400">
                                        <span>Subtotal</span>
                                        <span>{currency} {cartTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-zinc-400">
                                        <span>VAT (16%)</span>
                                        <span>{currency} {cartVat.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-zinc-700">
                                        <span>Total</span>
                                        <span className="text-emerald-400">{currency} {cartGrandTotal.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Payment Methods */}
                                <div className="grid grid-cols-3 gap-2">
                                    {PAYMENT_MODES.map((mode) => (
                                        <Button
                                            key={mode.value}
                                            className={cn(
                                                "flex flex-col items-center gap-1 h-auto py-3",
                                                mode.color,
                                                "text-white"
                                            )}
                                            disabled={isProcessing}
                                            onClick={() => onCheckout(mode.value)}
                                        >
                                            <mode.icon className="h-5 w-5" />
                                            <span className="text-xs font-medium">{mode.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* Undo Toast */}
            <AnimatePresence>
                {showUndo && lastRemoved && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-20 left-4 right-4 z-50 lg:hidden"
                    >
                        <div className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between shadow-xl">
                            <span className="text-sm text-white">Removed {lastRemoved.item_name}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-400 hover:text-emerald-300 gap-1"
                                onClick={handleUndo}
                            >
                                <Undo2 className="h-4 w-4" />
                                Undo
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default BottomSheetCart;
