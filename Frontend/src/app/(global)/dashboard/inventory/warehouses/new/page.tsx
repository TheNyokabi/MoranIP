'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWarehouse } from '@/lib/api/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function NewWarehousePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        warehouse_name: '',
        company: '',
        warehouse_type: '',
        parent_warehouse: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await createWarehouse({
                warehouse_name: formData.warehouse_name,
                company: formData.company,
                warehouse_type: formData.warehouse_type || undefined,
                parent_warehouse: formData.parent_warehouse || undefined,
            });
            router.push('/dashboard/inventory/warehouses');
        } catch (error) {
            console.error('Failed to create warehouse:', error);
            alert('Failed to create warehouse. Please try again.');
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

            <h1 className="text-3xl font-bold mb-6">New Warehouse</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="warehouse_name">Warehouse Name *</Label>
                    <Input
                        id="warehouse_name"
                        required
                        value={formData.warehouse_name}
                        onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                        placeholder="Main Warehouse"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="company">Company *</Label>
                    <Input
                        id="company"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Company Name"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="warehouse_type">Warehouse Type</Label>
                    <Input
                        id="warehouse_type"
                        value={formData.warehouse_type}
                        onChange={(e) => setFormData({ ...formData, warehouse_type: e.target.value })}
                        placeholder="e.g., Transit, Finished Goods"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="parent_warehouse">Parent Warehouse</Label>
                    <Input
                        id="parent_warehouse"
                        value={formData.parent_warehouse}
                        onChange={(e) => setFormData({ ...formData, parent_warehouse: e.target.value })}
                        placeholder="Parent warehouse name"
                    />
                </div>

                <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Warehouse'}
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
