'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Tag, Package, Download, ArrowLeft } from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { BulkUploadModal } from '@/components/shared/bulk-upload-modal';

interface Item {
  name: string;
  item_name: string;
  item_code: string;
  item_group: string;
  uom: string;
  standard_rate: number;
  disabled: boolean;
  has_variants: boolean;
  stock_qty: number;
}

export default function ItemMasterPage() {
  const params = useParams() as any;
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const tenantId = tenantSlug;
  
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [filterGroup, setFilterGroup] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const handleRefresh = () => {
    fetchItems();
  };
  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
    item_group: 'Raw Materials',
    uom: 'Nos',
    standard_rate: 0,
    description: '',
    has_variants: false,
  });

  useEffect(() => {
    if (tenantId) {
      fetchItems();
    }
  }, [tenantId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/items`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || data || []);
      }
    } catch (err) {
      setError('Failed to load items');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    try {
      const payload = {
        item_name: formData.item_name,
        item_code: formData.item_code,
        item_group: formData.item_group,
        uom: formData.uom,
        standard_rate: parseFloat(formData.standard_rate.toString()),
        description: formData.description,
        has_variants: formData.has_variants,
      };

      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/items`,
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
          item_name: '',
          item_code: '',
          item_group: 'Raw Materials',
          uom: 'Nos',
          standard_rate: 0,
          description: '',
          has_variants: false,
        });
        setShowNewForm(false);
        await fetchItems();
      }
    } catch (err) {
      setError('Failed to create item');
      console.error(err);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/inventory/items/${selectedItem.item_code}`,
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
        setSelectedItem(null);
        setFormData({
          item_name: '',
          item_code: '',
          item_group: 'Raw Materials',
          uom: 'Nos',
          standard_rate: 0,
          description: '',
          has_variants: false,
        });
        await fetchItems();
      }
    } catch (err) {
      setError('Failed to update item');
      console.error(err);
    }
  };

  const itemColumns = [
    { key: 'item_code', label: 'Item Code' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'item_group', label: 'Category' },
    { key: 'uom', label: 'UOM' },
    { key: 'standard_rate', label: 'Price' },
    { key: 'stock_qty', label: 'Stock' },
  ];

  const itemGroups = [
    'Raw Materials',
    'Finished Goods',
    'Semi-finished Goods',
    'Consumables',
    'Trading',
    'Services',
  ];

  const filteredItems = filterGroup
    ? items.filter((item: Item) => item.item_group === filterGroup)
    : items;

  const totalValue = items.reduce(
    (sum: number, item: Item) => sum + (item.standard_rate * item.stock_qty || 0),
    0
  );

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
            <h1 className="text-3xl font-bold tracking-tight">Item Master</h1>
            <p className="text-muted-foreground">Manage your product and service catalog</p>
          </div>
        </div>
        <div className="flex gap-2">
          <BulkUploadModal entityType="inventory" onSuccess={handleRefresh} />
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" className="gap-2" onClick={() => router.push(`/w/${tenantSlug}/inventory/items/new`)}>
            <Plus className="h-4 w-4" />
            New Item
          </Button>
        </div>
      </div>

      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" /> Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-sm text-gray-600">In inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Raw Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.filter((item: Item) => item.item_group === 'Raw Materials').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Finished Goods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {items.filter((item: Item) => item.item_group === 'Finished Goods').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalValue.toFixed(2)}</div>
            <p className="text-sm text-gray-600">Total stock value</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Item List</TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterGroup === '' ? 'default' : 'outline'}
                  onClick={() => setFilterGroup('')}
                >
                  All
                </Button>
                {itemGroups.map((group) => (
                  <Button
                    key={group}
                    size="sm"
                    variant={filterGroup === group ? 'default' : 'outline'}
                    onClick={() => setFilterGroup(group)}
                  >
                    {group}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {filteredItems.length} items found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading items...</div>
              ) : (
                <DataTable columns={itemColumns} data={filteredItems} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories View */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Item Categories</CardTitle>
              <CardDescription>Items organized by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {itemGroups.map((group) => {
                  const groupItems = items.filter((item: Item) => item.item_group === group);
                  const groupValue = groupItems.reduce(
                    (sum: number, item: Item) => sum + (item.standard_rate * item.stock_qty || 0),
                    0
                  );

                  return (
                    <div key={group} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold">{group}</h3>
                        <div className="text-sm text-gray-600">
                          {groupItems.length} items | Value: {groupValue.toFixed(2)}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {groupItems.map((item: Item) => (
                          <div
                            key={item.name}
                            className="text-sm p-2 bg-gray-50 rounded flex justify-between"
                          >
                            <span>{item.item_code} - {item.item_name}</span>
                            <span className="font-medium">{item.standard_rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New/Edit Item Modal */}
      {(showNewForm || selectedItem) && (
        <Card className="fixed right-4 bottom-4 w-96 z-50 shadow-lg max-h-96 overflow-y-auto">
          <CardHeader>
            <CardTitle>{selectedItem ? 'Edit Item' : 'New Item'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Item Code *</label>
              <Input
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                placeholder="e.g., ITEM-001"
                className="mt-2"
                disabled={!!selectedItem}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                placeholder="e.g., Premium Widget"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Category *</label>
              <select
                value={formData.item_group}
                onChange={(e) => setFormData({ ...formData, item_group: e.target.value })}
                className="w-full mt-2 border rounded p-2"
              >
                {itemGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">UOM *</label>
              <Input
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                placeholder="e.g., Nos, Kg, L"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Standard Rate</label>
              <Input
                type="number"
                value={formData.standard_rate}
                onChange={(e) => setFormData({ ...formData, standard_rate: parseFloat(e.target.value) })}
                placeholder="0.00"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Item description..."
                className="w-full mt-2 border rounded p-2 text-sm"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.has_variants}
                onChange={(e) => setFormData({ ...formData, has_variants: e.target.checked })}
                id="has_variants"
              />
              <label htmlFor="has_variants" className="text-sm font-medium">
                This item has variants
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={selectedItem ? handleUpdateItem : handleCreateItem}
                className="flex-1"
              >
                {selectedItem ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setSelectedItem(null);
                  setFormData({
                    item_name: '',
                    item_code: '',
                    item_group: 'Raw Materials',
                    uom: 'Nos',
                    standard_rate: 0,
                    description: '',
                    has_variants: false,
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
