"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Keyboard,
  Contrast,
  Type,
  Monitor,
  Settings,
  Save,
  RotateCcw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AccessibilitySettings {
  screenReader: boolean
  highContrast: boolean
  largeText: boolean
  keyboardNav: boolean
  voiceCommands: boolean
  zoomLevel: number
  reduceMotion: boolean
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  language: 'en' | 'sw'
  fontSize: number
  lineHeight: number
}

interface AccessibilityToolsProps {
  onSettingsChange?: (settings: AccessibilitySettings) => void
  initialSettings?: Partial<AccessibilitySettings>
}

const defaultSettings: AccessibilitySettings = {
  screenReader: false,
  highContrast: false,
  largeText: false,
  keyboardNav: true,
  voiceCommands: false,
  zoomLevel: 100,
  reduceMotion: false,
  colorBlindMode: 'none',
  language: 'en',
  fontSize: 16,
  lineHeight: 1.5
}

export function AccessibilityTools({ onSettingsChange, initialSettings }: AccessibilityToolsProps) {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AccessibilitySettings>({
    ...defaultSettings,
    ...initialSettings
  })
  const [isOpen, setIsOpen] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('pos-accessibility-settings')
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsedSettings })
      } catch (error) {
        console.warn('Failed to parse saved accessibility settings:', error)
      }
    }
  }, [])

  // Apply settings to document when they change
  useEffect(() => {
    applyAccessibilitySettings(settings)
    onSettingsChange?.(settings)
  }, [settings, onSettingsChange])

  const applyAccessibilitySettings = (newSettings: AccessibilitySettings) => {
    const root = document.documentElement

    // High contrast mode
    if (newSettings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // Large text mode
    if (newSettings.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }

    // Reduce motion
    if (newSettings.reduceMotion) {
      root.style.setProperty('--animation-duration', '0s')
    } else {
      root.style.removeProperty('--animation-duration')
    }

    // Zoom level
    root.style.setProperty('--zoom-level', `${newSettings.zoomLevel}%`)

    // Font size
    root.style.setProperty('--base-font-size', `${newSettings.fontSize}px`)

    // Line height
    root.style.setProperty('--line-height', newSettings.lineHeight.toString())

    // Color blind modes
    root.classList.remove('color-blind-protanopia', 'color-blind-deuteranopia', 'color-blind-tritanopia')
    if (newSettings.colorBlindMode !== 'none') {
      root.classList.add(`color-blind-${newSettings.colorBlindMode}`)
    }
  }

  const handleSettingChange = (key: keyof AccessibilitySettings, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    // Save to localStorage
    localStorage.setItem('pos-accessibility-settings', JSON.stringify(newSettings))

    toast({
      title: "Settings Updated",
      description: "Accessibility settings have been applied"
    })
  }

  const resetToDefaults = () => {
    setSettings(defaultSettings)
    localStorage.removeItem('pos-accessibility-settings')
    toast({
      title: "Settings Reset",
      description: "Accessibility settings reset to defaults"
    })
  }

  const speakText = (text: string) => {
    if ('speechSynthesis' in window && settings.voiceCommands) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = settings.language === 'sw' ? 'sw-TZ' : 'en-US'
      utterance.rate = 0.8
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }

  const announceChange = (settingName: string, value: any) => {
    if (settings.screenReader) {
      const announcement = `${settingName} ${value ? 'enabled' : 'disabled'}`
      speakText(announcement)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        title="Accessibility Settings"
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Accessibility</span>
      </Button>

      {isOpen && (
        <Card className="absolute top-12 right-0 z-50 w-96 max-h-96 overflow-y-auto shadow-lg border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Accessibility Settings
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                ×
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Vision Settings */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Vision
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-contrast" className="flex items-center gap-2">
                    <Contrast className="h-4 w-4" />
                    High Contrast
                  </Label>
                  <Switch
                    id="high-contrast"
                    checked={settings.highContrast}
                    onCheckedChange={(checked) => {
                      handleSettingChange('highContrast', checked)
                      announceChange('High contrast mode', checked)
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="large-text" className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    Large Text
                  </Label>
                  <Switch
                    id="large-text"
                    checked={settings.largeText}
                    onCheckedChange={(checked) => {
                      handleSettingChange('largeText', checked)
                      announceChange('Large text mode', checked)
                    }}
                  />
                </div>
              </div>

              {/* Color Blind Mode */}
              <div className="space-y-2">
                <Label>Color Blind Mode</Label>
                <Select
                  value={settings.colorBlindMode}
                  onValueChange={(value: AccessibilitySettings['colorBlindMode']) =>
                    handleSettingChange('colorBlindMode', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="protanopia">Protanopia (Red-Green)</SelectItem>
                    <SelectItem value="deuteranopia">Deuteranopia (Green-Red)</SelectItem>
                    <SelectItem value="tritanopia">Tritanopia (Blue-Yellow)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zoom Level */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  Zoom Level: {settings.zoomLevel}%
                </Label>
                <Slider
                  value={[settings.zoomLevel]}
                  onValueChange={([value]: number[]) => handleSettingChange('zoomLevel', value)}
                  min={75}
                  max={150}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            {/* Navigation Settings */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Navigation
              </h4>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="screen-reader" className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Screen Reader
                  </Label>
                  <Switch
                    id="screen-reader"
                    checked={settings.screenReader}
                    onCheckedChange={(checked) => {
                      handleSettingChange('screenReader', checked)
                      announceChange('Screen reader mode', checked)
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="keyboard-nav" className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4" />
                    Keyboard Navigation
                  </Label>
                  <Switch
                    id="keyboard-nav"
                    checked={settings.keyboardNav}
                    onCheckedChange={(checked) => {
                      handleSettingChange('keyboardNav', checked)
                      announceChange('Keyboard navigation', checked)
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-commands" className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Voice Commands
                  </Label>
                  <Switch
                    id="voice-commands"
                    checked={settings.voiceCommands}
                    onCheckedChange={(checked) => {
                      handleSettingChange('voiceCommands', checked)
                      announceChange('Voice commands', checked)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Language Settings */}
            <div className="space-y-3">
              <h4 className="font-medium">Language & Display</h4>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(value: 'en' | 'sw') => handleSettingChange('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sw">Kiswahili</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <Label>Font Size: {settings.fontSize}px</Label>
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([value]: number[]) => handleSettingChange('fontSize', value)}
                  min={12}
                  max={24}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Line Height */}
              <div className="space-y-2">
                <Label>Line Height: {settings.lineHeight}</Label>
                <Slider
                  value={[settings.lineHeight]}
                  onValueChange={([value]: number[]) => handleSettingChange('lineHeight', value)}
                  min={1.2}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Reduce Motion */}
              <div className="flex items-center justify-between">
                <Label htmlFor="reduce-motion">Reduce Motion</Label>
                <Switch
                  id="reduce-motion"
                  checked={settings.reduceMotion}
                  onCheckedChange={(checked) => {
                    handleSettingChange('reduceMotion', checked)
                    announceChange('Reduce motion', checked)
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Done
              </Button>
            </div>

            {/* Kenya-Specific Info */}
            <div className="bg-blue-50 p-3 rounded-lg mt-4">
              <p className="text-xs text-blue-800">
                <strong>Kenya Accessibility:</strong> Screen reader support includes Swahili voice output.
                Voice commands work with both English and Kiswahili.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Settings Indicator */}
      {(settings.highContrast || settings.largeText || settings.screenReader) && (
        <Badge variant="secondary" className="ml-2">
          {[
            settings.screenReader && 'SR',
            settings.highContrast && 'HC',
            settings.largeText && 'LT'
          ].filter(Boolean).join('+')}
        </Badge>
      )}
    </div>
  )
}