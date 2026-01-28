'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Coins, Star, TrendingUp, Sparkles } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

interface PointsDisplayProps {
  available: number
  totalEarned: number
  level: number
  experience: number
  experienceToNext: number
  className?: string
  variant?: 'default' | 'compact' | 'card'
  showLevel?: boolean
}

export function PointsDisplay({
  available,
  totalEarned,
  level,
  experience,
  experienceToNext,
  className,
  variant = 'default',
  showLevel = true,
}: PointsDisplayProps) {
  const levelProgress = experienceToNext > 0 
    ? Math.round((experience / experienceToNext) * 100) 
    : 100
  
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Coins className="w-4 h-4 text-yellow-500" />
        <span className="font-semibold">{available.toLocaleString()}</span>
        {showLevel && (
          <>
            <span className="text-muted-foreground">|</span>
            <Star className="w-4 h-4 text-purple-500" />
            <span className="font-semibold">Lv.{level}</span>
          </>
        )}
      </div>
    )
  }
  
  if (variant === 'card') {
    return (
      <div className={cn(
        'p-4 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 text-white',
        className
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6" />
            <span className="font-medium">My Points</span>
          </div>
          <Sparkles className="w-5 h-5 opacity-80" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {available.toLocaleString()}
        </div>
        
        <div className="text-sm opacity-90">
          Total earned: {totalEarned.toLocaleString()}
        </div>
        
        {showLevel && (
          <div className="mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Level {level}</span>
              <span className="text-xs opacity-80">
                {experience}/{experienceToNext} XP
              </span>
            </div>
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }
  
  // Default variant
  return (
    <div className={cn('space-y-4', className)}>
      {/* Points Section */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
          <Coins className="w-8 h-8 text-yellow-500" />
        </div>
        <div>
          <div className="text-2xl font-bold">{available.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Available points</div>
        </div>
      </div>
      
      {/* Level Section */}
      {showLevel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-purple-500" />
              <span className="font-medium">Level {level}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {experience} / {experienceToNext} XP
            </span>
          </div>
          <Progress value={levelProgress} className="h-2" />
          <div className="text-xs text-muted-foreground text-center">
            {experienceToNext - experience} XP to next level
          </div>
        </div>
      )}
      
      {/* Stats */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TrendingUp className="w-4 h-4" />
        <span>Total earned: {totalEarned.toLocaleString()} points</span>
      </div>
    </div>
  )
}

// Mini points badge for navigation
interface PointsBadgeProps {
  points: number
  level?: number
  onClick?: () => void
}

export function PointsBadge({ points, level, onClick }: PointsBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
    >
      <Coins className="w-4 h-4" />
      <span className="text-sm font-medium">{points.toLocaleString()}</span>
      {level !== undefined && (
        <>
          <span className="text-yellow-400">|</span>
          <Star className="w-3 h-3 text-purple-500" />
          <span className="text-sm">{level}</span>
        </>
      )}
    </button>
  )
}

// Points animation for earning
interface PointsEarnedAnimationProps {
  points: number
  source: string
  onComplete?: () => void
}

export function PointsEarnedAnimation({ points, source, onComplete }: PointsEarnedAnimationProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])
  
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      <div className="animate-bounce-in bg-yellow-500 text-white px-6 py-3 rounded-full shadow-lg">
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6" />
          <span className="text-xl font-bold">+{points}</span>
          <span className="text-sm opacity-90">points</span>
        </div>
        <div className="text-center text-xs opacity-80">{source}</div>
      </div>
    </div>
  )
}
