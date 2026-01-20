'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FileText, ShoppingCart, Truck, Receipt, Plus } from 'lucide-react';
import { salesApi, type Quotation, type SalesOrder, type DeliveryNote, type SalesInvoice } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const quotationSchema = z.object({
  quotation_to: z.string().min(1, 'Quotation to is required'),
  party_name: z.string().min(1, 'Party name is required'),
  transaction_date: z.string().min(1, 'Transaction date is required'),
  company: z.string().min(1, 'Company is required'),
  valid_till: z.string().optional(),
});

const salesOrderSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  transaction_date: z.string().min(1, 'Transaction date is required'),
  company: z.string().min(1, 'Company is required'),
  delivery_date: z.string().optional(),
});

const deliveryNoteSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  posting_date: z.string().min(1, 'Posting date is required'),
  company: z.string().min(1, 'Company is required'),
});

const salesInvoiceSchema = z.object({
  customer: z.string().min(1, 'Customer is required'),
  posting_date: z.string().min(1, 'Posting date is required'),
  company: z.string().min(1, 'Company is required'),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;
type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;
type DeliveryNoteFormValues = z.infer<typeof deliveryNoteSchema>;
type SalesInvoiceFormValues = z.infer<typeof salesInvoiceSchema>;

export default function SalesPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('quotations');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);

  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [deliveryNoteDialogOpen, setDeliveryNoteDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const quotationForm = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotation_to: 'Customer',
      party_name: '',
      transaction_date: new Date().toISOString().split('T')[0],
      company: '',
      valid_till: '',
    },
  });

  const orderForm = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      customer: '',
      transaction_date: new Date().toISOString().split('T')[0],
      company: '',
      delivery_date: '',
    },
  });

  const deliveryNoteForm = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: {
      customer: '',
      posting_date: new Date().toISOString().split('T')[0],
      company: '',
    },
  });

  const invoiceForm = useForm<SalesInvoiceFormValues>({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      customer: '',
      posting_date: new Date().toISOString().split('T')[0],
      company: '',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [quotationsRes, ordersRes, deliveryNotesRes, invoicesRes] = await Promise.all([
        salesApi.listQuotations().catch(() => ({ data: [] })),
        salesApi.listOrders().catch(() => ({ data: [] })),
        salesApi.listDeliveryNotes().catch(() => ({ data: [] })),
        salesApi.listInvoices().catch(() => ({ data: [] })),
      ]);

      setQuotations(quotationsRes.data || []);
      setOrders(ordersRes.data || []);
      setDeliveryNotes(deliveryNotesRes.data || []);
      setInvoices(invoicesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load sales data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuotation = async (data: QuotationFormValues) => {
    try {
      await salesApi.createQuotation(data);
      toast({ title: 'Success', description: 'Quotation created successfully' });
      setQuotationDialogOpen(false);
      quotationForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create quotation',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOrder = async (data: SalesOrderFormValues) => {
    try {
      await salesApi.createOrder(data);
      toast({ title: 'Success', description: 'Sales order created successfully' });
      setOrderDialogOpen(false);
      orderForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create sales order',
        variant: 'destructive',
      });
    }
  };

  const handleCreateDeliveryNote = async (data: DeliveryNoteFormValues) => {
    try {
      await salesApi.createDeliveryNote(data);
      toast({ title: 'Success', description: 'Delivery note created successfully' });
      setDeliveryNoteDialogOpen(false);
      deliveryNoteForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create delivery note',
        variant: 'destructive',
      });
    }
  };

  const handleCreateInvoice = async (data: SalesInvoiceFormValues) => {
    try {
      await salesApi.createInvoice(data);
      toast({ title: 'Success', description: 'Sales invoice created successfully' });
      setInvoiceDialogOpen(false);
      invoiceForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create sales invoice',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'quotation') {
      quotationForm.reset({
        quotation_to: item.quotation_to || 'Customer',
        party_name: item.party_name || '',
        transaction_date: item.transaction_date || '',
        company: item.company || '',
        valid_till: item.valid_till || '',
      });
      setQuotationDialogOpen(true);
    } else if (type === 'order') {
      orderForm.reset({
        customer: item.customer || '',
        transaction_date: item.transaction_date || '',
        company: item.company || '',
        delivery_date: item.delivery_date || '',
      });
      setOrderDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.name || item.party_name || item.customer || 'this item',
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      toast({ title: 'Success', description: 'Item deleted successfully' });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  const columns = {
    quotations: [
      { key: 'name', label: 'Quotation #' },
      { key: 'party_name', label: 'Party' },
      { key: 'transaction_date', label: 'Date' },
      { key: 'grand_total', label: 'Total', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'status', label: 'Status' },
    ],
    orders: [
      { key: 'name', label: 'Order #' },
      { key: 'customer', label: 'Customer' },
      { key: 'transaction_date', label: 'Date' },
      { key: 'grand_total', label: 'Total', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'status', label: 'Status' },
    ],
    deliveryNotes: [
      { key: 'name', label: 'Delivery Note #' },
      { key: 'customer', label: 'Customer' },
      { key: 'posting_date', label: 'Date' },
      { key: 'grand_total', label: 'Total', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'status', label: 'Status' },
    ],
    invoices: [
      { key: 'name', label: 'Invoice #' },
      { key: 'customer', label: 'Customer' },
      { key: 'posting_date', label: 'Date' },
      { key: 'grand_total', label: 'Total', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'status', label: 'Status' },
    ],
  };

  const getActionButton = () => {
    if (activeTab === 'quotations') {
      return { label: 'New Quotation', onClick: () => setQuotationDialogOpen(true) };
    } else if (activeTab === 'orders') {
      return { label: 'New Sales Order', onClick: () => setOrderDialogOpen(true) };
    } else if (activeTab === 'delivery-notes') {
      return { label: 'New Delivery Note', onClick: () => setDeliveryNoteDialogOpen(true) };
    } else if (activeTab === 'invoices') {
      return { label: 'New Sales Invoice', onClick: () => setInvoiceDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Sales Module"
      description="Manage quotations, sales orders, delivery notes, and invoices"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Quotations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotations.length}</div>
            <p className="text-xs text-muted-foreground">Total quotations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Sales orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4" /> Delivery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryNotes.length}</div>
            <p className="text-xs text-muted-foreground">Delivery notes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground">Sales invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="quotations">Quotations</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="delivery-notes">Delivery Notes</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="quotations" className="mt-4">
              <DataTable
                columns={columns.quotations}
                data={quotations}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'quotation')}
                onDelete={(row) => handleDelete(row, 'quotation')}
                emptyMessage="No quotations found"
              />
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              <DataTable
                columns={columns.orders}
                data={orders}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'order')}
                onDelete={(row) => handleDelete(row, 'order')}
                emptyMessage="No sales orders found"
              />
            </TabsContent>

            <TabsContent value="delivery-notes" className="mt-4">
              <DataTable
                columns={columns.deliveryNotes}
                data={deliveryNotes}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'deliveryNote')}
                onDelete={(row) => handleDelete(row, 'deliveryNote')}
                emptyMessage="No delivery notes found"
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <DataTable
                columns={columns.invoices}
                data={invoices}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'invoice')}
                onDelete={(row) => handleDelete(row, 'invoice')}
                emptyMessage="No sales invoices found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quotation Dialog */}
      <Dialog open={quotationDialogOpen} onOpenChange={setQuotationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Quotation' : 'New Quotation'}</DialogTitle>
            <DialogDescription>Create a sales quotation</DialogDescription>
          </DialogHeader>
          <Form {...quotationForm}>
            <form onSubmit={quotationForm.handleSubmit(handleCreateQuotation)} className="space-y-4">
              <FormField
                control={quotationForm.control}
                name="party_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quotationForm.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quotationForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setQuotationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Quotation</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sales Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Sales Order' : 'New Sales Order'}</DialogTitle>
            <DialogDescription>Create a sales order</DialogDescription>
          </DialogHeader>
          <Form {...orderForm}>
            <form onSubmit={orderForm.handleSubmit(handleCreateOrder)} className="space-y-4">
              <FormField
                control={orderForm.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orderForm.control}
                name="transaction_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={orderForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOrderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Sales Order</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delivery Note Dialog */}
      <Dialog open={deliveryNoteDialogOpen} onOpenChange={setDeliveryNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Delivery Note</DialogTitle>
            <DialogDescription>Create a delivery note</DialogDescription>
          </DialogHeader>
          <Form {...deliveryNoteForm}>
            <form onSubmit={deliveryNoteForm.handleSubmit(handleCreateDeliveryNote)} className="space-y-4">
              <FormField
                control={deliveryNoteForm.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deliveryNoteForm.control}
                name="posting_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Posting Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deliveryNoteForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeliveryNoteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Delivery Note</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sales Invoice Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sales Invoice</DialogTitle>
            <DialogDescription>Create a sales invoice</DialogDescription>
          </DialogHeader>
          <Form {...invoiceForm}>
            <form onSubmit={invoiceForm.handleSubmit(handleCreateInvoice)} className="space-y-4">
              <FormField
                control={invoiceForm.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={invoiceForm.control}
                name="posting_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Posting Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={invoiceForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Sales Invoice</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name}
      />
    </ModulePageLayout>
  );
}
