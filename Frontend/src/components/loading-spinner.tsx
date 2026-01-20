import * as React from "react"
import { cn } from "@/lib/utils"

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = 'md', text, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center', className)}
        {...props}
      >
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white',
            sizeClasses[size]
          )}
        />
        {text && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{text}</p>}
      </div>
    )
  }
)
LoadingSpinner.displayName = 'LoadingSpinner'

export { LoadingSpinner }
