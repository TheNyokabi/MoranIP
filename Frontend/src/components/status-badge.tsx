import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?:
    | 'open'
    | 'in-progress'
    | 'closed'
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'cancelled'
    | 'planning'
    | 'active'
    | 'on_hold'
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'open': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'in-progress': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  'closed': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  'planning': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  'active': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  'on_hold': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  'draft': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  'submitted': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  'approved': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  'rejected': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  'completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'cancelled': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' },
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, status = 'open', ...props }, ref) => {
    const styles = STATUS_STYLES[status] || STATUS_STYLES['open']
    
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
          styles.bg,
          styles.text,
          styles.border,
          className
        )}
        {...props}
      >
        {status.charAt(0).toUpperCase() + status.slice(1).replace(/[-_]/g, ' ')}
      </div>
    )
  }
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge }
