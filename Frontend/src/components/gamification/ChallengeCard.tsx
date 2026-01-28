'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { 
  Target, Clock, Users, User, Trophy, 
  CheckCircle, Play, Calendar, Gift
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface ChallengeCardProps {
  id: string
  name: string
  description?: string
  icon?: string
  challengeType: 'individual' | 'team' | 'company'
  metric: string
  targetValue: number
  startDate: string
  endDate: string
  pointsReward: number
  prizeDescription?: string
  status: 'upcoming' | 'active' | 'completed'
  currentValue?: number
  progressPercentage?: number
  isJoined?: boolean
  isCompleted?: boolean
  onJoin?: () => void
  onViewDetails?: () => void
  className?: string
}

const statusColors = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const typeIcons = {
  individual: User,
  team: Users,
  company: Target,
}

const formatMetric = (metric: string) => {
  const metricNames: Record<string, string> = {
    total_sales: 'Total Sales',
    items_sold: 'Items Sold',
    new_customers: 'New Customers',
    sales_count: 'Sales Count',
  }
  return metricNames[metric] || metric
}

const formatValue = (value: number, metric: string) => {
  if (metric === 'total_sales') {
    return `KES ${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

const getTimeRemaining = (endDate: string) => {
  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()
  
  if (diff <= 0) return 'Ended'
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h left`
  
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${minutes}m left`
}

export function ChallengeCard({
  id,
  name,
  description,
  icon = '🎯',
  challengeType,
  metric,
  targetValue,
  startDate,
  endDate,
  pointsReward,
  prizeDescription,
  status,
  currentValue = 0,
  progressPercentage = 0,
  isJoined = false,
  isCompleted = false,
  onJoin,
  onViewDetails,
  className,
}: ChallengeCardProps) {
  const TypeIcon = typeIcons[challengeType]
  const isActive = status === 'active'
  const isUpcoming = status === 'upcoming'
  
  return (
    <Card className={cn(
      'overflow-hidden transition-all hover:shadow-md',
      isCompleted && 'opacity-80',
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{icon}</div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={statusColors[status]}>
                  {status === 'active' && <Play className="w-3 h-3 mr-1" />}
                  {status === 'upcoming' && <Clock className="w-3 h-3 mr-1" />}
                  {status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <TypeIcon className="w-3 h-3 mr-1" />
                  {challengeType}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Reward badge */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Trophy className="w-4 h-4" />
              <span className="font-bold">{pointsReward.toLocaleString()}</span>
            </div>
            <span className="text-xs text-muted-foreground">points</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        
        {/* Goal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Goal:</span>
          <span className="font-medium">
            {formatValue(targetValue, metric)} {formatMetric(metric)}
          </span>
        </div>
        
        {/* Progress (for active challenges when joined) */}
        {isActive && isJoined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {formatValue(currentValue, metric)} / {formatValue(targetValue, metric)}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="text-center text-xs text-muted-foreground">
              {Math.round(progressPercentage)}% complete
            </div>
          </div>
        )}
        
        {/* Time info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>
              {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
            </span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1 text-orange-500">
              <Clock className="w-3 h-3" />
              <span>{getTimeRemaining(endDate)}</span>
            </div>
          )}
        </div>
        
        {/* Prize description */}
        {prizeDescription && (
          <div className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm">
            <Gift className="w-4 h-4 text-purple-500 mt-0.5" />
            <span className="text-purple-700 dark:text-purple-300">{prizeDescription}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {isActive && !isJoined && onJoin && (
            <Button onClick={onJoin} className="flex-1">
              Join Challenge
            </Button>
          )}
          
          {isActive && isJoined && !isCompleted && (
            <Button variant="outline" className="flex-1" disabled>
              <Play className="w-4 h-4 mr-2" />
              In Progress
            </Button>
          )}
          
          {isCompleted && (
            <Button variant="outline" className="flex-1" disabled>
              <CheckCircle className="w-4 h-4 mr-2" />
              Completed
            </Button>
          )}
          
          {isUpcoming && (
            <Button variant="outline" className="flex-1" disabled>
              <Clock className="w-4 h-4 mr-2" />
              Starts {new Date(startDate).toLocaleDateString()}
            </Button>
          )}
          
          {onViewDetails && (
            <Button variant="ghost" onClick={onViewDetails}>
              Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact challenge list item
interface ChallengeListItemProps {
  name: string
  icon?: string
  targetValue: number
  metric: string
  currentValue: number
  progressPercentage: number
  pointsReward: number
  timeRemaining?: string
  onClick?: () => void
}

export function ChallengeListItem({
  name,
  icon = '🎯',
  targetValue,
  metric,
  currentValue,
  progressPercentage,
  pointsReward,
  timeRemaining,
  onClick,
}: ChallengeListItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="text-2xl">{icon}</div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{name}</span>
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            +{pointsReward}
          </span>
        </div>
        
        <div className="mt-1">
          <Progress value={progressPercentage} className="h-1.5" />
        </div>
        
        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
          <span>
            {formatValue(currentValue, metric)} / {formatValue(targetValue, metric)}
          </span>
          {timeRemaining && (
            <span className="text-orange-500">{timeRemaining}</span>
          )}
        </div>
      </div>
    </div>
  )
}
