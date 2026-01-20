
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Upload, FileDown, CheckCircle, AlertCircle, RefreshCcw } from "lucide-react"
import { importApi, ImportValidation, ImportResult } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

interface BulkUploadModalProps {
    entityType: "users" | "inventory" | "warehouses" | "storefronts"
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function BulkUploadModal({ entityType, trigger, onSuccess }: BulkUploadModalProps) {
    const { token } = useAuthStore()
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<"upload" | "validating" | "validated" | "importing" | "success" | "error">("upload")
    const [file, setFile] = useState<File | null>(null)
    const [validation, setValidation] = useState<ImportValidation | null>(null)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const reset = () => {
        setStep("upload")
        setFile(null)
        setValidation(null)
        setResult(null)
        setErrorMsg(null)
    }

    const handleDownloadTemplate = async () => {
        if (!token) return
        try {
            const blob = await importApi.getTemplate(token, entityType)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `template_${entityType}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (e) {
            console.error("Failed to download template", e)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setErrorMsg(null)
        }
    }

    const handleValidate = async () => {
        if (!file || !token) return
        setStep("validating")
        try {
            const res = await importApi.validate(token, entityType, file)
            setValidation(res)
            setStep("validated")
        } catch (e) {
            const detail = typeof e === 'object' && e !== null && 'detail' in e ? (e as any).detail : null
            setErrorMsg(typeof detail === 'string' ? detail : "Validation failed")
            setStep("upload") // Go back to let them try again
        }
    }

    const handleImport = async () => {
        if (!file || !token) return
        setStep("importing")
        try {
            const res = await importApi.execute(token, entityType, file)
            setResult(res)
            setStep("success")
            if (onSuccess) onSuccess()
        } catch (e) {
            const detail = typeof e === 'object' && e !== null && 'detail' in e ? (e as any).detail : null
            setErrorMsg(typeof detail === 'string' ? detail : "Import execution failed")
            setStep("validated") // Stay on validation screen but show error
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            // reset after a delay so animation finishes
            setTimeout(reset, 300)
        }
    }

    const labels: Record<string, string> = {
        users: "Users",
        inventory: "Inventory",
        warehouses: "Warehouses",
        storefronts: "Storefronts"
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import {labels[entityType]}</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Import {labels[entityType]}</DialogTitle>
                    <DialogDescription>
                        Bulk create records by uploading a CSV file.
                    </DialogDescription>
                </DialogHeader>

                {step === "upload" && (
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/50">
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium">1. Download Template</h4>
                                <p className="text-xs text-muted-foreground">Get the CSV format for this entity.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                                <FileDown className="w-4 h-4 mr-2" /> Template
                            </Button>
                        </div>

                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="file">2. Upload CSV File</Label>
                            <Input id="file" type="file" accept=".csv" onChange={handleFileChange} />
                        </div>

                        {errorMsg && (
                            <div className="text-sm text-destructive flex items-center">
                                <AlertCircle className="w-4 h-4 mr-2" /> {errorMsg}
                            </div>
                        )}
                    </div>
                )}

                {step === "validating" && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Validating file contents...</p>
                    </div>
                )}

                {step === "validated" && validation && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold">Validation Results</h4>
                            {validation.valid ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Valid
                                </Badge>
                            ) : (
                                <Badge variant="destructive">
                                    <AlertCircle className="w-3 h-3 mr-1" /> Invalid
                                </Badge>
                            )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                            Found {validation.row_count} rows.
                        </div>

                        {!validation.valid ? (
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-red-50">
                                <ul className="list-disc pl-4 space-y-1 text-sm text-red-900">
                                    {validation.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </ScrollArea>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm">Preview of first 5 items:</p>
                                <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-muted">
                                            <tr>
                                                {validation.preview.length > 0 && Object.keys(validation.preview[0]).map(k => (
                                                    <th key={k} className="p-2 border-b font-medium">{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validation.preview.map((row, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                                                    {Object.values(row).map((v: any, j) => (
                                                        <td key={j} className="p-2 truncate max-w-[100px]">{v}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="text-sm text-destructive flex items-center">
                                <AlertCircle className="w-4 h-4 mr-2" /> {errorMsg}
                            </div>
                        )}
                    </div>
                )}

                {step === "importing" && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Importing records...</p>
                    </div>
                )}

                {step === "success" && result && (
                    <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Import Complete</h3>
                            <p className="text-sm text-muted-foreground">
                                Successfully created {result.created} of {result.processed} records.
                            </p>
                        </div>
                    </div>
                )}


                <DialogFooter className="sm:justify-between">
                    {step === "upload" && (
                        <>
                            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button disabled={!file} onClick={handleValidate}>Validate File</Button>
                        </>
                    )}
                    {step === "validated" && (
                        <>
                            <Button variant="ghost" onClick={reset}><RefreshCcw className="w-4 h-4 mr-2" /> Reset</Button>
                            <Button disabled={!validation?.valid} onClick={handleImport}>Import Records</Button>
                        </>
                    )}
                    {step === "success" && (
                        <Button className="w-full" onClick={() => setOpen(false)}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
