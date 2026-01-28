"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    ArrowLeft,
    RefreshCw,
    Building2,
} from "lucide-react";
import { 
    getSuppliers, 
    createSupplier, 
    updateSupplier, 
    deleteSupplier 
} from "@/lib/api/purchases";
import type { Supplier, CreateSupplierRequest, UpdateSupplierRequest } from "@/lib/types/purchases";
import { toast } from "sonner";

const SUPPLIER_GROUPS = [
    "Local",
    "International",
    "Distributor",
    "Manufacturer",
    "Wholesaler",
    "Services",
    "Raw Materials",
    "Hardware",
    "All Supplier Groups",
];

const COUNTRIES = [
    "Kenya",
    "Tanzania",
    "Uganda",
    "Rwanda",
    "Ethiopia",
    "South Africa",
    "Nigeria",
    "Ghana",
    "USA",
    "UK",
    "China",
    "India",
    "UAE",
];

export default function SuppliersPage() {
    const params = useParams();
    const router = useRouter();
    const tenantSlug = params.tenantSlug as string;
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState<CreateSupplierRequest>({
        name: "",
        supplier_group: "Local",
        country: "Kenya",
        currency: "KES",
        tax_id: "",
    });

    const loadSuppliers = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await getSuppliers({ limit: 100 });
            setSuppliers(data);
        } catch (error) {
            console.error("Failed to fetch suppliers:", error);
            toast.error("Failed to load suppliers");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    const openCreateDialog = () => {
        setEditingSupplier(null);
        setFormData({
            name: "",
            supplier_group: "Local",
            country: "Kenya",
            currency: "KES",
            tax_id: "",
        });
        setDialogOpen(true);
    };

    const openEditDialog = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            name: supplier.name,
            supplier_group: supplier.supplier_group || "Local",
            country: supplier.country || "Kenya",
            currency: supplier.currency || "KES",
            tax_id: supplier.tax_id || "",
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Supplier name is required");
            return;
        }

        setIsSaving(true);
        try {
            if (editingSupplier) {
                // Update existing
                const updateData: UpdateSupplierRequest = {
                    name: formData.name,
                    supplier_group: formData.supplier_group,
                    country: formData.country,
                    currency: formData.currency,
                    tax_id: formData.tax_id,
                };
                await updateSupplier(editingSupplier.id, updateData);
                toast.success("Supplier updated");
            } else {
                // Create new
                await createSupplier(formData);
                toast.success("Supplier created");
            }
            setDialogOpen(false);
            loadSuppliers();
        } catch (error: any) {
            toast.error(error?.message || "Failed to save supplier");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (supplier: Supplier) => {
        if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) {
            return;
        }
        try {
            await deleteSupplier(supplier.id);
            toast.success("Supplier deleted");
            loadSuppliers();
        } catch (error: any) {
            toast.error(error?.message || "Failed to delete supplier");
        }
    };

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.supplier_group?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-muted-foreground">Manage your vendor relationships</p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search suppliers..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" onClick={loadSuppliers}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Supplier Name</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Tax ID</TableHead>
                                <TableHead className="w-[80px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Loading suppliers...
                                    </TableCell>
                                </TableRow>
                            ) : filteredSuppliers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        {searchQuery ? "No suppliers match your search" : "No suppliers yet. Add your first supplier."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSuppliers.map((supplier) => (
                                    <TableRow key={supplier.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                {supplier.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{supplier.supplier_group}</Badge>
                                        </TableCell>
                                        <TableCell>{supplier.country}</TableCell>
                                        <TableCell>{supplier.currency || "KES"}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {supplier.tax_id || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        onClick={() => handleDelete(supplier)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingSupplier 
                                ? "Update the supplier information below."
                                : "Enter the details for the new supplier."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Supplier Name *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter supplier name"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Supplier Group</Label>
                                <Select 
                                    value={formData.supplier_group} 
                                    onValueChange={(value) => setFormData({ ...formData, supplier_group: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPLIER_GROUPS.map((group) => (
                                            <SelectItem key={group} value={group}>
                                                {group}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Country</Label>
                                <Select 
                                    value={formData.country} 
                                    onValueChange={(value) => setFormData({ ...formData, country: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COUNTRIES.map((country) => (
                                            <SelectItem key={country} value={country}>
                                                {country}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select 
                                    value={formData.currency} 
                                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                        <SelectItem value="TZS">TZS - Tanzanian Shilling</SelectItem>
                                        <SelectItem value="UGX">UGX - Ugandan Shilling</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="tax_id">Tax ID / PIN</Label>
                                <Input
                                    id="tax_id"
                                    value={formData.tax_id}
                                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                    placeholder="e.g., P051234567X"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : (editingSupplier ? "Update" : "Create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
