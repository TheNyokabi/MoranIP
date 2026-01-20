"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/store/auth-store"
import { posApi, POSItem, POSInvoice, POSInvoiceRequest, DailySummary, apiFetch } from "@/lib/api"
import { QuickActionsPanel } from "@/components/pos/QuickActionsPanel"
import { MpesaPaymentModal } from "@/components/pos/MpesaPaymentModal"
import { LoyaltyPointsDisplay } from "@/components/pos/LoyaltyPointsDisplay"
import { OfflineSyncStatus } from "@/components/pos/OfflineSyncStatus"
import { ReceiptPreview } from "@/components/pos/ReceiptPreview"
import { AccessibilityTools } from "@/components/pos/AccessibilityTools"
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    CreditCard,
    Wallet,
    Smartphone,
    Receipt,
    Users,
    TrendingUp,
    Package,
    Search,
    X,
    Check,
    Loader2,
    BarChart3,
    Gift,
    Palette,
    Settings
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// Cart item type
interface CartItem {
    item_code: string
    item_name: string
    qty: number
    rate: number
    total: number
}

// Customer types with commission info
const CUSTOMER_TYPES = [
    { value: 'Direct', label: 'Direct Customer', commission: 0, color: 'bg-gray-500' },
    { value: 'Fundi', label: 'Fundi', commission: 10, color: 'bg-orange-500' },
    { value: 'Sales Team', label: 'Sales Team', commission: 15, color: 'bg-blue-500' },
    { value: 'Wholesaler', label: 'Wholesaler', commission: '3-5', color: 'bg-purple-500' },
]

// Payment modes
const PAYMENT_MODES = [
    { value: 'Cash', label: 'Cash', icon: Wallet, color: 'text-green-500' },
    { value: 'Mpesa', label: 'M-Pesa', icon: Smartphone, color: 'text-emerald-500' },
    { value: 'Pesalink', label: 'PesaLink', icon: CreditCard, color: 'text-blue-500' },
]

