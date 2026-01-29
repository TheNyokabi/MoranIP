'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ShoppingCart,
    User,
    CreditCard,
    Receipt,
    Loader2,
    CheckCircle2,
    Tag,
    Plus,
    Minus,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItem {
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
    total: number;
}

interface SaleConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    cart: CartItem[];
    onUpdateQty?: (itemCode: string, delta: number) => void;
    onRemoveItem?: (itemCode: string) => void;
    customer: string;
    customerType: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    total: number;
    isProcessing: boolean;
    amountTendered?: number;
    changeAmount?: number;
    currency?: string;
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
    Cash: <CreditCard className="h-4 w-4" />,
    Mpesa: <span className="text-xs font-bold">M</span>,
    Pesalink: <span className="text-xs font-bold">PL</span>,
};

export function SaleConfirmationModal({
    open,
    onClose,
    onConfirm,
    cart,
    onUpdateQty,
    onRemoveItem,
    customer,
    customerType,
    paymentMethod,
    subtotal,
    discount,
    total,
    isProcessing,
    amountTendered,
    changeAmount,
    currency = 'KES',
}: SaleConfirmationModalProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Confirm Sale
                    </DialogTitle>
                    <DialogDescription>
                        Review your order before completing the sale
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[300px] pr-4">
                    {/* Order Items */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Confirm Quantities</h4>
                        {cart.map((item, index) => (
                            <div
                                key={item.item_code}
                                className={cn(
                                    "flex items-center justify-between py-2",
                                    index < cart.length - 1 && "border-b border-border"
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{item.item_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.qty} × {currency} {item.rate.toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    {onUpdateQty && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => onUpdateQty(item.item_code, -1)}
                                                disabled={isProcessing}
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => onUpdateQty(item.item_code, 1)}
                                                disabled={isProcessing}
                                                aria-label="Increase quantity"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                    {onRemoveItem && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => onRemoveItem(item.item_code)}
                                            disabled={isProcessing}
                                            aria-label="Remove item"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <p className="font-medium w-[110px] text-right">
                                        {currency} {item.total.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <Separator className="my-4" />

                {/* Customer & Payment Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Customer</p>
                            <p className="text-sm font-medium">{customer || 'Walk-in Customer'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {customerType}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Payment Method</p>
                            <p className="text-sm font-medium flex items-center gap-1">
                                {PAYMENT_ICONS[paymentMethod]}
                                {paymentMethod}
                            </p>
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                {/* Totals */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{currency} {subtotal.toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                Loyalty Discount
                            </span>
                            <span>- {currency} {discount.toLocaleString()}</span>
                        </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">{currency} {total.toLocaleString()}</span>
                    </div>
                </div>

                {/* Cash Payment Details */}
                {paymentMethod === 'Cash' && amountTendered !== undefined && amountTendered > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-2 bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount Tendered</span>
                                <span className="font-medium">{currency} {amountTendered.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-emerald-600">
                                <span>Change Due</span>
                                <span>{currency} {(changeAmount || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </>
                )}

                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Back
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="min-w-[140px]"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Complete Sale
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default SaleConfirmationModal;
