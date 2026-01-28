'use client'

import * as React from 'react'

// Hook to detect mobile device
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

// Hook for viewport size
export function useViewport() {
  const [viewport, setViewport] = React.useState({
    width: 0,
    height: 0,
    isXs: false,
    isSm: false,
    isMd: false,
    isLg: false,
    isXl: false,
    is2Xl: false,
  })

  React.useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setViewport({
        width,
        height,
        isXs: width < 640,
        isSm: width >= 640 && width < 768,
        isMd: width >= 768 && width < 1024,
        isLg: width >= 1024 && width < 1280,
        isXl: width >= 1280 && width < 1536,
        is2Xl: width >= 1536,
      })
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return viewport
}

// Hook for touch detection
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = React.useState(false)

  React.useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore
      navigator.msMaxTouchPoints > 0
    )
  }, [])

  return isTouch
}

// Hook for device orientation
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('portrait')

  React.useEffect(() => {
    const updateOrientation = () => {
      if (window.innerWidth > window.innerHeight) {
        setOrientation('landscape')
      } else {
        setOrientation('portrait')
      }
    }

    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)
    
    return () => {
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [])

  return orientation
}

// Hook for safe area insets (iOS notch, etc.)
export function useSafeArea() {
  const [safeArea, setSafeArea] = React.useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  React.useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement)
      setSafeArea({
        top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 
             parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10) ||
               parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) ||
                parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10) ||
              parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      })
    }

    updateSafeArea()
    window.addEventListener('resize', updateSafeArea)
    return () => window.removeEventListener('resize', updateSafeArea)
  }, [])

  return safeArea
}

// Hook for scroll direction detection
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = React.useState<'up' | 'down' | null>(null)
  const [isAtTop, setIsAtTop] = React.useState(true)
  const [isAtBottom, setIsAtBottom] = React.useState(false)
  const lastScrollY = React.useRef(0)

  React.useEffect(() => {
    const threshold = 10

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Check if at top or bottom
      setIsAtTop(currentScrollY < threshold)
      setIsAtBottom(
        window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - threshold
      )

      // Determine direction
      if (Math.abs(currentScrollY - lastScrollY.current) < threshold) {
        return
      }

      setScrollDirection(currentScrollY > lastScrollY.current ? 'down' : 'up')
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return { scrollDirection, isAtTop, isAtBottom }
}

// Hook for online/offline status
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Hook for keyboard visibility (mobile)
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = React.useState(false)
  const initialViewportHeight = React.useRef<number>(0)

  React.useEffect(() => {
    initialViewportHeight.current = window.innerHeight

    const handleResize = () => {
      // On mobile, keyboard appearing reduces viewport height significantly
      const heightDiff = initialViewportHeight.current - window.innerHeight
      setIsKeyboardVisible(heightDiff > 150)
    }

    // Use visualViewport API if available (more accurate)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => window.visualViewport?.removeEventListener('resize', handleResize)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isKeyboardVisible
}

// Hook for long press gesture
export function useLongPress(
  onLongPress: () => void,
  onClick?: () => void,
  options: { delay?: number; shouldPreventDefault?: boolean } = {}
) {
  const { delay = 500, shouldPreventDefault = true } = options
  
  const timeout = React.useRef<NodeJS.Timeout>()
  const target = React.useRef<EventTarget | null>(null)

  const start = React.useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, { passive: false })
        target.current = event.target
      }
      timeout.current = setTimeout(() => {
        onLongPress()
      }, delay)
    },
    [onLongPress, delay, shouldPreventDefault]
  )

  const clear = React.useCallback(
    (event: React.MouseEvent | React.TouchEvent, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current)
      shouldTriggerClick && onClick?.()
      
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault)
      }
    },
    [onClick, shouldPreventDefault]
  )

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
  }
}

function preventDefault(event: Event) {
  if ('touches' in event && (event as TouchEvent).touches.length < 2) {
    event.preventDefault()
  }
}

// Hook for swipe gesture detection
interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
}

export function useSwipe(options: SwipeOptions) {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 } = options
  
  const touchStart = React.useRef({ x: 0, y: 0 })

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
  }, [])

  const onTouchEnd = React.useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // Horizontal swipe
    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        onSwipeRight?.()
      } else {
        onSwipeLeft?.()
      }
    }
    
    // Vertical swipe
    if (absY > absX && absY > threshold) {
      if (deltaY > 0) {
        onSwipeDown?.()
      } else {
        onSwipeUp?.()
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold])

  return { onTouchStart, onTouchEnd }
}
