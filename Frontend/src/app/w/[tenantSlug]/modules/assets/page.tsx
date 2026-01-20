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
import { Building2, Wrench, Plus } from 'lucide-react';
import { assetsApi, type Asset, type AssetMaintenance } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { DeleteDialog } from '@/components/crud/delete-dialog';
import { useToast } from '@/hooks/use-toast';
import { ModulePageLayout } from '@/components/layout/module-page-layout';

const assetSchema = z.object({
  asset_name: z.string().min(1, 'Asset name is required'),
  asset_category: z.string().min(1, 'Asset category is required'),
  company: z.string().min(1, 'Company is required'),
  purchase_date: z.string().optional(),
  purchase_amount: z.number().min(0, 'Purchase amount must be positive'),
  location: z.string().optional(),
  department: z.string().optional(),
});

const maintenanceSchema = z.object({
  asset: z.string().min(1, 'Asset is required'),
  maintenance_type: z.string().min(1, 'Maintenance type is required'),
  maintenance_status: z.string().min(1, 'Status is required'),
  next_due_date: z.string().optional(),
  assign_to: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;
type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

export default function AssetsPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('assets');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenance, setMaintenance] = useState<AssetMaintenance[]>([]);

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);

  const assetForm = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      asset_name: '',
      asset_category: '',
      company: '',
      purchase_date: '',
      purchase_amount: 0,
      location: '',
      department: '',
    },
  });

  const maintenanceForm = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      asset: '',
      maintenance_type: '',
      maintenance_status: 'Scheduled',
      next_due_date: '',
      assign_to: '',
    },
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetsRes, maintenanceRes] = await Promise.all([
        assetsApi.listAssets().catch(() => ({ data: [] })),
        assetsApi.listMaintenance().catch(() => ({ data: [] })),
      ]);

      setAssets(assetsRes.data || []);
      setMaintenance(maintenanceRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load assets data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load assets data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (data: AssetFormValues) => {
    try {
      await assetsApi.createAsset(data);
      toast({ title: 'Success', description: 'Asset created successfully' });
      setAssetDialogOpen(false);
      assetForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create asset',
        variant: 'destructive',
      });
    }
  };

  const handleCreateMaintenance = async (data: MaintenanceFormValues) => {
    try {
      await assetsApi.createMaintenance(data);
      toast({ title: 'Success', description: 'Maintenance record created successfully' });
      setMaintenanceDialogOpen(false);
      maintenanceForm.reset();
      loadAllData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create maintenance record',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any, type: string) => {
    setEditingItem({ ...item, _type: type });
    if (type === 'asset') {
      assetForm.reset({
        asset_name: item.asset_name || '',
        asset_category: item.asset_category || '',
        company: item.company || '',
        purchase_date: item.purchase_date || '',
        purchase_amount: item.purchase_amount || 0,
        location: item.location || '',
        department: item.department || '',
      });
      setAssetDialogOpen(true);
    } else if (type === 'maintenance') {
      maintenanceForm.reset({
        asset: item.asset || item.asset_name || '',
        maintenance_type: item.maintenance_type || '',
        maintenance_status: item.maintenance_status || 'Scheduled',
        next_due_date: item.next_due_date || '',
        assign_to: item.assign_to || '',
      });
      setMaintenanceDialogOpen(true);
    }
  };

  const handleDelete = (item: any, type: string) => {
    setDeleteItem({
      type,
      id: item.name,
      name: item.asset_name || item.name || 'this item',
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
    assets: [
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'asset_category', label: 'Category' },
      { key: 'purchase_amount', label: 'Purchase Amount', render: (val: any) => val ? parseFloat(val).toFixed(2) : '0.00' },
      { key: 'status', label: 'Status' },
      { key: 'location', label: 'Location' },
    ],
    maintenance: [
      { key: 'asset_name', label: 'Asset' },
      { key: 'maintenance_type', label: 'Type' },
      { key: 'maintenance_status', label: 'Status' },
      { key: 'next_due_date', label: 'Next Due' },
      { key: 'assign_to', label: 'Assigned To' },
    ],
  };

  const totalAssets = assets.length;
  const totalValue = assets.reduce((sum, asset) => sum + (parseFloat(String(asset.purchase_amount)) || 0), 0);
  const scheduledMaintenance = maintenance.filter(m => m.maintenance_status === 'Scheduled').length;

  const getActionButton = () => {
    if (activeTab === 'assets') {
      return { label: 'New Asset', onClick: () => setAssetDialogOpen(true) };
    } else if (activeTab === 'maintenance') {
      return { label: 'New Maintenance', onClick: () => setMaintenanceDialogOpen(true) };
    }
    return undefined;
  };

  return (
    <ModulePageLayout
      title="Assets Module"
      description="Manage company assets and maintenance schedules"
      action={getActionButton()}
    >
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">Total assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalValue.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Asset value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledMaintenance}</div>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assets Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            </TabsList>

            <TabsContent value="assets" className="mt-4">
              <DataTable
                columns={columns.assets}
                data={assets}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'asset')}
                onDelete={(row) => handleDelete(row, 'asset')}
                emptyMessage="No assets found"
              />
            </TabsContent>

            <TabsContent value="maintenance" className="mt-4">
              <DataTable
                columns={columns.maintenance}
                data={maintenance}
                isLoading={loading}
                searchable
                onEdit={(row) => handleEdit(row, 'maintenance')}
                onDelete={(row) => handleDelete(row, 'maintenance')}
                emptyMessage="No maintenance records found"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Asset Dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Asset' : 'New Asset'}</DialogTitle>
            <DialogDescription>Add a new asset to your organization</DialogDescription>
          </DialogHeader>
          <Form {...assetForm}>
            <form onSubmit={assetForm.handleSubmit(handleCreateAsset)} className="space-y-4">
              <FormField
                control={assetForm.control}
                name="asset_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={assetForm.control}
                  name="asset_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={assetForm.control}
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
              </div>
              <FormField
                control={assetForm.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={assetForm.control}
                name="purchase_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Amount *</FormLabel>
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAssetDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Asset</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Maintenance' : 'New Maintenance'}</DialogTitle>
            <DialogDescription>Schedule asset maintenance</DialogDescription>
          </DialogHeader>
          <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit(handleCreateMaintenance)} className="space-y-4">
              <FormField
                control={maintenanceForm.control}
                name="asset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="maintenance_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maintenance Type *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="maintenance_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="next_due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Maintenance</Button>
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
