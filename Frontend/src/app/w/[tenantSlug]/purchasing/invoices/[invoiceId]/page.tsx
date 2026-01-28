"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  Calendar,
  User,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { getPurchaseInvoice } from "@/lib/api/purchases";
import type { PurchaseInvoice } from "@/lib/types/purchases";

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "KES 0";
  return `KES ${amount.toLocaleString()}`;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getStatusBadge(status: string | undefined, docstatus?: number) {
  if (docstatus === 2) {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  if (docstatus === 1) {
    return <Badge variant="default" className="bg-green-500">Submitted</Badge>;
  }
  if (docstatus === 0) {
    return <Badge variant="secondary">Draft</Badge>;
  }
  
  const statusLower = (status || "draft").toLowerCase();
  switch (statusLower) {
    case "paid":
      return <Badge variant="default" className="bg-green-500">Paid</Badge>;
    case "unpaid":
      return <Badge variant="default" className="bg-amber-500">Unpaid</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
}

export default function PurchaseInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseInvoice(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error("Failed to load invoice:", error);
      toast.error("Failed to load purchase invoice");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Invoice not found</p>
          <Button
            className="mt-4"
            onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </div>
    );
  }

  const docstatus = (invoice as unknown as Record<string, unknown>).docstatus as number | undefined;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {invoice.name || invoice.id}
            </h1>
            <p className="text-muted-foreground">Purchase Invoice Details</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(invoice.status, docstatus)}
          <Button variant="outline" size="icon" onClick={loadInvoice}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Invoice Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{invoice.supplier_name || invoice.supplier_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Bill Number</p>
                  <p className="font-medium">{invoice.bill_no || "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Bill Date</p>
                  <p className="font-medium">{formatDate(invoice.posting_date || invoice.bill_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{formatDate(invoice.due_date)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.items && invoice.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.item_code}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount || item.qty * item.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(invoice.total_amount || invoice.grand_total)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(invoice.grand_total || invoice.total_amount)}</span>
                  </div>
                  {invoice.outstanding_amount !== undefined && invoice.outstanding_amount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Outstanding</span>
                      <span>{formatCurrency(invoice.outstanding_amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No items in this invoice</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    </div>
  );
}
