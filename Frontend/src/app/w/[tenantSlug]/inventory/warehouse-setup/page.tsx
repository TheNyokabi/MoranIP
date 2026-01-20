'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, MapPin, Download, ArrowLeft } from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { BulkUploadModal } from '@/components/shared/bulk-upload-modal';

interface Warehouse {
  name: string;
  warehouse_name: string;
  warehouse_code: string;
  is_group: boolean;
  parent_warehouse: string | null;
  company: string;
  disabled: boolean;
  address: string;
}

export default function WarehouseConfigurationPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const tenantId = tenantSlug;
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  const handleRefresh = () => {
    fetchWarehouses();
  };
  const [formData, setFormData] = useState({
    warehouse_name: '',
    warehouse_code: '',
    parent_warehouse: '',
    is_group: false,
    address: '',
    incharge_name: '',
    incharge_email: '',
    capacity: '',
  });

  useEffect(() => {
    if (tenantId) {
      fetchWarehouses();
    }
  }, [tenantId]);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/warehouses`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.data || data || []);
      }
    } catch (err) {
      setError('Failed to load warehouses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWarehouse = async () => {
    try {
      const payload = {
        warehouse_name: formData.warehouse_name,
        warehouse_code: formData.warehouse_code,
        parent_warehouse: formData.parent_warehouse || undefined,
        is_group: formData.is_group,
        address: formData.address,
      };

      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/warehouses`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        setFormData({
          warehouse_name: '',
          warehouse_code: '',
          parent_warehouse: '',
          is_group: false,
          address: '',
          incharge_name: '',
          incharge_email: '',
          capacity: '',
        });
        setShowNewForm(false);
        await fetchWarehouses();
      }
    } catch (err) {
      setError('Failed to create warehouse');
      console.error(err);
    }
  };

  const handleUpdateWarehouse = async () => {
    if (!selectedWarehouse) return;
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/warehouses/${selectedWarehouse.name}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        setSelectedWarehouse(null);
        setFormData({
          warehouse_name: '',
          warehouse_code: '',
          parent_warehouse: '',
          is_group: false,
          address: '',
          incharge_name: '',
          incharge_email: '',
          capacity: '',
        });
        await fetchWarehouses();
      }
    } catch (err) {
      setError('Failed to update warehouse');
      console.error(err);
    }
  };

  const warehouseColumns = [
    { key: 'warehouse_code', label: 'Code' },
    { key: 'warehouse_name', label: 'Warehouse Name' },
    { key: 'parent_warehouse', label: 'Parent' },
    { key: 'is_group', label: 'Type' },
    { key: 'disabled', label: 'Status' },
  ];

  const activeWarehouses = warehouses.filter((w: Warehouse) => !w.disabled);
  const groupWarehouses = warehouses.filter((w: Warehouse) => w.is_group);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouse Configuration</h1>
            <p className="text-muted-foreground">Manage storage locations and warehouse hierarchy</p>
          </div>
        </div>
        <div className="flex gap-2">
          <BulkUploadModal entityType="warehouses" onSuccess={handleRefresh} />
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" className="gap-2" onClick={() => router.push(`/w/${tenantSlug}/inventory/warehouses/new`)}>
            <Plus className="h-4 w-4" />
            New Warehouse
          </Button>
        </div>
      </div>

      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Total Warehouses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWarehouses.length}</div>
            <p className="text-sm text-gray-600">Active locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Main Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {warehouses.filter((w: Warehouse) => !w.parent_warehouse).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sub Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {warehouses.filter((w: Warehouse) => w.parent_warehouse).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupWarehouses.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Warehouse List</TabsTrigger>
          <TabsTrigger value="hierarchy">
            <MapPin className="h-4 w-4 mr-2" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouses</CardTitle>
              <CardDescription>
                {activeWarehouses.length} active warehouses configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading warehouses...</div>
              ) : (
                <DataTable columns={warehouseColumns} data={activeWarehouses} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hierarchy View */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Hierarchy</CardTitle>
              <CardDescription>View warehouse structure and relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warehouses
                  .filter((w: Warehouse) => !w.parent_warehouse && !w.is_group)
                  .map((mainWarehouse: Warehouse) => (
                    <div key={mainWarehouse.name} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 font-semibold mb-3">
                        <MapPin className="h-4 w-4" />
                        {mainWarehouse.warehouse_name}
                      </div>

                      {/* Sub warehouses */}
                      {warehouses
                        .filter((w: Warehouse) => w.parent_warehouse === mainWarehouse.name)
                        .map((subWarehouse: Warehouse) => (
                          <div
                            key={subWarehouse.name}
                            className="ml-6 mb-2 p-2 bg-gray-50 rounded border-l-2 border-blue-300"
                          >
                            <p className="text-sm font-medium">{subWarehouse.warehouse_name}</p>
                            <p className="text-xs text-gray-600">{subWarehouse.warehouse_code}</p>
                          </div>
                        ))}
                    </div>
                  ))}

                {/* Warehouse Groups */}
                {groupWarehouses.length > 0 && (
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <h3 className="font-semibold mb-3">Warehouse Groups</h3>
                    <div className="space-y-2">
                      {groupWarehouses.map((group: Warehouse) => (
                        <div key={group.name} className="text-sm">
                          <p className="font-medium">{group.warehouse_name}</p>
                          <p className="text-xs text-gray-600">
                            {warehouses.filter((w: Warehouse) => w.parent_warehouse === group.name)
                              .length}{' '}
                            sub-locations
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Management Settings</CardTitle>
              <CardDescription>Global warehouse configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Default Warehouse for New Purchases</label>
                <select className="w-full mt-2 border rounded p-2">
                  <option>Select warehouse...</option>
                  {activeWarehouses.map((w: Warehouse) => (
                    <option key={w.name} value={w.name}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Default Warehouse for Sales</label>
                <select className="w-full mt-2 border rounded p-2">
                  <option>Select warehouse...</option>
                  {activeWarehouses.map((w: Warehouse) => (
                    <option key={w.name} value={w.name}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_valuation" defaultChecked />
                <label htmlFor="enable_valuation" className="text-sm font-medium">
                  Enable Warehouse Valuation
                </label>
              </div>

              <Button>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New/Edit Warehouse Modal */}
      {(showNewForm || selectedWarehouse) && (
        <Card className="fixed right-4 bottom-4 w-96 z-50 shadow-lg max-h-96 overflow-y-auto">
          <CardHeader>
            <CardTitle>{selectedWarehouse ? 'Edit Warehouse' : 'New Warehouse'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Warehouse Name *</label>
              <Input
                value={formData.warehouse_name}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_name: e.target.value })
                }
                placeholder="e.g., Main Store"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Warehouse Code</label>
              <Input
                value={formData.warehouse_code}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_code: e.target.value })
                }
                placeholder="e.g., WHM-001"
                className="mt-2"
                disabled={!!selectedWarehouse}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Parent Warehouse</label>
              <select
                value={formData.parent_warehouse}
                onChange={(e) =>
                  setFormData({ ...formData, parent_warehouse: e.target.value })
                }
                className="w-full mt-2 border rounded p-2"
              >
                <option value="">None (Main warehouse)</option>
                {groupWarehouses.map((w: Warehouse) => (
                  <option key={w.name} value={w.name}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full warehouse address"
                className="w-full mt-2 border rounded p-2 text-sm"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_group}
                onChange={(e) => setFormData({ ...formData, is_group: e.target.checked })}
                id="is_group"
              />
              <label htmlFor="is_group" className="text-sm font-medium">
                This is a warehouse group (contains sub-warehouses)
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={selectedWarehouse ? handleUpdateWarehouse : handleCreateWarehouse}
                className="flex-1"
              >
                {selectedWarehouse ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setSelectedWarehouse(null);
                  setFormData({
                    warehouse_name: '',
                    warehouse_code: '',
                    parent_warehouse: '',
                    is_group: false,
                    address: '',
                    incharge_name: '',
                    incharge_email: '',
                    capacity: '',
                  });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
