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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Clock,
    DollarSign,
    Receipt,
    Users,
    AlertTriangle,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySummary {
    total_sales: number;
    total_transactions: number;
    total_commission: number;
    by_payment_mode: {
        cash: number;
        mpesa: number;
        bank: number;
        total: number;
    };
}

interface EndSessionModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (closingCash: number) => void;
    sessionStartTime: Date | null;
    openingCash: number;
    summary: DailySummary | null;
}

export function EndSessionModal({
    open,
    onClose,
    onConfirm,
    sessionStartTime,
    openingCash,
    summary,
}: EndSessionModalProps) {
    const [closingCash, setClosingCash] = React.useState<string>('');

    const expectedCash = openingCash + (summary?.by_payment_mode?.cash || 0);
    const actualCash = parseFloat(closingCash) || 0;
    const variance = actualCash - expectedCash;

    const sessionDuration = sessionStartTime
        ? Math.round((Date.now() - sessionStartTime.getTime()) / 1000 / 60)
        : 0;

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const handleConfirm = () => {
        onConfirm(actualCash);
        setClosingCash('');
    };

    const handleClose = () => {
        setClosingCash('');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        End Session
                    </DialogTitle>
                    <DialogDescription>
                        Close your register and reconcile cash
                    </DialogDescription>
                </DialogHeader>

                {/* Session Summary */}
                <div className="space-y-4">
                    {/* Duration */}
                    {sessionStartTime && (
                        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Session Duration
                            </span>
                            <span className="font-medium">{formatDuration(sessionDuration)}</span>
                        </div>
                    )}

                    {/* Sales Summary */}
                    {summary && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
                                <p className="text-lg font-bold text-primary">
                                    KES {summary.total_sales.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                                <p className="text-lg font-bold">{summary.total_transactions}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Commissions</p>
                                <p className="text-lg font-bold text-purple-500">
                                    KES {summary.total_commission.toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">M-Pesa</p>
                                <p className="text-lg font-bold text-green-500">
                                    KES {(summary.by_payment_mode?.mpesa || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Cash Reconciliation */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium">Cash Reconciliation</h4>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Opening Cash</span>
                            <span className="font-medium">KES {openingCash.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Cash Sales</span>
                            <span className="font-medium text-green-600">
                                + KES {(summary?.by_payment_mode?.cash || 0).toLocaleString()}
                            </span>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Expected Cash</span>
                            <span className="font-bold">KES {expectedCash.toLocaleString()}</span>
                        </div>

                        {/* Closing Cash Input */}
                        <div className="space-y-2">
                            <Label htmlFor="closingCash">Actual Cash in Drawer</Label>
                            <Input
                                id="closingCash"
                                type="number"
                                placeholder="Enter closing cash amount"
                                value={closingCash}
                                onChange={(e) => setClosingCash(e.target.value)}
                                className="text-lg h-12"
                            />
                        </div>

                        {/* Variance Display */}
                        {closingCash && (
                            <div className={cn(
                                "flex items-center justify-between p-3 rounded-lg",
                                variance === 0 && "bg-green-500/10 border border-green-500/20",
                                variance > 0 && "bg-blue-500/10 border border-blue-500/20",
                                variance < 0 && "bg-red-500/10 border border-red-500/20"
                            )}>
                                <span className="text-sm font-medium flex items-center gap-2">
                                    {variance === 0 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    {variance > 0 && <AlertTriangle className="h-4 w-4 text-blue-500" />}
                                    {variance < 0 && <XCircle className="h-4 w-4 text-red-500" />}
                                    Variance
                                </span>
                                <span className={cn(
                                    "font-bold",
                                    variance === 0 && "text-green-600",
                                    variance > 0 && "text-blue-600",
                                    variance < 0 && "text-red-600"
                                )}>
                                    {variance >= 0 ? '+' : ''}KES {variance.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4 gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant="destructive"
                    >
                        Close Session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default EndSessionModal;
