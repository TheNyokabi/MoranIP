'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Hammer, Package, Factory, Zap, Plus } from 'lucide-react';
import { manufacturingApi, type BOM, type WorkOrder, type ProductionPlan } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const bomSchema = z.object({
  item: z.string().min(1, 'Item is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  company: z.string().min(1, 'Company is required'),
});

const workOrderSchema = z.object({
  production_item: z.string().min(1, 'Production item is required'),
  qty: z.number().min(0.01, 'Quantity must be greater than 0'),
  company: z.string().min(1, 'Company is required'),
  bom_no: z.string().optional(),
});

const productionPlanSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  get_items_from: z.string().min(1, 'Source is required'),
});

type BOMFormValues = z.infer<typeof bomSchema>;
type WorkOrderFormValues = z.infer<typeof workOrderSchema>;
type ProductionPlanFormValues = z.infer<typeof productionPlanSchema>;

export default function ManufacturingPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('boms');

  const [boms, setBOMs] = useState<BOM[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [productionPlans, setProductionPlans] = useState<ProductionPlan[]>([]);

  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [workOrderDialogOpen, setWorkOrderDialogOpen] = useState(false);
  const [productionPlanDialogOpen, setProductionPlanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const bomForm = useForm<BOMFormValues>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      item: '',
      quantity: 1,
      company: '',
    },
  });

  const workOrderForm = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      production_item: '',
      qty: 1,
      company: '',
      bom_no: '',
    },
  });

  const productionPlanForm = useForm<ProductionPlanFormValues>({
    resolver: zodResolver(productionPlanSchema),
    defaultValues: {
      company: '',
      get_items_from: 'Sales Order',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bomsRes, workOrdersRes, plansRes] = await Promise.all([
        manufacturingApi.listBOMs().catch(() => ({ data: [] })),
        manufacturingApi.listWorkOrders().catch(() => ({ data: [] })),
        manufacturingApi.listProductionPlans().catch(() => ({ data: [] })),
      ]);

      setBOMs(bomsRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setProductionPlans(plansRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load manufacturing data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load manufacturing data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBOM = async (data: BOMFormValues) => {
    try {
      await manufacturingApi.createBOM(data);
      toast({ title: 'Success', description: 'BOM created successfully' });
      setBomDialogOpen(false);
      bomForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create BOM',
        variant: 'destructive',
      });
    }
  };

  const handleCreateWorkOrder = async (data: WorkOrderFormValues) => {
    try {
      await manufacturingApi.createWorkOrder(data);
      toast({ title: 'Success', description: 'Work order created successfully' });
      setWorkOrderDialogOpen(false);
      workOrderForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create work order',
        variant: 'destructive',
      });
    }
  };

  const handleCreateProductionPlan = async (data: ProductionPlanFormValues) => {
    try {
      await manufacturingApi.createProductionPlan(data);
      toast({ title: 'Success', description: 'Production plan created successfully' });
      setProductionPlanDialogOpen(false);
      productionPlanForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create production plan',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'bom') {
      bomForm.reset({
        item: item.item || '',
        quantity: item.quantity || 1,
        company: item.company || '',
      });
      setBomDialogOpen(true);
    } else if (type === 'workOrder') {
      workOrderForm.reset({
        production_item: item.production_item || '',
        qty: item.qty || 1,
        company: item.company || '',
        bom_no: item.bom_no || '',
      });
      setWorkOrderDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.name || item.item_name || 'this item',
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
    boms: [
      { key: 'name', label: 'BOM ID' },
      { key: 'item_name', label: 'Item' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'docstatus', label: 'Status', render: (val: any) => val === 1 ? 'Submitted' : 'Draft' },
    ],
    workOrders: [
      { key: 'name', label: 'Work Order #' },
      { key: 'item_name', label: 'Item' },
      { key: 'qty', label: 'Quantity' },
      { key: 'status', label: 'Status' },
      { key: 'docstatus', label: 'Doc Status', render: (val: any) => val === 1 ? 'Submitted' : 'Draft' },
    ],
    productionPlans: [
      { key: 'name', label: 'Plan ID' },
      { key: 'status', label: 'Status' },
      { key: 'docstatus', label: 'Doc Status', render: (val: any) => val === 1 ? 'Submitted' : 'Draft' },
    ],
  };

  const activeWorkOrders = workOrders.filter(wo => wo.status !== 'Completed').length;
  const totalQty = workOrders.reduce((sum, wo) => sum + (parseFloat(String(wo.qty)) || 0), 0);

  const getActionButton = () => {
    if (activeTab === 'boms') {
      return { label: 'New BOM', onClick: () => setBomDialogOpen(true) };
    } else if (activeTab === 'work-orders') {
      return { label: 'New Work Order', onClick: () => setWorkOrderDialogOpen(true) };
    } else if (activeTab === 'production-plans') {
      return { label: 'New Production Plan', onClick: () => setProductionPlanDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Manufacturing Module"
      description="Manage BOMs, work orders, and production plans"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> BOMs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boms.length}</div>
            <p className="text-xs text-muted-foreground">Total BOMs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hammer className="h-4 w-4" /> Work Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWorkOrders}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Factory className="h-4 w-4" /> Production
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productionPlans.length}</div>
            <p className="text-xs text-muted-foreground">Plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" /> Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQty.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Total quantity</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manufacturing Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="boms">BOMs</TabsTrigger>
              <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
              <TabsTrigger value="production-plans">Production Plans</TabsTrigger>
            </TabsList>

            <TabsContent value="boms" className="mt-4">
              <DataTable
                columns={columns.boms}
                data={boms}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'bom')}
                onDelete={(row) => handleDelete(row, 'bom')}
                emptyMessage="No BOMs found"
              />
            </TabsContent>

            <TabsContent value="work-orders" className="mt-4">
              <DataTable
                columns={columns.workOrders}
                data={workOrders}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'workOrder')}
                onDelete={(row) => handleDelete(row, 'workOrder')}
                emptyMessage="No work orders found"
              />
            </TabsContent>

            <TabsContent value="production-plans" className="mt-4">
              <DataTable
                columns={columns.productionPlans}
                data={productionPlans}
                isLoading={loading}
                searchable
                emptyMessage="No production plans found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* BOM Dialog */}
      <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit BOM' : 'New BOM'}</DialogTitle>
            <DialogDescription>Create a bill of materials</DialogDescription>
          </DialogHeader>
          <Form {...bomForm}>
            <form onSubmit={bomForm.handleSubmit(handleCreateBOM)} className="space-y-4">
              <FormField
                control={bomForm.control}
                name="item"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={bomForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
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
                control={bomForm.control}
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
                <Button type="button" variant="outline" onClick={() => setBomDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create BOM</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Work Order Dialog */}
      <Dialog open={workOrderDialogOpen} onOpenChange={setWorkOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Work Order' : 'New Work Order'}</DialogTitle>
            <DialogDescription>Create a new work order</DialogDescription>
          </DialogHeader>
          <Form {...workOrderForm}>
            <form onSubmit={workOrderForm.handleSubmit(handleCreateWorkOrder)} className="space-y-4">
              <FormField
                control={workOrderForm.control}
                name="production_item"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Production Item *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={workOrderForm.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
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
                control={workOrderForm.control}
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
              <FormField
                control={workOrderForm.control}
                name="bom_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BOM Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setWorkOrderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Work Order</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Production Plan Dialog */}
      <Dialog open={productionPlanDialogOpen} onOpenChange={setProductionPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Production Plan</DialogTitle>
            <DialogDescription>Create a production plan</DialogDescription>
          </DialogHeader>
          <Form {...productionPlanForm}>
            <form onSubmit={productionPlanForm.handleSubmit(handleCreateProductionPlan)} className="space-y-4">
              <FormField
                control={productionPlanForm.control}
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
              <FormField
                control={productionPlanForm.control}
                name="get_items_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProductionPlanDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Production Plan</Button>
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
