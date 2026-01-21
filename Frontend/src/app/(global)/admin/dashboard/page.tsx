'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { iamApi, TenantWithMetadata } from '@/lib/api'
import { Building2, Users, Search, Plus, Loader2, Shield, AlertCircle, Eye, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

export default function AdminDashboard() {
    const router = useRouter()
    const { token, user, isSuperAdmin } = useAuthStore()
    const [tenants, setTenants] = useState<TenantWithMetadata[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [engineFilter, setEngineFilter] = useState<string>('all')

    useEffect(() => {
        // Check if user is super admin
        if (!isSuperAdmin()) {
            router.push('/dashboard')
            return
        }

        loadTenants()
    }, [])

    const loadTenants = async () => {
        if (!token) return

        setLoading(true)
        setError(null)
        try {
            const response = await iamApi.listAllTenants(
                token,
                0,
                100,
                statusFilter === 'all' ? undefined : statusFilter,
                engineFilter === 'all' ? undefined : engineFilter
            )
            setTenants(response.tenants)
            setTotal(response.total)
        } catch (err: any) {
            setError(err.detail || 'Failed to load tenants')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (token) {
            loadTenants()
        }
    }, [statusFilter, engineFilter])

    const filteredTenants = tenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.tenant_code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (!isSuperAdmin()) {
        return null
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
                <div className="container mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                                <Shield className="h-8 w-8 text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                                <p className="text-white/60">Platform Administration & Tenant Management</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => router.push('/admin/workspaces')}
                            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 hover:opacity-90"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Workspace
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-cyan-500/20">
                                <Building2 className="h-6 w-6 text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-white/60 text-sm">Total Workspaces</p>
                                <p className="text-3xl font-bold text-white">{total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-500/20">
                                <Users className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-white/60 text-sm">Total Members</p>
                                <p className="text-3xl font-bold text-white">
                                    {tenants.reduce((sum, t) => sum + t.member_count, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="glass rounded-2xl p-6 border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-purple-500/20">
                                <Shield className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-white/60 text-sm">Active Workspaces</p>
                                <p className="text-3xl font-bold text-white">
                                    {tenants.filter(t => t.status === 'ACTIVE').length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="glass rounded-2xl p-6 border border-white/10 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                <Input
                                    placeholder="Search tenants..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={engineFilter} onValueChange={setEngineFilter}>
                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                <SelectValue placeholder="Filter by engine" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Engines</SelectItem>
                                <SelectItem value="erpnext">ERPNext</SelectItem>
                                <SelectItem value="odoo">Odoo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Tenants Table */}
                <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                                <p className="text-red-400">{error}</p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableHead className="text-white/70">Name</TableHead>
                                    <TableHead className="text-white/70">Code</TableHead>
                                    <TableHead className="text-white/70">Engine</TableHead>
                                    <TableHead className="text-white/70">Status</TableHead>
                                    <TableHead className="text-white/70">Owner</TableHead>
                                    <TableHead className="text-white/70">Members</TableHead>
                                    <TableHead className="text-white/70">Created</TableHead>
                                    <TableHead className="text-white/70">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTenants.map((tenant) => (
                                    <TableRow key={tenant.id} className="border-white/10 hover:bg-white/5">
                                        <TableCell className="font-medium text-white">{tenant.name}</TableCell>
                                        <TableCell className="font-mono text-sm text-white/70">
                                            {tenant.tenant_code}
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-300 uppercase">
                                                {tenant.engine}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${tenant.status === 'ACTIVE'
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'bg-red-500/20 text-red-300'
                                                }`}>
                                                {tenant.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-white/70">
                                            {tenant.owner ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{tenant.owner.full_name || 'N/A'}</span>
                                                    <span className="text-xs text-white/50">{tenant.owner.email}</span>
                                                </div>
                                            ) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-white/70">{tenant.member_count}</TableCell>
                                        <TableCell className="text-white/70 text-sm">
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => router.push(`/w/${tenant.tenant_code}`)}
                                                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => router.push(`/admin/users?tenant=${tenant.id}&name=${tenant.name}`)}
                                                    className="text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
                                                >
                                                    <Users className="h-4 w-4 mr-1" />
                                                    Users
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => router.push(`/admin/warehouse-access?tenant=${tenant.id}&name=${tenant.name}`)}
                                                    className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                                                >
                                                    <Warehouse className="h-4 w-4 mr-1" />
                                                    Warehouses
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {!loading && !error && filteredTenants.length === 0 && (
                        <div className="text-center py-12">
                            <Building2 className="h-12 w-12 text-white/20 mx-auto mb-4" />
                            <p className="text-white/60">No tenants found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
