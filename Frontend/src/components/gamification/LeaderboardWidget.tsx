'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  score: number
  rankChange: number
  isCurrentUser?: boolean
}

interface LeaderboardWidgetProps {
  title: string
  description?: string
  metric: string
  period: string
  entries: LeaderboardEntry[]
  currentUserRank?: LeaderboardEntry | null
  onViewAll?: () => void
  className?: string
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-500" />
    case 2:
      return <Medal className="w-5 h-5 text-gray-400" />
    case 3:
      return <Medal className="w-5 h-5 text-amber-600" />
    default:
      return null
  }
}

const getRankChange = (change: number) => {
  if (change > 0) {
    return (
      <span className="flex items-center text-green-500 text-xs">
        <TrendingUp className="w-3 h-3 mr-0.5" />
        {change}
      </span>
    )
  } else if (change < 0) {
    return (
      <span className="flex items-center text-red-500 text-xs">
        <TrendingDown className="w-3 h-3 mr-0.5" />
        {Math.abs(change)}
      </span>
    )
  }
  return (
    <span className="flex items-center text-gray-400 text-xs">
      <Minus className="w-3 h-3" />
    </span>
  )
}

const formatScore = (score: number, metric: string) => {
  if (metric === 'points' || metric === 'level' || metric === 'achievements') {
    return score.toLocaleString()
  }
  // For sales values
  return `KES ${score.toLocaleString()}`
}

export function LeaderboardWidget({
  title,
  description,
  metric,
  period,
  entries,
  currentUserRank,
  onViewAll,
  className,
}: LeaderboardWidgetProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground capitalize">{period}</span>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Entries */}
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={entry.userId}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                entry.rank === 1 && 'bg-yellow-50 dark:bg-yellow-900/20',
                entry.rank === 2 && 'bg-gray-50 dark:bg-gray-800/50',
                entry.rank === 3 && 'bg-amber-50 dark:bg-amber-900/20',
                entry.isCurrentUser && 'ring-2 ring-blue-500',
                !entry.isCurrentUser && entry.rank > 3 && 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
              )}
            >
              {/* Rank */}
              <div className="w-8 flex items-center justify-center">
                {getRankIcon(entry.rank) || (
                  <span className={cn(
                    'text-sm font-bold',
                    entry.rank <= 3 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'
                  )}>
                    #{entry.rank}
                  </span>
                )}
              </div>
              
              {/* Avatar and name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={cn(
                    entry.rank === 1 && 'bg-yellow-200 text-yellow-800',
                    entry.rank === 2 && 'bg-gray-200 text-gray-800',
                    entry.rank === 3 && 'bg-amber-200 text-amber-800',
                    entry.rank > 3 && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  )}>
                    {entry.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={cn(
                  'text-sm truncate',
                  entry.isCurrentUser && 'font-semibold'
                )}>
                  {entry.userName}
                  {entry.isCurrentUser && (
                    <span className="text-xs text-blue-500 ml-1">(You)</span>
                  )}
                </span>
              </div>
              
              {/* Score and rank change */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {formatScore(entry.score, metric)}
                </span>
                {getRankChange(entry.rankChange)}
              </div>
            </div>
          ))}
        </div>
        
        {/* Current user rank if not in top list */}
        {currentUserRank && !entries.find(e => e.isCurrentUser) && (
          <div className="mt-4 pt-4 border-t border-dashed">
            <p className="text-xs text-muted-foreground mb-2">Your position</p>
            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500">
              <div className="w-8 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-500">
                  #{currentUserRank.rank}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-200 text-blue-800">
                    {currentUserRank.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold truncate">
                  {currentUserRank.userName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {formatScore(currentUserRank.score, metric)}
                </span>
                {getRankChange(currentUserRank.rankChange)}
              </div>
            </div>
          </div>
        )}
        
        {/* View all button */}
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full mt-4 text-center text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            View Full Leaderboard
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar/small spaces
interface CompactLeaderboardProps {
  entries: LeaderboardEntry[]
  currentUserId?: string
}

export function CompactLeaderboard({ entries, currentUserId }: CompactLeaderboardProps) {
  const topThree = entries.slice(0, 3)
  
  return (
    <div className="space-y-1">
      {topThree.map((entry) => (
        <div
          key={entry.userId}
          className={cn(
            'flex items-center gap-2 text-sm py-1',
            entry.userId === currentUserId && 'font-semibold text-blue-500'
          )}
        >
          {getRankIcon(entry.rank) || <span className="w-5 text-center">#{entry.rank}</span>}
          <span className="flex-1 truncate">{entry.userName}</span>
          <span className="font-medium">{entry.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
