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
  CheckCircle,
  XCircle,
  ArrowLeft,
  Package,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPurchaseOrders,
  deletePurchaseOrder,
  submitPurchaseOrder,
  cancelPurchaseOrder,
} from "@/lib/api/purchases";
import type { PurchaseOrder } from "@/lib/types/purchases";

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
  // Handle docstatus for ERPNext documents
  if (docstatus === 2) {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  if (docstatus === 1) {
    return <Badge variant="default" className="bg-green-500">Submitted</Badge>;
  }
  if (docstatus === 0) {
    return <Badge variant="secondary">Draft</Badge>;
  }
  
  // Fallback to status string
  const statusLower = (status || "draft").toLowerCase();
  switch (statusLower) {
    case "submitted":
    case "completed":
      return <Badge variant="default" className="bg-green-500">Submitted</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    case "closed":
      return <Badge variant="outline">Closed</Badge>;
    case "to receive":
    case "to receive and bill":
      return <Badge variant="default" className="bg-blue-500">{status}</Badge>;
    default:
      return <Badge variant="secondary">Draft</Badge>;
  }
}

export default function PurchaseOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrders();
      setOrders(data || []);
    } catch (error) {
      console.error("Failed to load orders:", error);
      toast.error("Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleDelete = async (order: PurchaseOrder) => {
    const orderId = order.name || order.id;
    const docstatus = (order as unknown as Record<string, unknown>).docstatus as number | undefined;
    
    if (docstatus !== 0) {
      toast.error("Can only delete Draft orders");
      return;
    }

    if (!confirm(`Delete purchase order ${orderId}?`)) return;

    try {
      setActionLoading(orderId);
      await deletePurchaseOrder(orderId);
      toast.success("Purchase order deleted");
      loadOrders();
    } catch (error) {
      console.error("Failed to delete order:", error);
      toast.error("Failed to delete purchase order");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async (order: PurchaseOrder) => {
    const orderId = order.name || order.id;
    const docstatus = (order as unknown as Record<string, unknown>).docstatus as number | undefined;
    
    if (docstatus !== 0) {
      toast.error("Can only submit Draft orders");
      return;
    }

    try {
      setActionLoading(orderId);
      await submitPurchaseOrder(orderId);
      toast.success("Purchase order submitted");
      loadOrders();
    } catch (error) {
      console.error("Failed to submit order:", error);
      toast.error("Failed to submit purchase order");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (order: PurchaseOrder) => {
    const orderId = order.name || order.id;
    const docstatus = (order as unknown as Record<string, unknown>).docstatus as number | undefined;
    
    if (docstatus !== 1) {
      toast.error("Can only cancel Submitted orders");
      return;
    }

    if (!confirm(`Cancel purchase order ${orderId}? This action cannot be undone.`)) return;

    try {
      setActionLoading(orderId);
      await cancelPurchaseOrder(orderId);
      toast.success("Purchase order cancelled");
      loadOrders();
    } catch (error) {
      console.error("Failed to cancel order:", error);
      toast.error("Failed to cancel purchase order");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    const name = (order.name || order.id || "").toLowerCase();
    const supplier = (order.supplier_name || order.supplier_id || "").toLowerCase();
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
              <ShoppingCart className="h-6 w-6" />
              Purchase Orders
            </h1>
            <p className="text-muted-foreground">
              Manage your purchase orders
            </p>
          </div>
        </div>

        <Button onClick={() => router.push(`/w/${tenantSlug}/purchasing/purchase-orders/new`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      {/* Search and Refresh */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={loadOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Purchase Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No orders match your search" : "No purchase orders yet"}
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/w/${tenantSlug}/purchasing/purchase-orders/new`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Order
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const orderId = order.name || order.id;
                    const docstatus = (order as unknown as Record<string, unknown>).docstatus as number | undefined;
                    const isDraft = docstatus === 0;
                    const isSubmitted = docstatus === 1;
                    const isLoading = actionLoading === orderId;

                    return (
                      <TableRow key={orderId}>
                        <TableCell className="font-medium">{orderId}</TableCell>
                        <TableCell>{order.supplier_name || order.supplier_id || "-"}</TableCell>
                        <TableCell>{formatDate(order.transaction_date || order.order_date)}</TableCell>
                        <TableCell>{formatCurrency(order.grand_total || order.total_amount)}</TableCell>
                        <TableCell>{getStatusBadge(order.status, docstatus)}</TableCell>
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
                                onClick={() => router.push(`/w/${tenantSlug}/purchasing/purchase-orders/${orderId}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {isDraft && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/w/${tenantSlug}/purchasing/purchase-orders/${orderId}?edit=true`)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSubmit(order)}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Submit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(order)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isSubmitted && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/w/${tenantSlug}/purchasing/receipts/new?order=${orderId}`)}
                                  >
                                    <Package className="h-4 w-4 mr-2" />
                                    Create Receipt
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleCancel(order)}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
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
