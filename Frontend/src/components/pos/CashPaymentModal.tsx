'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Wallet,
    Check,
    X,
    Delete,
    ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashPaymentModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (amountTendered: number) => void;
    totalAmount: number;
    currency?: string;
    isProcessing?: boolean;
}

// Quick denomination buttons (Kenyan currency)
const DENOMINATIONS = [50, 100, 200, 500, 1000, 2000, 5000];

export function CashPaymentModal({
    open,
    onClose,
    onConfirm,
    totalAmount,
    currency = 'KES',
    isProcessing = false
}: CashPaymentModalProps) {
    const [amountEntered, setAmountEntered] = React.useState('');
    
    const amountNumber = parseFloat(amountEntered) || 0;
    const change = amountNumber - totalAmount;
    const canComplete = amountNumber >= totalAmount;

    // Reset when modal opens
    React.useEffect(() => {
        if (open) {
            setAmountEntered('');
        }
    }, [open]);

    const handleKeyPress = (key: string) => {
        if (isProcessing) return;
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(5);
        }

        if (key === 'backspace') {
            setAmountEntered(prev => prev.slice(0, -1));
        } else if (key === 'clear') {
            setAmountEntered('');
        } else if (key === '.') {
            if (!amountEntered.includes('.')) {
                setAmountEntered(prev => prev + '.');
            }
        } else {
            // Limit to reasonable amount
            if (amountEntered.length < 10) {
                setAmountEntered(prev => prev + key);
            }
        }
    };

    const handleDenomination = (amount: number) => {
        if (isProcessing) return;
        
        // Add denomination to current amount
        const current = parseFloat(amountEntered) || 0;
        setAmountEntered((current + amount).toString());
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    const handleExactAmount = () => {
        if (isProcessing) return;
        setAmountEntered(totalAmount.toString());
    };

    const handleConfirm = () => {
        if (canComplete && !isProcessing) {
            onConfirm(amountNumber);
        }
    };

    const keypadKeys = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['.', '0', 'backspace']
    ];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-zinc-900 border-zinc-800">
                {/* Header */}
                <div className="bg-zinc-800 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-emerald-400" />
                        <DialogTitle className="text-lg font-bold text-white">
                            Cash Payment
                        </DialogTitle>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Amount Due */}
                    <div className="text-center py-2">
                        <p className="text-sm text-zinc-400 mb-1">Amount Due</p>
                        <p className="text-3xl font-bold text-white">
                            {currency} {totalAmount.toLocaleString()}
                        </p>
                    </div>

                    {/* Amount Entered Display */}
                    <div className="bg-zinc-800 rounded-xl p-4">
                        <p className="text-xs text-zinc-400 mb-1">Amount Tendered</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-zinc-500">{currency}</span>
                            <span className={cn(
                                "text-4xl font-bold tracking-tight",
                                amountEntered ? "text-white" : "text-zinc-600"
                            )}>
                                {amountEntered || '0'}
                            </span>
                        </div>
                    </div>

                    {/* Change Display */}
                    <AnimatePresence>
                        {amountNumber > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={cn(
                                    "rounded-xl p-4 text-center",
                                    canComplete ? "bg-emerald-500/20" : "bg-red-500/20"
                                )}
                            >
                                <p className="text-xs mb-1" style={{ color: canComplete ? '#6ee7b7' : '#fca5a5' }}>
                                    {canComplete ? 'Change Due' : 'Amount Short'}
                                </p>
                                <p className={cn(
                                    "text-3xl font-bold",
                                    canComplete ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {currency} {Math.abs(change).toLocaleString()}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Quick Denominations */}
                    <div>
                        <p className="text-xs text-zinc-400 mb-2">Quick Add</p>
                        <div className="flex flex-wrap gap-2">
                            {DENOMINATIONS.map((denom) => (
                                <Button
                                    key={denom}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 min-w-[60px] bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                                    onClick={() => handleDenomination(denom)}
                                    disabled={isProcessing}
                                >
                                    +{denom >= 1000 ? `${denom/1000}K` : denom}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-2">
                        {keypadKeys.map((row, rowIndex) => (
                            <React.Fragment key={rowIndex}>
                                {row.map((key) => (
                                    <Button
                                        key={key}
                                        variant="ghost"
                                        className={cn(
                                            "h-14 text-xl font-bold rounded-xl",
                                            key === 'backspace' 
                                                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-400" 
                                                : "bg-zinc-800 hover:bg-zinc-700 text-white"
                                        )}
                                        onClick={() => handleKeyPress(key)}
                                        disabled={isProcessing}
                                    >
                                        {key === 'backspace' ? (
                                            <Delete className="h-5 w-5" />
                                        ) : (
                                            key
                                        )}
                                    </Button>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                            variant="outline"
                            className="h-12 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                            onClick={handleExactAmount}
                            disabled={isProcessing}
                        >
                            Exact Amount
                        </Button>
                        <Button
                            className={cn(
                                "h-12 text-white font-bold",
                                canComplete 
                                    ? "bg-emerald-600 hover:bg-emerald-500" 
                                    : "bg-zinc-700 cursor-not-allowed"
                            )}
                            onClick={handleConfirm}
                            disabled={!canComplete || isProcessing}
                        >
                            {isProcessing ? (
                                <span className="flex items-center gap-2">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </motion.div>
                                    Processing...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    Complete Sale
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default CashPaymentModal;
