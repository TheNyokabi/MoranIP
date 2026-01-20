"use client";

import { useState } from 'react';
import { ERPModule } from '@/store/erp-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ModuleConfigProps {
    module: ERPModule;
    onSave: (config: any) => Promise<void>;
}

// Module-specific configuration schemas
const MODULE_CONFIG_SCHEMAS: Record<string, Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'textarea';
    placeholder?: string;
    description?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
}>> = {
    accounting: [
        {
            key: 'company_currency',
            label: 'Company Currency',
            type: 'select',
            description: 'Default currency for accounting',
            options: [
                { value: 'KES', label: 'Kenyan Shilling' },
                { value: 'USD', label: 'US Dollar' },
                { value: 'EUR', label: 'Euro' },
                { value: 'GBP', label: 'British Pound' },
                { value: 'INR', label: 'Indian Rupee' },
            ],
            required: true,
        },
        {
            key: 'fiscal_year_start',
            label: 'Fiscal Year Start (MM-DD)',
            type: 'text',
            placeholder: 'MM-DD',
            description: 'Start date of your fiscal year',
        },
        {
            key: 'enable_cash_management',
            label: 'Enable Cash Management',
            type: 'select',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
        },
    ],
    inventory: [
        {
            key: 'default_warehouse',
            label: 'Default Warehouse',
            type: 'text',
            placeholder: 'e.g., Main Warehouse',
            description: 'Default warehouse for inventory operations',
        },
        {
            key: 'enable_batch_tracking',
            label: 'Enable Batch Tracking',
            type: 'select',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
        },
        {
            key: 'enable_serial_numbers',
            label: 'Enable Serial Numbers',
            type: 'select',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
        },
    ],
    pos: [
        {
            key: 'default_pos_profile',
            label: 'Default POS Profile',
            type: 'text',
            placeholder: 'e.g., Main Counter',
            description: 'Default POS profile for transactions',
        },
        {
            key: 'receipt_printer_enabled',
            label: 'Receipt Printer',
            type: 'select',
            options: [
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' },
            ],
        },
        {
            key: 'default_customer_group',
            label: 'Default Customer Group',
            type: 'text',
            placeholder: 'e.g., Retail',
        },
    ],
    crm: [
        {
            key: 'enable_pipeline',
            label: 'Enable Sales Pipeline',
            type: 'select',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
        },
        {
            key: 'default_lead_source',
            label: 'Default Lead Source',
            type: 'text',
            placeholder: 'e.g., Direct, Referral, Website',
        },
    ],
    hr: [
        {
            key: 'company_code',
            label: 'Company Code',
            type: 'text',
            placeholder: 'e.g., COM-001',
            description: 'Unique company identifier for HR',
        },
        {
            key: 'default_department',
            label: 'Default Department',
            type: 'text',
            placeholder: 'e.g., Operations',
        },
        {
            key: 'enable_attendance',
            label: 'Enable Attendance Tracking',
            type: 'select',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
        },
    ],
};

export function ModuleConfig({ module, onSave }: ModuleConfigProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>(module.configuration || {});

    const schema = MODULE_CONFIG_SCHEMAS[module.code] || [];

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Convert string booleans to actual booleans
            const cleanConfig = Object.entries(formData).reduce((acc, [key, value]) => {
                if (value === 'true') {
                    acc[key] = true;
                } else if (value === 'false') {
                    acc[key] = false;
                } else {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            await onSave(cleanConfig);
            toast.success(`${module.name} configured successfully`);
            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to save configuration');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFieldChange = (key: string, value: any) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value
        }));
    };

    if (!module.is_enabled || schema.length === 0) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                >
                    <Settings2 className="h-4 w-4" />
                    Configure
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Configure {module.name}</DialogTitle>
                    <DialogDescription>
                        Update module settings and preferences
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {schema.map((field) => (
                        <div key={field.key} className="space-y-2">
                            <Label htmlFor={field.key}>
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                            </Label>

                            {field.type === 'text' && (
                                <Input
                                    id={field.key}
                                    placeholder={field.placeholder}
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                />
                            )}

                            {field.type === 'number' && (
                                <Input
                                    id={field.key}
                                    type="number"
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                />
                            )}

                            {field.type === 'textarea' && (
                                <Textarea
                                    id={field.key}
                                    placeholder={field.placeholder}
                                    value={formData[field.key] || ''}
                                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                    rows={3}
                                />
                            )}

                            {field.type === 'select' && (
                                <Select
                                    value={String(formData[field.key] || '')}
                                    onValueChange={(value) => handleFieldChange(field.key, value)}
                                >
                                    <SelectTrigger id={field.key}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {field.options?.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            {field.description && (
                                <p className="text-xs text-muted-foreground">
                                    {field.description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Configuration
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
