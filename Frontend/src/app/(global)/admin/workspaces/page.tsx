'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Building2,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Users,
    Package,
} from 'lucide-react';
import { ProvisioningStatus } from '@/components/provisioning/ProvisioningStatus';
import { useAuthStore } from '@/store/auth-store';

interface CreateWorkspaceFormData {
    name: string;
    category: string;
    description: string;
    country_code: string;
    admin_email: string;
    admin_name: string;
    admin_password: string;
    engine: string;
    provisioning_template: string;
    country_template: string;
}

export default function CreateWorkspacePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [createdWorkspace, setCreatedWorkspace] = useState<any>(null);

    const [formData, setFormData] = useState<CreateWorkspaceFormData>({
        name: '',
        category: 'Enterprises',
        description: '',
        country_code: 'KE',
        admin_email: '',
        admin_name: '',
        admin_password: '',
        engine: 'erpnext',
        provisioning_template: 'company_to_pos',
        country_template: 'Kenya',
    });

    useEffect(() => {
        if (formData.category === 'Enterprises') {
            setFormData((prev) => ({
                ...prev,
                engine: 'erpnext',
                provisioning_template: prev.provisioning_template || 'company_to_pos',
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            engine: 'odoo',
            provisioning_template: '',
        }));
    }, [formData.category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { iamApi } = await import('@/lib/api');
            const token = useAuthStore.getState().token;

            const data = await iamApi.createTenant({
                name: formData.name,
                category: formData.category,
                description: formData.description,
                country_code: formData.country_code,
                admin_email: formData.admin_email,
                admin_name: formData.admin_name,
                admin_password: formData.admin_password,
                engine: formData.engine as 'odoo' | 'erpnext',
            }, token || undefined);

            setCreatedWorkspace(data);
            setSuccess(true);

            // Set tenant context in auth store immediately
            const tenant = {
                id: data.tenant.id,
                name: data.tenant.name,
                code: data.tenant.code || data.tenant.id,
                engine: data.tenant.engine || 'erpnext',
            };

            // Add to available tenants if not already present and set as current
            const authState = useAuthStore.getState();
            const existingTenants = authState.availableTenants || [];
            const tenantExists = existingTenants.some(t => t.id === tenant.id);
            if (!tenantExists) {
                useAuthStore.setState({
                    availableTenants: [...existingTenants, tenant],
                });
            }
            // Always set as current tenant
            useAuthStore.getState().setCurrentTenant(tenant);

            // Only auto-redirect if provisioning is complete or not started
            // If provisioning is in progress, let user see the status
            if (!data.provisioning ||
                (data.provisioning && data.provisioning.status === 'COMPLETED') ||
                (data.provisioning && data.provisioning.status === 'NOT_PROVISIONED')) {
                setTimeout(() => {
                    // Redirect to tenant dashboard, not global dashboard
                    const tenantSlug = data.tenant.code || data.tenant.name.toLowerCase().replace(/\s+/g, '-');
                    router.push(`/w/${tenantSlug}`);
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof CreateWorkspaceFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    if (success && createdWorkspace) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8">
                <div className="max-w-2xl mx-auto">
                    <Card className="glass border-emerald-500/30">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                            </div>
                            <CardTitle className="text-2xl text-white">Workspace Created Successfully!</CardTitle>
                            <CardDescription className="text-white/60">
                                Your workspace is now active and ready to use
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <h3 className="text-sm font-medium text-white/60 mb-3">Workspace Details</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Name:</span>
                                        <span className="text-white font-medium">{createdWorkspace.tenant.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Code:</span>
                                        <span className="text-white font-mono text-sm">{createdWorkspace.tenant.code}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Category:</span>
                                        <span className="text-white">{createdWorkspace.tenant.category}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Engine:</span>
                                        <span className="text-white uppercase">{createdWorkspace.tenant.engine}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                <h3 className="text-sm font-medium text-white/60 mb-3">Admin User</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Email:</span>
                                        <span className="text-white">{createdWorkspace.admin.email}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">User Code:</span>
                                        <span className="text-white font-mono text-sm">{createdWorkspace.admin.code}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-white/50">Role:</span>
                                        <span className="text-emerald-400 font-medium">{createdWorkspace.admin.role}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Provisioning Status */}
                            {createdWorkspace.tenant.engine === 'erpnext' && (
                                <div className="mt-4">
                                    <ProvisioningStatus
                                        tenantId={createdWorkspace.tenant.id}
                                        startConfig={{
                                            include_demo_data: false,
                                            pos_store_enabled: true,
                                            country_template: formData.country_template,
                                            template: formData.provisioning_template || undefined,
                                        }}
                                        onComplete={() => {
                                            // Provisioning complete - update UI
                                            setCreatedWorkspace((prev: any) => ({
                                                ...prev,
                                                provisioning: { ...prev.provisioning, status: 'COMPLETED' }
                                            }));
                                        }}
                                        onError={(error) => {
                                            // Only log detailed error, don't spam console
                                            if (error && error !== 'Provisioning failed') {
                                                console.error('Provisioning error:', error);
                                            }
                                        }}
                                        autoRefresh={true}
                                        refreshInterval={2000}
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                <Button
                                    onClick={() => router.push(`/admin/users?tenant=${createdWorkspace.tenant.id}&name=${createdWorkspace.tenant.name}`)}
                                    variant="outline"
                                    className="flex-1 border-white/10 text-white hover:bg-white/5"
                                >
                                    <Users className="h-4 w-4 mr-2" />
                                    Manage Users
                                </Button>
                                <Button
                                    onClick={() => router.push(`/w/${createdWorkspace.tenant.code}/settings/modules`)}
                                    variant="outline"
                                    className="flex-1 border-white/10 text-white hover:bg-white/5"
                                >
                                    <Package className="h-4 w-4 mr-2" />
                                    Configure Modules
                                </Button>
                                <Button
                                    onClick={() => {
                                        // Set tenant context before navigating
                                        const tenant = {
                                            id: createdWorkspace.tenant.id,
                                            name: createdWorkspace.tenant.name,
                                            code: createdWorkspace.tenant.code || createdWorkspace.tenant.id,
                                            engine: createdWorkspace.tenant.engine || 'erpnext',
                                        };

                                        // Add to available tenants if not already present
                                        const authState = useAuthStore.getState();
                                        const existingTenants = authState.availableTenants || [];
                                        const tenantExists = existingTenants.some(t => t.id === tenant.id);
                                        if (!tenantExists) {
                                            useAuthStore.setState({
                                                availableTenants: [...existingTenants, tenant],
                                            });
                                        }
                                        // Always set as current tenant
                                        useAuthStore.getState().setCurrentTenant(tenant);

                                        // Navigate to tenant dashboard
                                        const tenantSlug = tenant.code || tenant.name.toLowerCase().replace(/\s+/g, '-');
                                        router.push(`/w/${tenantSlug}`);
                                    }}
                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                                >
                                    Go to Dashboard
                                </Button>
                            </div>

                            {(!createdWorkspace.provisioning ||
                                (createdWorkspace.provisioning && createdWorkspace.provisioning.status === 'COMPLETED')) && (
                                    <p className="text-center text-white/40 text-sm mt-4">
                                        Auto-redirecting in 3 seconds...
                                    </p>
                                )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="text-white/60 hover:text-white mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                            <Building2 className="h-8 w-8 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Create New Workspace</h1>
                            <p className="text-white/60">Onboard a new tenant to the platform</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <Card className="glass border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">Workspace Information</CardTitle>
                            <CardDescription className="text-white/60">
                                Enter the details for the new workspace
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-red-400 font-medium">Error</p>
                                        <p className="text-red-400/80 text-sm">{error}</p>
                                    </div>
                                </div>
                            )}

                            {/* Workspace Details */}
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="name" className="text-white">Workspace Name *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        placeholder="e.g., Durashield"
                                        required
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="category" className="text-white">Category *</Label>
                                        <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Chama">Chama</SelectItem>
                                                <SelectItem value="Sacco">Sacco</SelectItem>
                                                <SelectItem value="Enterprises">Enterprises</SelectItem>
                                                <SelectItem value="Subscription">Subscription</SelectItem>
                                                <SelectItem value="Collection">Collection</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="engine" className="text-white">ERP Engine *</Label>
                                        <Select
                                            value={formData.engine}
                                            onValueChange={(value) => handleChange('engine', value)}
                                            disabled={formData.category !== 'Enterprises'}
                                        >
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {formData.category === 'Enterprises' ? (
                                                    <SelectItem value="erpnext">ERPNext</SelectItem>
                                                ) : (
                                                    <SelectItem value="odoo">Odoo</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {formData.category !== 'Enterprises' && (
                                            <p className="text-xs text-white/40 mt-1">ERPNext is available for Enterprises only</p>
                                        )}
                                    </div>
                                </div>

                                {formData.engine === 'erpnext' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="provisioning_template" className="text-white">Provisioning Template *</Label>
                                            <Select
                                                value={formData.provisioning_template || 'company_to_pos'}
                                                onValueChange={(value) => handleChange('provisioning_template', value)}
                                            >
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="company_to_pos">Company to POS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="country_template" className="text-white">Chart Template *</Label>
                                            <Select
                                                value={formData.country_template}
                                                onValueChange={(value) => handleChange('country_template', value)}
                                            >
                                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Kenya">Kenya</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="description" className="text-white">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Brief description of the business..."
                                        rows={3}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="country_code" className="text-white">Country Code *</Label>
                                    <Input
                                        id="country_code"
                                        value={formData.country_code}
                                        onChange={(e) => handleChange('country_code', e.target.value.toUpperCase())}
                                        placeholder="KE"
                                        maxLength={2}
                                        required
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                    />
                                    <p className="text-xs text-white/40 mt-1">2-letter ISO country code</p>
                                </div>
                            </div>

                            {/* Admin User Details */}
                            <div className="pt-6 border-t border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-4">Administrator Account</h3>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="admin_name" className="text-white">Admin Full Name *</Label>
                                        <Input
                                            id="admin_name"
                                            value={formData.admin_name}
                                            onChange={(e) => handleChange('admin_name', e.target.value)}
                                            placeholder="John Doe"
                                            required
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="admin_email" className="text-white">Admin Email *</Label>
                                        <Input
                                            id="admin_email"
                                            type="email"
                                            value={formData.admin_email}
                                            onChange={(e) => handleChange('admin_email', e.target.value)}
                                            placeholder="admin@company.com"
                                            required
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="admin_password" className="text-white">Admin Password *</Label>
                                        <Input
                                            id="admin_password"
                                            type="password"
                                            value={formData.admin_password}
                                            onChange={(e) => handleChange('admin_password', e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                        />
                                        <p className="text-xs text-white/40 mt-1">Minimum 8 characters</p>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-6 flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                    className="flex-1 border-white/10 text-white hover:bg-white/5"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 hover:opacity-90"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Building2 className="h-4 w-4 mr-2" />
                                            Create Workspace
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </div>
    );
}
