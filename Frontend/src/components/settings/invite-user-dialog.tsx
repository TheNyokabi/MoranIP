'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { InviteUserRequest } from '@/lib/api'

interface InviteUserDialogProps {
    onInvite: (email: string, fullName: string, role: InviteUserRequest['role']) => Promise<void>
}

const ROLES = [
    { value: 'ADMIN', label: 'Admin', description: 'Full administrative access' },
    { value: 'MANAGER', label: 'Manager', description: 'Manage operations and reports' },
    { value: 'CASHIER', label: 'Cashier', description: 'Create sales and manage inventory' },
    { value: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
]

export function InviteUserDialog({ onInvite }: InviteUserDialogProps) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    const [role, setRole] = useState<InviteUserRequest['role']>('CASHIER')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleInvite = async () => {
        if (!email || !fullName) {
            setError('Email and full name are required')
            return
        }

        setLoading(true)
        setError(null)

        try {
            await onInvite(email, fullName, role)
            setOpen(false)
            // Reset form
            setEmail('')
            setFullName('')
            setRole('CASHIER')
        } catch (err: any) {
            setError(err.detail || 'Failed to invite user')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite User
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invite User to Workspace</DialogTitle>
                    <DialogDescription>
                        Send an invitation email to add a new member to your workspace.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                            value={role}
                            onValueChange={(value) => setRole(value as InviteUserRequest['role'])}
                            disabled={loading}
                        >
                            <SelectTrigger id="role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{r.label}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {r.description}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invitation
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
