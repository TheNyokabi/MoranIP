"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Toaster } from "sonner"
import { useAuthStore } from "@/store/auth-store"
import { OfflineIndicator } from "@/components/ui/offline-indicator"

function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null
    const cookie = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${name}=`))
    if (!cookie) return null
    const value = cookie.slice(name.length + 1)
    return value ? decodeURIComponent(value) : null
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = React.useState(() => new QueryClient())
    const token = useAuthStore((s) => s.token)

    React.useEffect(() => {
        const cookieToken = getCookieValue('auth_token')
        if (cookieToken && cookieToken !== token) {
            useAuthStore.setState({ token: cookieToken })
        }
    }, [token])

    return (
        <QueryClientProvider client={queryClient}>
            <OfflineIndicator />
            {children}
            <Toaster richColors position="top-right" />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}

