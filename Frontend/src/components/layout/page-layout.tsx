'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
  footer?: React.ReactNode
  bottomNav?: React.ReactNode
  className?: string
  contentClassName?: string
  fullWidth?: boolean
  noPadding?: boolean
}

export function PageLayout({
  children,
  sidebar,
  header,
  footer,
  bottomNav,
  className,
  contentClassName,
  fullWidth = false,
  noPadding = false,
}: PageLayoutProps) {
  return (
    <div className={cn('min-h-screen flex flex-col bg-background', className)}>
      {/* Header */}
      {header && (
        <header className="sticky top-0 z-40 bg-background border-b">
          {header}
        </header>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        {sidebar && (
          <aside className="hidden lg:flex flex-col w-64 border-r bg-card">
            {sidebar}
          </aside>
        )}

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 flex flex-col min-w-0',
            !noPadding && 'p-4 sm:p-6',
            !fullWidth && 'max-w-7xl mx-auto w-full',
            bottomNav && 'pb-20 lg:pb-6', // Space for bottom nav on mobile
            contentClassName
          )}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <footer className="border-t bg-card">
          {footer}
        </footer>
      )}

      {/* Mobile Bottom Navigation */}
      {bottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t bg-background safe-area-pb">
          {bottomNav}
        </nav>
      )}
    </div>
  )
}

// Content area with optional max width
interface ContentAreaProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
  className?: string
  centered?: boolean
}

export function ContentArea({
  children,
  maxWidth = 'full',
  className,
  centered = false,
}: ContentAreaProps) {
  const maxWidthStyles = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    '7xl': 'max-w-7xl',
    full: '',
  }

  return (
    <div
      className={cn(
        'w-full',
        maxWidthStyles[maxWidth],
        centered && 'mx-auto',
        className
      )}
    >
      {children}
    </div>
  )
}

// Sticky header container
interface StickyHeaderProps {
  children: React.ReactNode
  className?: string
  offset?: number
}

export function StickyHeader({ children, className, offset = 0 }: StickyHeaderProps) {
  return (
    <div
      className={cn(
        'sticky z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      style={{ top: offset }}
    >
      {children}
    </div>
  )
}

// Grid layouts
interface GridLayoutProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
}

export function GridLayout({
  children,
  columns = 12,
  gap = 'md',
  className,
}: GridLayoutProps) {
  const columnStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-12',
  }

  const gapStyles = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }

  return (
    <div className={cn('grid', columnStyles[columns], gapStyles[gap], className)}>
      {children}
    </div>
  )
}

// Flex layouts
interface FlexLayoutProps {
  children: React.ReactNode
  direction?: 'row' | 'col'
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch'
  wrap?: boolean
  gap?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
}

export function FlexLayout({
  children,
  direction = 'row',
  justify = 'start',
  align = 'stretch',
  wrap = false,
  gap = 'md',
  className,
}: FlexLayoutProps) {
  const directionStyles = {
    row: 'flex-row',
    col: 'flex-col',
  }

  const justifyStyles = {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  }

  const alignStyles = {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
  }

  const gapStyles = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  }

  return (
    <div
      className={cn(
        'flex',
        directionStyles[direction],
        justifyStyles[justify],
        alignStyles[align],
        wrap && 'flex-wrap',
        gapStyles[gap],
        className
      )}
    >
      {children}
    </div>
  )
}

// Split layout (sidebar + content pattern)
interface SplitLayoutProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  sidebarPosition?: 'left' | 'right'
  sidebarWidth?: 'sm' | 'md' | 'lg'
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  className?: string
}

export function SplitLayout({
  children,
  sidebar,
  sidebarPosition = 'left',
  sidebarWidth = 'md',
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  className,
}: SplitLayoutProps) {
  const widthStyles = {
    sm: 'w-56',
    md: 'w-64',
    lg: 'w-80',
  }

  const sidebarElement = (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r bg-card overflow-y-auto transition-all duration-300',
        collapsed ? 'w-16' : widthStyles[sidebarWidth],
        sidebarPosition === 'right' && 'border-r-0 border-l order-last'
      )}
    >
      {sidebar}
    </aside>
  )

  return (
    <div className={cn('flex flex-1 min-h-0', className)}>
      {sidebarPosition === 'left' && sidebarElement}
      <main className="flex-1 overflow-y-auto">{children}</main>
      {sidebarPosition === 'right' && sidebarElement}
    </div>
  )
}

// Card container for dashboard sections
interface DashboardCardProps {
  children: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function DashboardCard({
  children,
  title,
  description,
  action,
  className,
  noPadding = false,
}: DashboardCardProps) {
  return (
    <div className={cn('bg-card border rounded-xl', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
          <div>
            {title && (
              <h3 className="font-semibold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn(!noPadding && 'p-4')}>{children}</div>
    </div>
  )
}
