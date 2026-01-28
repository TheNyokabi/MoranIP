"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    Package,
    Warehouse,
    Calendar,
    User,
    RefreshCw,
    FileText,
} from "lucide-react";
import { getPurchaseReceipt, submitPurchaseReceipt, cancelPurchaseReceipt } from "@/lib/api/purchases";
import type { PurchaseReceipt } from "@/lib/types/purchases";
import { toast } from "sonner";

export default function PurchaseReceiptDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const receiptId = params.receiptId as string;
    
    const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadReceipt = async () => {
        try {
            setIsLoading(true);
            const data = await getPurchaseReceipt(receiptId);
            setReceipt(data);
        } catch (error) {
            console.error("Failed to load receipt:", error);
            toast.error("Failed to load receipt details");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReceipt();
    }, [receiptId]);

    const handleSubmit = async () => {
        if (!receipt) return;
        try {
            setIsSubmitting(true);
            await submitPurchaseReceipt(receipt.id);
            toast.success("Receipt submitted successfully! Inventory has been updated.");
            loadReceipt();
        } catch (error: any) {
            toast.error(error?.message || "Failed to submit receipt");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!receipt) return;
        try {
            setIsSubmitting(true);
            await cancelPurchaseReceipt(receipt.id);
            toast.success("Receipt cancelled. Inventory changes have been reversed.");
            loadReceipt();
        } catch (error: any) {
            toast.error(error?.message || "Failed to cancel receipt");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatus = () => {
        if (!receipt) return { label: "Unknown", variant: "outline" as const, icon: Clock };
        const docstatus = (receipt as any).docstatus ?? 0;
        if (docstatus === 1) return { label: "Submitted", variant: "default" as const, icon: CheckCircle, color: "text-green-600" };
        if (docstatus === 2) return { label: "Cancelled", variant: "destructive" as const, icon: XCircle, color: "text-red-600" };
        return { label: "Draft", variant: "outline" as const, icon: Clock, color: "text-yellow-600" };
    };

    const status = getStatus();
    const StatusIcon = status.icon;
    const canSubmit = (receipt as any)?.docstatus === 0;
    const canCancel = (receipt as any)?.docstatus === 1;

    const totalQty = receipt?.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
    const totalAmount = receipt?.items?.reduce((sum, item) => sum + ((item.qty || 0) * (item.rate || 0)), 0) || 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!receipt) {
        return (
            <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Receipt Not Found</h2>
                <p className="text-muted-foreground mb-4">The purchase receipt could not be found.</p>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">{receipt.id}</h1>
                        <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">Purchase Receipt Details</p>
                </div>
                <div className="flex gap-2">
                    {canSubmit && (
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Submit &amp; Update Inventory
                        </Button>
                    )}
                    {canCancel && (
                        <Button variant="destructive" onClick={handleCancel} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Cancel Receipt
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <User className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Supplier</p>
                                <p className="font-semibold">{receipt.supplier_id}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Posting Date</p>
                                <p className="font-semibold">{receipt.posting_date}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Package className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Total Items</p>
                                <p className="font-semibold">{receipt.items?.length || 0} items ({totalQty} units)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Purchase Order</p>
                                <p className="font-semibold">{receipt.purchase_order_id || "N/A"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Inventory Impact Notice */}
            {status.label === "Draft" && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Draft Receipt</h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                    This receipt is in draft status. Inventory has NOT been updated yet.
                                    Click &quot;Submit &amp; Update Inventory&quot; to receive the goods into your warehouse.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {status.label === "Submitted" && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-green-800 dark:text-green-200">Inventory Updated</h3>
                                <p className="text-sm text-green-700 dark:text-green-300">
                                    This receipt has been submitted. Stock quantities have been updated in the warehouse.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Warehouse className="h-5 w-5" />
                        Received Items
                    </CardTitle>
                    <CardDescription>Items received in this purchase receipt</CardDescription>
                </CardHeader>
                <CardContent>
                    {!receipt.items || receipt.items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No items in this receipt
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receipt.items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{item.item_code}</TableCell>
                                        <TableCell>{item.warehouse}</TableCell>
                                        <TableCell className="text-right">{item.qty}</TableCell>
                                        <TableCell className="text-right">{(item.rate || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{((item.qty || 0) * (item.rate || 0)).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-semibold">
                                    <TableCell colSpan={2}>Total</TableCell>
                                    <TableCell className="text-right">{totalQty}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right">KES {totalAmount.toFixed(2)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
