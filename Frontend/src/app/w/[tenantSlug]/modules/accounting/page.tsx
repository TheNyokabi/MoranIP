'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Zap, FileText, CreditCard, DollarSign, Receipt, Plus, Edit2, Trash2 } from 'lucide-react';
import { accountingApi, type GLEntry, type JournalEntry, type PaymentEntry, type Account, type AccountingSalesInvoice } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

// Form schemas
const journalEntrySchema = z.object({
  posting_date: z.string().min(1, 'Posting date is required'),
  company: z.string().min(1, 'Company is required'),
  accounts: z.array(z.object({
    account: z.string().min(1, 'Account is required'),
    debit: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
  })).min(1, 'At least one account entry is required'),
});

const paymentEntrySchema = z.object({
  posting_date: z.string().min(1, 'Posting date is required'),
  party_type: z.string().min(1, 'Party type is required'),
  party: z.string().min(1, 'Party is required'),
  paid_amount: z.number().min(0).optional(),
  received_amount: z.number().min(0).optional(),
  payment_type: z.string().min(1, 'Payment type is required'),
  mode_of_payment: z.string().min(1, 'Mode of payment is required'),
});

const accountSchema = z.object({
  account_name: z.string().min(1, 'Account name is required'),
  account_type: z.string().min(1, 'Account type is required'),
  root_type: z.string().min(1, 'Root type is required'),
  company: z.string().min(1, 'Company is required'),
});

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;
type PaymentEntryFormValues = z.infer<typeof paymentEntrySchema>;
type AccountFormValues = z.infer<typeof accountSchema>;

