"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Camera, CameraOff, Search, Package, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

interface BarcodeScannerProps {
  onItemFound: (item: any) => void
  onClose?: () => void
  posProfileId?: string
}

interface ScannedItem {
  item_code: string
  item_name: string
  standard_rate: number
  barcode?: string
  stock_uom: string
}

export function BarcodeScanner({ onItemFound, onClose, posProfileId }: BarcodeScannerProps) {
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [isScanning, setIsScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [cameraSupported, setCameraSupported] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasCamera = devices.some(device => device.kind === 'videoinput')
        setCameraSupported(hasCamera)
      } catch (error) {
        console.warn('Camera detection failed:', error)
        setCameraSupported(false)
      }
    }

    checkCameraSupport()
  }, [])

  // Start camera scanning
  const startScanning = useCallback(async () => {
    if (!cameraSupported) {
      toast({
        title: "Camera Not Available",
        description: "Camera access is not supported on this device",
        variant: "destructive"
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsScanning(true)
      }
    } catch (error) {
      console.error('Camera access failed:', error)
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to scan barcodes",
        variant: "destructive"
      })
    }
  }, [cameraSupported, toast])

  // Stop camera scanning
  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }, [])

  // Capture frame for barcode processing (simplified - would use a barcode library in production)
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // In a real implementation, you would use a barcode scanning library like:
    // - QuaggaJS
    // - ZXing
    // - BarcodeDetector API (experimental)

    // For demo purposes, we'll simulate barcode detection
    simulateBarcodeDetection()
  }, [])

  // Simulate barcode detection (replace with real barcode library)
  const simulateBarcodeDetection = () => {
    // This is just for demonstration - in production, use proper barcode detection
    const mockBarcodes = [
      '8901234567890', // Mock EAN-13
      'PHN-SAM-S23',   // Item code
      '123456789012'   // Another mock
    ]

    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)]

    if (Math.random() > 0.7) { // 30% chance of "detecting" a barcode
      processBarcode(randomBarcode)
    }
  }

  // Process detected barcode
  const processBarcode = async (barcode: string) => {
    if (barcode === lastScanned) return // Avoid duplicate scans

    setLastScanned(barcode)
    stopScanning()

    toast({
      title: "Barcode Detected",
      description: `Scanning: ${barcode}`
    })

    await searchItem(barcode)
  }

  // Search for item by barcode or code
  const searchItem = async (searchTerm: string) => {
    setSearching(true)

    try {
      const response = await apiFetch(`/pos/quick-actions/search-items?q=${encodeURIComponent(searchTerm)}${posProfileId ? `&pos_profile_id=${posProfileId}` : ''}&limit=5`, {}, token)

      const items = (response as any).search_results || []

      if (items.length === 1) {
        // Exact match - auto-add item
        const item = items[0]
        onItemFound({
          item_code: item.item_code,
          item_name: item.item_name,
          rate: item.standard_rate,
          qty: 1,
          barcode: item.barcode,
          stock_uom: item.stock_uom
        })

        toast({
          title: "Item Found",
          description: `${item.item_name} added to cart`
        })

        setLastScanned(null) // Allow rescanning same item

      } else if (items.length > 1) {
        // Multiple matches - show selection
        toast({
          title: "Multiple Items Found",
          description: `Found ${items.length} items. Please select one.`,
          variant: "default"
        })

        // In a real implementation, show a selection dialog
        // For now, just take the first one
        const item = items[0]
        onItemFound({
          item_code: item.item_code,
          item_name: item.item_name,
          rate: item.standard_rate,
          qty: 1,
          barcode: item.barcode,
          stock_uom: item.stock_uom
        })

      } else {
        // No items found
        toast({
          title: "Item Not Found",
          description: `No item found for: ${searchTerm}`,
          variant: "destructive"
        })
      }

    } catch (error) {
      console.error('Item search failed:', error)
      toast({
        title: "Search Failed",
        description: "Could not search for item",
        variant: "destructive"
      })
    } finally {
      setSearching(false)
    }
  }

  // Handle manual entry
  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      toast({
        title: "Enter Code",
        description: "Please enter an item code or barcode",
        variant: "destructive"
      })
      return
    }

    await searchItem(manualCode.trim())
    setManualCode('')
  }

  // Handle key press in manual input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit()
    }
  }

  // Continuous scanning when camera is active
  useEffect(() => {
    let scanInterval: NodeJS.Timeout

    if (isScanning) {
      scanInterval = setInterval(captureFrame, 1000) // Scan every second
    }

    return () => {
      if (scanInterval) {
        clearInterval(scanInterval)
      }
    }
  }, [isScanning, captureFrame])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Barcode Scanner
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant={mode === 'camera' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('camera')}
            disabled={!cameraSupported}
          >
            <Camera className="h-4 w-4 mr-2" />
            Camera
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('manual')}
          >
            <Search className="h-4 w-4 mr-2" />
            Manual
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mode === 'camera' && (
          <div className="space-y-4">
            {!cameraSupported ? (
              <div className="text-center py-8">
                <CameraOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Camera not supported on this device
                </p>
                <Button
                  variant="outline"
                  onClick={() => setMode('manual')}
                  className="mt-4"
                >
                  Use Manual Entry
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 bg-black rounded-lg object-cover"
                    style={{ transform: 'scaleX(-1)' }} // Mirror for natural feel
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />

                  {/* Scanning overlay */}
                  {isScanning && (
                    <div className="absolute inset-0 border-2 border-blue-500 rounded-lg">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-48 h-1 bg-red-500 animate-pulse"></div>
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-blue-500 text-white">
                          Scanning...
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startScanning} className="flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Scanning
                    </Button>
                  ) : (
                    <Button onClick={stopScanning} variant="outline" className="flex-1">
                      <CameraOff className="h-4 w-4 mr-2" />
                      Stop Scanning
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setMode('manual')}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {searching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span>Searching for item...</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-code">Enter Item Code or Barcode</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="manual-code"
                  placeholder="e.g., PHN-SAM-S23 or 8901234567890"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button
                  onClick={handleManualSubmit}
                  disabled={searching || !manualCode.trim()}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setMode('camera')}
                disabled={!cameraSupported}
              >
                <Camera className="h-4 w-4 mr-2" />
                Use Camera Instead
              </Button>
            </div>

            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Searching for item...</span>
              </div>
            )}
          </div>
        )}

        {/* Supported formats info */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-1">Supported Formats:</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <div>• EAN-13, Code 128, QR Codes</div>
            <div>• Item codes, barcodes, serial numbers</div>
            <div>• Manual entry always available</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4 border-t">
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setLastScanned(null)
              setManualCode('')
            }}
            className="flex-1"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}