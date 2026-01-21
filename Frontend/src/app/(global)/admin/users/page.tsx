'use client';

import { Suspense, useEffect, useState } from 'react';
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
import {
    Users,
    ArrowLeft,
    Loader2,
    Search,
    UserPlus,
    CheckCircle2,
    AlertCircle,
    Shield,
    Crown,
    Briefcase,
} from 'lucide-react';

interface User {
    id: string;
    user_code: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    kyc_tier: string;
}

interface TenantUser {
    id: string;
    user_code: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    membership_status: string;
    legacy_role: string;
    rbac_roles: Array<{
        role_code: string;
        role_name: string;
        assigned_at: string;
    }>;
}

const ROLE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    OWNER: { icon: Crown, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', label: 'Owner' },
    ADMIN: { icon: Shield, color: 'text-red-400 bg-red-500/10 border-red-500/30', label: 'Admin' },
    MANAGER: { icon: Briefcase, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', label: 'Manager' },
    STAFF: { icon: Users, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', label: 'Staff' },
    VIEWER: { icon: Users, color: 'text-gray-400 bg-gray-500/10 border-gray-500/30', label: 'Viewer' },
};

function ManageUsersInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tenantId = searchParams?.get('tenant') ?? null;
    const tenantName = searchParams?.get('name') ?? null;

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedRole, setSelectedRole] = useState('STAFF');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [tenantId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all platform users
            const usersRes = await fetch('http://localhost:9000/iam/users');
            const usersData = await usersRes.json();
            setAllUsers(usersData.users || []);

            // Fetch tenant users if tenant is selected
            if (tenantId) {
                const tenantUsersRes = await fetch(`http://localhost:9000/iam/tenants/${tenantId}/users`);
                const tenantUsersData = await tenantUsersRes.json();
                setTenantUsers(tenantUsersData.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!selectedUser || !tenantId) return;

        setAdding(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`http://localhost:9000/iam/tenants/${tenantId}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_email: selectedUser,
                    role_code: selectedRole,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to add user');
            }

            const data = await response.json();
            const userCode = data?.user?.user_code ? ` (${data.user.user_code})` : '';
            setSuccess(`User added successfully with ${data.role} role${userCode}`);
            setSelectedUser('');
            fetchData(); // Refresh the lists
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setAdding(false);
        }
    };

    const availableUsers = allUsers.filter(user =>
        !tenantUsers.some(tu => tu.id === user.id)
    );

    const filteredMembers = tenantUsers.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.user_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8">
            <div className="max-w-6xl mx-auto">
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
                            <Users className="h-8 w-8 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                {tenantName || 'Workspace'} - User Management
                            </h1>
                            <p className="text-white/60">
                                Manage members and their roles for this workspace
                            </p>
                        </div>
                    </div>
                </div>

                {!tenantId ? (
                    <Card className="glass border-white/10">
                        <CardContent className="py-12 text-center">
                            <Users className="h-16 w-16 text-white/20 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-white mb-2">No Workspace Selected</h3>
                            <p className="text-white/60 mb-6">Please select a workspace to manage its users</p>
                            <Button
                                onClick={() => router.push('/admin/workspaces')}
                                className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                            >
                                Go to Workspaces
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Add User Form */}
                        <Card className="glass border-white/10 lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <UserPlus className="h-5 w-5" />
                                    Add Member
                                </CardTitle>
                                <CardDescription className="text-white/60">
                                    Assign a user to this workspace
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
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

                                <div>
                                    <Label htmlFor="user" className="text-white">Select User</Label>
                                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue placeholder="Choose a user..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableUsers.length === 0 ? (
                                                <div className="p-4 text-center text-white/40 text-sm">
                                                    All users are already members
                                                </div>
                                            ) : (
                                                availableUsers.map((user) => (
                                                    <SelectItem key={user.id} value={user.email}>
                                                        <div className="flex flex-col">
                                                            <span>{user.full_name || user.email}</span>
                                                            <span className="text-xs text-white/40">{user.user_code}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-white/40 mt-1">
                                        {availableUsers.length} available users
                                    </p>
                                </div>

                                <div>
                                    <Label htmlFor="role" className="text-white">Role</Label>
                                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADMIN">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4 text-red-400" />
                                                    <span>Admin</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="MANAGER">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase className="h-4 w-4 text-purple-400" />
                                                    <span>Manager</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="STAFF">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-blue-400" />
                                                    <span>Staff</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="VIEWER">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-gray-400" />
                                                    <span>Viewer</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleAddUser}
                                    disabled={!selectedUser || adding}
                                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
                                >
                                    {adding ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4 mr-2" />
                                            Add Member
                                        </>
                                    )}
                                </Button>

                                {/* Stats */}
                                <div className="pt-4 border-t border-white/10">
                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div className="p-3 rounded-lg bg-white/5">
                                            <div className="text-2xl font-bold text-white">{tenantUsers.length}</div>
                                            <div className="text-xs text-white/40">Members</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5">
                                            <div className="text-2xl font-bold text-cyan-400">{availableUsers.length}</div>
                                            <div className="text-xs text-white/40">Available</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Workspace Members List */}
                        <Card className="glass border-white/10 lg:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-white">Workspace Members</CardTitle>
                                        <CardDescription className="text-white/60">
                                            {tenantUsers.length} members in {tenantName}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4 text-white/40" />
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search members..."
                                            className="w-48 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="text-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-400 mb-4" />
                                        <p className="text-white/60">Loading members...</p>
                                    </div>
                                ) : tenantUsers.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Users className="h-16 w-16 text-white/20 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-white mb-2">No Members Yet</h3>
                                        <p className="text-white/60">Add your first member to get started</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredMembers.map((user) => (
                                            <div
                                                key={user.id}
                                                className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-white truncate">
                                                                {user.full_name || user.email}
                                                            </span>
                                                            {user.is_active && (
                                                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-white/60 truncate">{user.email}</p>
                                                        <p className="text-xs text-white/40 font-mono mt-1">{user.user_code}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {user.rbac_roles.length > 0 ? (
                                                            user.rbac_roles.map((role, idx) => {
                                                                const config = ROLE_CONFIG[role.role_code] || ROLE_CONFIG.VIEWER;
                                                                const Icon = config.icon;
                                                                return (
                                                                    <Badge
                                                                        key={idx}
                                                                        variant="outline"
                                                                        className={`${config.color} flex items-center gap-1.5 px-2.5 py-1`}
                                                                    >
                                                                        <Icon className="h-3.5 w-3.5" />
                                                                        <span className="font-medium">{role.role_name}</span>
                                                                    </Badge>
                                                                );
                                                            })
                                                        ) : (
                                                            <Badge variant="outline" className="bg-white/5 text-white/60 border-white/20">
                                                                Member
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ManageUsersPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-8">
                    <div className="max-w-6xl mx-auto text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-400 mb-4" />
                        <p className="text-white/60">Loading...</p>
                    </div>
                </div>
            }
        >
            <ManageUsersInner />
        </Suspense>
    );
}
