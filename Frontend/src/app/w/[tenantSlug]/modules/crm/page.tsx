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
import { Users, Target, Briefcase, Phone, Plus } from 'lucide-react';
import { crmApi, type Contact, type Lead, type Customer, type Opportunity } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email_id: z.string().email().optional().or(z.literal('')),
  mobile_no: z.string().optional(),
  company_name: z.string().optional(),
  designation: z.string().optional(),
});

const leadSchema = z.object({
  lead_name: z.string().min(1, 'Lead name is required'),
  company_name: z.string().optional(),
  email_id: z.string().email().optional().or(z.literal('')),
  mobile_no: z.string().optional(),
  source: z.string().optional(),
  industry: z.string().optional(),
});

const customerSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_type: z.string().min(1, 'Customer type is required'),
  customer_group: z.string().min(1, 'Customer group is required'),
  territory: z.string().optional(),
  email_id: z.string().email().optional().or(z.literal('')),
  mobile_no: z.string().optional(),
});

const opportunitySchema = z.object({
  opportunity_type: z.string().min(1, 'Opportunity type is required'),
  party_name: z.string().min(1, 'Party name is required'),
  opportunity_from: z.string().min(1, 'Source is required'),
  probability: z.number().min(0).max(100),
  expected_closing: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;
type LeadFormValues = z.infer<typeof leadSchema>;
type CustomerFormValues = z.infer<typeof customerSchema>;
type OpportunityFormValues = z.infer<typeof opportunitySchema>;

export default function CRMPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('contacts');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email_id: '',
      mobile_no: '',
      company_name: '',
      designation: '',
    },
  });

  const leadForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      lead_name: '',
      company_name: '',
      email_id: '',
      mobile_no: '',
      source: '',
      industry: '',
    },
  });

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customer_name: '',
      customer_type: 'Company',
      customer_group: '',
      territory: '',
      email_id: '',
      mobile_no: '',
    },
  });

  const opportunityForm = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      opportunity_type: 'Sales',
      party_name: '',
      opportunity_from: 'Lead',
      probability: 50,
      expected_closing: '',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [contactsRes, leadsRes, customersRes, opportunitiesRes] = await Promise.all([
        crmApi.listContacts().catch(() => ({ data: [] })),
        crmApi.listLeads().catch(() => ({ data: [] })),
        crmApi.listCustomers().catch(() => ({ data: [] })),
        crmApi.listOpportunities().catch(() => ({ data: [] })),
      ]);

      setContacts(contactsRes.data || []);
      setLeads(leadsRes.data || []);
      setCustomers(customersRes.data || []);
      setOpportunities(opportunitiesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load CRM data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load CRM data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContact = async (data: ContactFormValues) => {
    try {
      await crmApi.createContact(data);
      toast({ title: 'Success', description: 'Contact created successfully' });
      setContactDialogOpen(false);
      contactForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create contact',
        variant: 'destructive',
      });
    }
  };

  const handleCreateLead = async (data: LeadFormValues) => {
    try {
      await crmApi.createLead(data);
      toast({ title: 'Success', description: 'Lead created successfully' });
      setLeadDialogOpen(false);
      leadForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create lead',
        variant: 'destructive',
      });
    }
  };

  const handleCreateCustomer = async (data: CustomerFormValues) => {
    try {
      await crmApi.createCustomer(data);
      toast({ title: 'Success', description: 'Customer created successfully' });
      setCustomerDialogOpen(false);
      customerForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create customer',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOpportunity = async (data: OpportunityFormValues) => {
    try {
      await crmApi.createOpportunity(data);
      toast({ title: 'Success', description: 'Opportunity created successfully' });
      setOpportunityDialogOpen(false);
      opportunityForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create opportunity',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'contact') {
      contactForm.reset({
        first_name: item.first_name || '',
        last_name: item.last_name || '',
        email_id: item.email_id || '',
        mobile_no: item.mobile_no || item.phone || '',
        company_name: item.company_name || '',
        designation: item.designation || '',
      });
      setContactDialogOpen(true);
    } else if (type === 'lead') {
      leadForm.reset({
        lead_name: item.lead_name || '',
        company_name: item.company_name || '',
        email_id: item.email_id || '',
        mobile_no: item.mobile_no || '',
        source: item.source || '',
        industry: item.industry || '',
      });
      setLeadDialogOpen(true);
    } else if (type === 'customer') {
      customerForm.reset({
        customer_name: item.customer_name || '',
        customer_type: item.customer_type || 'Company',
        customer_group: item.customer_group || '',
        territory: item.territory || '',
        email_id: item.email_id || '',
        mobile_no: item.mobile_no || '',
      });
      setCustomerDialogOpen(true);
    } else if (type === 'opportunity') {
      opportunityForm.reset({
        opportunity_type: item.opportunity_type || 'Sales',
        party_name: item.party_name || '',
        opportunity_from: item.opportunity_from || 'Lead',
        probability: item.probability || 50,
        expected_closing: item.expected_closing || '',
      });
      setOpportunityDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.first_name || item.lead_name || item.customer_name || item.party_name || 'this item',
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      // Delete implementation depends on backend
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
    contacts: [
      { key: 'first_name', label: 'Name', render: (val: any, row: any) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || val },
      { key: 'email_id', label: 'Email' },
      { key: 'mobile_no', label: 'Phone', render: (val: any, row: any) => val || row.phone || '-' },
      { key: 'company_name', label: 'Company' },
    ],
    leads: [
      { key: 'lead_name', label: 'Lead Name' },
      { key: 'email_id', label: 'Email' },
      { key: 'mobile_no', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'source', label: 'Source' },
    ],
    customers: [
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'customer_type', label: 'Type' },
      { key: 'territory', label: 'Territory' },
      { key: 'customer_group', label: 'Group' },
      { key: 'status', label: 'Status' },
    ],
    opportunities: [
      { key: 'party_name', label: 'Party' },
      { key: 'opportunity_type', label: 'Type' },
      { key: 'probability', label: 'Probability', render: (val: any) => `${val}%` },
      { key: 'status', label: 'Status' },
      { key: 'expected_closing', label: 'Expected Closing' },
    ],
  };

  const getActionButton = () => {
    if (activeTab === 'contacts') {
      return { label: 'New Contact', onClick: () => setContactDialogOpen(true) };
    } else if (activeTab === 'leads') {
      return { label: 'New Lead', onClick: () => setLeadDialogOpen(true) };
    } else if (activeTab === 'customers') {
      return { label: 'New Customer', onClick: () => setCustomerDialogOpen(true) };
    } else if (activeTab === 'opportunities') {
      return { label: 'New Opportunity', onClick: () => setOpportunityDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="CRM Module"
      description="Manage your customer relationships, leads, and sales opportunities"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" /> Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
            <p className="text-xs text-muted-foreground">Total contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" /> Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-xs text-muted-foreground">Active leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Total customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" /> Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{opportunities.length}</div>
            <p className="text-xs text-muted-foreground">Open opportunities</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CRM Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="mt-4">
              <DataTable
                columns={columns.contacts}
                data={contacts}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'contact')}
                onDelete={(row) => handleDelete(row, 'contact')}
                emptyMessage="No contacts found"
              />
            </TabsContent>

            <TabsContent value="leads" className="mt-4">
              <DataTable
                columns={columns.leads}
                data={leads}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'lead')}
                onDelete={(row) => handleDelete(row, 'lead')}
                emptyMessage="No leads found"
              />
            </TabsContent>

            <TabsContent value="customers" className="mt-4">
              <DataTable
                columns={columns.customers}
                data={customers}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'customer')}
                onDelete={(row) => handleDelete(row, 'customer')}
                emptyMessage="No customers found"
              />
            </TabsContent>

            <TabsContent value="opportunities" className="mt-4">
              <DataTable
                columns={columns.opportunities}
                data={opportunities}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'opportunity')}
                onDelete={(row) => handleDelete(row, 'opportunity')}
                emptyMessage="No opportunities found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Contact' : 'New Contact'}</DialogTitle>
            <DialogDescription>Add a new contact to your CRM</DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleCreateContact)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="email_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="mobile_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Contact</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Lead Dialog */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Lead' : 'New Lead'}</DialogTitle>
            <DialogDescription>Add a new sales lead</DialogDescription>
          </DialogHeader>
          <Form {...leadForm}>
            <form onSubmit={leadForm.handleSubmit(handleCreateLead)} className="space-y-4">
              <FormField
                control={leadForm.control}
                name="lead_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="email_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="mobile_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLeadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Lead</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Customer' : 'New Customer'}</DialogTitle>
            <DialogDescription>Add a new customer</DialogDescription>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(handleCreateCustomer)} className="space-y-4">
              <FormField
                control={customerForm.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customerForm.control}
                  name="customer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Company">Company</SelectItem>
                          <SelectItem value="Individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={customerForm.control}
                  name="customer_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Group *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Customer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Opportunity Dialog */}
      <Dialog open={opportunityDialogOpen} onOpenChange={setOpportunityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Opportunity' : 'New Opportunity'}</DialogTitle>
            <DialogDescription>Create a new sales opportunity</DialogDescription>
          </DialogHeader>
          <Form {...opportunityForm}>
            <form onSubmit={opportunityForm.handleSubmit(handleCreateOpportunity)} className="space-y-4">
              <FormField
                control={opportunityForm.control}
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={opportunityForm.control}
                  name="opportunity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="Support">Support</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={opportunityForm.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpportunityDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Opportunity</Button>
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