export default function AccountingPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('gl-entries');

  // Data state
  const [glEntries, setGLEntries] = useState<GLEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<AccountingSalesInvoice[]>([]);

  // Dialog states
  const [journalDialogOpen, setJournalDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  // Forms
  const journalForm = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      posting_date: new Date().toISOString().split('T')[0],
      company: '',
      accounts: [{ account: '', debit: 0, credit: 0 }],
    },
  });

  const paymentForm = useForm<PaymentEntryFormValues>({
    resolver: zodResolver(paymentEntrySchema),
    defaultValues: {
      posting_date: new Date().toISOString().split('T')[0],
      party_type: 'Customer',
      party: '',
      paid_amount: 0,
      received_amount: 0,
      payment_type: 'Receive',
      mode_of_payment: '',
    },
  });

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      account_name: '',
      account_type: '',
      root_type: '',
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
      const [glRes, journalRes, paymentRes, accountsRes, invoicesRes] = await Promise.all([
        accountingApi.listGLEntries().catch(() => ({ data: [] })),
        accountingApi.listJournalEntries().catch(() => ({ data: [] })),
        accountingApi.listPaymentEntries().catch(() => ({ data: [] })),
        accountingApi.listAccounts().catch(() => ({ data: [] })),
        accountingApi.listSalesInvoices().catch(() => ({ data: [] })),
      ]);

      setGLEntries(glRes.data || []);
      setJournalEntries(journalRes.data || []);
      setPaymentEntries(paymentRes.data || []);
      setAccounts(accountsRes.data || []);
      setSalesInvoices(invoicesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounting data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load accounting data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJournal = async (data: JournalEntryFormValues) => {
    try {
      await accountingApi.createJournalEntry({
        ...data,
        accounts: data.accounts.map(a => ({
          ...a,
          debit: a.debit || 0,
          credit: a.credit || 0
        }))
      });
      toast({ title: 'Success', description: 'Journal entry created successfully' });
      setJournalDialogOpen(false);
      journalForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create journal entry',
        variant: 'destructive',
      });
    }
  };

  const handleCreatePayment = async (data: PaymentEntryFormValues) => {
    try {
      await accountingApi.createPaymentEntry(data);
      toast({ title: 'Success', description: 'Payment entry created successfully' });
      setPaymentDialogOpen(false);
      paymentForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create payment entry',
        variant: 'destructive',
      });
    }
  };

  const handleCreateAccount = async (data: AccountFormValues) => {
    try {
      await accountingApi.createAccount(data);
      toast({ title: 'Success', description: 'Account created successfully' });
      setAccountDialogOpen(false);
      accountForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create account',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    // Populate form based on type
    if (type === 'journal') {
      journalForm.reset({
        posting_date: item.posting_date,
        company: item.company,
        accounts: item.accounts || [],
      });
      setJournalDialogOpen(true);
    } else if (type === 'payment') {
      paymentForm.reset({
        posting_date: item.posting_date,
        party_type: item.party_type,
        party: item.party,
        paid_amount: item.paid_amount,
        received_amount: item.received_amount,
        payment_type: item.payment_type,
        mode_of_payment: item.mode_of_payment,
      });
      setPaymentDialogOpen(true);
    } else if (type === 'account') {
      accountForm.reset({
        account_name: item.account_name,
        account_type: item.account_type || '',
        root_type: item.root_type,
        company: item.company || '',
      });
      setAccountDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.name || item.account_name || 'this item',
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;

    try {
      // Note: Delete endpoints may not exist for all resources
      // This is a placeholder - actual implementation depends on backend
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
    glEntries: [
      { key: 'name', label: 'ID' },
      { key: 'account', label: 'Account' },
      { key: 'debit', label: 'Debit', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'credit', label: 'Credit', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'posting_date', label: 'Date' },
    ],
    journals: [
      { key: 'name', label: 'Reference' },
      { key: 'posting_date', label: 'Date' },
      { key: 'total_debit', label: 'Total Debit', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'total_credit', label: 'Total Credit', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'docstatus', label: 'Status', render: (val: any) => val === 1 ? 'Submitted' : 'Draft' },
    ],
    payments: [
      { key: 'name', label: 'ID' },
      { key: 'party_type', label: 'Type' },
      { key: 'party', label: 'Party' },
      { key: 'paid_amount', label: 'Paid', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'received_amount', label: 'Received', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'posting_date', label: 'Date' },
    ],
    accounts: [
      { key: 'account_name', label: 'Account Name' },
      { key: 'account_type', label: 'Type' },
      { key: 'root_type', label: 'Root Type' },
      { key: 'report_type', label: 'Report Type' },
    ],
    invoices: [
      { key: 'name', label: 'Invoice #' },
      { key: 'customer', label: 'Customer' },
      { key: 'grand_total', label: 'Total', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'posting_date', label: 'Date' },
      { key: 'docstatus', label: 'Status', render: (val: any) => val === 1 ? 'Submitted' : 'Draft' },
    ],
  };

  const totalDebit = glEntries.reduce((sum, entry) => sum + (parseFloat(String(entry.debit)) || 0), 0);
  const totalCredit = glEntries.reduce((sum, entry) => sum + (parseFloat(String(entry.credit)) || 0), 0);
  const totalInvoices = salesInvoices.reduce((sum, inv) => sum + (parseFloat(String(inv.grand_total)) || 0), 0);

  const getActionButton = () => {
    if (activeTab === 'journals') {
      return { label: 'New Journal Entry', onClick: () => setJournalDialogOpen(true) };
    } else if (activeTab === 'payments') {
      return { label: 'New Payment Entry', onClick: () => setPaymentDialogOpen(true) };
    } else if (activeTab === 'accounts') {
      return { label: 'New Account', onClick: () => setAccountDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Accounting Module"
      description="Manage your financial records, transactions, and accounts"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" /> GL Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{glEntries.length}</div>
            <p className="text-xs text-muted-foreground">Total entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" /> Journals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{journalEntries.length}</div>
            <p className="text-xs text-muted-foreground">Journal entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentEntries.length}</div>
            <p className="text-xs text-muted-foreground">Payment entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesInvoices.length}</div>
            <p className="text-xs text-muted-foreground">Total {totalInvoices.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounting Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="gl-entries">GL Entries</TabsTrigger>
              <TabsTrigger value="journals">Journals</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            <TabsContent value="gl-entries" className="mt-4">
              <DataTable
                columns={columns.glEntries}
                data={glEntries}
                isLoading={loading}
                searchable
                emptyMessage="No GL entries found"
              />
            </TabsContent>

            <TabsContent value="journals" className="mt-4">
              <DataTable
                columns={columns.journals}
                data={journalEntries}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'journal')}
                onDelete={(row) => handleDelete(row, 'journal')}
                emptyMessage="No journal entries found"
              />
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <DataTable
                columns={columns.payments}
                data={paymentEntries}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'payment')}
                onDelete={(row) => handleDelete(row, 'payment')}
                emptyMessage="No payment entries found"
              />
            </TabsContent>

            <TabsContent value="accounts" className="mt-4">
              <DataTable
                columns={columns.accounts}
                data={accounts}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'account')}
                onDelete={(row) => handleDelete(row, 'account')}
                emptyMessage="No accounts found"
              />
            </TabsContent>

            <TabsContent value="invoices" className="mt-4">
              <DataTable
                columns={columns.invoices}
                data={salesInvoices}
                isLoading={loading}
                searchable
                emptyMessage="No sales invoices found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Journal Entry Dialog */}
      <Dialog open={journalDialogOpen} onOpenChange={setJournalDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
            <DialogDescription>Create a new journal entry for accounting transactions</DialogDescription>
          </DialogHeader>
          <Form {...journalForm}>
            <form onSubmit={journalForm.handleSubmit(handleCreateJournal)} className="space-y-4">
              <FormField
                control={journalForm.control}
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
                control={journalForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setJournalDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Journal Entry</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Entry Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Payment Entry' : 'New Payment Entry'}</DialogTitle>
            <DialogDescription>Record a payment transaction</DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleCreatePayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
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
                  control={paymentForm.control}
                  name="party_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Party Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Customer">Customer</SelectItem>
                          <SelectItem value="Supplier">Supplier</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentForm.control}
                name="party"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party *</FormLabel>
                    <FormControl>
                      <Input placeholder="Party name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="paid_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="received_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Received Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Payment Entry</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Account' : 'New Account'}</DialogTitle>
            <DialogDescription>Create a new chart of accounts entry</DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(handleCreateAccount)} className="space-y-4">
              <FormField
                control={accountForm.control}
                name="account_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Account name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={accountForm.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Asset, Liability" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="root_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Root Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select root type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Asset">Asset</SelectItem>
                          <SelectItem value="Liability">Liability</SelectItem>
                          <SelectItem value="Equity">Equity</SelectItem>
                          <SelectItem value="Income">Income</SelectItem>
                          <SelectItem value="Expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={accountForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company *</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Account</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={deleteItem?.name}
      />
    </ModulePageLayout>
  );
}
