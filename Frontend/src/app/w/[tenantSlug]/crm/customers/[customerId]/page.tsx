'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Edit2,
  Save,
  X,
  MapPin,
  Phone,
  Mail,
  FileText,
  Clock,
  DollarSign,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CustomerAddress {
  name: string;
  address_type: 'Billing' | 'Shipping' | 'Other';
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary_address?: boolean;
}

interface ContactPerson {
  name: string;
  designation: string;
  email: string;
  phone: string;
  is_primary_contact?: boolean;
}

interface Customer {
  name: string;
  customer_name: string;
  customer_type: 'Individual' | 'Company';
  customer_group: string;
  territory: string;
  status: string;
  email: string;
  phone: string;
  mobile_no: string;
  website: string;
  credit_limit: number;
  credit_days: number;
  outstanding_invoices_amount: number;
  total_lifetime_value: number;
  total_orders: number;
  addresses: CustomerAddress[];
  contacts: ContactPerson[];
  notes: string;
  created_on: string;
  modified_on: string;
}

const defaultCustomer: Customer = {
  name: '',
  customer_name: '',
  customer_type: 'Company',
  customer_group: '',
  territory: '',
  status: 'Active',
  email: '',
  phone: '',
  mobile_no: '',
  website: '',
  credit_limit: 0,
  credit_days: 0,
  outstanding_invoices_amount: 0,
  total_lifetime_value: 0,
  total_orders: 0,
  addresses: [],
  contacts: [],
  notes: '',
  created_on: '',
  modified_on: '',
};

export default function CustomerDetailPage() {
  const params = useParams() as any;
  const customerId = params?.customerId as string;
  const tenantSlug = params?.tenantSlug as string;

  const [customer, setCustomer] = useState<Customer>(defaultCustomer);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  // Fetch customer data
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/tenants/${tenantSlug}/erp/crm/customers/${customerId}`
        );
        if (!response.ok) throw new Error('Failed to fetch customer');
        const data = await response.json();
        setCustomer(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading customer');
      } finally {
        setIsLoading(false);
      }
    };

    if (customerId && tenantSlug) fetchCustomer();
  }, [customerId, tenantSlug]);

  const handleSave = async () => {
    try {
      const response = await fetch(
        `/api/tenants/${tenantSlug}/erp/crm/customers/${customerId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customer),
        }
      );
      if (!response.ok) throw new Error('Failed to save customer');
      setIsEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving customer');
    }
  };

  const calculateCreditUsed = (): number => {
    return Math.min(
      customer.outstanding_invoices_amount,
      customer.credit_limit
    );
  };

  const calculateCreditUtilization = (): number => {
    if (customer.credit_limit === 0) return 0;
    return (calculateCreditUsed() / customer.credit_limit) * 100;
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading customer details...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{customer.customer_name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge className={getStatusColor(customer.status)}>
              {customer.status}
            </Badge>
            <Badge variant="outline">{customer.customer_type}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditMode ? (
            <Button onClick={() => setIsEditMode(true)} variant="default">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} variant="default">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                onClick={() => {
                  setIsEditMode(false);
                  setError(null);
                }}
                variant="outline"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Credit Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Credit Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customer.credit_limit.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {customer.credit_days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Credit Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateCreditUsed().toLocaleString()}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${Math.min(calculateCreditUtilization(), 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {calculateCreditUtilization().toFixed(1)}% utilization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.total_orders}</div>
            <p className="text-xs text-gray-500 mt-1">Lifetime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Lifetime Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customer.total_lifetime_value.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total spent</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="contacts">Contact Persons</TabsTrigger>
          <TabsTrigger value="orders">Order History</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    value={customer.customer_name}
                    onChange={(e) =>
                      setCustomer({
                        ...customer,
                        customer_name: e.target.value,
                      })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={customer.email}
                    onChange={(e) =>
                      setCustomer({ ...customer, email: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={customer.phone}
                    onChange={(e) =>
                      setCustomer({ ...customer, phone: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input
                    value={customer.mobile_no}
                    onChange={(e) =>
                      setCustomer({ ...customer, mobile_no: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={customer.website}
                    onChange={(e) =>
                      setCustomer({ ...customer, website: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Customer Group</Label>
                  <Select
                    value={customer.customer_group}
                    onValueChange={(value) =>
                      setCustomer({ ...customer, customer_group: value })
                    }
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Individual">Individual</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Government">Government</SelectItem>
                      <SelectItem value="Educational">Educational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Territory</Label>
                  <Input
                    value={customer.territory}
                    onChange={(e) =>
                      setCustomer({ ...customer, territory: e.target.value })
                    }
                    disabled={!isEditMode}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={customer.status}
                    onValueChange={(value) =>
                      setCustomer({ ...customer, status: value })
                    }
                    disabled={!isEditMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses">
          <Card>
            <CardHeader>
              <CardTitle>Addresses</CardTitle>
              <CardDescription>
                Manage billing, shipping, and other addresses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customer.addresses.length === 0 ? (
                  <p className="text-gray-500 text-sm">No addresses added yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customer.addresses.map((address, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline">
                            <MapPin className="w-3 h-3 mr-1" />
                            {address.address_type}
                          </Badge>
                          {address.is_primary_address && (
                            <Badge>Primary</Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm">
                          {address.address_line1}
                        </p>
                        {address.address_line2 && (
                          <p className="text-sm text-gray-600">
                            {address.address_line2}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {address.city}, {address.state} {address.postal_code}
                        </p>
                        <p className="text-sm text-gray-600">
                          {address.country}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Persons Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contact Persons</CardTitle>
              <CardDescription>
                Manage key contacts at this customer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customer.contacts.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No contacts added yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Primary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.contacts.map((contact, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {contact.name}
                          </TableCell>
                          <TableCell>{contact.designation}</TableCell>
                          <TableCell>
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-4 h-4" />
                              {contact.email}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href={`tel:${contact.phone}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-4 h-4" />
                              {contact.phone}
                            </a>
                          </TableCell>
                          <TableCell>
                            {contact.is_primary_contact && <Badge>Yes</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Order History
              </CardTitle>
              <CardDescription>
                Recent sales invoices and orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Order history loading...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={customer.notes}
                onChange={(e) =>
                  setCustomer({ ...customer, notes: e.target.value })
                }
                disabled={!isEditMode}
                placeholder="Add internal notes about this customer..."
                className="min-h-32"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6 text-xs text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Created on: {new Date(customer.created_on).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p>Modified on: {new Date(customer.modified_on).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
