'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { HelpCircle, Plus } from 'lucide-react';
import { supportApi, type Issue } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const issueSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  customer: z.string().optional(),
  status: z.enum(['Open', 'Replied', 'On Hold', 'Resolved', 'Closed']).optional(),
  priority: z.string().optional(),
  issue_type: z.string().optional(),
  description: z.string().optional(),
});

type IssueFormValues = z.infer<typeof issueSchema>;

export default function SupportPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const issueForm = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      subject: '',
      customer: '',
      status: 'Open',
      priority: 'Medium',
      issue_type: '',
      description: '',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const issuesRes = await supportApi.listIssues().catch(() => ({ data: [] }));
      setIssues(issuesRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load support issues');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load support issues',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async (data: IssueFormValues) => {
    try {
      await supportApi.createIssue(data);
      toast({ title: 'Success', description: 'Issue created successfully' });
      setIssueDialogOpen(false);
      issueForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create issue',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    issueForm.reset({
      subject: item.subject || '',
      customer: item.customer || '',
      status: item.status || 'Open',
      priority: item.priority || 'Medium',
      issue_type: item.issue_type || '',
      description: item.description || '',
    });
    setIssueDialogOpen(true);
  };

  const handleDelete = (item: any) => {
    setDeleteItem({
      type: 'issue',
      id: item.name,
      name: item.subject || item.name || 'this issue',
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      toast({ title: 'Success', description: 'Issue deleted successfully' });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete issue',
        variant: 'destructive',
      });
    }
  };

  const columns = [
    { key: 'subject', label: 'Subject' },
    { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'issue_type', label: 'Type' },
    { key: 'opening_date', label: 'Opened' },
  ];

  const openIssues = issues.filter(i => i.status === 'Open' || i.status === 'Replied').length;
  const resolvedIssues = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;

  return (
    <ModulePageLayout
      title="Support Module"
      description="Manage customer support issues and tickets"
      action={{ label: 'New Issue', onClick: () => setIssueDialogOpen(true) }}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> Total Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues.length}</div>
            <p className="text-xs text-muted-foreground">All issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openIssues}</div>
            <p className="text-xs text-muted-foreground">Active issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" /> Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedIssues}</div>
            <p className="text-xs text-muted-foreground">Closed issues</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={issues}
            isLoading={loading}
            searchable
            onEdit={handleEdit}
            onDelete={handleDelete}
            emptyMessage="No issues found"
          />
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Issue' : 'New Issue'}</DialogTitle>
            <DialogDescription>Create a support issue or ticket</DialogDescription>
          </DialogHeader>
          <Form {...issueForm}>
            <form onSubmit={issueForm.handleSubmit(handleCreateIssue)} className="space-y-4">
              <FormField
                control={issueForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={issueForm.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={issueForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Replied">Replied</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={issueForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={issueForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIssueDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Issue</Button>
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
