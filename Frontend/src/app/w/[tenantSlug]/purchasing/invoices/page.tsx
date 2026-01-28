"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ArrowLeft,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPurchaseInvoices,
  deletePurchaseInvoice,
} from "@/lib/api/purchases";
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
      month: "short",
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

export default function PurchaseInvoicesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseInvoices();
      setInvoices(data || []);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      toast.error("Failed to load purchase invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleDelete = async (invoice: PurchaseInvoice) => {
    const invoiceId = invoice.name || invoice.id;
    const docstatus = (invoice as unknown as Record<string, unknown>).docstatus as number | undefined;
    
    if (docstatus !== 0) {
      toast.error("Can only delete Draft invoices");
      return;
    }

    if (!confirm(`Delete purchase invoice ${invoiceId}?`)) return;

    try {
      setActionLoading(invoiceId);
      await deletePurchaseInvoice(invoiceId);
      toast.success("Purchase invoice deleted");
      loadInvoices();
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast.error("Failed to delete purchase invoice");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchLower = searchQuery.toLowerCase();
    const name = (invoice.name || invoice.id || "").toLowerCase();
    const supplier = (invoice.supplier_name || invoice.supplier_id || "").toLowerCase();
    return name.includes(searchLower) || supplier.includes(searchLower);
  });

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/w/${tenantSlug}/purchasing`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Purchase Invoices
            </h1>
            <p className="text-muted-foreground">
              Manage supplier invoices
            </p>
          </div>
        </div>

        <Button onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Search and Refresh */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice ID or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchase Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No invoices match your search" : "No purchase invoices yet"}
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices/new`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Invoice
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const invoiceId = invoice.name || invoice.id;
                    const docstatus = (invoice as unknown as Record<string, unknown>).docstatus as number | undefined;
                    const isDraft = docstatus === 0;
                    const isLoading = actionLoading === invoiceId;

                    return (
                      <TableRow key={invoiceId}>
                        <TableCell className="font-medium">{invoiceId}</TableCell>
                        <TableCell>{invoice.supplier_name || invoice.supplier_id || "-"}</TableCell>
                        <TableCell>{formatDate(invoice.posting_date || invoice.invoice_date)}</TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell>{formatCurrency(invoice.grand_total || invoice.total_amount)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status, docstatus)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isLoading}>
                                {isLoading ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices/${invoiceId}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {isDraft && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/w/${tenantSlug}/purchasing/invoices/${invoiceId}?edit=true`)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(invoice)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
