"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        // Set initial state
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            // Hide the reconnected message after 3 seconds
            setTimeout(() => setShowReconnected(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Don't render anything if online and not showing reconnected message
    if (isOnline && !showReconnected) {
        return null;
    }

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-medium transition-all duration-300 transform",
                isOnline
                    ? "bg-green-500 text-white translate-y-0"
                    : "bg-amber-500 text-white translate-y-0"
            )}
            role="alert"
            aria-live="polite"
        >
            {isOnline ? (
                <span className="flex items-center justify-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Back online
                </span>
            ) : (
                <span className="flex items-center justify-center gap-2">
                    <WifiOff className="h-4 w-4 animate-pulse" />
                    You're offline. Some features may be unavailable.
                </span>
            )}
        </div>
    );
}
