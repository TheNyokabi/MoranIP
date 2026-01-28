'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Warehouse } from 'lucide-react';

interface TenantUser {
    id: string;
    user_code: string;
    email: string;
    full_name: string | null;
}

function WarehouseAccessInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tenantId = searchParams?.get('tenant') ?? null;
    const tenantName = searchParams?.get('name') ?? null;

    const [warehouses, setWarehouses] = useState<string[]>([]);
    const [roleWarehouses, setRoleWarehouses] = useState<string[]>([]);
    const [userWarehouses, setUserWarehouses] = useState<string[]>([]);
    const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [savingRole, setSavingRole] = useState(false);
    const [savingUser, setSavingUser] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const authHeaders = useMemo(() => {
        if (typeof window === 'undefined') {
            return {};
        }
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    useEffect(() => {
        if (!tenantId) return;
        fetchAllData();
    }, [tenantId]);

    useEffect(() => {
        if (!tenantId || !selectedUserId) {
            setUserWarehouses([]);
            return;
        }
        fetchUserAccess(selectedUserId);
    }, [tenantId, selectedUserId]);

    const fetchAllData = async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([fetchWarehouses(), fetchRoleAccess(), fetchTenantUsers()]);
        } catch (err) {
            console.error('Failed to load warehouse access data', err);
            setError('Failed to load warehouse access data');
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        if (!tenantId) return;
        const response = await fetch('http://localhost:9000/api/pos/warehouses', {
            headers: {
                ...authHeaders,
                'X-Tenant-ID': tenantId,
            } as Record<string, string>,
        });
        if (!response.ok) {
            throw new Error('Failed to load warehouses');
        }
        const data = await response.json();
        const names = (data.warehouses || [])
            .map((warehouse: any) => warehouse.name || warehouse.warehouse_name)
            .filter(Boolean);
        const unique = Array.from(new Set(names)).sort();
        setWarehouses(unique as string[]);
    };

    const fetchRoleAccess = async () => {
        if (!tenantId) return;
        const response = await fetch(
            `http://localhost:9000/api/pos/warehouse-access/roles?tenant_id=${tenantId}&role_code=CASHIER`,
            { headers: { ...authHeaders } as Record<string, string> }
        );
        if (!response.ok) {
            throw new Error('Failed to load role access');
        }
        const data = await response.json();
        setRoleWarehouses(data.warehouses || []);
    };

    const fetchUserAccess = async (userId: string) => {
        if (!tenantId) return;
        const response = await fetch(
            `http://localhost:9000/api/pos/warehouse-access/users?tenant_id=${tenantId}&user_id=${userId}`,
            { headers: { ...authHeaders } as Record<string, string> }
        );
        if (!response.ok) {
            throw new Error('Failed to load user access');
        }
        const data = await response.json();
        setUserWarehouses(data.warehouses || []);
    };

    const fetchTenantUsers = async () => {
        if (!tenantId) return;
        const response = await fetch(`http://localhost:9000/iam/tenants/${tenantId}/users`);
        if (!response.ok) {
            throw new Error('Failed to load tenant users');
        }
        const data = await response.json();
        setTenantUsers(data.users || []);
    };

    const toggleWarehouse = (warehouse: string, selected: string[], setSelected: (next: string[]) => void) => {
        if (selected.includes(warehouse)) {
            setSelected(selected.filter((item) => item !== warehouse));
        } else {
            setSelected([...selected, warehouse]);
        }
    };

    const handleSaveRoleAccess = async () => {
        if (!tenantId) return;
        setSavingRole(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch('http://localhost:9000/api/pos/warehouse-access/roles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                } as Record<string, string>,
                body: JSON.stringify({
                    role_code: 'CASHIER',
                    warehouses: roleWarehouses,
                    replace: true,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save role access');
            }
            setSuccess('Cashier warehouse access updated');
        } catch (err: any) {
            setError(err.message || 'Failed to save role access');
        } finally {
            setSavingRole(false);
        }
    };

    const handleSaveUserAccess = async () => {
        if (!tenantId || !selectedUserId) return;
        setSavingUser(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch('http://localhost:9000/api/pos/warehouse-access/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                } as Record<string, string>,
                body: JSON.stringify({
                    user_id: selectedUserId,
                    warehouses: userWarehouses,
                    replace: true,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save user access');
            }
            setSuccess('User warehouse access updated');
        } catch (err: any) {
            setError(err.message || 'Failed to save user access');
        } finally {
            setSavingUser(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8">
            <div className="max-w-6xl mx-auto">
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
                            <Warehouse className="h-8 w-8 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                {tenantName || 'Workspace'} - Warehouse Access
                            </h1>
                            <p className="text-white/60">
                                Control which warehouses cashiers can use at session start
                            </p>
                        </div>
                    </div>
                </div>

                {!tenantId ? (
                    <Card className="glass border-white/10">
                        <CardContent className="py-12 text-center">
                            <Warehouse className="h-16 w-16 text-white/20 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No Workspace Selected</h3>
                            <p className="text-white/60 mb-6">Please select a workspace to configure access</p>
                            <Button
                                onClick={() => router.push('/admin/workspaces')}
                                className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                            >
                                Go to Workspaces
                            </Button>
                        </CardContent>
                    </Card>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-emerald-400 text-sm">{success}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="glass border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white">Role Access (Cashier)</CardTitle>
                                    <CardDescription className="text-white/60">
                                        Warehouses available to all cashiers in this workspace
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="bg-white/10 text-white/70 border-white/10">
                                            Role: CASHIER
                                        </Badge>
                                    </div>
                                    <div className="space-y-2 max-h-80 overflow-auto pr-2">
                                        {warehouses.length === 0 ? (
                                            <p className="text-white/50 text-sm">No warehouses found</p>
                                        ) : (
                                            warehouses.map((warehouse) => (
                                                <label
                                                    key={warehouse}
                                                    className="flex items-center gap-2 text-white/80 text-sm"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-white/20 bg-white/5"
                                                        checked={roleWarehouses.includes(warehouse)}
                                                        onChange={() =>
                                                            toggleWarehouse(warehouse, roleWarehouses, setRoleWarehouses)
                                                        }
                                                    />
                                                    <span>{warehouse}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleSaveRoleAccess}
                                        disabled={savingRole}
                                        className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                                    >
                                        {savingRole ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Cashier Access'
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="glass border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white">User Overrides</CardTitle>
                                    <CardDescription className="text-white/60">
                                        If set, user-specific access overrides the role mapping
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="user" className="text-white">Select User</Label>
                                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                <SelectValue placeholder="Choose a user..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tenantUsers.length === 0 ? (
                                                    <div className="p-4 text-center text-white/40 text-sm">
                                                        No users found
                                                    </div>
                                                ) : (
                                                    tenantUsers.map((user) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            <div className="flex flex-col">
                                                                <span>{user.full_name || user.email}</span>
                                                                <span className="text-xs text-white/40">
                                                                    {user.user_code}
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedUserId && (
                                        <>
                                            <div className="space-y-2 max-h-80 overflow-auto pr-2">
                                                {warehouses.length === 0 ? (
                                                    <p className="text-white/50 text-sm">No warehouses found</p>
                                                ) : (
                                                    warehouses.map((warehouse) => (
                                                        <label
                                                            key={warehouse}
                                                            className="flex items-center gap-2 text-white/80 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-white/20 bg-white/5"
                                                                checked={userWarehouses.includes(warehouse)}
                                                                onChange={() =>
                                                                    toggleWarehouse(warehouse, userWarehouses, setUserWarehouses)
                                                                }
                                                            />
                                                            <span>{warehouse}</span>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                            <Button
                                                onClick={handleSaveUserAccess}
                                                disabled={savingUser}
                                                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                                            >
                                                {savingUser ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    'Save User Overrides'
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WarehouseAccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
            <WarehouseAccessInner />
        </Suspense>
    );
}
