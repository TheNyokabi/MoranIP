"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/store/auth-store"
import { posApi } from "@/lib/api"
import {
    Package,
    Calendar,
    DollarSign,
    User,
    ShoppingCart,
    X,
    CheckCircle2,
    Clock,
    AlertCircle,
    Plus,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function LayawayPage() {
    const params = useParams()
    const { token } = useAuthStore()
    const tenantSlug = (params?.tenantSlug as string) || ''

    const [loading, setLoading] = useState(false)
    const [layawayPlans, setLayawayPlans] = useState<any[]>([])
    const [selectedPlan, setSelectedPlan] = useState<any>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState("")
    const [processing, setProcessing] = useState(false)

    // Create form state
    const [createForm, setCreateForm] = useState({
        customer: "",
        items: [] as Array<{ item_code: string; qty: number; rate: number }>,
        total_amount: 0,
        deposit_amount: 0,
        payment_schedule: "weekly" as "weekly" | "biweekly" | "monthly",
        number_of_payments: 4,
        due_date: ""
    })

    useEffect(() => {
        if (token) {
            loadLayawayPlans()
        }
    }, [token])

    const loadLayawayPlans = async () => {
        if (!token) return

        setLoading(true)
        try {
            // Get all layaway plans (we'll need to implement a list endpoint or use a workaround)
            // For now, we'll use an empty array and let users create new ones
            setLayawayPlans([])
        } catch (error) {
            toast.error("Failed to load layaway plans")
            console.error("Layaway error:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateLayaway = async () => {
        if (!token || !createForm.customer || createForm.items.length === 0) {
            toast.error("Please fill in all required fields")
            return
        }

        setProcessing(true)
        try {
            const response = await posApi.createLayaway(token, {
                customer: createForm.customer,
                items: createForm.items,
                total_amount: createForm.total_amount,
                down_payment: createForm.deposit_amount,
                installment_periods: createForm.number_of_payments,
                payment_schedule: createForm.payment_schedule === 'biweekly' ? 'bi_weekly' : createForm.payment_schedule
            })

            toast.success("Layaway plan created successfully")
            setShowCreateModal(false)
            resetCreateForm()
            await loadLayawayPlans()
        } catch (error: any) {
            toast.error(error.message || "Failed to create layaway plan")
        } finally {
            setProcessing(false)
        }
    }

    const handleRecordPayment = async () => {
        if (!token || !selectedPlan || !paymentAmount) {
            toast.error("Please enter payment amount")
            return
        }

        setProcessing(true)
        try {
            const amount = parseFloat(paymentAmount)
            if (isNaN(amount) || amount <= 0) {
                toast.error("Please enter a valid amount")
                setProcessing(false)
                return
            }

            await posApi.recordLayawayPayment(token, {
                layaway_id: selectedPlan.plan_id,
                amount: amount,
                payment_date: new Date().toISOString().split('T')[0]
            })

            toast.success("Payment recorded successfully")
            setShowPaymentModal(false)
            setPaymentAmount("")
            setSelectedPlan(null)
            await loadLayawayPlans()
        } catch (error: any) {
            toast.error(error.message || "Failed to record payment")
        } finally {
            setProcessing(false)
        }
    }

    const handleCancelLayaway = async () => {
        if (!token || !selectedPlan) return

        setProcessing(true)
        try {
            await posApi.cancelLayaway(token, selectedPlan.plan_id)

            toast.success("Layaway plan cancelled")
            setShowCancelModal(false)
            setSelectedPlan(null)
            await loadLayawayPlans()
        } catch (error: any) {
            toast.error(error.message || "Failed to cancel layaway plan")
        } finally {
            setProcessing(false)
        }
    }

    const handleCompleteLayaway = async (planId: string) => {
        if (!token) return

        setProcessing(true)
        try {
            await posApi.completeLayaway(token, planId)

            toast.success("Layaway plan completed")
            await loadLayawayPlans()
        } catch (error: any) {
            toast.error(error.message || "Failed to complete layaway plan")
        } finally {
            setProcessing(false)
        }
    }

    const resetCreateForm = () => {
        setCreateForm({
            customer: "",
            items: [],
            total_amount: 0,
            deposit_amount: 0,
            payment_schedule: "weekly",
            number_of_payments: 4,
            due_date: ""
        })
    }

    const formatCurrency = (amount: number) => {
        return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            active: { variant: "default", icon: Clock, label: "Active" },
            completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
            cancelled: { variant: "destructive", icon: X, label: "Cancelled" }
        }

        const config = variants[status] || { variant: "secondary", icon: AlertCircle, label: status }
        const Icon = config.icon

        return (
            <Badge variant={config.variant}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
            </Badge>
        )
    }

    // Filter plans by status
    const activePlans = layawayPlans.filter(p => p.status === 'active')
    const completedPlans = layawayPlans.filter(p => p.status === 'completed')
    const cancelledPlans = layawayPlans.filter(p => p.status === 'cancelled')

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Layaway Plans</h1>
                    <p className="text-muted-foreground">Manage customer layaway and installment plans</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/w/${tenantSlug}/pos`}>
                        <Button variant="outline">Back to POS</Button>
                    </Link>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Layaway Plan
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="active" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="active">
                        Active ({activePlans.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                        Completed ({completedPlans.length})
                    </TabsTrigger>
                    <TabsTrigger value="cancelled">
                        Cancelled ({cancelledPlans.length})
                    </TabsTrigger>
                </TabsList>

                {/* Active Plans */}
                <TabsContent value="active" className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : activePlans.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-muted-foreground">No active layaway plans</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {activePlans.map((plan) => {
                                const progress = (plan.total_paid / plan.total_amount) * 100
                                const remaining = plan.total_amount - plan.total_paid

                                return (
                                    <Card key={plan.plan_id}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2">
                                                        {plan.customer_name || plan.customer}
                                                        {getStatusBadge(plan.status)}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Plan ID: {plan.plan_id} • Created: {formatDate(plan.created_at)}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold">{formatCurrency(plan.total_amount)}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {formatCurrency(remaining)} remaining
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Progress Bar */}
                                            <div>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span>Progress</span>
                                                    <span>{progress.toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-2">
                                                    <div
                                                        className="bg-primary h-2 rounded-full transition-all"
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <div className="text-muted-foreground">Total Paid</div>
                                                    <div className="font-medium">{formatCurrency(plan.total_paid)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Payments Made</div>
                                                    <div className="font-medium">{plan.payments_made} / {plan.number_of_payments}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Next Payment</div>
                                                    <div className="font-medium">
                                                        {plan.next_payment_date ? formatDate(plan.next_payment_date) : "N/A"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Due Date</div>
                                                    <div className="font-medium">
                                                        {plan.due_date ? formatDate(plan.due_date) : "N/A"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2 pt-4 border-t">
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedPlan(plan)
                                                        setShowPaymentModal(true)
                                                    }}
                                                >
                                                    <DollarSign className="h-4 w-4 mr-2" />
                                                    Record Payment
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCompleteLayaway(plan.plan_id)}
                                                    disabled={processing}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Complete
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => {
                                                        setSelectedPlan(plan)
                                                        setShowCancelModal(true)
                                                    }}
                                                >
                                                    <X className="h-4 w-4 mr-2" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* Completed Plans */}
                <TabsContent value="completed" className="space-y-4">
                    {completedPlans.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-muted-foreground">No completed layaway plans</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {completedPlans.map((plan) => (
                                <Card key={plan.plan_id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    {plan.customer_name || plan.customer}
                                                    {getStatusBadge(plan.status)}
                                                </CardTitle>
                                                <CardDescription>
                                                    Completed: {formatDate(plan.completed_at || plan.updated_at)}
                                                </CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{formatCurrency(plan.total_amount)}</div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Cancelled Plans */}
                <TabsContent value="cancelled" className="space-y-4">
                    {cancelledPlans.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <X className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-muted-foreground">No cancelled layaway plans</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {cancelledPlans.map((plan) => (
                                <Card key={plan.plan_id}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    {plan.customer_name || plan.customer}
                                                    {getStatusBadge(plan.status)}
                                                </CardTitle>
                                                <CardDescription>
                                                    Cancelled: {formatDate(plan.cancelled_at || plan.updated_at)}
                                                </CardDescription>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{formatCurrency(plan.total_amount)}</div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Create Layaway Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create Layaway Plan</DialogTitle>
                        <DialogDescription>
                            Create a new layaway/installment plan for a customer
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Customer *</Label>
                            <Input
                                value={createForm.customer}
                                onChange={(e) => setCreateForm({ ...createForm, customer: e.target.value })}
                                placeholder="Customer name or ID"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Total Amount (KES) *</Label>
                                <Input
                                    type="number"
                                    value={createForm.total_amount || ""}
                                    onChange={(e) => setCreateForm({ ...createForm, total_amount: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <Label>Deposit Amount (KES) *</Label>
                                <Input
                                    type="number"
                                    value={createForm.deposit_amount || ""}
                                    onChange={(e) => setCreateForm({ ...createForm, deposit_amount: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Payment Schedule</Label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={createForm.payment_schedule}
                                    onChange={(e) => setCreateForm({ ...createForm, payment_schedule: e.target.value as any })}
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Bi-weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div>
                                <Label>Number of Payments</Label>
                                <Input
                                    type="number"
                                    value={createForm.number_of_payments || ""}
                                    onChange={(e) => setCreateForm({ ...createForm, number_of_payments: parseInt(e.target.value) || 4 })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Due Date (Optional)</Label>
                            <Input
                                type="date"
                                value={createForm.due_date}
                                onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                            />
                        </div>
                        <div className="p-4 bg-muted rounded-md">
                            <p className="text-sm text-muted-foreground">
                                Note: Item selection will be added in a future update. For now, please enter items manually.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateLayaway} disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Plan"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Modal */}
            <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment</DialogTitle>
                        <DialogDescription>
                            Record a payment for {selectedPlan?.customer_name || selectedPlan?.customer}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Payment Amount (KES) *</Label>
                            <Input
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="Enter amount"
                            />
                            {selectedPlan && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Remaining balance: {formatCurrency(selectedPlan.total_amount - selectedPlan.total_paid)}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRecordPayment} disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Recording...
                                </>
                            ) : (
                                "Record Payment"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Cancel Modal */}
            <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Layaway Plan</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel this layaway plan? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                            No, Keep Plan
                        </Button>
                        <Button variant="destructive" onClick={handleCancelLayaway} disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                "Yes, Cancel Plan"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
