'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface RippleProps {
  x: number
  y: number
  size: number
}

interface TouchRippleProps {
  children: React.ReactNode
  color?: string
  duration?: number
  disabled?: boolean
  className?: string
}

export function TouchRipple({
  children,
  color = 'currentColor',
  duration = 500,
  disabled = false,
  className,
}: TouchRippleProps) {
  const [ripples, setRipples] = React.useState<RippleProps[]>([])
  const containerRef = React.useRef<HTMLDivElement>(null)

  const addRipple = React.useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in event) {
      x = event.touches[0].clientX - rect.left
      y = event.touches[0].clientY - rect.top
    } else {
      x = event.clientX - rect.left
      y = event.clientY - rect.top
    }

    const size = Math.max(rect.width, rect.height) * 2

    const newRipple: RippleProps = { x, y, size }
    setRipples((prev) => [...prev, newRipple])

    setTimeout(() => {
      setRipples((prev) => prev.slice(1))
    }, duration)
  }, [disabled, duration])

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      onMouseDown={addRipple}
      onTouchStart={addRipple}
    >
      {children}
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute rounded-full pointer-events-none animate-ripple"
          style={{
            left: ripple.x - ripple.size / 2,
            top: ripple.y - ripple.size / 2,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
            opacity: 0.3,
            animationDuration: `${duration}ms`,
          }}
        />
      ))}
      
      <style jsx>{`
        @keyframes ripple {
          from {
            transform: scale(0);
            opacity: 0.3;
          }
          to {
            transform: scale(1);
            opacity: 0;
          }
        }
        .animate-ripple {
          animation: ripple ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// Touchable component wrapper with haptic feedback support
interface TouchableProps {
  children: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  haptic?: boolean
  ripple?: boolean
  rippleColor?: string
  activeOpacity?: number
  longPressDelay?: number
  className?: string
}

export function Touchable({
  children,
  onPress,
  onLongPress,
  disabled = false,
  haptic = true,
  ripple = true,
  rippleColor = 'currentColor',
  activeOpacity = 0.7,
  longPressDelay = 500,
  className,
}: TouchableProps) {
  const [isPressed, setIsPressed] = React.useState(false)
  const longPressTimer = React.useRef<NodeJS.Timeout>()
  const isLongPress = React.useRef(false)

  const triggerHaptic = React.useCallback(() => {
    if (haptic && navigator.vibrate) {
      navigator.vibrate(10)
    }
  }, [haptic])

  const handlePressStart = React.useCallback(() => {
    if (disabled) return
    
    setIsPressed(true)
    isLongPress.current = false

    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true
        triggerHaptic()
        onLongPress()
      }, longPressDelay)
    }
  }, [disabled, onLongPress, longPressDelay, triggerHaptic])

  const handlePressEnd = React.useCallback(() => {
    setIsPressed(false)
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }

    if (!isLongPress.current && onPress && !disabled) {
      triggerHaptic()
      onPress()
    }
  }, [onPress, disabled, triggerHaptic])

  const content = (
    <div
      className={cn(
        'select-none transition-opacity',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{ opacity: isPressed ? activeOpacity : 1 }}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={() => setIsPressed(false)}
    >
      {children}
    </div>
  )

  if (ripple && !disabled) {
    return (
      <TouchRipple color={rippleColor}>
        {content}
      </TouchRipple>
    )
  }

  return content
}

// Press and hold button with visual progress
interface PressAndHoldButtonProps {
  onComplete: () => void
  duration?: number
  children: React.ReactNode
  variant?: 'default' | 'destructive'
  disabled?: boolean
  className?: string
}

export function PressAndHoldButton({
  onComplete,
  duration = 1500,
  children,
  variant = 'default',
  disabled = false,
  className,
}: PressAndHoldButtonProps) {
  const [progress, setProgress] = React.useState(0)
  const [isHolding, setIsHolding] = React.useState(false)
  const intervalRef = React.useRef<NodeJS.Timeout>()
  const startTimeRef = React.useRef<number>()

  const handleStart = React.useCallback(() => {
    if (disabled) return
    
    setIsHolding(true)
    startTimeRef.current = Date.now()
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || 0)
      const newProgress = Math.min((elapsed / duration) * 100, 100)
      setProgress(newProgress)
      
      if (newProgress >= 100) {
        clearInterval(intervalRef.current)
        setIsHolding(false)
        setProgress(0)
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50])
        }
        onComplete()
      }
    }, 16)
  }, [disabled, duration, onComplete])

  const handleEnd = React.useCallback(() => {
    setIsHolding(false)
    setProgress(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [])

  const bgColor = variant === 'destructive' 
    ? 'bg-red-500' 
    : 'bg-primary'

  return (
    <button
      disabled={disabled}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      className={cn(
        'relative overflow-hidden px-4 py-3 rounded-xl font-medium',
        'text-foreground bg-muted',
        'transition-colors select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Progress overlay */}
      <div
        className={cn(
          'absolute inset-0 transition-all',
          bgColor,
          isHolding ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: `${progress}%` }}
      />
      
      {/* Content */}
      <span className={cn(
        'relative z-10',
        isHolding && progress > 50 && 'text-white'
      )}>
        {children}
      </span>
    </button>
  )
}
