"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { Loader2, Printer, Mail, MessageSquare, Download, Share2, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ReceiptPreviewProps {
  invoiceId: string
  onClose?: () => void
}

interface ReceiptData {
  invoice_id: string
  format: string
  language: string
  content: string
  content_type: string
  printer_type?: string
}

export function ReceiptPreview({ invoiceId, onClose }: ReceiptPreviewProps) {
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(false)
  const [format, setFormat] = useState<'html' | 'thermal' | 'pdf'>('html')
  const [language, setLanguage] = useState<'en' | 'sw'>('en')
  const [showPreview, setShowPreview] = useState(true)
  const thermalWidth = 80

  // Load receipt on mount and when format/language changes
  useEffect(() => {
    if (invoiceId && token) {
      loadReceipt()
    }
  }, [invoiceId, format, language, token])

  const loadReceipt = async () => {
    setLoading(true)
    try {
      const url = format === 'thermal'
        ? `/pos/receipts/${invoiceId}/thermal?width=${thermalWidth}&language=${language}`
        : `/pos/receipts/${invoiceId}?format=${format}&language=${language}`

      const response = await apiFetch(url, {}, token)
      setReceiptData(response as ReceiptData)
    } catch (error) {
      console.error('Failed to load receipt:', error)
      toast({
        title: "Error",
        description: "Failed to load receipt",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!receiptData) return

    if (format === 'html') {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(receiptData.content)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 100)
      }
    } else if (format === 'thermal') {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        const safeText = receiptData.content
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')

        printWindow.document.write(`
          <html>
            <head>
              <title>Thermal Receipt - ${invoiceId}</title>
              <style>
                @page { margin: 0; }
                body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; margin: 0; padding: 10px; }
                pre { white-space: pre-wrap; margin: 0; }
              </style>
            </head>
            <body>
              <pre>${safeText}</pre>
              <script>window.print(); window.close();</script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    } else if (format === 'pdf') {
      // Download PDF
      const blob = new Blob([Uint8Array.from(atob(receiptData.content), c => c.charCodeAt(0))], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleEmail = async () => {
    const email = prompt('Enter customer email address:')
    if (!email) return

    setLoading(true)
    try {
      const response = await apiFetch(`/pos/receipts/${invoiceId}/email`, {
        method: 'POST',
        body: JSON.stringify({ email, language })
      }, token)

      toast({
        title: "Email Sent",
        description: `Receipt sent to ${email}`
      })
    } catch (error) {
      console.error('Failed to send email:', error)
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSMS = async () => {
    const phoneNumber = prompt('Enter customer phone number (Kenya format: 07XX XXX XXX):')
    if (!phoneNumber) return

    setLoading(true)
    try {
      const response = await apiFetch(`/pos/receipts/${invoiceId}/sms`, {
        method: 'POST',
        body: JSON.stringify({ phone_number: phoneNumber, language })
      }, token)

      toast({
        title: "SMS Sent",
        description: `Receipt sent to ${phoneNumber}`
      })
    } catch (error) {
      console.error('Failed to send SMS:', error)
      toast({
        title: "Error",
        description: "Failed to send SMS",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!receiptData) return

    if (format === 'pdf') {
      const blob = new Blob([Uint8Array.from(atob(receiptData.content), c => c.charCodeAt(0))], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      // Download as text file
      const blob = new Blob([receiptData.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${invoiceId}.${format === 'html' ? 'html' : 'txt'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    toast({
      title: "Downloaded",
      description: `Receipt saved as ${format.toUpperCase()} file`
    })
  }

  const handleShare = async () => {
    if (!receiptData) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Receipt ${invoiceId}`,
          text: 'Customer Receipt',
          url: window.location.href
        })
      } else {
        // Fallback: copy receipt content to clipboard
        await navigator.clipboard.writeText(receiptData.content)
        toast({
          title: "Copied to Clipboard",
          description: "Receipt content copied for sharing"
        })
      }
    } catch (error) {
      console.error('Failed to share:', error)
      toast({
        title: "Share Failed",
        description: "Unable to share receipt",
        variant: "destructive"
      })
    }
  }

  const renderReceiptPreview = () => {
    if (!receiptData) return null

    if (format === 'html') {
      return (
        <div
          className="border rounded-lg p-4 max-h-96 overflow-auto bg-white"
          dangerouslySetInnerHTML={{ __html: receiptData.content }}
        />
      )
    } else if (format === 'thermal') {
      return (
        <pre className="border rounded-lg p-4 max-h-96 overflow-auto bg-gray-50 font-mono text-sm whitespace-pre-wrap">
          {receiptData.content}
        </pre>
      )
    } else if (format === 'pdf') {
      return (
        <div className="border rounded-lg p-4 max-h-96 overflow-auto bg-gray-50">
          <div className="text-center py-8">
            <Download className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">PDF Receipt Generated</p>
            <p className="text-sm text-gray-500">Click &quot;Download&quot; to save the PDF file</p>
          </div>
        </div>
      )
    }
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Receipt Preview - {invoiceId}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                ×
              </Button>
            )}
          </div>
        </div>

        {/* Format and Language Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'html' | 'thermal' | 'pdf')}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="html">Web/HTML</option>
              <option value="thermal">Thermal Printer</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Language:</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'sw')}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </select>
          </div>

          {receiptData?.printer_type && (
            <Badge variant="outline">{receiptData.printer_type}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handlePrint} disabled={loading}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>

          <Button variant="outline" onClick={handleDownload} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>

          <Button variant="outline" onClick={handleEmail} disabled={loading}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>

          <Button variant="outline" onClick={handleSMS} disabled={loading}>
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS
          </Button>

          <Button variant="outline" onClick={handleShare} disabled={loading}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>

        <Separator />

        {/* Receipt Preview */}
        {showPreview && (
          <div>
            <h3 className="text-lg font-medium mb-2">Preview</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading receipt...</span>
              </div>
            ) : (
              renderReceiptPreview()
            )}
          </div>
        )}

        {/* Kenya-Specific Features Info */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-1">Kenya Market Features:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• M-Pesa transaction codes included on receipts</li>
            <li>• SMS delivery for instant customer notifications</li>
            <li>• Thermal printer formats for 58mm/80mm printers</li>
            <li>• QR codes for invoice verification</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}