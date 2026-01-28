'use client'

import * as React from 'react'
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  description?: string
  snapPoints?: number[] // Heights as percentages [25, 50, 90]
  defaultSnapPoint?: number
  showHandle?: boolean
  showCloseButton?: boolean
  className?: string
}

export function MobileSheet({
  isOpen,
  onClose,
  children,
  title,
  description,
  snapPoints = [50, 90],
  defaultSnapPoint = 0,
  showHandle = true,
  showCloseButton = true,
  className,
}: MobileSheetProps) {
  const [currentSnap, setCurrentSnap] = React.useState(defaultSnapPoint)
  const constraintsRef = React.useRef(null)
  const dragControls = useDragControls()

  const currentHeight = snapPoints[currentSnap]

  const handleDragEnd = (_: any, info: PanInfo) => {
    const velocity = info.velocity.y
    const offset = info.offset.y

    // Swipe down to close
    if (velocity > 500 || offset > 100) {
      if (currentSnap > 0) {
        setCurrentSnap(currentSnap - 1)
      } else {
        onClose()
      }
      return
    }

    // Swipe up to expand
    if (velocity < -500 || offset < -100) {
      if (currentSnap < snapPoints.length - 1) {
        setCurrentSnap(currentSnap + 1)
      }
      return
    }
  }

  // Reset snap point when opened
  React.useEffect(() => {
    if (isOpen) {
      setCurrentSnap(defaultSnapPoint)
    }
  }, [isOpen, defaultSnapPoint])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Sheet */}
          <motion.div
            ref={constraintsRef}
            initial={{ y: '100%' }}
            animate={{ y: `${100 - currentHeight}%` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-background rounded-t-2xl shadow-2xl',
              'flex flex-col max-h-[95vh]',
              'safe-area-pb',
              className
            )}
            style={{ height: `${currentHeight}vh` }}
          >
            {/* Handle */}
            {showHandle && (
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between px-4 pb-3">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  )}
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Simple bottom sheet for quick actions
interface QuickActionSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  actions: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'destructive'
  }>
}

export function QuickActionSheet({
  isOpen,
  onClose,
  title,
  actions,
}: QuickActionSheetProps) {
  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      snapPoints={[50]}
      showCloseButton={false}
    >
      <div className="space-y-1">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              action.onClick()
              onClose()
            }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
              'text-left transition-colors',
              action.variant === 'destructive'
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-muted'
            )}
          >
            {action.icon && (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                {action.icon}
              </div>
            )}
            <span className="font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </MobileSheet>
  )
}

// Confirmation sheet
interface ConfirmationSheetProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

export function ConfirmationSheet({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmationSheetProps) {
  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[35]}
      showHandle={true}
      showCloseButton={false}
    >
      <div className="text-center py-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'w-full py-3 px-4 rounded-xl font-medium transition-colors',
            variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? 'Loading...' : confirmLabel}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
        >
          {cancelLabel}
        </button>
      </div>
    </MobileSheet>
  )
}

// Form sheet with scroll
interface FormSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function FormSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
}: FormSheetProps) {
  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      snapPoints={[90]}
      showHandle={true}
      showCloseButton={true}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="border-t pt-4 mt-4">
            {footer}
          </div>
        )}
      </div>
    </MobileSheet>
  )
}
