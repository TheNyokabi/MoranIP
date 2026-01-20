'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth-store'
import { rbacApi, Role, RoleWithPermissions } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Shield,
    Crown,
    UserCog,
    Users,
    Eye,
    AlertCircle,
    ChevronDown,
    ChevronRight
} from 'lucide-react'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'

const ROLE_CONFIG: Record<string, { icon: typeof Shield, color: string, description: string }> = {
    SUPER_ADMIN: {
        icon: Crown,
        color: 'text-red-600',
        description: 'Full system access across all tenants. Platform administrators only.'
    },
    OWNER: {
        icon: Crown,
        color: 'text-yellow-600',
        description: 'Full workspace access. Can manage all settings, users, and data.'
    },
    ADMIN: {
        icon: Shield,
        color: 'text-red-600',
        description: 'Administrative access. Can manage users, settings, and most data.'
    },
    MANAGER: {
        icon: UserCog,
        color: 'text-purple-600',
        description: 'Managerial access. Can view reports and manage day-to-day operations.'
    },
    CASHIER: {
        icon: Users,
        color: 'text-blue-600',
        description: 'Operational access. Can create sales, invoices, and manage inventory.'
    },
    VIEWER: {
        icon: Eye,
        color: 'text-gray-600',
        description: 'Read-only access. Can view data but cannot make changes.'
    }
}

export default function RolesSettingsPage() {
    const router = useRouter()
    const { token, user } = useAuthStore()
    const [roles, setRoles] = useState<Role[]>([])
    const [expandedRole, setExpandedRole] = useState<string | null>(null)
    const [rolePermissions, setRolePermissions] = useState<Record<string, RoleWithPermissions>>({})
    const [loading, setLoading] = useState(true)
    const [loadingPermissions, setLoadingPermissions] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Check if user has admin permissions
    const isAdmin = user?.isSuperAdmin || false

    useEffect(() => {
        if (!isAdmin) {
            router.push('/dashboard')
            return
        }

        async function loadRoles() {
            if (!token) return
            try {
                const response = await rbacApi.listRoles(token)
                setRoles(response)
            } catch (err: any) {
                setError(err.detail || 'Failed to load roles')
            } finally {
                setLoading(false)
            }
        }
        loadRoles()
    }, [token, isAdmin, router])

    const handleToggleRole = async (roleCode: string) => {
        if (expandedRole === roleCode) {
            setExpandedRole(null)
            return
        }

        setExpandedRole(roleCode)

        // Load permissions if not already loaded
        if (!rolePermissions[roleCode] && token) {
            setLoadingPermissions(roleCode)
            try {
                const response = await rbacApi.getRolePermissions(token, roleCode)
                setRolePermissions(prev => ({ ...prev, [roleCode]: response }))
            } catch (err: any) {
                setError(`Failed to load permissions for ${roleCode}`)
            } finally {
                setLoadingPermissions(null)
            }
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <Skeleton className="h-8 w-64 mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Roles & Permissions</h1>
                <p className="text-muted-foreground">
                    View available roles and their permissions. Roles are managed at system level.
                </p>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Info Alert */}
            <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                    System roles cannot be modified. Use the Members page to assign roles to users.
                </AlertDescription>
            </Alert>

            {/* Roles List */}
            <div className="space-y-4">
                {roles.map(role => {
                    const config = ROLE_CONFIG[role.code] || ROLE_CONFIG.VIEWER
                    const Icon = config.icon
                    const isExpanded = expandedRole === role.code
                    const permissions = rolePermissions[role.code]?.permissions || []

                    return (
                        <Card key={role.id}>
                            <Collapsible
                                open={isExpanded}
                                onOpenChange={() => handleToggleRole(role.code)}
                            >
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-lg bg-muted ${config.color}`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <CardTitle className="text-lg">{role.name}</CardTitle>
                                                        <Badge variant="outline" className="text-xs">
                                                            {role.level}
                                                        </Badge>
                                                    </div>
                                                    <CardDescription className="mt-1">
                                                        {config.description}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-5 w-5" />
                                                ) : (
                                                    <ChevronRight className="h-5 w-5" />
                                                )}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <CardContent className="pt-0">
                                        <div className="border-t pt-4">
                                            <h4 className="font-semibold mb-3">Permissions ({permissions.length})</h4>
                                            {loadingPermissions === role.code ? (
                                                <div className="space-y-2">
                                                    {[1, 2, 3].map(i => (
                                                        <Skeleton key={i} className="h-8 w-full" />
                                                    ))}
                                                </div>
                                            ) : permissions.length > 0 ? (
                                                <div className="grid gap-2 md:grid-cols-2">
                                                    {permissions.map(perm => (
                                                        <div
                                                            key={perm.id}
                                                            className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                                                        >
                                                            <Badge
                                                                variant="outline"
                                                                className="mt-0.5 shrink-0"
                                                            >
                                                                {perm.module}
                                                            </Badge>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-mono text-xs truncate">
                                                                    {perm.code}
                                                                </div>
                                                                {perm.description && (
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {perm.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    No permissions loaded
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </CollapsibleContent>
                            </Collapsible>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
