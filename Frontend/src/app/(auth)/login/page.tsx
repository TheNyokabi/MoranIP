"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Cpu, ArrowRight, Sparkles, Shield, Zap } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const { login, isLoading, error, clearError } = useAuthStore()

    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        clearError()

        try {
            await login(email, password)
            // Always redirect to global dashboard after login
            // No tenant selection required
            router.push("/dashboard")
        } catch {
            // Error is handled by store
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] flex">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse-slow" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-pink-500/15 to-orange-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />

                    {/* Grid pattern */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                            backgroundSize: '60px 60px'
                        }}
                    />
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="mb-12">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600">
                                <Cpu className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                                    Moran
                                </h1>
                                <p className="text-white/40">Innovation Platform</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-semibold text-white mb-4 leading-tight">
                            Where Breakthrough Ideas<br />
                            Meet Enterprise Execution
                        </h2>
                        <p className="text-white/50 text-lg max-w-md">
                            Join the innovation hub powering the next generation of enterprise solutions.
                        </p>
                    </div>

                    {/* Feature highlights */}
                    <div className="space-y-4">
                        {[
                            { icon: Sparkles, text: "AI-Powered Innovation Matching", color: "text-cyan-400" },
                            { icon: Shield, text: "Enterprise-Grade Security", color: "text-purple-400" },
                            { icon: Zap, text: "Real-Time Collaboration", color: "text-emerald-400" },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-4 text-white/70">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                                </div>
                                <span>{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600">
                            <Cpu className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            Moran
                        </span>
                    </div>

                    {/* Credentials Form */}
                    <div>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-semibold text-white mb-2">Welcome back</h2>
                                <p className="text-white/50">Sign in to access the Innovation Hub</p>
                            </div>

                            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                                {error && (
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-white/70">
                                        Email
                                    </label>
                                    <Input
                                        id="email"
                                        data-testid="login-email"
                                        type="email"
                                        placeholder="admin@moran.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-white/70">
                                        Password
                                    </label>
                                    <Input
                                        id="password"
                                        data-testid="login-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                                    />
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 text-white/50">
                                        <input type="checkbox" className="rounded border-white/20 bg-white/5" />
                                        Remember me
                                    </label>
                                    <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                                        Forgot password?
                                    </a>
                                </div>

                                <Button
                                    type="submit"
                                    data-testid="login-submit"
                                    disabled={isLoading}
                                    className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0 hover:opacity-90 font-medium"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        <>
                                            Sign In
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </form>

                            <div className="mt-8 text-center">
                                <p className="text-white/40 text-sm">
                                    Don&apos;t have an account?{" "}
                                    <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                                        Request Access
                                    </a>
                                </p>
                            </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center text-white/30 text-xs">
                        <p>© 2026 Moran Platform. Enterprise Innovation at Scale.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
