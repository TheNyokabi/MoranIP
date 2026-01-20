"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/store/auth-store"
import { posApi } from "@/lib/api"
import { 
    Award, 
    Gift, 
    Star,
    Loader2,
    TrendingUp
} from "lucide-react"
import { toast } from "sonner"

interface LoyaltyPointsDisplayProps {
    customer: string
    purchaseAmount?: number
    onRedeem?: (points: number, discount: number) => void
}

const TIER_COLORS = {
    Bronze: "bg-orange-500",
    Silver: "bg-gray-400",
    Gold: "bg-yellow-500"
}

const TIER_ICONS = {
    Bronze: Star,
    Silver: TrendingUp,
    Gold: Award
}

export function LoyaltyPointsDisplay({
    customer,
    purchaseAmount,
    onRedeem
}: LoyaltyPointsDisplayProps) {
    const { token } = useAuthStore()
    const [points, setPoints] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [pointsCalculation, setPointsCalculation] = useState<any>(null)

    useEffect(() => {
        if (customer && token) {
            loadPoints()
        }
    }, [customer, token])

    useEffect(() => {
        if (customer && purchaseAmount && token) {
            calculatePoints()
        }
    }, [customer, purchaseAmount, token])

    const loadPoints = async () => {
        if (!customer || !token) return
        
        setLoading(true)
        try {
            const response = await posApi.getCustomerPoints(token, customer)
            setPoints(response)
        } catch (error) {
            console.error("Failed to load points:", error)
        } finally {
            setLoading(false)
        }
    }

    const calculatePoints = async () => {
        if (!customer || !purchaseAmount || !token) return
        
        try {
            const response = await posApi.calculatePoints(token, purchaseAmount, customer, false)
            setPointsCalculation(response)
        } catch (error) {
            console.error("Failed to calculate points:", error)
        }
    }

    const handleRedeem = async () => {
        if (!points || !purchaseAmount || !token) return
        
        // For now, redeem all available points
        // In production, show a modal to select amount
        try {
            const response = await posApi.redeemPoints(token, {
                customer: customer,
                points_to_redeem: points.points_balance,
                invoice_amount: purchaseAmount
            })
            
            if (onRedeem) {
                onRedeem(response.points_redeemed, response.discount_amount)
            }
            
            toast.success(`Redeemed ${response.points_redeemed.toFixed(0)} points for KES ${response.discount_amount.toFixed(2)} discount`)
            
            // Reload points
            await loadPoints()
        } catch (error: any) {
            toast.error(error.message || "Failed to redeem points")
        }
    }

    if (!customer) {
        return null
    }

    if (loading && !points) {
        return (
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!points) {
        return null
    }

    const TierIcon = TIER_ICONS[points.tier as keyof typeof TIER_ICONS] || Star
    const tierColor = TIER_COLORS[points.tier as keyof typeof TIER_COLORS] || "bg-gray-500"

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Loyalty Points
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Points Balance */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="text-2xl font-bold">{points.points_balance.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">
                            = KES {points.points_value_kes.toFixed(2)}
                        </div>
                    </div>
                    <Badge className={`${tierColor} text-white`}>
                        <TierIcon className="h-3 w-3 mr-1" />
                        {points.tier}
                    </Badge>
                </div>

                {/* Points to Earn */}
                {pointsCalculation && (
                    <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground mb-1">
                            Points to earn from this purchase
                        </div>
                        <div className="text-lg font-semibold text-green-600">
                            +{pointsCalculation.total_points.toFixed(0)} points
                        </div>
                        {pointsCalculation.is_birthday && (
                            <Badge variant="outline" className="mt-1 text-xs">
                                🎂 Birthday Bonus (2x)
                            </Badge>
                        )}
                    </div>
                )}

                {/* Redeem Button */}
                {points.points_balance > 0 && purchaseAmount && (
                    <Button
                        onClick={handleRedeem}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        Redeem Points
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
