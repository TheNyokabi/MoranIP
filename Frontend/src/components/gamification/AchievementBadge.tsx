'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AchievementBadgeProps {
  name: string
  description?: string
  icon?: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  isEarned: boolean
  progress?: number
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const tierColors = {
  bronze: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
  },
  silver: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-400',
    text: 'text-gray-700 dark:text-gray-300',
    ring: 'ring-gray-400',
  },
  gold: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
    ring: 'ring-yellow-500',
  },
  platinum: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-500',
  },
}

const sizeClasses = {
  sm: 'w-12 h-12 text-lg',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-20 h-20 text-3xl',
}

export function AchievementBadge({
  name,
  description,
  icon = '🏆',
  tier,
  isEarned,
  progress = 0,
  showProgress = false,
  size = 'md',
  onClick,
}: AchievementBadgeProps) {
  const colors = tierColors[tier]
  
  const badge = (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full border-2 transition-all',
        sizeClasses[size],
        colors.bg,
        colors.border,
        isEarned ? 'opacity-100' : 'opacity-50 grayscale',
        onClick && 'cursor-pointer hover:scale-110',
        isEarned && 'shadow-lg'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <span className="select-none">{icon}</span>
      
      {/* Earned check mark */}
      {isEarned && (
        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      
      {/* Locked indicator */}
      {!isEarned && (
        <div className="absolute -bottom-1 -right-1 bg-gray-500 rounded-full p-0.5">
          <Lock className="w-3 h-3 text-white" />
        </div>
      )}
      
      {/* Progress ring */}
      {showProgress && !isEarned && progress > 0 && (
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle
            className="stroke-current text-gray-200 dark:text-gray-700"
            strokeWidth="8"
            fill="transparent"
            r="42"
            cx="50"
            cy="50"
          />
          <circle
            className={cn('stroke-current', colors.text)}
            strokeWidth="8"
            strokeLinecap="round"
            fill="transparent"
            r="42"
            cx="50"
            cy="50"
            style={{
              strokeDasharray: `${2 * Math.PI * 42}`,
              strokeDashoffset: `${2 * Math.PI * 42 * (1 - progress / 100)}`,
            }}
          />
        </svg>
      )}
    </div>
  )
  
  if (!description) {
    return badge
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
            {!isEarned && progress > 0 && (
              <p className="text-xs text-muted-foreground">
                Progress: {Math.round(progress)}%
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Achievement card with more details
interface AchievementCardProps {
  name: string
  description?: string
  icon?: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  pointsReward: number
  isEarned: boolean
  earnedAt?: string
  progressCurrent: number
  progressTarget: number
  onClaim?: () => void
  isClaimed?: boolean
}

export function AchievementCard({
  name,
  description,
  icon = '🏆',
  tier,
  pointsReward,
  isEarned,
  earnedAt,
  progressCurrent,
  progressTarget,
  onClaim,
  isClaimed,
}: AchievementCardProps) {
  const colors = tierColors[tier]
  const progress = progressTarget > 0 ? (progressCurrent / progressTarget) * 100 : 0
  
  return (
    <div
      className={cn(
        'relative p-4 rounded-lg border-2 transition-all',
        colors.border,
        isEarned ? colors.bg : 'bg-gray-50 dark:bg-gray-900/50',
        !isEarned && 'opacity-70'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Badge */}
        <AchievementBadge
          name={name}
          icon={icon}
          tier={tier}
          isEarned={isEarned}
          progress={progress}
          showProgress={!isEarned}
          size="lg"
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn('font-semibold', colors.text)}>{name}</h3>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full capitalize',
              colors.bg, colors.text
            )}>
              {tier}
            </span>
          </div>
          
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
          
          {/* Progress */}
          {!isEarned && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{progressCurrent} / {progressTarget}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all', colors.bg)}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Earned info */}
          {isEarned && earnedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Earned on {new Date(earnedAt).toLocaleDateString()}
            </p>
          )}
          
          {/* Points reward */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              +{pointsReward} points
            </span>
            
            {isEarned && !isClaimed && onClaim && (
              <button
                onClick={onClaim}
                className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
              >
                Claim Reward
              </button>
            )}
            
            {isClaimed && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Claimed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
