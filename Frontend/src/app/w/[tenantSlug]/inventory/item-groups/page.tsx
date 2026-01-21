"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    FolderTree,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    ChevronRight,
    ChevronDown,
    Folder,
    FileText,
    Search
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ItemGroup {
    name: string;
    item_group_name: string;
    parent_item_group: string | null;
    is_group: number;
    children?: ItemGroup[];
}

export default function ItemGroupsPage() {
    const params = useParams() as any;
    const tenantSlug = params.tenantSlug as string;
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
    const [hierarchicalData, setHierarchicalData] = useState<ItemGroup[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["All Item Groups"]));
    const [isCreating, setIsCreating] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Partial<ItemGroup> | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (token) {
            fetchItemGroups();
        }
    }, [token]);

    const fetchItemGroups = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await apiFetch<{ data: ItemGroup[]; hierarchical: ItemGroup[] }>(
                "/api/inventory/item-groups",
                {},
                token
            );
            setItemGroups(response.data || []);
            setHierarchicalData(response.hierarchical || []);
        } catch (error) {
            console.error("Failed to fetch item groups", error);
            toast.error("Failed to load item groups");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = () => {
        setEditingGroup({
            item_group_name: "",
            parent_item_group: "All Item Groups",
            is_group: 0
        });
        setIsCreating(true);
    };

    const handleEditGroup = (group: ItemGroup) => {
        setEditingGroup({ ...group });
        setIsCreating(true);
    };

    const handleSaveGroup = async () => {
        if (!token || !editingGroup || !editingGroup.item_group_name) return;

        setSaving(true);
        try {
            const isNew = !itemGroups.find(g => g.name === editingGroup.name);

            if (isNew) {
                await apiFetch(
                    "/api/inventory/item-groups",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            item_group_name: editingGroup.item_group_name,
                            parent_item_group: editingGroup.parent_item_group || null,
                            is_group: editingGroup.is_group || 0
                        })
                    },
                    token
                );
                toast.success("Item group created successfully");
            } else {
                await apiFetch(
                    `/api/inventory/item-groups/${encodeURIComponent(editingGroup.name!)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            item_group_name: editingGroup.item_group_name,
                            parent_item_group: editingGroup.parent_item_group,
                            is_group: editingGroup.is_group
                        })
                    },
                    token
                );
                toast.success("Item group updated successfully");
            }

            setIsCreating(false);
            setEditingGroup(null);
            fetchItemGroups();
        } catch (error: any) {
            console.error("Failed to save item group", error);
            toast.error(error?.message || "Failed to save item group");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGroup = async (groupName: string) => {
        if (!token || !confirm(`Are you sure you want to delete "${groupName}"?`)) return;

        try {
            await apiFetch(
                `/api/inventory/item-groups/${encodeURIComponent(groupName)}`,
                { method: "DELETE" },
                token
            );
            toast.success("Item group deleted successfully");
            fetchItemGroups();
        } catch (error: any) {
            console.error("Failed to delete item group", error);
            toast.error(error?.message || "Failed to delete item group");
        }
    };

    const toggleExpand = (groupName: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupName)) {
            newExpanded.delete(groupName);
        } else {
            newExpanded.add(groupName);
        }
        setExpandedGroups(newExpanded);
    };

    const renderTreeNode = (group: ItemGroup, level: number = 0) => {
        const isExpanded = expandedGroups.has(group.name);
        const hasChildren = group.children && group.children.length > 0;
        const isGroup = group.is_group === 1;

        // Filter by search query
        const matchesSearch = !searchQuery ||
            group.item_group_name.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch && !hasChildren) return null;

        return (
            <div key={group.name} className="w-full">
                <div
                    className={`flex items-center gap-2 p-3 rounded-lg hover:bg-muted/50 dark:hover:bg-white/5 transition-all group ${level > 0 ? `ml-${level * 6}` : ""
                        }`}
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    {hasChildren && (
                        <button
                            onClick={() => toggleExpand(group.name)}
                            className="p-1 hover:bg-muted dark:hover:bg-white/10 rounded transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    {!hasChildren && <div className="w-6" />}

                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isGroup
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                        }`}>
                        {isGroup ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>

                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{group.item_group_name}</p>
                        {group.parent_item_group && (
                            <p className="text-xs text-muted-foreground">
                                Parent: {group.parent_item_group}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary dark:hover:text-cyan-400"
                            onClick={() => handleEditGroup(group)}
                        >
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        {group.name !== "All Item Groups" && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive dark:hover:text-red-400"
                                onClick={() => handleDeleteGroup(group.name)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {hasChildren && isExpanded && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {group.children!.map(child => renderTreeNode(child, level + 1))}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent dark:from-white dark:to-white/60">
                        Item Groups
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Manage item categories and hierarchical structure
                    </p>
                </div>
                <Button
                    onClick={handleCreateGroup}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                </Button>
            </div>

            {/* Main Content */}
            <Card className="border-border dark:border-white/10">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search item groups..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        {hierarchicalData.map(group => renderTreeNode(group, 0))}
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Modal */}
            {isCreating && editingGroup && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-card border border-border dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-xl"
                    >
                        <h2 className="text-2xl font-bold mb-4">
                            {editingGroup.name ? "Edit Item Group" : "Create Item Group"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-2 block">
                                    Group Name
                                </label>
                                <Input
                                    value={editingGroup.item_group_name || ""}
                                    onChange={(e) =>
                                        setEditingGroup({ ...editingGroup, item_group_name: e.target.value })
                                    }
                                    placeholder="e.g., Electronics"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-foreground mb-2 block">
                                    Parent Group
                                </label>
                                <select
                                    value={editingGroup.parent_item_group || ""}
                                    onChange={(e) =>
                                        setEditingGroup({ ...editingGroup, parent_item_group: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
                                >
                                    <option value="">None (Root Level)</option>
                                    {itemGroups
                                        .filter(g => g.is_group === 1 && g.name !== editingGroup.name)
                                        .map(g => (
                                            <option key={g.name} value={g.name}>
                                                {g.item_group_name}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_group"
                                    checked={editingGroup.is_group === 1}
                                    onChange={(e) =>
                                        setEditingGroup({ ...editingGroup, is_group: e.target.checked ? 1 : 0 })
                                    }
                                    className="rounded border-border"
                                />
                                <label htmlFor="is_group" className="text-sm text-foreground">
                                    This is a group (can have child groups)
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingGroup(null);
                                }}
                                className="flex-1"
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveGroup}
                                className="flex-1 bg-primary hover:bg-primary/90"
                                disabled={saving || !editingGroup.item_group_name}
                            >
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {editingGroup.name ? "Update" : "Create"}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
