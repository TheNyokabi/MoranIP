'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LucideIcon, Home, Package, CreditCard, BarChart3, User, Plus, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

interface BottomNavigationProps {
  items?: NavItem[]
  tenantSlug?: string
  fab?: {
    icon?: LucideIcon
    label?: string
    onClick: () => void
  }
  moreItems?: NavItem[]
  className?: string
}

const defaultItems: NavItem[] = [
  { label: 'Home', href: '', icon: Home },
  { label: 'Inventory', href: '/inventory', icon: Package },
  { label: 'POS', href: '/pos', icon: CreditCard },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Account', href: '/settings', icon: User },
]

export function BottomNavigation({
  items = defaultItems,
  tenantSlug,
  fab,
  moreItems,
  className,
}: BottomNavigationProps) {
  const pathname = usePathname()
  
  const basePath = tenantSlug ? `/w/${tenantSlug}` : ''
  
  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === '') {
      return pathname === basePath || pathname === `${basePath}/`
    }
    return pathname.startsWith(fullPath)
  }

  const visibleItems = moreItems ? items.slice(0, 4) : items.slice(0, 5)

  return (
    <div className={cn(
      'flex items-center justify-around bg-background border-t h-16 px-2',
      className
    )}>
      {visibleItems.map((item, index) => {
        // Insert FAB in the middle
        if (fab && index === Math.floor(visibleItems.length / 2)) {
          return (
            <React.Fragment key={`fab-${index}`}>
              <NavItem
                item={item}
                href={`${basePath}${item.href}`}
                isActive={isActive(item.href)}
              />
              <FABButton fab={fab} />
            </React.Fragment>
          )
        }
        
        return (
          <NavItem
            key={item.href}
            item={item}
            href={`${basePath}${item.href}`}
            isActive={isActive(item.href)}
          />
        )
      })}
      
      {/* More Menu */}
      {moreItems && moreItems.length > 0 && (
        <MoreMenu items={moreItems} basePath={basePath} />
      )}
      
      {/* FAB at the end if no items were shifted */}
      {fab && visibleItems.length < 3 && (
        <FABButton fab={fab} />
      )}
    </div>
  )
}

// Individual nav item
interface NavItemProps {
  item: NavItem
  href: string
  isActive: boolean
}

function NavItem({ item, href, isActive }: NavItemProps) {
  const Icon = item.icon

  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center min-w-[64px] h-full py-1 px-2',
        'transition-colors relative',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5" />
        {item.badge && item.badge > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-medium">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </div>
      <span className="text-[10px] mt-1 font-medium">{item.label}</span>
      
      {/* Active indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="bottomNavIndicator"
            className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary rounded-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          />
        )}
      </AnimatePresence>
    </Link>
  )
}

// FAB Button
interface FABButtonProps {
  fab: {
    icon?: LucideIcon
    label?: string
    onClick: () => void
  }
}

function FABButton({ fab }: FABButtonProps) {
  const Icon = fab.icon || Plus

  return (
    <button
      onClick={fab.onClick}
      className={cn(
        'flex items-center justify-center',
        'h-14 w-14 -mt-6 rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'active:scale-95 transition-transform',
        'hover:bg-primary/90'
      )}
      aria-label={fab.label || 'Quick action'}
    >
      <Icon className="h-6 w-6" />
    </button>
  )
}

// More menu
interface MoreMenuProps {
  items: NavItem[]
  basePath: string
}

function MoreMenu({ items, basePath }: MoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex flex-col items-center justify-center min-w-[64px] h-full py-1 px-2 text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">More</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={`${basePath}${item.href}`} className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto h-5 min-w-[20px] rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Floating Action Button (standalone)
interface FloatingActionButtonProps {
  icon?: LucideIcon
  label?: string
  onClick: () => void
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left'
  className?: string
}

export function FloatingActionButton({
  icon: Icon = Plus,
  label,
  onClick,
  position = 'bottom-right',
  className,
}: FloatingActionButtonProps) {
  const positionStyles = {
    'bottom-right': 'bottom-20 right-4 lg:bottom-6',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2 lg:bottom-6',
    'bottom-left': 'bottom-20 left-4 lg:bottom-6',
  }

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'fixed z-40 flex items-center justify-center',
        'h-14 w-14 rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'hover:bg-primary/90 active:scale-95',
        'transition-colors',
        positionStyles[position],
        className
      )}
      aria-label={label || 'Quick action'}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
    >
      <Icon className="h-6 w-6" />
    </motion.button>
  )
}

// Speed Dial (FAB with expandable actions)
interface SpeedDialAction {
  icon: LucideIcon
  label: string
  onClick: () => void
}

interface SpeedDialProps {
  actions: SpeedDialAction[]
  icon?: LucideIcon
  position?: 'bottom-right' | 'bottom-left'
  className?: string
}

export function SpeedDial({
  actions,
  icon: MainIcon = Plus,
  position = 'bottom-right',
  className,
}: SpeedDialProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const positionStyles = {
    'bottom-right': 'bottom-20 right-4 lg:bottom-6',
    'bottom-left': 'bottom-20 left-4 lg:bottom-6',
  }

  return (
    <div className={cn('fixed z-40', positionStyles[position], className)}>
      {/* Actions */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-2 mb-2">
            {actions.map((action, index) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  action.onClick()
                  setIsOpen(false)
                }}
                className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-full bg-card border shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <action.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-center',
          'h-14 w-14 rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 transition-colors'
        )}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <MainIcon className="h-6 w-6" />
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 -z-10"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
