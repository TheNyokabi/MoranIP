"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Smartphone, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

interface MpesaPaymentModalProps {
  amount: number
  invoiceId: string
  customerName?: string
  onSuccess: (paymentData: any) => void
  onCancel: () => void
}

type PaymentStatus = 'idle' | 'initiating' | 'waiting' | 'completed' | 'failed'

export function MpesaPaymentModal({ amount, invoiceId, customerName, onSuccess, onCancel }: MpesaPaymentModalProps) {
  const { token } = useAuthStore()
  const { toast } = useToast()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [paymentData, setPaymentData] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes countdown
  const [errorMessage, setErrorMessage] = useState('')

  // Countdown timer for payment timeout
  useEffect(() => {
    if (status === 'waiting' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (status === 'waiting' && timeLeft === 0) {
      setStatus('failed')
      setErrorMessage('Payment timeout. Please try again.')
    }
  }, [status, timeLeft])

  // Auto-check payment status every 10 seconds when waiting
  useEffect(() => {
    if (status === 'waiting') {
      const checkInterval = setInterval(checkPaymentStatus, 10000)
      return () => clearInterval(checkInterval)
    }
  }, [status, paymentData])

  const formatPhoneNumber = (input: string) => {
    // Remove all non-numeric characters
    const cleaned = input.replace(/\D/g, '')

    // Format based on length
    if (cleaned.length >= 10) {
      if (cleaned.startsWith('254')) {
        return cleaned.slice(0, 12)
      } else if (cleaned.startsWith('0')) {
        return '254' + cleaned.slice(1, 10)
      } else if (cleaned.length === 9 && cleaned.startsWith('7')) {
        return '254' + cleaned
      }
    }

    return cleaned
  }

  const validatePhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '')
    const kenyaPrefixes = ['700', '701', '702', '703', '704', '705', '706', '707', '708', '709',
                          '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
                          '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
                          '730', '731', '740', '741', '742', '743', '744', '745', '746', '747',
                          '748', '749', '750', '751', '752', '753', '754', '755', '756', '757',
                          '758', '759']

    if (cleaned.startsWith('254') && cleaned.length === 12) {
      const prefix = cleaned.slice(3, 6)
      return kenyaPrefixes.includes(prefix)
    }

    return false
  }

  const handlePhoneNumberChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setPhoneNumber(formatted)
  }

  const initiatePayment = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Kenyan phone number",
        variant: "destructive"
      })
      return
    }

    setStatus('initiating')
    setErrorMessage('')

    try {
      const response = await apiFetch('/pos/payments/mpesa/stk-push', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: phoneNumber,
          amount: amount,
          account_reference: invoiceId,
          transaction_desc: `Payment for Invoice ${invoiceId}`
        })
      }, token)

      setPaymentData(response)
      setStatus('waiting')
      setTimeLeft(300) // Reset 5-minute timer

      toast({
        title: "Payment Initiated",
        description: "Please check your phone and enter your M-Pesa PIN"
      })

    } catch (error: any) {
      setStatus('failed')
      setErrorMessage(error.message || 'Failed to initiate payment')
      toast({
        title: "Payment Failed",
        description: "Could not initiate M-Pesa payment",
        variant: "destructive"
      })
    }
  }

  const checkPaymentStatus = async () => {
    if (!paymentData?.checkout_request_id) return

    try {
      const response = await apiFetch('/pos/payments/mpesa/query', {
        method: 'POST',
        body: JSON.stringify({
          checkout_request_id: paymentData.checkout_request_id
        })
      }, token)

      if (response.status === 'completed') {
        setStatus('completed')
        onSuccess({
          ...response,
          phone_number: phoneNumber,
          amount: amount
        })

        toast({
          title: "Payment Successful",
          description: `KES ${amount} received from ${phoneNumber}`
        })
      } else if (response.status === 'failed') {
        setStatus('failed')
        setErrorMessage('Payment was declined or failed')
      }

    } catch (error) {
      // Silently handle status check errors
      console.warn('Payment status check failed:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
        return <Smartphone className="h-8 w-8 text-blue-500" />
      case 'initiating':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      case 'waiting':
        return <Clock className="h-8 w-8 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-500" />
      default:
        return <AlertCircle className="h-8 w-8 text-gray-500" />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'idle':
        return "Enter your M-Pesa phone number to proceed"
      case 'initiating':
        return "Initiating payment request..."
      case 'waiting':
        return `Check your phone and enter M-Pesa PIN. Time remaining: ${formatTime(timeLeft)}`
      case 'completed':
        return "Payment completed successfully!"
      case 'failed':
        return errorMessage || "Payment failed. Please try again."
      default:
        return ""
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            M-Pesa Payment
            <Badge variant="outline">KES {amount}</Badge>
          </CardTitle>
          {customerName && (
            <p className="text-sm text-muted-foreground">Customer: {customerName}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>
          </div>

          {status === 'idle' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0712345678 or 254712345678"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  className="text-center text-lg"
                  maxLength={13}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your Safaricom number (0700-0799)
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Invoice:</strong> {invoiceId}<br/>
                  <strong>Amount:</strong> KES {amount}<br/>
                  <strong>Processing Fee:</strong> Free
                </p>
              </div>
            </div>
          )}

          {status === 'waiting' && paymentData && (
            <div className="space-y-3">
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>STK Push sent to:</strong> {phoneNumber}<br/>
                  <strong>Reference:</strong> {paymentData.checkout_request_id}<br/>
                  <strong>Expires in:</strong> {formatTime(timeLeft)}
                </p>
              </div>

              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Waiting for payment confirmation...
                </p>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="space-y-3">
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-green-800 font-medium">Payment Successful!</p>
                <p className="text-sm text-green-700">
                  KES {amount} received<br/>
                  Transaction: {paymentData?.mpesa_receipt_number || 'Processing'}
                </p>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-3">
              <div className="bg-red-50 p-3 rounded-lg text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <p className="text-red-800 font-medium">Payment Failed</p>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {status === 'idle' && (
              <>
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={initiatePayment}
                  disabled={!validatePhoneNumber(phoneNumber) || status === 'initiating'}
                  className="flex-1"
                >
                  {status === 'initiating' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Pay Now
                </Button>
              </>
            )}

            {status === 'waiting' && (
              <Button variant="outline" onClick={() => setStatus('idle')} className="w-full">
                Try Different Number
              </Button>
            )}

            {status === 'completed' && (
              <Button onClick={onCancel} className="w-full">
                Continue
              </Button>
            )}

            {status === 'failed' && (
              <>
                <Button variant="outline" onClick={() => setStatus('idle')} className="flex-1">
                  Try Again
                </Button>
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Cancel
                </Button>
              </>
            )}
          </div>

          {/* Kenya M-Pesa Info */}
          <div className="bg-gray-50 p-3 rounded-lg mt-4">
            <p className="text-xs text-gray-600 text-center">
              Powered by M-Pesa. Secure payment processing.<br/>
              Supported prefixes: 0700-0731, 0740-0759
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}