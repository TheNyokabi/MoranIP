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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, FlaskConical, Plus } from 'lucide-react';
import { qualityApi, type QualityInspection, type QualityTest } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const inspectionSchema = z.object({
  inspection_type: z.string().min(1, 'Inspection type is required'),
  reference_type: z.string().optional(),
  reference_name: z.string().optional(),
  item_code: z.string().optional(),
  status: z.string().optional(),
  inspection_date: z.string().optional(),
});

const testSchema = z.object({
  test_name: z.string().min(1, 'Test name is required'),
  test_description: z.string().optional(),
  item_group: z.string().optional(),
});

type InspectionFormValues = z.infer<typeof inspectionSchema>;
type TestFormValues = z.infer<typeof testSchema>;

export default function QualityPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('inspections');

  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [tests, setTests] = useState<QualityTest[]>([]);

  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const inspectionForm = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      inspection_type: '',
      reference_type: '',
      reference_name: '',
      item_code: '',
      status: 'Pending',
      inspection_date: new Date().toISOString().split('T')[0],
    },
  });

  const testForm = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      test_name: '',
      test_description: '',
      item_group: '',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inspectionsRes, testsRes] = await Promise.all([
        qualityApi.listInspections().catch(() => ({ data: [] })),
        qualityApi.listTests().catch(() => ({ data: [] })),
      ]);

      setInspections(inspectionsRes.data || []);
      setTests(testsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load quality data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load quality data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInspection = async (data: InspectionFormValues) => {
    try {
      await qualityApi.createInspection(data);
      toast({ title: 'Success', description: 'Quality inspection created successfully' });
      setInspectionDialogOpen(false);
      inspectionForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create inspection',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTest = async (data: TestFormValues) => {
    try {
      await qualityApi.createTest(data);
      toast({ title: 'Success', description: 'Quality test created successfully' });
      setTestDialogOpen(false);
      testForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create test',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'inspection') {
      inspectionForm.reset({
        inspection_type: item.inspection_type || '',
        reference_type: item.reference_type || '',
        reference_name: item.reference_name || '',
        item_code: item.item_code || '',
        status: item.status || 'Pending',
        inspection_date: item.inspection_date || '',
      });
      setInspectionDialogOpen(true);
    } else if (type === 'test') {
      testForm.reset({
        test_name: item.test_name || '',
        test_description: item.test_description || '',
        item_group: item.item_group || '',
      });
      setTestDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.test_name || item.inspection_type || item.name || 'this item',
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
    inspections: [
      { key: 'inspection_type', label: 'Inspection Type' },
      { key: 'reference_name', label: 'Reference' },
      { key: 'item_name', label: 'Item' },
      { key: 'status', label: 'Status' },
      { key: 'inspection_date', label: 'Date' },
    ],
    tests: [
      { key: 'test_name', label: 'Test Name' },
      { key: 'item_group', label: 'Item Group' },
      { key: 'test_description', label: 'Description' },
    ],
  };

  const pendingInspections = inspections.filter(i => i.status === 'Pending').length;
  const passedInspections = inspections.filter(i => i.status === 'Passed').length;

  const getActionButton = () => {
    if (activeTab === 'inspections') {
      return { label: 'New Inspection', onClick: () => setInspectionDialogOpen(true) };
    } else if (activeTab === 'tests') {
      return { label: 'New Test', onClick: () => setTestDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Quality Module"
      description="Manage quality inspections and tests"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Inspections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inspections.length}</div>
            <p className="text-xs text-muted-foreground">Total inspections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInspections}</div>
            <p className="text-xs text-muted-foreground">Pending inspections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tests.length}</div>
            <p className="text-xs text-muted-foreground">Quality tests</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inspections">Inspections</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="inspections" className="mt-4">
              <DataTable
                columns={columns.inspections}
                data={inspections}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'inspection')}
                onDelete={(row) => handleDelete(row, 'inspection')}
                emptyMessage="No inspections found"
              />
            </TabsContent>

            <TabsContent value="tests" className="mt-4">
              <DataTable
                columns={columns.tests}
                data={tests}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'test')}
                onDelete={(row) => handleDelete(row, 'test')}
                emptyMessage="No quality tests found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Inspection Dialog */}
      <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Inspection' : 'New Inspection'}</DialogTitle>
            <DialogDescription>Create a quality inspection</DialogDescription>
          </DialogHeader>
          <Form {...inspectionForm}>
            <form onSubmit={inspectionForm.handleSubmit(handleCreateInspection)} className="space-y-4">
              <FormField
                control={inspectionForm.control}
                name="inspection_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspection Type *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inspectionForm.control}
                name="item_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inspectionForm.control}
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
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Passed">Passed</SelectItem>
                        <SelectItem value="Failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInspectionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Inspection</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Test' : 'New Test'}</DialogTitle>
            <DialogDescription>Create a quality test</DialogDescription>
          </DialogHeader>
          <Form {...testForm}>
            <form onSubmit={testForm.handleSubmit(handleCreateTest)} className="space-y-4">
              <FormField
                control={testForm.control}
                name="test_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={testForm.control}
                name="item_group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Group</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={testForm.control}
                name="test_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTestDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Test</Button>
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
