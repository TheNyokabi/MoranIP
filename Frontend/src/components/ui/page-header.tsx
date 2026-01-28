'use client'

import * as React from 'react'
import { LucideIcon, ChevronRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  backButton?: {
    label?: string
    onClick: () => void
  }
  tabs?: React.ReactNode
  className?: string
  sticky?: boolean
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
  backButton,
  tabs,
  className,
  sticky = false,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b bg-background',
        sticky && 'sticky top-0 z-30',
        className
      )}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight className="h-4 w-4" />}
                {item.href || item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Back Button */}
        {backButton && (
          <button
            onClick={backButton.onClick}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            {backButton.label || 'Back'}
          </button>
        )}

        {/* Main Header Content */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {Icon && (
              <div className="hidden sm:flex h-12 w-12 rounded-xl bg-primary/10 items-center justify-center flex-shrink-0">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>

        {/* Additional Content */}
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs && (
        <div className="px-4 sm:px-6 lg:px-8 -mb-px">
          {tabs}
        </div>
      )}
    </div>
  )
}

// Page Header Actions Component
interface PageHeaderActionsProps {
  children: React.ReactNode
  className?: string
}

export function PageHeaderActions({ children, className }: PageHeaderActionsProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
    </div>
  )
}

// Page Section Component
interface PageSectionProps {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function PageSection({ title, description, actions, children, className }: PageSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

// Page Content Container
interface PageContentProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

export function PageContent({ children, className, maxWidth = 'full' }: PageContentProps) {
  const maxWidthStyles = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: '',
  }

  return (
    <div className={cn(
      'px-4 sm:px-6 lg:px-8 py-6',
      maxWidthStyles[maxWidth],
      maxWidth !== 'full' && 'mx-auto',
      className
    )}>
      {children}
    </div>
  )
}
