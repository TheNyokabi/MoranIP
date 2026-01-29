'use client';

import * as React from 'react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    CheckCircle,
    Printer,
    Mail,
    MessageSquare,
    Download,
    ShoppingCart,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { posApi } from '@/lib/api';

interface SaleSuccessModalProps {
    open: boolean;
    onClose: () => void;
    onNewSale: () => void;
    invoiceId: string;
    invoiceNumber: string;
    total: number;
    customer: string;
    token: string;
    paymentMethod?: string;
    amountTendered?: number;
    changeAmount?: number;
}

export function SaleSuccessModal({
    open,
    onClose,
    onNewSale,
    invoiceId,
    invoiceNumber,
    total,
    customer,
    token,
    paymentMethod,
    amountTendered,
    changeAmount,
}: SaleSuccessModalProps) {
    const [isPrinting, setIsPrinting] = useState(false);
    const [isEmailing, setIsEmailing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [showSmsInput, setShowSmsInput] = useState(false);

    const normalizeInvoiceId = (value: string) => (typeof value === 'string' ? value.trim() : '')
    const isInvalidInvoiceId = (value: string) => {
        const normalized = normalizeInvoiceId(value)
        return !normalized || ['undefined', 'null', 'none'].includes(normalized.toLowerCase())
    }

    const handlePrint = async () => {
        if (isInvalidInvoiceId(invoiceId)) {
            toast.error('Invoice ID is missing. Cannot print receipt.');
            return;
        }
        
        setIsPrinting(true);
        try {
            // Get thermal receipt for printing
            const receipt = await posApi.getThermalReceipt(token, invoiceId);

                        const safeReceipt = receipt
                                .replaceAll('&', '&amp;')
                                .replaceAll('<', '&lt;')
                                .replaceAll('>', '&gt;')

            // Create print window
            const printWindow = window.open('', '_blank');
                        if (!printWindow) {
                                toast.error('Pop-up blocked. Allow pop-ups to print receipts.');
                                return;
                        }

                        if (printWindow) {
                printWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${invoiceNumber}</title>
              <style>
                body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
                pre { white-space: pre-wrap; }
              </style>
            </head>
            <body>
                            <pre>${safeReceipt}</pre>
              <script>window.print(); window.close();</script>
            </body>
          </html>
        `);
                printWindow.document.close();
            }
            toast.success('Receipt sent to printer');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to print receipt');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleEmail = async () => {
        if (isInvalidInvoiceId(invoiceId)) {
            toast.error('Invoice ID is missing. Cannot send email.');
            return;
        }
        
        if (!emailAddress) {
            setShowEmailInput(true);
            return;
        }

        setIsEmailing(true);
        try {
            await posApi.emailReceipt(token, invoiceId, emailAddress);
            toast.success(`Receipt sent to ${emailAddress}`);
            setShowEmailInput(false);
            setEmailAddress('');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send email');
        } finally {
            setIsEmailing(false);
        }
    };

    const handleSms = async () => {
        if (isInvalidInvoiceId(invoiceId)) {
            toast.error('Invoice ID is missing. Cannot send SMS.');
            return;
        }
        
        if (!phoneNumber) {
            setShowSmsInput(true);
            return;
        }

        setIsSending(true);
        try {
            await posApi.smsReceipt(token, invoiceId, phoneNumber);
            toast.success(`Receipt sent to ${phoneNumber}`);
            setShowSmsInput(false);
            setPhoneNumber('');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send SMS');
        } finally {
            setIsSending(false);
        }
    };

    const handleDownload = async () => {
        if (isInvalidInvoiceId(invoiceId)) {
            toast.error('Invoice ID is missing. Cannot download receipt.');
            return;
        }
        
        setIsDownloading(true);
        try {
            const receipt = await posApi.getReceipt(token, invoiceId, 'html');
            const blob = new Blob([receipt], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${invoiceNumber}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Receipt downloaded');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to download receipt');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleNewSale = () => {
        setShowEmailInput(false);
        setShowSmsInput(false);
        setEmailAddress('');
        setPhoneNumber('');
        onNewSale();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader className="text-center">
                    {/* Success Animation */}
                    <div className="mx-auto mb-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                            <div className="relative bg-green-500 rounded-full p-4">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </div>

                    <DialogTitle className="text-xl text-center">
                        Sale Completed!
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Invoice created successfully
                    </DialogDescription>
                </DialogHeader>

                {/* Invoice Details */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Invoice Number</p>
                        <p className="font-mono font-bold text-lg">{invoiceNumber}</p>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="font-medium">{customer || 'Walk-in Customer'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Paid</span>
                        <span className="text-xl font-bold text-primary">
                            KES {total.toLocaleString()}
                        </span>
                    </div>

                    {paymentMethod === 'Cash' && (amountTendered || 0) > 0 && (
                        <>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Cash Received</span>
                                <span className="font-medium">KES {(amountTendered || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Change Due</span>
                                <span className="font-bold text-emerald-600">KES {(changeAmount || 0).toLocaleString()}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Receipt Actions */}
                <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Send Receipt</p>

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="w-full"
                        >
                            {isPrinting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Printer className="h-4 w-4 mr-2" />
                            )}
                            Print
                        </Button>

                        <Button
                            variant="outline"
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full"
                        >
                            {isDownloading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            Download
                        </Button>
                    </div>

                    {/* Email Input */}
                    {showEmailInput ? (
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="customer@email.com"
                                value={emailAddress}
                                onChange={(e) => setEmailAddress(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                            />
                            <Button
                                onClick={handleEmail}
                                disabled={isEmailing || !emailAddress}
                                size="sm"
                            >
                                {isEmailing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Send'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowEmailInput(true)}
                            className="w-full"
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            Email Receipt
                        </Button>
                    )}

                    {/* SMS Input */}
                    {showSmsInput ? (
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                placeholder="+254..."
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                            />
                            <Button
                                onClick={handleSms}
                                disabled={isSending || !phoneNumber}
                                size="sm"
                            >
                                {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Send'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowSmsInput(true)}
                            className="w-full"
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            SMS Receipt
                        </Button>
                    )}
                </div>

                <Separator />

                {/* New Sale Button */}
                <Button
                    onClick={handleNewSale}
                    className="w-full"
                    size="lg"
                >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Start New Sale
                </Button>
            </DialogContent>
        </Dialog>
    );
}

export default SaleSuccessModal;
