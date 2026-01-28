'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Star, Sparkles, Trophy, ArrowUp, Gift, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import confetti from 'canvas-confetti'

interface LevelUpModalProps {
  newLevel: number
  previousLevel: number
  unlockedRewards?: Array<{
    name: string
    description: string
    icon?: string
  }>
  onClose: () => void
  isOpen: boolean
}

export function LevelUpModal({
  newLevel,
  previousLevel,
  unlockedRewards = [],
  onClose,
  isOpen,
}: LevelUpModalProps) {
  const [showContent, setShowContent] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti
      const duration = 3000
      const end = Date.now() + duration
      
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#9333ea', '#f59e0b', '#3b82f6'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#9333ea', '#f59e0b', '#3b82f6'],
        })
        
        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      
      frame()
      
      // Show content after brief delay
      setTimeout(() => setShowContent(true), 300)
    } else {
      setShowContent(false)
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={cn(
        'relative bg-gradient-to-b from-purple-900 to-purple-950 rounded-2xl p-8 max-w-md w-full text-center text-white overflow-hidden',
        'transform transition-all duration-500',
        showContent ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
      )}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {/* Sparkles decoration */}
        <div className="absolute top-4 left-4">
          <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
        </div>
        <div className="absolute top-12 right-12">
          <Sparkles className="w-6 h-6 text-purple-300 animate-pulse delay-100" />
        </div>
        
        {/* Level badge */}
        <div className="relative mb-6">
          <div className="w-32 h-32 mx-auto relative">
            {/* Animated ring */}
            <div className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-ping opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-yellow-400" />
            
            {/* Level circle */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
              <div className="text-center">
                <Star className="w-8 h-8 text-white mx-auto mb-1" />
                <span className="text-3xl font-bold text-white">{newLevel}</span>
              </div>
            </div>
          </div>
          
          {/* Level up arrow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-green-500 rounded-full p-1">
            <ArrowUp className="w-4 h-4 text-white" />
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-3xl font-bold mb-2 animate-bounce-in">
          Level Up!
        </h2>
        
        <p className="text-purple-200 mb-6">
          Congratulations! You&apos;ve reached Level {newLevel}!
        </p>
        
        {/* Level change */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-300">{previousLevel}</div>
            <div className="text-xs text-purple-400">Previous</div>
          </div>
          <ArrowUp className="w-6 h-6 text-green-400" />
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{newLevel}</div>
            <div className="text-xs text-yellow-400/70">Current</div>
          </div>
        </div>
        
        {/* Unlocked rewards */}
        {unlockedRewards.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-pink-400" />
              <span className="text-sm font-medium text-pink-300">Unlocked Rewards</span>
            </div>
            <div className="space-y-2">
              {unlockedRewards.map((reward, index) => (
                <div
                  key={index}
                  className="bg-white/10 rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-2xl">{reward.icon || '🎁'}</span>
                  <div className="text-left">
                    <div className="font-medium">{reward.name}</div>
                    <div className="text-xs text-purple-300">{reward.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Continue button */}
        <Button
          onClick={onClose}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
        >
          <Trophy className="w-5 h-5 mr-2" />
          Awesome!
        </Button>
      </div>
    </div>
  )
}

// Achievement unlocked toast
interface AchievementUnlockedToastProps {
  name: string
  icon?: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  pointsReward: number
  onClose?: () => void
}

const tierGradients = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-amber-500',
  platinum: 'from-purple-500 to-purple-700',
}

export function AchievementUnlockedToast({
  name,
  icon = '🏆',
  tier,
  pointsReward,
  onClose,
}: AchievementUnlockedToastProps) {
  useEffect(() => {
    // Small confetti burst
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#fbbf24', '#9333ea', '#f472b6'],
    })
    
    // Auto close after 5 seconds
    const timer = setTimeout(() => {
      onClose?.()
    }, 5000)
    
    return () => clearTimeout(timer)
  }, [onClose])
  
  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50',
      'animate-slide-up'
    )}>
      <div className={cn(
        'bg-gradient-to-r text-white rounded-xl p-4 shadow-xl max-w-sm',
        tierGradients[tier]
      )}>
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">
            {icon}
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
              <Sparkles className="w-3 h-3" />
              Achievement Unlocked!
            </div>
            <div className="font-bold">{name}</div>
            <div className="text-sm opacity-90">+{pointsReward} points</div>
          </div>
          
          {/* Close */}
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
