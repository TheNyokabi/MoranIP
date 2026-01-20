'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/components/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';

export type MasterDataFieldType = 'text' | 'date' | 'boolean';

export interface MasterDataField {
  key: string;
  label: string;
  type?: MasterDataFieldType;
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
}

export interface MasterDataCrudConfig {
  title: string;
  description?: string;
  tenantId: string;

  listPath: (tenantId: string) => string;
  createPath: (tenantId: string) => string;
  getPath?: (tenantId: string, id: string) => string;
  updatePath: (tenantId: string, id: string) => string;
  deletePath: (tenantId: string, id: string) => string;

  idField?: string;
  columns?: ReadonlyArray<{ key: string; label: string }>;
  fields: ReadonlyArray<MasterDataField>;
}

function coerceFieldValue(value: any, type: MasterDataFieldType): any {
  if (type === 'boolean') return Boolean(value);
  return value;
}

export function MasterDataCrudPage({ config }: { config: MasterDataCrudConfig }) {
  const {
    title,
    description,
    tenantId,
    listPath,
    createPath,
    getPath,
    updatePath,
    deletePath,
    idField = 'name',
    fields,
  } = config;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const columns = useMemo(() => {
    const base = (config.columns && config.columns.length > 0)
      ? config.columns
      : [{ key: idField, label: 'Name' }];

    return [
      ...base,
      {
        key: '__actions',
        label: 'Actions',
        render: (_: any, row: any) => {
          const id = String(row?.[idField] ?? row?.name ?? '');
          return (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(id)}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ] as any;
  }, [config.columns, idField, title]);

  const resetForm = () => {
    const initial: Record<string, any> = {};
    for (const field of fields) {
      initial[field.key] = field.defaultValue ?? (field.type === 'boolean' ? false : '');
    }
    setFormData(initial);
  };

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>(listPath(tenantId));
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setItems(list);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, listPath]);

  const openCreate = () => {
    setMode('create');
    setActiveId(null);
    resetForm();
    setOpen(true);
  };

  const onEdit = async (id: string) => {
    setMode('edit');
    setActiveId(id);
    resetForm();
    setOpen(true);

    if (!getPath) return;

    setSaving(true);
    try {
      const detail = await apiFetch<any>(getPath(tenantId, id));
      const next = { ...formData };
      for (const field of fields) {
        if (detail?.[field.key] !== undefined) next[field.key] = detail[field.key];
      }
      setFormData(next);
    } catch (e: any) {
      toast.error(e?.detail || e?.message || 'Failed to load details');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await apiFetch(deletePath(tenantId, id), { method: 'DELETE' });
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(e?.detail || e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async () => {
    if (!tenantId) return;

    // Basic required validation.
    for (const field of fields) {
      if (field.required) {
        const value = formData[field.key];
        if (value === null || value === undefined || String(value).trim() === '') {
          toast.error(`${field.label} is required`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const field of fields) {
        const type = field.type ?? 'text';
        const value = coerceFieldValue(formData[field.key], type);
        if (value !== '' && value !== null && value !== undefined) payload[field.key] = value;
      }

      if (mode === 'create') {
        await apiFetch(createPath(tenantId), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Created');
      } else if (activeId) {
        await apiFetch(updatePath(tenantId, activeId), {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Updated');
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.detail || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <CardDescription>Manage {title.toLowerCase()} for this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={items} isLoading={loading} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? `New ${title}` : `Edit ${title}`}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Fill in the fields and save.'
                : 'Update fields and save changes.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {fields.map((field) => {
              const type = field.type ?? 'text';
              const value = formData[field.key];

              if (type === 'boolean') {
                return (
                  <div key={field.key} className="flex items-center justify-between gap-4">
                    <div>
                      <Label>{field.label}</Label>
                      {field.placeholder ? (
                        <p className="text-xs text-muted-foreground">{field.placeholder}</p>
                      ) : null}
                    </div>
                    <Switch
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, [field.key]: checked }))}
                    />
                  </div>
                );
              }

              return (
                <div key={field.key} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Input
                    type={type === 'date' ? 'date' : 'text'}
                    placeholder={field.placeholder}
                    value={value ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
