'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getItem, updateItem, deleteItem } from '@/lib/api/inventory';
import type { Item } from '@/lib/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Trash2 } from 'lucide-react';

export default function ItemDetailPage() {
    const router = useRouter();
    const params = useParams();
    const code =
        params && typeof (params as any).code === 'string'
            ? ((params as any).code as string)
            : null;

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        item_name: '',
        item_group: '',
        stock_uom: '',
        standard_rate: '',
        description: '',
    });

    useEffect(() => {
        if (code) {
            loadItem();
        }
    }, [code]);

    const loadItem = async () => {
        if (!code) return;
        try {
            setLoading(true);
            const data = await getItem(decodeURIComponent(code));
            setItem(data);
            setFormData({
                item_name: data.item_name,
                item_group: data.item_group,
                stock_uom: data.stock_uom,
                standard_rate: data.standard_rate?.toString() || '',
                description: data.description || '',
            });
        } catch (error) {
            console.error('Failed to load item:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!code) return;
        try {
            setSaving(true);
            await updateItem(code, {
                ...formData,
                standard_rate: formData.standard_rate ? parseFloat(formData.standard_rate) : undefined,
            });
            setEditing(false);
            loadItem();
        } catch (error) {
            console.error('Failed to update item:', error);
            alert('Failed to update item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!code) return;
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await deleteItem(code);
            router.push('/dashboard/inventory/items');
        } catch (error) {
            console.error('Failed to delete item:', error);
            alert('Failed to delete item');
        }
    };

    if (!code) return <div className="container mx-auto py-6">Invalid item code</div>;
    if (loading) return <div className="container mx-auto py-6">Loading...</div>;
    if (!item) return <div className="container mx-auto py-6">Item not found</div>;

    return (
        <div className="container mx-auto py-6 max-w-2xl">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">{item.item_code}</h1>
                <div className="flex gap-2">
                    {editing ? (
                        <>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="outline" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => setEditing(true)}>Edit</Button>
                            <Button variant="destructive" onClick={handleDelete}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>Item Name</Label>
                    {editing ? (
                        <Input
                            value={formData.item_name}
                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                        />
                    ) : (
                        <p className="text-lg">{item.item_name}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Item Group</Label>
                        {editing ? (
                            <Input
                                value={formData.item_group}
                                onChange={(e) => setFormData({ ...formData, item_group: e.target.value })}
                            />
                        ) : (
                            <p>{item.item_group}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Stock UOM</Label>
                        {editing ? (
                            <Input
                                value={formData.stock_uom}
                                onChange={(e) => setFormData({ ...formData, stock_uom: e.target.value })}
                            />
                        ) : (
                            <p>{item.stock_uom}</p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Standard Rate</Label>
                    {editing ? (
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.standard_rate}
                            onChange={(e) => setFormData({ ...formData, standard_rate: e.target.value })}
                        />
                    ) : (
                        <p>{item.standard_rate ? `$${item.standard_rate.toFixed(2)}` : '-'}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Description</Label>
                    {editing ? (
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                        />
                    ) : (
                        <p className="text-gray-600">{item.description || 'No description'}</p>
                    )}
                </div>

                <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500">
                        Status: <span className={item.disabled ? 'text-red-600' : 'text-green-600'}>
                            {item.disabled ? 'Disabled' : 'Active'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
