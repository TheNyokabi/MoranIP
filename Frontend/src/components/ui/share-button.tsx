"use client";

import { useCallback } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
    title: string;
    text?: string;
    url?: string;
    className?: string;
    variant?: "default" | "outline" | "ghost" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Native Web Share API button for mobile sharing.
 * Falls back to clipboard copy on desktop/unsupported browsers.
 */
export function ShareButton({
    title,
    text,
    url,
    className,
    variant = "outline",
    size = "sm",
}: ShareButtonProps) {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

    const handleShare = useCallback(async () => {
        const shareData = {
            title,
            text: text || title,
            url: shareUrl,
        };

        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard');
            } catch {
                toast.error('Failed to copy link');
            }
        };

        // Check if Web Share API is available
        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
                toast.success('Shared successfully');
            } catch (err: any) {
                // User cancelled share or error occurred
                if (err?.name !== 'AbortError') {
                    // Fall back to clipboard
                    await copyToClipboard();
                }
            }
        } else {
            // Fall back to clipboard copy
            await copyToClipboard();
        }
    }, [title, text, shareUrl]);

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleShare}
            className={className}
        >
            <Share2 className="h-4 w-4 mr-2" />
            Share
        </Button>
    );
}

/**
 * Hook for programmatic sharing
 */
export function useShare() {
    const share = useCallback(async (data: { title: string; text?: string; url?: string }) => {
        const shareUrl = data.url || (typeof window !== 'undefined' ? window.location.href : '');
        const shareData = {
            title: data.title,
            text: data.text || data.title,
            url: shareUrl,
        };

        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
                return true;
            } catch {
                return false;
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard');
            return true;
        } catch {
            return false;
        }
    }, []);

    const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

    return { share, canNativeShare };
}
