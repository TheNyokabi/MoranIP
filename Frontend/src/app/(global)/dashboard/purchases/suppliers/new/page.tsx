'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupplier } from '@/lib/api/purchases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function NewSupplierPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        supplier_group: 'Raw Material',
        country: 'Kenya',
        currency: 'KES',
        tax_id: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await createSupplier({
                name: formData.name,
                supplier_group: formData.supplier_group,
                country: formData.country,
                currency: formData.currency || undefined,
                tax_id: formData.tax_id || undefined,
            });
            router.push('/dashboard/purchases/suppliers');
        } catch (error) {
            console.error('Failed to create supplier:', error);
            alert('Failed to create supplier. Please try again.');
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

            <h1 className="text-3xl font-bold mb-6">New Supplier</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="name">Supplier Name *</Label>
                    <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Supplier Name"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="supplier_group">Supplier Group *</Label>
                        <Input
                            id="supplier_group"
                            required
                            value={formData.supplier_group}
                            onChange={(e) => setFormData({ ...formData, supplier_group: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="country">Country *</Label>
                        <Input
                            id="country"
                            required
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                            id="currency"
                            value={formData.currency}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                            placeholder="KES"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tax_id">Tax ID</Label>
                        <Input
                            id="tax_id"
                            value={formData.tax_id}
                            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                            placeholder="Tax ID Number"
                        />
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Supplier'}
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
