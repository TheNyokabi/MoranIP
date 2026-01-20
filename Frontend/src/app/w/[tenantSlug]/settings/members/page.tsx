'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'
import { useTenantStore } from '@/store/tenant-store'
import { iamApi, InviteUserRequest, TenantMembership } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Users,
    Shield,
    AlertCircle,
    MoreVertical,
    CheckCircle2
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InviteUserDialog } from '@/components/settings/invite-user-dialog'
import { ChangeRoleDialog } from '@/components/settings/change-role-dialog'
import { toast } from 'sonner'

const ROLE_COLORS: Record<string, string> = {
    OWNER: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    ADMIN: 'bg-red-500/10 text-red-600 border-red-500/20',
    MANAGER: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    CASHIER: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    VIEWER: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

export default function MembersSettingsPage({ params }: { params: { tenantSlug: string } }) {
    const router = useRouter()
    const { token, user } = useAuthStore()
    const { currentTenant } = useTenantStore()
    const [members, setMembers] = useState<TenantMembership[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false)
    const [selectedMember, setSelectedMember] = useState<TenantMembership | null>(null)
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
    const [memberToRemove, setMemberToRemove] = useState<TenantMembership | null>(null)

    // Check if user has admin permissions
    const isAdmin = user?.isSuperAdmin || false // TODO: Add proper role check

    useEffect(() => {
        if (!isAdmin) {
            router.push('/dashboard')
            return
        }

        loadMembers()
    }, [token, currentTenant?.id, isAdmin, router])

    const loadMembers = async () => {
        if (!token || !currentTenant?.id) return
        setLoading(true)
        try {
            const response = await iamApi.getTenantUsers(currentTenant.id, token)
            setMembers(
                (response.users || []).map((u) => ({
                    id: u.id,
                    name: u.full_name || u.email || u.user_code,
                    code: u.email,
                    status: u.membership_status,
                    role: u.legacy_role,
                }))
            )
            setError(null)
        } catch (err: any) {
            setError(err.detail || 'Failed to load members')
        } finally {
            setLoading(false)
        }
    }

    const handleInviteUser = async (email: string, fullName: string, role: InviteUserRequest['role']) => {
        if (!token || !currentTenant?.id) return

        try {
            await iamApi.inviteUser(currentTenant.id, { email, full_name: fullName, role }, token)
            toast.success(`Invitation sent to ${email}`)
            setSuccess(`Invited ${email} as ${role}`)
            setTimeout(() => setSuccess(null), 3000)
            loadMembers()
        } catch (err: any) {
            throw err // Let dialog handle the error
        }
    }

    const handleChangeRole = (member: TenantMembership) => {
        setSelectedMember(member)
        setChangeRoleDialogOpen(true)
    }

    const handleChangeRoleConfirm = async (newRole: string) => {
        if (!token || !currentTenant?.id || !selectedMember) return

        try {
            await iamApi.updateMembership(token, currentTenant.id, selectedMember.id, newRole)
            toast.success(`Updated ${selectedMember.name}'s role to ${newRole}`)
            setSuccess(`Role updated successfully`)
            setTimeout(() => setSuccess(null), 3000)
            loadMembers()
        } catch (err: any) {
            throw err // Let dialog handle the error
        }
    }

    const handleRemoveUser = (member: TenantMembership) => {
        setMemberToRemove(member)
        setRemoveDialogOpen(true)
    }

    const handleRemoveUserConfirm = async () => {
        if (!token || !currentTenant?.id || !memberToRemove) return

        try {
            await iamApi.updateMembership(token, currentTenant.id, memberToRemove.id, memberToRemove.role, 'SUSPENDED')
            toast.success(`Removed ${memberToRemove.name} from workspace`)
            setSuccess(`Member removed successfully`)
            setTimeout(() => setSuccess(null), 3000)
            setRemoveDialogOpen(false)
            setMemberToRemove(null)
            loadMembers()
        } catch (err: any) {
            setError(err.detail || 'Failed to remove member')
            setRemoveDialogOpen(false)
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-6xl mx-auto">
                <Skeleton className="h-8 w-64 mb-6" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Team Members</h1>
                    <p className="text-muted-foreground">
                        Manage workspace members and their roles
                    </p>
                </div>
                <InviteUserDialog onInvite={handleInviteUser} />
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Success Alert */}
            {success && (
                <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-600 dark:text-green-400">
                        {success}
                    </AlertDescription>
                </Alert>
            )}

            {/* Members Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Workspace Members ({members.length})
                    </CardTitle>
                    <CardDescription>
                        All users with access to this workspace
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No members found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">
                                            {member.name || 'N/A'}
                                        </TableCell>
                                        <TableCell>{member.code}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={ROLE_COLORS[member.role] || ''}
                                            >
                                                <Shield className="h-3 w-3 mr-1" />
                                                {member.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
                                            >
                                                {member.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleChangeRole(member)}>
                                                        Change Role
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleRemoveUser(member)}
                                                    >
                                                        Remove from Workspace
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Change Role Dialog */}
            {
                selectedMember && (
                    <ChangeRoleDialog
                        open={changeRoleDialogOpen}
                        onOpenChange={setChangeRoleDialogOpen}
                        memberName={selectedMember.name || 'Member'}
                        currentRole={selectedMember.role}
                        onChangeRole={handleChangeRoleConfirm}
                    />
                )
            }

            {/* Remove User Confirmation Dialog */}
            <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from this workspace?
                            This will suspend their access.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveUserConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove Member
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
