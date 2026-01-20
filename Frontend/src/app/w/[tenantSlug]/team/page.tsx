"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuthStore } from "@/store/auth-store"
import { iamApi, TenantUser, InviteUserRequest } from "@/lib/api"
import { findTenantBySlug, useTenantStore } from "@/store/tenant-store"
import { BulkUploadModal } from "@/components/shared/bulk-upload-modal"
import {
    Users,
    UserPlus,
    Crown,
    Shield,
    Search,
    MoreHorizontal,
    Wallet,
    TrendingUp,
    ShoppingCart,
    Check,
    X,
    Loader2,
    Mail,
    AlertCircle
} from "lucide-react"

// Role badge config
const ROLE_CONFIG: Record<string, { icon: typeof Shield; color: string; bgColor: string; label: string }> = {
    ADMIN: { icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: 'Admin' },
    MANAGER: { icon: Shield, color: 'text-purple-500', bgColor: 'bg-purple-500/10', label: 'Manager' },
    CASHIER: { icon: Users, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Cashier' },
    VIEWER: { icon: Users, color: 'text-gray-500', bgColor: 'bg-gray-500/10', label: 'Viewer' },
    MEMBER: { icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: 'Member' },
};

// Team member type for display
interface TeamMember {
    id: string
    name: string
    email: string
    role: string
    status: 'ACTIVE' | 'INVITED' | 'PENDING' | 'SUSPENDED'
    userCode: string
    stats?: {
        totalSales: number
        transactions: number
        commission: number
        cashAtHand: number
    }
}

// Format currency
function formatCurrency(amount: number): string {
    if (amount >= 1000000) {
        return `KES ${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
        return `KES ${(amount / 1000).toFixed(1)}K`
    }
    return `KES ${amount.toFixed(0)}`
}

export default function TeamPage() {
    const params = useParams()
    const tenantSlug = params?.tenantSlug as string
    const { token } = useAuthStore()
    const { availableTenants } = useTenantStore()
    const tenant = findTenantBySlug(tenantSlug, availableTenants)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [members, setMembers] = useState<TeamMember[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteName, setInviteName] = useState('')
    const [inviteRole, setInviteRole] = useState<'CASHIER' | 'MANAGER' | 'ADMIN' | 'VIEWER'>('CASHIER')
    const [inviting, setInviting] = useState(false)
    const [inviteSuccess, setInviteSuccess] = useState(false)
    const [inviteError, setInviteError] = useState<string | null>(null)

    // Load team members from API
    useEffect(() => {
        async function loadTeam() {
            if (!token || !tenant) {
                setLoading(false)
                return
            }

            try {
                setError(null)
                const response = await iamApi.getTenantUsers(tenant.id, token)

                // Transform API response to TeamMember format
                const teamMembers: TeamMember[] = response.users.map((user: TenantUser) => ({
                    id: user.id,
                    name: user.full_name || user.email.split('@')[0],
                    email: user.email,
                    role: user.legacy_role || 'MEMBER',
                    status: user.membership_status as TeamMember['status'],
                    userCode: user.user_code,
                    // Stats would come from a separate API in production
                    stats: user.legacy_role === 'CASHIER' ? {
                        totalSales: 0,
                        transactions: 0,
                        commission: 0,
                        cashAtHand: 0
                    } : undefined
                }))

                setMembers(teamMembers)
            } catch (err) {
                console.error('Failed to load team:', err)
                setError('Failed to load team members')
            } finally {
                setLoading(false)
            }
        }
        loadTeam()
    }, [token, tenant])

    // Handle invite using real API
    const handleInvite = async () => {
        if (!inviteEmail || !token || !tenant) return

        setInviting(true)
        setInviteError(null)

        try {
            const response = await iamApi.inviteUser(tenant.id, {
                email: inviteEmail,
                full_name: inviteName || undefined,
                role: inviteRole
            }, token)

            setInviteSuccess(true)

            // Add new member to list
            setMembers(prev => [...prev, {
                id: response.user_code,
                name: inviteName || inviteEmail.split('@')[0],
                email: inviteEmail,
                role: inviteRole,
                status: 'INVITED',
                userCode: response.user_code
            }])

            // Reset form after delay
            setTimeout(() => {
                setShowInviteModal(false)
                setInviteEmail('')
                setInviteName('')
                setInviteRole('CASHIER')
                setInviteSuccess(false)
            }, 1500)
        } catch (err: unknown) {
            console.error('Failed to invite:', err)
            const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation'
            setInviteError(errorMessage)
        } finally {
            setInviting(false)
        }
    }

    // Filter members
    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Calculate totals
    const totalCashiers = members.filter(m => m.role === 'CASHIER').length
    const activeCashiers = members.filter(m => m.role === 'CASHIER' && m.status === 'ACTIVE').length
    const totalCashAtHand = members.reduce((sum, m) => sum + (m.stats?.cashAtHand || 0), 0)
    const totalCommissions = members.reduce((sum, m) => sum + (m.stats?.commission || 0), 0)
    const pendingInvites = members.filter(m => m.status === 'INVITED').length

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-lg font-semibold mb-2">Error Loading Team</h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Team Management</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage your team members and their access
                    </p>
                </div>
                <div className="flex gap-2">
                    <BulkUploadModal entityType="users" onSuccess={() => window.location.reload()} />
                    <Button onClick={() => setShowInviteModal(true)} className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Invite Member
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{members.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {activeCashiers} active cashiers{pendingInvites > 0 && `, ${pendingInvites} pending`}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cash at Hand</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalCashAtHand)}</div>
                        <p className="text-xs text-muted-foreground">Across all cashiers</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalCommissions)}</div>
                        <p className="text-xs text-muted-foreground">Earned today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{members.filter(m => m.status === 'INVITED').length}</div>
                        <p className="text-xs text-muted-foreground">Awaiting acceptance</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Members List */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>View and manage team member access and performance</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-48" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredMembers.map((member) => {
                                const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.CASHIER
                                const RoleIcon = roleConfig.icon

                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{member.name}</span>
                                                <Badge
                                                    variant="outline"
                                                    className={`${roleConfig.bgColor} ${roleConfig.color} border-0`}
                                                >
                                                    <RoleIcon className="h-3 w-3 mr-1" />
                                                    {roleConfig.label}
                                                </Badge>
                                                {member.status === 'INVITED' && (
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-0">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                                        </div>

                                        {/* Stats for cashiers */}
                                        {member.role === 'CASHIER' && member.stats && member.status === 'ACTIVE' && (
                                            <div className="hidden md:flex items-center gap-6 text-sm">
                                                <div className="text-center">
                                                    <div className="font-medium">{formatCurrency(member.stats.totalSales)}</div>
                                                    <div className="text-xs text-muted-foreground">Sales</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-medium">{member.stats.transactions}</div>
                                                    <div className="text-xs text-muted-foreground">Txns</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-medium text-emerald-600">{formatCurrency(member.stats.commission)}</div>
                                                    <div className="text-xs text-muted-foreground">Commission</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="font-medium text-primary">{formatCurrency(member.stats.cashAtHand)}</div>
                                                    <div className="text-xs text-muted-foreground">Cash</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>Invite Team Member</CardTitle>
                            <CardDescription>Send an invitation to join your workspace</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {inviteSuccess ? (
                                <div className="text-center py-8">
                                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                        <Check className="h-6 w-6 text-emerald-500" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Invitation Sent!</h3>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        An email has been sent to {inviteEmail}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email Address</label>
                                        <Input
                                            type="email"
                                            placeholder="colleague@company.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Full Name (optional)</label>
                                        <Input
                                            type="text"
                                            placeholder="John Doe"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Role</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['CASHIER', 'MANAGER'].map(role => {
                                                const config = ROLE_CONFIG[role]
                                                const Icon = config.icon
                                                return (
                                                    <button
                                                        key={role}
                                                        onClick={() => setInviteRole(role as 'CASHIER' | 'MANAGER')}
                                                        className={`p-3 rounded-lg border text-left transition-colors ${inviteRole === role
                                                                ? 'border-primary bg-primary/5'
                                                                : 'border-muted hover:bg-muted/50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={`h-4 w-4 ${config.color}`} />
                                                            <span className="font-medium">{config.label}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {role === 'CASHIER' ? 'Can process sales' : 'Can manage team & inventory'}
                                                        </p>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {inviteError && (
                                        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4" />
                                            {inviteError}
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setShowInviteModal(false)
                                                setInviteError(null)
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={handleInvite}
                                            disabled={!inviteEmail || inviting}
                                        >
                                            {inviting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Mail className="h-4 w-4 mr-2" />
                                                    Send Invite
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
