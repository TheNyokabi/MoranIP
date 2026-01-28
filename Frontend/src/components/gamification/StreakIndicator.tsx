'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Flame, Calendar, Award, TrendingUp } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StreakIndicatorProps {
  currentStreak: number
  longestStreak: number
  variant?: 'default' | 'compact' | 'detailed'
  className?: string
}

const getStreakColor = (streak: number) => {
  if (streak >= 30) return 'text-purple-500'
  if (streak >= 14) return 'text-orange-500'
  if (streak >= 7) return 'text-yellow-500'
  if (streak >= 3) return 'text-orange-400'
  return 'text-gray-400'
}

const getStreakBgColor = (streak: number) => {
  if (streak >= 30) return 'bg-purple-100 dark:bg-purple-900/30'
  if (streak >= 14) return 'bg-orange-100 dark:bg-orange-900/30'
  if (streak >= 7) return 'bg-yellow-100 dark:bg-yellow-900/30'
  if (streak >= 3) return 'bg-orange-100 dark:bg-orange-900/30'
  return 'bg-gray-100 dark:bg-gray-800'
}

const getStreakMessage = (streak: number) => {
  if (streak >= 30) return 'Incredible! You are on fire!'
  if (streak >= 14) return 'Amazing streak! Keep going!'
  if (streak >= 7) return 'Great week! Maintain the momentum!'
  if (streak >= 3) return 'Nice start! Build your streak!'
  if (streak > 0) return 'Streak started! Keep it up!'
  return 'Start your streak today!'
}

export function StreakIndicator({
  currentStreak,
  longestStreak,
  variant = 'default',
  className,
}: StreakIndicatorProps) {
  const streakColor = getStreakColor(currentStreak)
  const bgColor = getStreakBgColor(currentStreak)
  
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full',
              bgColor,
              className
            )}>
              <Flame className={cn('w-4 h-4', streakColor, currentStreak > 0 && 'animate-pulse')} />
              <span className={cn('font-bold', streakColor)}>{currentStreak}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{currentStreak} day streak</p>
              <p className="text-xs text-muted-foreground">
                Best: {longestStreak} days
              </p>
              <p className="text-xs">{getStreakMessage(currentStreak)}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  if (variant === 'detailed') {
    // Generate last 7 days
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isActive: i < currentStreak || (i === 0 && currentStreak > 0),
      })
    }
    
    return (
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={cn('w-6 h-6', streakColor)} />
            <div>
              <div className="font-bold text-lg">{currentStreak} Day Streak</div>
              <div className="text-xs text-muted-foreground">
                {getStreakMessage(currentStreak)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Award className="w-4 h-4" />
              <span>Best: {longestStreak} days</span>
            </div>
          </div>
        </div>
        
        {/* Weekly calendar */}
        <div className="flex justify-between gap-1">
          {days.map((day, index) => (
            <div key={index} className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground mb-1">
                {day.dayName}
              </span>
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                day.isActive 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              )}>
                {day.isActive ? (
                  <Flame className="w-4 h-4" />
                ) : (
                  <span className="text-xs">{day.date.getDate()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Bonus multiplier */}
        {currentStreak > 0 && (
          <div className={cn(
            'flex items-center justify-between p-3 rounded-lg',
            bgColor
          )}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium">Streak Bonus</span>
            </div>
            <span className={cn('font-bold', streakColor)}>
              +{Math.min(currentStreak * 5, 50)}% points
            </span>
          </div>
        )}
      </div>
    )
  }
  
  // Default variant
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 rounded-lg',
      bgColor,
      className
    )}>
      <div className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center',
        currentStreak > 0 ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
      )}>
        <Flame className={cn(
          'w-8 h-8',
          currentStreak > 0 ? 'text-white' : 'text-gray-500'
        )} />
      </div>
      
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-bold', streakColor)}>
            {currentStreak}
          </span>
          <span className="text-muted-foreground">day streak</span>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {getStreakMessage(currentStreak)}
        </div>
      </div>
      
      <div className="text-right">
        <div className="text-xs text-muted-foreground">Best</div>
        <div className="flex items-center gap-1">
          <Award className="w-4 h-4 text-yellow-500" />
          <span className="font-bold">{longestStreak}</span>
        </div>
      </div>
    </div>
  )
}

// Streak broken notification
interface StreakBrokenProps {
  previousStreak: number
  onClose?: () => void
}

export function StreakBroken({ previousStreak, onClose }: StreakBrokenProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full text-center shadow-xl">
        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <Flame className="w-10 h-10 text-gray-400" />
        </div>
        
        <h3 className="text-xl font-bold mb-2">Streak Lost</h3>
        <p className="text-muted-foreground mb-4">
          Your {previousStreak} day streak has ended. Don&apos;t worry, you can start a new one today!
        </p>
        
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          Start New Streak
        </button>
      </div>
    </div>
  )
}
