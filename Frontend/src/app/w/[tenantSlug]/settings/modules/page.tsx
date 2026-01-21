"use client";

import { useEffect, useState } from 'react';
import { useERPStore, ERPModule } from '@/store/erp-store';
import { useTenantStore } from '@/store/tenant-store';
import { ModuleConfig } from '@/components/onboarding/ModuleConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingCart, Calculator, Users, Factory, UserCheck, Briefcase, ShoppingBag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ICON_MAP: Record<string, any> = {
    package: Package,
    'shopping-cart': ShoppingCart,
    calculator: Calculator,
    users: Users,
    factory: Factory,
    'user-check': UserCheck,
    briefcase: Briefcase,
    'shopping-bag': ShoppingBag,
};

export default function ERPModulesPage({ params }: { params: { tenantSlug: string } }) {
    const { currentTenant, selectTenantBySlug } = useTenantStore();
    const { modules, isLoading, fetchModules, enableModule, disableModule, configureModule, setupERP } = useERPStore();
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [togglingModule, setTogglingModule] = useState<string | null>(null);

    // Ensure tenant is selected from URL slug
    useEffect(() => {
        if (!currentTenant && params.tenantSlug) {
            selectTenantBySlug(params.tenantSlug);
        }
    }, [currentTenant, params.tenantSlug, selectTenantBySlug]);

    useEffect(() => {
        if (currentTenant?.id) {
            // First try to fetch modules, if 400 (not setup), try setup then fetch
            fetchModules(currentTenant.id).catch(async (err) => {
                // Simple retry logic or check if error indicates missing setup
                // Ideally the store handles this, but for now we can rely on fetchModules
            });
        }
    }, [currentTenant?.id, fetchModules]);

    const handleToggleModule = async (module: ERPModule) => {
        if (!currentTenant?.id) return;

        setTogglingModule(module.code);
        try {
            if (module.is_enabled) {
                await disableModule(currentTenant.id, module.code);
                toast.success(`${module.name} disabled`);
            } else {
                await enableModule(currentTenant.id, module.code);
                toast.success(`${module.name} enabled`);
            }
        } catch (error) {
            toast.error(`Failed to ${module.is_enabled ? 'disable' : 'enable'} module`);
        } finally {
            setTogglingModule(null);
        }
    };

    const handleConfigureModule = async (moduleCode: string, config: any) => {
        if (!currentTenant?.id) return;
        try {
            await configureModule(currentTenant.id, moduleCode, config);
        } catch (error) {
            throw error;
        }
    };

    const ensureSetup = async () => {
        if (!currentTenant?.id) return;
        setIsSettingUp(true);
        try {
            await setupERP(currentTenant.id);
            await fetchModules(currentTenant.id);
            toast.success("ERP System Initialized");
        } catch (error) {
            toast.error("Failed to initialize ERP system");
        } finally {
            setIsSettingUp(false);
        }
    };

    if (!currentTenant) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isLoading && modules.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Group modules by category
    const groupedModules = modules.reduce((acc, module) => {
        if (!acc[module.category]) acc[module.category] = [];
        acc[module.category].push(module);
        return acc;
    }, {} as Record<string, ERPModule[]>);

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">ERP Modules</h1>
                    <p className="text-muted-foreground">
                        Manage active ERP modules for your workspace.
                    </p>
                </div>
                {modules.length === 0 && !isLoading && (
                    <Button onClick={ensureSetup} disabled={isSettingUp}>
                        {isSettingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Initialize ERP System
                    </Button>
                )}
            </div>

            {Object.entries(groupedModules).map(([category, categoryModules]) => (
                <div key={category} className="space-y-4">
                    <h2 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
                        <span className="h-px flex-1 bg-border/60"></span>
                        {category}
                        <span className="h-px flex-1 bg-border/60"></span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryModules.map((module) => {
                            const Icon = ICON_MAP[module.icon] || Package;
                            return (
                                <Card key={module.code} className={module.is_enabled ? "border-primary/50 bg-primary/5" : ""}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-base font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-2 rounded-md ${module.is_enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                {module.name}
                                            </div>
                                        </CardTitle>
                                        <Switch
                                            checked={module.is_enabled}
                                            onCheckedChange={() => handleToggleModule(module)}
                                            disabled={togglingModule === module.code}
                                        />
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="min-h-[40px]">
                                            {module.description}
                                        </CardDescription>
                                        {module.is_enabled && (
                                            <div className="mt-4 flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    Active
                                                </Badge>
                                                <ModuleConfig
                                                    module={module}
                                                    onSave={(config) => handleConfigureModule(module.code, config)}
                                                />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ))}

            {modules.length === 0 && !isLoading && (
                <div className="text-center p-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground mb-4">ERP System needs to be initialized first.</p>
                    <Button onClick={ensureSetup} disabled={isSettingUp}>
                        {isSettingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Initialize Now
                    </Button>
                </div>
            )}
        </div>
    );
}
