"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/store/auth-store"
import { posApi } from "@/lib/api"
import { 
    Wifi, 
    WifiOff, 
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2
} from "lucide-react"
import { toast } from "sonner"

interface OfflineSyncStatusProps {
    onSyncComplete?: () => void
}

export function OfflineSyncStatus({ onSyncComplete }: OfflineSyncStatusProps) {
    const { token } = useAuthStore()
    const [syncStatus, setSyncStatus] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [open, setOpen] = useState(false)

    // Load sync status on mount and periodically
    useEffect(() => {
        if (token) {
            loadSyncStatus()
            const interval = setInterval(loadSyncStatus, 10000) // Every 10 seconds
            return () => clearInterval(interval)
        }
    }, [token])

    const loadSyncStatus = async () => {
        if (!token) return
        
        try {
            const response = await posApi.getSyncStatus(token)
            setSyncStatus(response)
        } catch (error) {
            // If offline, status might fail
            console.error("Failed to load sync status:", error)
        }
    }

    const handleSync = async () => {
        if (!token || syncing) return
        
        setSyncing(true)
        try {
            const response = await posApi.syncPendingTransactions(token, 3)
            
            toast.success(
                `Synced ${response.synced} transactions. ` +
                (response.failed > 0 ? `${response.failed} failed.` : "")
            )
            
            await loadSyncStatus()
            
            if (onSyncComplete) {
                onSyncComplete()
            }
        } catch (error) {
            toast.error("Sync failed")
        } finally {
            setSyncing(false)
        }
    }

    if (!syncStatus) {
        return null
    }

    const hasPending = syncStatus.pending > 0 || syncStatus.conflicts > 0
    const isOffline = syncStatus.pending > 0 || syncStatus.failed > 0
    const hasConflicts = syncStatus.conflicts > 0

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="relative"
                >
                    {isOffline ? (
                        <WifiOff className="h-4 w-4 mr-2" />
                    ) : (
                        <Wifi className="h-4 w-4 mr-2" />
                    )}
                    {hasPending && (
                        <Badge 
                            variant="destructive" 
                            className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                        >
                            {syncStatus.pending + syncStatus.conflicts}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Sync Status</span>
                            {isOffline ? (
                                <Badge variant="destructive">
                                    <WifiOff className="h-3 w-3 mr-1" />
                                    Offline
                                </Badge>
                            ) : (
                                <Badge variant="default">
                                    <Wifi className="h-3 w-3 mr-1" />
                                    Online
                                </Badge>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Pending:</span>
                                <span className="font-medium">{syncStatus.pending}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Conflicts:</span>
                                <span className="font-medium text-orange-600">{syncStatus.conflicts}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Completed:</span>
                                <span className="font-medium text-green-600">{syncStatus.completed}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Failed:</span>
                                <span className="font-medium text-red-600">{syncStatus.failed}</span>
                            </div>
                        </div>
                    </div>

                    {hasConflicts && (
                        <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            {syncStatus.conflicts} transaction(s) have conflicts. Please resolve them.
                        </div>
                    )}

                    {hasPending && (
                        <Button
                            onClick={handleSync}
                            disabled={syncing}
                            className="w-full"
                            size="sm"
                        >
                            {syncing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Sync Now
                                </>
                            )}
                        </Button>
                    )}

                    {!hasPending && (
                        <div className="flex items-center text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            All transactions synced
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
