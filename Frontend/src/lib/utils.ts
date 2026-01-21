import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a date as a relative time string (e.g., "5 minutes ago")
 */
export function formatDistanceToNow(date: Date): string {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
        return 'just now'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
        return `${diffInHours}h ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
        return `${diffInDays}d ago`
    }

    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
        return `${diffInWeeks}w ago`
    }

    return date.toLocaleDateString()
}

export function formatCurrency(amount: number, currency: string = 'KES'): string {
    if (!Number.isFinite(amount)) return `${currency} 0`
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(2)}`
    }
}

export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    })
}

export function getDaysRemaining(targetDate: string | Date): number {
    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
    if (Number.isNaN(target.getTime())) return 0

    const now = new Date()
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.ceil((target.getTime() - now.getTime()) / msPerDay)
}
