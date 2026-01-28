"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    Plus,
    Search,
    Package,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
} from "lucide-react";
import { getPurchaseReceipts, submitPurchaseReceipt, cancelPurchaseReceipt } from "@/lib/api/purchases";
import type { PurchaseReceipt } from "@/lib/types/purchases";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

export default function PurchaseReceiptsPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [submitting, setSubmitting] = useState<string | null>(null);

    const loadReceipts = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await getPurchaseReceipts({ limit: 100 });
            setReceipts(data);
        } catch (error) {
            console.error("Failed to fetch receipts:", error);
            toast.error("Failed to load purchase receipts");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReceipts();
    }, [loadReceipts]);

    const handleSubmit = async (receiptId: string) => {
        try {
            setSubmitting(receiptId);
            await submitPurchaseReceipt(receiptId);
            toast.success("Receipt submitted - Inventory updated");
            loadReceipts();
        } catch (error: any) {
            toast.error(error?.message || "Failed to submit receipt");
        } finally {
            setSubmitting(null);
        }
    };

    const handleCancel = async (receiptId: string) => {
        try {
            setSubmitting(receiptId);
            await cancelPurchaseReceipt(receiptId);
            toast.success("Receipt cancelled - Inventory reversed");
            loadReceipts();
        } catch (error: any) {
            toast.error(error?.message || "Failed to cancel receipt");
        } finally {
            setSubmitting(null);
        }
    };

    const filteredReceipts = receipts.filter(receipt =>
        receipt.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receipt.supplier_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusBadge = (receipt: PurchaseReceipt) => {
        // docstatus: 0=Draft, 1=Submitted, 2=Cancelled
        const status = (receipt as any).docstatus ?? (receipt as any).status;
        if (status === 1 || status === "Submitted") {
            return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Submitted</Badge>;
        } else if (status === 2 || status === "Cancelled") {
            return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
        }
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>;
    };

    const canSubmit = (receipt: PurchaseReceipt) => {
        const status = (receipt as any).docstatus ?? 0;
        return status === 0;
    };

    const canCancel = (receipt: PurchaseReceipt) => {
        const status = (receipt as any).docstatus ?? 0;
        return status === 1;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push(`/w/${tenantSlug}/purchasing`)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Purchase Receipts</h1>
                    <p className="text-muted-foreground">Receive goods and update inventory</p>
                </div>
                <Button onClick={() => router.push(`/w/${tenantSlug}/purchasing/receipts/new`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Receipt
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search receipts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button variant="outline" size="icon" onClick={loadReceipts}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Receipts ({filteredReceipts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading receipts...</div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No purchase receipts found. Create one to receive goods.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Receipt ID</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReceipts.map((receipt) => (
                                    <TableRow 
                                        key={receipt.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/w/${tenantSlug}/purchasing/receipts/${receipt.id}`)}
                                    >
                                        <TableCell className="font-medium">{receipt.id}</TableCell>
                                        <TableCell>{receipt.supplier_id}</TableCell>
                                        <TableCell>{receipt.posting_date}</TableCell>
                                        <TableCell>{receipt.items?.length || 0} items</TableCell>
                                        <TableCell>{getStatusBadge(receipt)}</TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                {canSubmit(receipt) && (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handleSubmit(receipt.id)}
                                                        disabled={submitting === receipt.id}
                                                    >
                                                        {submitting === receipt.id ? (
                                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Submit
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                {canCancel(receipt) && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="destructive"
                                                        onClick={() => handleCancel(receipt.id)}
                                                        disabled={submitting === receipt.id}
                                                    >
                                                        {submitting === receipt.id ? (
                                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Cancel
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
