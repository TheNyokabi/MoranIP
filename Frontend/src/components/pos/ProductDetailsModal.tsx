"use client"

import React, { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Loader2, Upload, Save, Image as ImageIcon, Box, Barcode, DollarSign } from "lucide-react"
import type { POSItem } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

interface ProductDetailsModalProps {
    open: boolean
    onClose: () => void
    item: POSItem | null
    onUpdate: () => void
}

export function ProductDetailsModal({ open, onClose, item, onUpdate }: ProductDetailsModalProps) {
    const { token } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(item?.image || null)

    // Reset state when item changes
    React.useEffect(() => {
        if (open && item) {
            setPreviewUrl(item.image || null)
        }
    }, [open, item])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size too large (max 5MB)")
            return
        }

        // Create local preview
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)

        // Upload immediately
        await uploadImage(file)
    }

    const uploadImage = async (file: File) => {
        if (!item || !token) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', 'image')

            // 1. Upload File
            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            if (!uploadRes.ok) throw new Error('Upload failed')

            const uploadData = await uploadRes.json()
            const imageUrl = uploadData.file.url

            // 2. Update Item in Backend (Inventory API)
            await apiFetch(`/inventory/items/${item.item_code}`, {
                method: 'PUT',
                body: JSON.stringify({ image: imageUrl })
            }, token)

            toast.success("Product image updated")
            onUpdate() // Refresh parent list

        } catch (error) {
            console.error(error)
            toast.error("Failed to upload image")
            // Revert preview
            setPreviewUrl(item.image || null)
        } finally {
            setUploading(false)
        }
    }

    if (!item) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-slate-200">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Box className="h-5 w-5 text-emerald-400" />
                        Product Details
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        View and edit details for <span className="text-white font-medium">{item.item_code}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    {/* Left Column: Image */}
                    <div className="space-y-4">
                        <div className="aspect-square relative rounded-xl overflow-hidden border-2 border-dashed border-slate-800 bg-slate-900/50 group">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt={item.item_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                    <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                                    <span className="text-sm">No Image</span>
                                </div>
                            )}

                            {/* Overlay Upload Button */}
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    {uploading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                    )}
                                    {uploading ? "Uploading..." : "Change Photo"}
                                </Button>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                        </div>
                        <p className="text-xs text-center text-slate-500">
                            Supported: JPG, PNG, WEBP (Max 5MB)
                        </p>
                    </div>

                    {/* Right Column: Details */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs uppercase">Item Name</Label>
                            <div className="p-3 bg-slate-900 rounded-lg text-sm font-medium border border-slate-800">
                                {item.item_name}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-xs uppercase">Stock UOM</Label>
                                <div className="p-3 bg-slate-900 rounded-lg text-sm font-mono border border-slate-800 flex items-center gap-2">
                                    <Box className="h-3 w-3 text-slate-500" />
                                    {item.stock_uom}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-slate-400 text-xs uppercase">Standard Rate</Label>
                                <div className="p-3 bg-slate-900 rounded-lg text-sm font-mono font-bold text-emerald-400 border border-slate-800 flex items-center gap-2">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(item.standard_rate)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs uppercase">Description</Label>
                            <div className="p-3 bg-slate-900 rounded-lg text-sm text-slate-400 border border-slate-800 min-h-[80px]">
                                {item.description || "No description available."}
                            </div>
                        </div>

                        <div className="pt-2">
                            <div className={`p-3 rounded-lg border flex items-center justify-between ${(item.stock_qty || 0) > 0
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                                }`}>
                                <span className="text-sm font-medium">Stock Availability</span>
                                <span className="font-bold font-mono">
                                    {item.stock_qty || 0} {item.stock_uom}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
