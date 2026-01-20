'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createItem } from '@/lib/api/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';

export default function NewItemPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        item_code: '',
        item_name: '',
        item_group: 'Products',
        stock_uom: 'Nos',
        standard_rate: '',
        description: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await createItem({
                ...formData,
                standard_rate: formData.standard_rate ? parseFloat(formData.standard_rate) : undefined,
            });
            router.push('/dashboard/inventory/items');
        } catch (error) {
            console.error('Failed to create item:', error);
            alert('Failed to create item. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-6 max-w-2xl">
            <Button
                variant="ghost"
                onClick={() => router.back()}
                className="mb-4"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            <h1 className="text-3xl font-bold mb-6">New Item</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="item_code">Item Code *</Label>
                    <Input
                        id="item_code"
                        required
                        value={formData.item_code}
                        onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                        placeholder="ITEM-001"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="item_name">Item Name *</Label>
                    <Input
                        id="item_name"
                        required
                        value={formData.item_name}
                        onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                        placeholder="Product Name"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="item_group">Item Group *</Label>
                        <Input
                            id="item_group"
                            required
                            value={formData.item_group}
                            onChange={(e) => setFormData({ ...formData, item_group: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stock_uom">Stock UOM *</Label>
                        <Input
                            id="stock_uom"
                            required
                            value={formData.stock_uom}
                            onChange={(e) => setFormData({ ...formData, stock_uom: e.target.value })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="standard_rate">Standard Rate</Label>
                    <Input
                        id="standard_rate"
                        type="number"
                        step="0.01"
                        value={formData.standard_rate}
                        onChange={(e) => setFormData({ ...formData, standard_rate: e.target.value })}
                        placeholder="0.00"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Item description..."
                        rows={4}
                    />
                </div>

                <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Item'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
