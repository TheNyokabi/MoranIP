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
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Shield } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

interface ChangeRoleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    memberName: string
    currentRole: string
    onChangeRole: (newRole: string) => Promise<void>
}

const ROLES = [
    { value: 'ADMIN', label: 'Admin', description: 'Full administrative access' },
    { value: 'MANAGER', label: 'Manager', description: 'Manage operations and reports' },
    { value: 'CASHIER', label: 'Cashier', description: 'Create sales and manage inventory' },
    { value: 'VIEWER', label: 'Viewer', description: 'Read-only access' },
]

export function ChangeRoleDialog({
    open,
    onOpenChange,
    memberName,
    currentRole,
    onChangeRole
}: ChangeRoleDialogProps) {
    const [selectedRole, setSelectedRole] = useState(currentRole)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleChangeRole = async () => {
        if (selectedRole === currentRole) {
            onOpenChange(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            await onChangeRole(selectedRole)
            onOpenChange(false)
        } catch (err: any) {
            setError(err.detail || 'Failed to change role')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Member Role</DialogTitle>
                    <DialogDescription>
                        Update the role for {memberName}
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
                        <Label htmlFor="role">New Role</Label>
                        <Select value={selectedRole} onValueChange={setSelectedRole} disabled={loading}>
                            <SelectTrigger id="role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-3 w-3" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">{r.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {r.description}
                                                </span>
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedRole !== currentRole && (
                            <p className="text-sm text-muted-foreground">
                                Changing from <strong>{currentRole}</strong> to <strong>{selectedRole}</strong>
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleChangeRole} disabled={loading || selectedRole === currentRole}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Role
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
