/**
 * Contact Management Component
 *
 * Note: This file previously contained corrupted/injected code.
 * This version is minimal and uses the shared `apiFetch` client.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Mail, Phone, User2, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Contact {
  id: string;
  contact_code: string;
  contact_name: string;
  contact_type: 'customer' | 'supplier' | 'partner';
  email?: string;
  phone?: string;
  status: string;
  escalation_requested: boolean;
  kyc_tier: string;
  created_at: string;
}

interface ContactManagementProps {
  tenantId: string;
}

export function ContactManagement({ tenantId }: ContactManagementProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'customer' | 'supplier' | 'partner' | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    void loadContacts();
  }, [tenantId, selectedType]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const qs = selectedType ? `?contact_type=${encodeURIComponent(selectedType)}` : '';
      const data = await apiFetch<any>(`/onboarding/tenants/${tenantId}/contacts${qs}`);
      const list = data?.contacts || data?.data?.contacts || [];
      setContacts(Array.isArray(list) ? list : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Contacts</h2>
          <p className="text-muted-foreground">Manage customers, suppliers, and partners</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Contact
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button variant={selectedType === null ? 'default' : 'outline'} onClick={() => setSelectedType(null)}>
          All
        </Button>
        {(['customer', 'supplier', 'partner'] as const).map((type) => (
          <Button
            key={type}
            variant={selectedType === type ? 'default' : 'outline'}
            onClick={() => setSelectedType(type)}
            className="capitalize"
          >
            {type}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">No contacts found. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEscalate={() => {
                setSelectedContact(contact);
                setShowEscalateDialog(true);
              }}
            />
          ))}
        </div>
      )}

      <CreateContactDialog
        tenantId={tenantId}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={async () => {
          setShowCreateDialog(false);
          await loadContacts();
        }}
      />

      {selectedContact && (
        <EscalateContactDialog
          tenantId={tenantId}
          contact={selectedContact}
          open={showEscalateDialog}
          onOpenChange={setShowEscalateDialog}
          onSuccess={async () => {
            setShowEscalateDialog(false);
            await loadContacts();
          }}
        />
      )}
    </div>
  );
}

function ContactCard({ contact, onEscalate }: { contact: Contact; onEscalate: () => void }) {
  const typeColor = (type: string) => {
    switch (type) {
      case 'customer':
        return 'bg-blue-100 text-blue-800';
      case 'supplier':
        return 'bg-green-100 text-green-800';
      case 'partner':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <User2 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{contact.contact_name}</h3>
              <Badge className={`capitalize ${typeColor(contact.contact_type)}`}>{contact.contact_type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{contact.contact_code}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {contact.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                </div>
              ) : null}
              {contact.phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Badge variant="outline">{contact.status}</Badge>
              </div>
            </div>

            {contact.escalation_requested ? (
              <Alert className="mt-4 bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-800">Escalation pending approval</AlertDescription>
              </Alert>
            ) : null}
          </div>

          {contact.contact_type === 'customer' && !contact.escalation_requested ? (
            <Button variant="outline" size="sm" onClick={onEscalate}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Escalate to User
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateContactDialog({
  tenantId,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_type: 'customer' as 'customer' | 'supplier' | 'partner',
    email: '',
    phone: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/onboarding/tenants/${tenantId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      onSuccess();
      setFormData({ contact_name: '', contact_type: 'customer', email: '', phone: '', address: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Contact</DialogTitle>
          <DialogDescription>Add a new customer, supplier, or partner</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={formData.contact_name}
              onChange={(e) => setFormData((p) => ({ ...p, contact_name: e.target.value }))}
              placeholder="Contact name"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Type *</label>
            <select
              value={formData.contact_type}
              onChange={(e) => setFormData((p) => ({ ...p, contact_type: e.target.value as any }))}
              className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
            >
              <option value="customer">Customer</option>
              <option value="supplier">Supplier</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Phone</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+254700000000"
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Contact'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EscalateContactDialog({
  tenantId,
  contact,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(contact.contact_name);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(contact.contact_name);
  }, [contact.contact_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/onboarding/tenants/${tenantId}/contacts/${contact.id}/accept-access`, {
        method: 'POST',
        body: JSON.stringify({ password, full_name: fullName }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escalate to User Account</DialogTitle>
          <DialogDescription>Create a user account for {contact.contact_name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div>
            <label className="text-sm font-medium">Email</label>
            <Input value={contact.email || ''} disabled className="mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium">Password *</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || password.length < 8}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User Account'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
