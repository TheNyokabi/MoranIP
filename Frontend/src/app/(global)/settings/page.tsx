"use client"

import * as React from "react"
import { useAuthStore } from "@/store/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { 
    User, 
    Shield, 
    Bell, 
    LogOut, 
    ChevronRight,
    Fingerprint,
    Palette,
    Globe,
    Lock,
    Smartphone,
    Key
} from "lucide-react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
    const router = useRouter()
    const { user, logout, currentTenant } = useAuthStore()

    const handleLogout = () => {
        logout()
        router.push('/login')
    }

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f]">
            {/* Ambient background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/5 to-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-pink-500/5 to-orange-500/5 rounded-full blur-3xl" />
            </div>
            
            <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
                        <p className="text-white/50">
                            Manage your account and preferences
                        </p>
                    </div>
                    <ThemeToggle />
                </div>

                {/* Profile Card */}
                <div className="glass rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-5">
                        <Avatar className="h-20 w-20 ring-2 ring-white/10">
                            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-2xl font-bold">
                                {user?.name ? getInitials(user.name) : 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold text-white">{user?.name || 'User'}</h2>
                            <p className="text-white/50">{user?.email || 'Not logged in'}</p>
                            {user?.userCode && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-xs font-mono">
                                        {user.userCode}
                                    </span>
                                    <span className="px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                                        {user?.kycTier || 'KYC-T0'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 hover:opacity-90">
                            Edit Profile
                        </Button>
                    </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Account Section */}
                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10">
                                <User className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Account</h3>
                                <p className="text-white/40 text-sm">Personal information</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <SettingsItem 
                                icon={<Globe className="h-4 w-4" />}
                                label="Display Name"
                                value={user?.name || 'Not set'}
                            />
                            <SettingsItem 
                                icon={<Palette className="h-4 w-4" />}
                                label="Language"
                                value="English (US)"
                            />
                            <SettingsItem 
                                icon={<Bell className="h-4 w-4" />}
                                label="Notifications"
                                value="Enabled"
                            />
                        </div>
                    </div>

                    {/* Security Section */}
                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10">
                                <Shield className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Security</h3>
                                <p className="text-white/40 text-sm">Authentication & access</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <SettingsItem 
                                icon={<Lock className="h-4 w-4" />}
                                label="Password"
                                value="••••••••"
                                action="Change"
                            />
                            <SettingsItem 
                                icon={<Smartphone className="h-4 w-4" />}
                                label="Two-Factor Auth"
                                value="Not enabled"
                                action="Enable"
                                actionVariant="success"
                            />
                            <SettingsItem 
                                icon={<Fingerprint className="h-4 w-4" />}
                                label="Biometrics"
                                value="Available"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Sessions */}
                <div className="glass rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10">
                                <Key className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Active Sessions</h3>
                                <p className="text-white/40 text-sm">Devices with access to your account</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-4">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <div>
                                    <p className="text-white font-medium">Current Session</p>
                                    <p className="text-white/40 text-sm">macOS • Safari • Nairobi, KE</p>
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                                Active Now
                            </span>
                        </div>
                        
                        {currentTenant && (
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                                <div>
                                    <p className="text-white/70 text-sm">Current Workspace</p>
                                    <p className="text-white font-medium">{currentTenant.name}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-white/30" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="glass rounded-2xl p-6 border border-red-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/10">
                                <LogOut className="h-5 w-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Sign Out</h3>
                                <p className="text-white/40 text-sm">End your current session on this device</p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={handleLogout}
                        >
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Settings Item Component
function SettingsItem({ 
    icon, 
    label, 
    value, 
    action, 
    actionVariant 
}: { 
    icon: React.ReactNode
    label: string
    value: string
    action?: string
    actionVariant?: 'default' | 'success'
}) {
    return (
        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
                <span className="text-white/40 group-hover:text-white/60 transition-colors">
                    {icon}
                </span>
                <span className="text-white/70 text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm">{value}</span>
                {action && (
                    <span className={`text-xs font-medium ${
                        actionVariant === 'success' ? 'text-emerald-400' : 'text-cyan-400'
                    }`}>
                        {action}
                    </span>
                )}
                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
        </div>
    )
}