export default function POSPage() {
    const params = useParams() as any
    const tenantSlug = params.tenantSlug as string
    const { token, currentTenant, availableTenants, selectTenant } = useAuthStore()

    // Session state
    const [sessionActive, setSessionActive] = useState(false)
    const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
    const [openingCash, setOpeningCash] = useState<number>(0)
    const [showSessionModal, setShowSessionModal] = useState(true)
    const [showEndSessionModal, setShowEndSessionModal] = useState(false)
    const [closingCash, setClosingCash] = useState<string>('')

    // State
    const [items, setItems] = useState<POSItem[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [summary, setSummary] = useState<DailySummary | null>(null)
    const [recentInvoices, setRecentInvoices] = useState<POSInvoice[]>([])
    const [posProfiles, setPosProfiles] = useState<any[]>([])
    const [selectedPosProfile, setSelectedPosProfile] = useState<string>('')
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<string>('')
    const [showCustomerPicker, setShowCustomerPicker] = useState(false)

    // Transaction form state
    const [customerType, setCustomerType] = useState<string>('Direct')
    const [referralCode, setReferralCode] = useState<string>('')
    const [selectedPayment, setSelectedPayment] = useState<string>('Cash')
    const [lastInvoice, setLastInvoice] = useState<POSInvoice | null>(null)
    const [loyaltyDiscount, setLoyaltyDiscount] = useState<number>(0)

    // Receipt preview state
    const [showReceiptPreview, setShowReceiptPreview] = useState(false)
    const [lastInvoiceId, setLastInvoiceId] = useState<string>('')

    // Accessibility state
    const [showAccessibilityTools, setShowAccessibilityTools] = useState(false)

    // Paint sales state
    const [colorCodes, setColorCodes] = useState<any[]>([])
    const [selectedColorCode, setSelectedColorCode] = useState<string>('')
    const [paintQuantity, setPaintQuantity] = useState<string>('1')
    const [paintFormula, setPaintFormula] = useState<any>(null)
    const [showPaintSales, setShowPaintSales] = useState(false)

    // Check for existing session on mount
    useEffect(() => {
        const savedSession = localStorage.getItem('pos_session')
        if (savedSession) {
            const session = JSON.parse(savedSession)
            if (session.date === new Date().toISOString().split('T')[0]) {
                setSessionActive(true)
                setSessionStartTime(new Date(session.startTime))
                setOpeningCash(session.openingCash)
                setShowSessionModal(false)
            }
        }
    }, [])

    // Ensure tenant context is available before loading data
    useEffect(() => {
        async function ensureTenantContext() {
            if (!token || !tenantSlug) return

            // Check if we have the correct tenant selected
            const targetTenant = availableTenants.find(t => t.code === tenantSlug || t.id === tenantSlug)
            if (!targetTenant) {
                console.error('Tenant not found:', tenantSlug)
                return
            }

            // If no current tenant or different tenant selected, select the correct one
            if (!currentTenant || currentTenant.id !== targetTenant.id) {
                console.log('Selecting tenant for POS:', targetTenant.id)
                try {
                    await selectTenant('', '', targetTenant.id)
                } catch (error) {
                    console.error('Failed to select tenant:', error)
                    return
                }
            }
        }
        ensureTenantContext()
    }, [token, tenantSlug, currentTenant, availableTenants, selectTenant])

    // Load items on mount (only after tenant context is established)
    useEffect(() => {
        async function loadData() {
            if (!token || !currentTenant) return

            // Ensure the current tenant matches the URL tenant
            const urlTenant = availableTenants.find(t => t.code === tenantSlug || t.id === tenantSlug)
            if (!urlTenant || currentTenant.id !== urlTenant.id) return

            setLoading(true)
            try {
                const [itemsRes, summaryRes, invoicesRes, profilesRes, customersRes] = await Promise.all([
                    posApi.getItems(token),
                    posApi.getDailySummary(token).catch(() => null),
                    posApi.getInvoices(token, 10).catch(() => ({ invoices: [] })),
                    posApi.getPosProfiles(token).catch(() => ({ profiles: [] })), // Fetch POS profiles
                    posApi.getCustomers(token).catch(() => ({ customers: [] })) // Fetch customers
                ])
                setItems(itemsRes.items || [])
                setSummary(summaryRes)
                setRecentInvoices(invoicesRes.invoices || [])
                const profiles = profilesRes?.profiles || []
                setPosProfiles(profiles)
                setCustomers(customersRes.customers || [])
                // Auto-select first profile if available
                if (profiles.length > 0 && !selectedPosProfile) {
                    setSelectedPosProfile(profiles[0].name || profiles[0].id)
                }
            } catch (error) {
                console.error('Failed to load PoS data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [token, currentTenant, tenantSlug, availableTenants])

    // Load paint data separately when token and tenant context is available
    useEffect(() => {
        async function loadPaintData() {
            if (!token || !currentTenant) return

            // Ensure the current tenant matches the URL tenant
            const urlTenant = availableTenants.find(t => t.code === tenantSlug || t.id === tenantSlug)
            if (!urlTenant || currentTenant.id !== urlTenant.id) return

            // Small delay to ensure auth state is fully initialized
            setTimeout(async () => {
                try {
                    const colorCodesRes = await apiFetch('/paint/color-codes', {}, token).catch(() => ({ data: [] }))
                    setColorCodes(colorCodesRes.data || [])
                } catch (error) {
                    console.error('Failed to load paint data:', error)
                    // Don't fail the whole POS if paint data fails
                }
            }, 100)
        }
        loadPaintData()
    }, [token, currentTenant, tenantSlug, availableTenants])

    // Start session
    const startSession = (cash: number) => {
        const now = new Date()
        setSessionActive(true)
        setSessionStartTime(now)
        setOpeningCash(cash)
        setShowSessionModal(false)

        // Save to localStorage
        localStorage.setItem('pos_session', JSON.stringify({
            date: now.toISOString().split('T')[0],
            startTime: now.toISOString(),
            openingCash: cash
        }))
    }

    // End session
    const endSession = () => {
        const closingAmount = parseFloat(closingCash) || 0
        const expectedCash = openingCash + (summary?.by_payment_mode?.cash || 0)
        const variance = closingAmount - expectedCash

        // Clear session
        localStorage.removeItem('pos_session')
        setSessionActive(false)
        setSessionStartTime(null)
        setOpeningCash(0)
        setShowEndSessionModal(false)
        setClosingCash('')
        setShowSessionModal(true)

        // In a real app, would save session summary to backend
        alert(`Session ended!\nExpected: KES ${expectedCash.toFixed(0)}\nActual: KES ${closingAmount.toFixed(0)}\nVariance: KES ${variance.toFixed(0)}`)
    }

    // Filter items by search
    const filteredItems = items.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Cart calculations
    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0)
    const cartQty = cart.reduce((sum, item) => sum + item.qty, 0)

    // Add to cart
    const addToCart = (item: POSItem) => {
        const existing = cart.find(c => c.item_code === item.item_code)
        if (existing) {
            setCart(cart.map(c =>
                c.item_code === item.item_code
                    ? { ...c, qty: c.qty + 1, total: (c.qty + 1) * c.rate }
                    : c
            ))
        } else {
            setCart([...cart, {
                item_code: item.item_code,
                item_name: item.item_name,
                qty: 1,
                rate: item.standard_rate,
                total: item.standard_rate
            }])
        }
    }

    // Update cart quantity
    const updateQty = (itemCode: string, delta: number) => {
        setCart(cart.map(c => {
            if (c.item_code === itemCode) {
                const newQty = Math.max(0, c.qty + delta)
                return newQty === 0 ? null : { ...c, qty: newQty, total: newQty * c.rate }
            }
            return c
        }).filter(Boolean) as CartItem[])
    }

    // Remove from cart
    const removeFromCart = (itemCode: string) => {
        setCart(cart.filter(c => c.item_code !== itemCode))
    }

    // Clear cart
    const clearCart = () => {
        setCart([])
        setSelectedCustomer('')
        setCustomerType('Direct')
        setReferralCode('')
        setSelectedPayment('Cash')
        setLoyaltyDiscount(0)
    }

    // Handle M-Pesa payment success
    const handleMpesaPaymentSuccess = async (paymentResult: any) => {
        if (!token || cart.length === 0 || !selectedPosProfile) return

        setProcessing(true)
        try {
            const invoice: POSInvoiceRequest = {
                customer: selectedCustomer,
                customer_type: customerType as any,
                referral_code: referralCode || undefined,
                pos_profile_id: selectedPosProfile,
                items: cart.map(c => ({
                    item_code: c.item_code,
                    qty: c.qty,
                    rate: c.rate,
                    is_vatable: true
                })),
                payments: [{
                    mode_of_payment: 'Mpesa',
                    amount: cartTotal - loyaltyDiscount
                }]
            }

            const result = await posApi.createInvoice(token, invoice)
            setLastInvoice(result)
            setLastInvoiceId(result.name)
            clearCart()
            setLoyaltyDiscount(0)
            setProcessing(false)

            toast.success(`M-Pesa payment confirmed! Invoice: ${result.name}`)

            // Show receipt preview
            setShowReceiptPreview(true)
        } catch (error: any) {
            toast.error(error.message || "Failed to create invoice after payment")
            setProcessing(false)
        }
    }

    // Process sale
    const processSale = async () => {
        if (!token || cart.length === 0) return

        // Validate POS profile is selected
        if (!selectedPosProfile) {
            alert('Please select a POS Profile before processing sale')
            return
        }

        setProcessing(true)
        try {
            const invoice: POSInvoiceRequest = {
                customer: selectedCustomer || 'Walk-in Customer', // Use selected customer or default
                customer_type: customerType as any,
                referral_code: referralCode || undefined,
                pos_profile_id: selectedPosProfile,  // REQUIRED: POS Profile ID
                items: cart.map(c => ({
                    item_code: c.item_code,
                    qty: c.qty,
                    rate: c.rate,
                    is_vatable: true  // Default to VATable, can be made configurable
                })),
                payments: [{
                    mode_of_payment: selectedPayment,
                    amount: cartTotal
                }]
            }

            const result = await posApi.createInvoice(token, invoice)
            setLastInvoice(result)

            // Store invoice ID for receipt preview
            setLastInvoiceId(result.name)

            // Refresh data
            const [summaryRes, invoicesRes] = await Promise.all([
                posApi.getDailySummary(token),
                posApi.getInvoices(token, 10)
            ])
            setSummary(summaryRes)
            setRecentInvoices(invoicesRes.invoices || [])

            // Clear cart
            clearCart()

            // Show receipt preview
            setShowReceiptPreview(true)

        } catch (error) {
            console.error('Failed to process sale:', error)
            alert('Failed to process sale. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
                </div>
            </div>
        )
    }

    // Session start modal
    if (showSessionModal && !sessionActive) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
                <Card className="w-full max-w-md bg-slate-900/90 border-white/10">
                    <CardHeader className="text-center">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <ShoppingCart className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-white text-xl">Start Your Session</CardTitle>
                        <CardDescription className="text-white/60">
                            Enter your opening cash balance to begin selling
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/80">Opening Cash (KES)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                className="bg-white/10 border-white/20 text-white text-lg h-12"
                                value={openingCash || ''}
                                onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <Button
                            className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                            onClick={() => startSession(openingCash)}
                        >
                            Start Session
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col bg-[#0a0a0f] text-white overflow-hidden">
            {/* Header Stats */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                            Point of Sale
                        </h1>
                        <p className="text-white/50 text-sm">Paint Shop Ltd - PoS Terminal</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Session Info */}
                        {sessionActive && sessionStartTime && (
                            <div className="text-right">
                                <div className="text-xs text-white/50">Session Started</div>
                                <div className="text-sm text-white/80">
                                    {sessionStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        )}
                        <div className="text-right">
                            <div className="text-xs text-white/50">Opening Cash</div>
                            <div className="text-sm text-emerald-400 font-medium">KES {openingCash.toLocaleString()}</div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            onClick={() => setShowEndSessionModal(true)}
                        >
                            End Session
                        </Button>
                        <OfflineSyncStatus />
                        <Link href={`/w/${tenantSlug}/pos/analytics`}>
                            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                                <BarChart3 className="h-4 w-4 mr-2" />
                                Analytics
                            </Button>
                        </Link>
                        <Link href={`/w/${tenantSlug}/pos/layaway`}>
                            <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                                <Package className="h-4 w-4 mr-2" />
                                Layaway
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={() => setShowAccessibilityTools(true)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                            Online
                        </Badge>
                    </div>
                </div>

                {/* Quick Stats */}
                {summary && (
                    <div className="grid grid-cols-4 gap-4">
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white/50 text-xs">Today&apos;s Sales</p>
                                        <p className="text-xl font-bold text-white">KES {summary.total_sales.toLocaleString()}</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-emerald-400" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white/50 text-xs">Transactions</p>
                                        <p className="text-xl font-bold text-white">{summary.total_transactions}</p>
                                    </div>
                                    <Receipt className="h-8 w-8 text-blue-400" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white/50 text-xs">Commissions</p>
                                        <p className="text-xl font-bold text-white">KES {summary.total_commission.toLocaleString()}</p>
                                    </div>
                                    <Users className="h-8 w-8 text-purple-400" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-white/50 text-xs">Cash in Drawer</p>
                                        <p className="text-xl font-bold text-white">KES {summary.by_payment_mode?.cash?.toLocaleString() || 0}</p>
                                    </div>
                                    <Wallet className="h-8 w-8 text-green-400" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Quick Actions Sidebar */}
                <div className="w-80 border-r border-white/10 p-4 overflow-y-auto">
                    <QuickActionsPanel
                        posProfileId={selectedPosProfile}
                        onItemAdd={(item) => {
                            const cartItem = {
                                item_code: item.item_code,
                                item_name: item.item_name,
                                qty: item.qty || 1,
                                rate: item.rate,
                                total: (item.qty || 1) * item.rate
                            }
                            addToCart(cartItem)
                        }}
                        onCustomerSelect={(customer) => {
                            setSelectedCustomer(customer)
                            setShowCustomerPicker(false)
                        }}
                        onQuickSale={(data) => {
                            toast.info('Quick sale feature coming soon')
                        }}
                        onBarcodeScan={(barcode) => {
                            setSearchQuery(barcode)
                        }}
                    />
                </div>

                {/* Products Grid */}
                <div className="flex-1 flex flex-col p-4">
                    <Tabs defaultValue="products" className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10">
                            <TabsTrigger value="products" className="text-white data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                                <Package className="h-4 w-4 mr-2" />
                                Products
                            </TabsTrigger>
                            <TabsTrigger value="paint" className="text-white data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                                <Palette className="h-4 w-4 mr-2" />
                                Custom Paint
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="products" className="flex-1 flex flex-col mt-4">
                            {/* Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                />
                            </div>

                            {/* Items Grid */}
                            <ScrollArea className="flex-1">
                                <div className="grid grid-cols-4 gap-3">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.item_code}
                                            onClick={() => addToCart(item)}
                                            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/50 transition-all text-left group"
                                        >
                                            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-3">
                                                <Package className="h-6 w-6 text-cyan-400" />
                                            </div>
                                            <h3 className="font-medium text-white text-sm mb-1 truncate">{item.item_name}</h3>
                                            <p className="text-xs text-white/40 mb-2">{item.item_code}</p>
                                            <p className="text-lg font-bold text-cyan-400">KES {item.standard_rate}</p>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="paint" className="flex-1 flex flex-col mt-4">
                            <div className="space-y-4">
                                {/* Color Code Input */}
                                <div>
                                    <label className="text-xs text-white/50 mb-2 block">Color Code</label>
                                    <div className="relative">
                                        <Input
                                            placeholder="Enter or select color code (e.g., RAL-5015)..."
                                            value={selectedColorCode}
                                            onChange={(e) => {
                                                setSelectedColorCode(e.target.value)
                                                setPaintFormula(null) // Reset formula when color changes
                                            }}
                                            className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/50"
                                        />

                                        {/* Dropdown for existing color codes */}
                                        {selectedColorCode && colorCodes.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 max-h-40 overflow-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl">
                                                <div className="p-2">
                                                    {colorCodes
                                                        .filter(color =>
                                                            color.id.toLowerCase().includes(selectedColorCode.toLowerCase()) ||
                                                            (color.name && color.name.toLowerCase().includes(selectedColorCode.toLowerCase()))
                                                        )
                                                        .slice(0, 5)
                                                        .map(color => (
                                                            <button
                                                                key={color.id}
                                                                onClick={() => {
                                                                    setSelectedColorCode(color.id)
                                                                    setPaintFormula(null)
                                                                }}
                                                                className="w-full p-2 rounded text-left text-sm transition-all text-white/70 hover:bg-white/10 hover:text-white"
                                                            >
                                                                <div className="font-medium">{color.id}</div>
                                                                {color.name && (
                                                                    <div className="text-xs text-white/40">{color.name} ({color.color_system})</div>
                                                                )}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/40 mt-1">
                                        Enter any color code - new codes will be saved automatically
                                    </p>
                                </div>

                                {/* Quantity Input */}
                                <div>
                                    <label className="text-xs text-white/50 mb-2 block">Quantity (Liters)</label>
                                    <Input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={paintQuantity}
                                        onChange={(e) => setPaintQuantity(e.target.value)}
                                        className="w-full p-2 rounded-lg bg-white/5 border-white/10 text-white"
                                        placeholder="1.0"
                                    />
                                </div>

                                {/* Calculate Formula Button */}
                                {selectedColorCode && paintQuantity && (
                                    <Button
                                        onClick={async () => {
                                            try {
                                                const response = await apiFetch('/paint/calculate-formula', {
                                                    method: 'POST',
                                                    body: JSON.stringify({
                                                        color_code: selectedColorCode,
                                                        quantity_liters: parseFloat(paintQuantity),
                                                        customer: selectedCustomer || 'Walk-in Customer'
                                                    })
                                                }, token)

                                                setPaintFormula(response)
                                            } catch (error: any) {
                                                console.error('Failed to calculate formula:', error)

                                                // Handle different error types
                                                if (error?.status === 401) {
                                                    alert('Authentication required. Please refresh the page.')
                                                } else if (error?.message?.includes('not found') || error?.detail?.includes('not found')) {
                                                    setPaintFormula({
                                                        color_code: selectedColorCode,
                                                        color_name: null,
                                                        quantity_requested_liters: parseFloat(paintQuantity),
                                                        base_paint: { item_code: 'UNKNOWN', quantity: parseFloat(paintQuantity), uom: 'Liter', unit_cost: 0, total_cost: 0 },
                                                        tints: [],
                                                        total_estimated_cost: 0,
                                                        formula_version: 0,
                                                        no_formula: true,
                                                        message: 'Color code not configured. Please inform admin to set up the formula.'
                                                    })
                                                } else {
                                                    alert('Failed to calculate paint formula: ' + (error?.detail || error?.message || 'Unknown error'))
                                                }
                                            }
                                        }}
                                        className="w-full bg-cyan-500 hover:bg-cyan-600"
                                    >
                                        Calculate Formula
                                    </Button>
                                )}

                                {/* Formula Display */}
                                {paintFormula && (
                                    <Card className={`bg-white/5 border-white/10 ${paintFormula.no_formula ? 'border-orange-500/50' : ''}`}>
                                        <CardHeader>
                                            <CardTitle className="text-white text-sm">
                                                {paintFormula.no_formula ? 'Formula Not Configured' : 'Paint Formula'}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {paintFormula.no_formula ? (
                                                <div className="text-center space-y-3">
                                                    <div className="text-orange-400">
                                                        <Palette className="h-8 w-8 mx-auto mb-2" />
                                                        <p className="text-sm">{paintFormula.message}</p>
                                                    </div>
                                                    <div className="text-xs text-white/60">
                                                        <p>Color Code: {paintFormula.color_code}</p>
                                                        <p>Quantity: {paintFormula.quantity_requested_liters} L</p>
                                                    </div>
                                                    <Button
                                                        onClick={() => {
                                                            // Still allow adding to cart but with zero cost
                                                            const paintItem: POSItem = {
                                                                item_code: `CUSTOM-PAINT-${paintFormula.color_code}`,
                                                                item_name: `Custom Paint - ${paintFormula.color_code} (No Formula)`,
                                                                standard_rate: 0,
                                                                stock_uom: 'Liter',
                                                                description: `Custom paint - formula not configured`
                                                            }
                                                            addToCart(paintItem)
                                                            setPaintFormula(null)
                                                            setSelectedColorCode('')
                                                            setPaintQuantity('1')
                                                        }}
                                                        className="w-full bg-orange-500 hover:bg-orange-600"
                                                    >
                                                        Add to Cart (Cost TBD)
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="text-sm text-white/80">
                                                        <p><strong>Color:</strong> {paintFormula.color_code} {paintFormula.color_name ? `(${paintFormula.color_name})` : ''}</p>
                                                        <p><strong>Quantity:</strong> {paintFormula.quantity_requested_liters} L</p>
                                                        <p><strong>Total Cost:</strong> KES {paintFormula.total_estimated_cost}</p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <h4 className="text-xs text-white/60 font-medium">Base Paint:</h4>
                                                        <div className="bg-white/5 rounded p-2 text-sm">
                                                            <p>{paintFormula.base_paint.item_code}: {paintFormula.base_paint.quantity} L</p>
                                                            <p className="text-white/60">Cost: KES {paintFormula.base_paint.total_cost}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <h4 className="text-xs text-white/60 font-medium">Tints Required:</h4>
                                                        {paintFormula.tints.map((tint: any, index: number) => (
                                                            <div key={index} className="bg-white/5 rounded p-2 text-sm">
                                                                <p>{tint.item_code}: {tint.quantity} {tint.uom}</p>
                                                                <p className="text-white/60">Cost: KES {tint.total_cost}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <Button
                                                        onClick={() => {
                                                            // Add custom paint to cart
                                                            const paintItem: POSItem = {
                                                                item_code: `CUSTOM-PAINT-${paintFormula.color_code}`,
                                                                item_name: `Custom Paint - ${paintFormula.color_code}`,
                                                                standard_rate: paintFormula.total_estimated_cost / paintFormula.quantity_requested_liters,
                                                                stock_uom: 'Liter',
                                                                description: `Custom tinted paint - ${paintFormula.color_code}`
                                                            }
                                                            addToCart(paintItem)
                                                            setPaintFormula(null)
                                                            setSelectedColorCode('')
                                                            setPaintQuantity('1')
                                                        }}
                                                        className="w-full bg-emerald-500 hover:bg-emerald-600"
                                                    >
                                                        Add to Cart (KES {paintFormula.total_estimated_cost})
                                                    </Button>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Cart Panel */}
                <div className="w-96 border-l border-white/10 flex flex-col bg-white/[0.02]">
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-lg flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-cyan-400" />
                                Cart ({cartQty} items)
                            </h2>
                            {cart.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-400 hover:text-red-300">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <ScrollArea className="flex-1 p-4">
                        {cart.length === 0 ? (
                            <div className="text-center py-12 text-white/40">
                                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Cart is empty</p>
                                <p className="text-sm">Click products to add</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.item_code} className="p-3 rounded-lg bg-white/5 border border-white/10">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium text-sm truncate">{item.item_name}</h4>
                                                <p className="text-xs text-white/40">KES {item.rate} each</p>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.item_code)} className="text-red-400 hover:text-red-300 h-6 w-6 p-0">
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => updateQty(item.item_code, -1)} className="h-7 w-7 p-0 border-white/20">
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-8 text-center font-medium">{item.qty}</span>
                                                <Button variant="outline" size="sm" onClick={() => updateQty(item.item_code, 1)} className="h-7 w-7 p-0 border-white/20">
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <span className="font-bold text-cyan-400">KES {item.total.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {/* POS Profile Selection */}
                    {posProfiles.length > 0 && (
                        <div className="p-4 border-t border-white/10">
                            <label className="text-xs text-white/50 mb-2 block">POS Profile (Store)</label>
                            <select
                                value={selectedPosProfile}
                                onChange={(e) => setSelectedPosProfile(e.target.value)}
                                className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            >
                                {posProfiles.map(profile => (
                                    <option key={profile.name || profile.id} value={profile.name || profile.id} className="bg-gray-900">
                                        {profile.name || profile.id} {profile.warehouse ? `- ${profile.warehouse}` : ''}
                                    </option>
                                ))}
                            </select>
                            {!selectedPosProfile && (
                                <p className="text-xs text-red-400 mt-1">Please select a POS Profile</p>
                            )}
                        </div>
                    )}

                    {/* Customer Selection */}
                    {cart.length > 0 && (
                        <div className="p-4 border-t border-white/10 space-y-4">
                            {/* Loyalty Points Display */}
                            {selectedCustomer && selectedCustomer !== 'Walk-in Customer' && (
                                <div className="mb-4">
                                    <LoyaltyPointsDisplay
                                        customer={selectedCustomer}
                                        purchaseAmount={cartTotal - loyaltyDiscount}
                                        onRedeem={(points, discount) => {
                                            setLoyaltyDiscount(discount)
                                            toast.success(`Applied ${discount.toFixed(2)} KES discount`)
                                        }}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-white/50 mb-2 block">Customer (Optional)</label>
                                <div className="space-y-2">
                                    {/* Customer Name Input */}
                                    <Input
                                        placeholder="Enter customer name or select from list..."
                                        value={selectedCustomer}
                                        onChange={(e) => setSelectedCustomer(e.target.value)}
                                        className="w-full p-2 rounded-lg text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-cyan-500/50"
                                    />

                                    {/* Quick Select from Existing Customers */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                                            className="w-full p-2 rounded-lg text-sm text-left border border-white/10 bg-white/5 text-white/70 hover:border-cyan-500/50 hover:bg-white/10 transition-all"
                                        >
                                            Select from existing customers...
                                        </button>
                                        {showCustomerPicker && (
                                            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl">
                                                <div className="p-2">
                                                    <Input
                                                        placeholder="Search customers..."
                                                        className="mb-2 bg-white/5 border-white/10 text-white text-sm"
                                                        onChange={(e) => {
                                                            const query = e.target.value.toLowerCase();
                                                            // Filter customers in real-time (you can implement this)
                                                        }}
                                                    />
                                                </div>
                                                <ScrollArea className="max-h-48">
                                                    <div className="p-2 space-y-1">
                                                        {customers.map(customer => {
                                                            const customerName = customer.name || customer.customer_name || customer.customer || '';
                                                            return (
                                                                <button
                                                                    key={customerName}
                                                                    onClick={() => {
                                                                        setSelectedCustomer(customerName);
                                                                        setShowCustomerPicker(false);
                                                                    }}
                                                                    className={`w-full p-2 rounded text-left text-sm transition-all ${selectedCustomer === customerName
                                                                        ? 'bg-cyan-500/20 text-cyan-400'
                                                                        : 'text-white/70 hover:bg-white/10'
                                                                        }`}
                                                                >
                                                                    {customerName}
                                                                    {customer.customer_group && (
                                                                        <span className="block text-xs text-white/40">{customer.customer_group}</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                        {customers.length === 0 && (
                                                            <div className="p-2 text-sm text-white/40 text-center">No customers found</div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-white/50 mb-2 block">Customer Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {CUSTOMER_TYPES.map(type => (
                                        <button
                                            key={type.value}
                                            onClick={() => setCustomerType(type.value)}
                                            className={`p-2 rounded-lg text-xs font-medium transition-all ${customerType === type.value
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                                                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                                                }`}
                                        >
                                            {type.label}
                                            {type.commission !== 0 && (
                                                <span className="block text-white/40">{type.commission}% comm</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {customerType !== 'Direct' && (
                                <div>
                                    <label className="text-xs text-white/50 mb-2 block">Referral Code</label>
                                    <Input
                                        placeholder="e.g., FND-001"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs text-white/50 mb-2 block">Payment Method</label>
                                <div className="flex gap-2">
                                    {PAYMENT_MODES.map(mode => (
                                        <button
                                            key={mode.value}
                                            onClick={() => setSelectedPayment(mode.value)}
                                            className={`flex-1 p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${selectedPayment === mode.value
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 border'
                                                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                                                }`}
                                        >
                                            <mode.icon className={`h-5 w-5 ${mode.color}`} />
                                            <span className="text-xs font-medium">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Checkout */}
                    <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-white/60">Total</span>
                            <span className="text-2xl font-bold text-white">KES {cartTotal.toLocaleString()}</span>
                        </div>
                        <Button
                            className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-semibold"
                            disabled={cart.length === 0 || processing}
                            onClick={processSale}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Check className="h-5 w-5 mr-2" />
                                    Complete Sale
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {lastInvoice && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setLastInvoice(null)}>
                    <div className="bg-[#0d0d14] rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <Check className="h-8 w-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Sale Complete!</h2>
                            <p className="text-white/60 mb-6">Invoice {lastInvoice.name}</p>

                            <div className="bg-white/5 rounded-xl p-4 mb-6 text-left">
                                <div className="flex justify-between mb-2">
                                    <span className="text-white/60">Total</span>
                                    <span className="font-bold text-white">KES {lastInvoice.grand_total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-white/60">Items</span>
                                    <span className="text-white">{lastInvoice.total_qty}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-white/60">Payment</span>
                                    <span className="text-white">{lastInvoice.payments[0]?.mode_of_payment}</span>
                                </div>
                                {lastInvoice.commission_amount > 0 && (
                                    <div className="flex justify-between pt-2 border-t border-white/10">
                                        <span className="text-white/60">Commission ({lastInvoice.commission_rate}%)</span>
                                        <span className="text-purple-400 font-medium">KES {lastInvoice.commission_amount.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            <Button onClick={() => setLastInvoice(null)} className="w-full bg-cyan-500 hover:bg-cyan-600">
                                New Sale
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* End Session Modal */}
            {showEndSessionModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-[#0d0d14] rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10">
                        <div className="text-center">
                            <div className="h-16 w-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                                <Receipt className="h-8 w-8 text-orange-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">End Session</h2>
                            <p className="text-white/60 mb-6">Balance your cash and close the session</p>

                            <div className="bg-white/5 rounded-xl p-4 mb-6 text-left space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-white/60">Opening Cash</span>
                                    <span className="text-white">KES {openingCash.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">Cash Sales</span>
                                    <span className="text-emerald-400">+ KES {(summary?.by_payment_mode?.cash || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/60">M-Pesa</span>
                                    <span className="text-white/50">KES {(summary?.by_payment_mode?.mpesa || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-white/10">
                                    <span className="text-white font-medium">Expected Cash</span>
                                    <span className="text-cyan-400 font-bold">KES {(openingCash + (summary?.by_payment_mode?.cash || 0)).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-white/80 block text-left mb-2">Actual Cash Count (KES)</label>
                                <Input
                                    type="number"
                                    placeholder="Enter your cash count"
                                    className="bg-white/10 border-white/20 text-white text-lg h-12"
                                    value={closingCash}
                                    onChange={(e) => setClosingCash(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                                    onClick={() => setShowEndSessionModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500"
                                    onClick={endSession}
                                >
                                    End Session
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            <ReceiptPreview
                invoiceId={lastInvoiceId}
                isOpen={showReceiptPreview}
                onClose={() => setShowReceiptPreview(false)}
            />
        </div>
    )
}
