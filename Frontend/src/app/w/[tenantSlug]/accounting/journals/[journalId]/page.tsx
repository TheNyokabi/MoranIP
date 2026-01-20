'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  BookOpen,
  AlertCircle,
  Check,
  Clock,
  Scale,
} from 'lucide-react';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';

interface JournalAccount {
  name: string;
  account: string;
  account_name?: string;
  account_type?: string;
  debit: number;
  credit: number;
  cost_center?: string;
  remarks?: string;
}

interface JournalEntry {
  name: string;
  company: string;
  posting_date: string;
  docstatus: 0 | 1 | 2;
  status: string;
  narration?: string;
  accounts: JournalAccount[];
  total_debit: number;
  total_credit: number;
  remarks?: string;
  currency?: string;
  fiscal_year?: string;
}

export default function JournalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug =
    params && typeof (params as any).tenantSlug === 'string'
      ? ((params as any).tenantSlug as string)
      : null;
  const journalId =
    params && typeof (params as any).journalId === 'string'
      ? ((params as any).journalId as string)
      : null;
  const tenantId = tenantSlug;

  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('accounts');

  const [formData, setFormData] = useState({
    posting_date: '',
    narration: '',
    company: '',
    remarks: '',
  });

  const [accounts, setAccounts] = useState<JournalAccount[]>([]);
  const [newAccount, setNewAccount] = useState({
    account: '',
    debit: 0,
    credit: 0,
    cost_center: '',
  });

  useEffect(() => {
    if (tenantId && journalId) {
      fetchJournal();
    }
  }, [tenantId, journalId]);

  if (!tenantId || !journalId) {
    return (
      <div className="p-6">
        <ErrorHandler error="Invalid journal route" />
      </div>
    );
  }

  const fetchJournal = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/journals/${journalId}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        const journalData = data.data || data;
        setJournal(journalData);
        setAccounts(journalData.accounts || []);
        setFormData({
          posting_date: journalData.posting_date || '',
          narration: journalData.narration || '',
          company: journalData.company || '',
          remarks: journalData.remarks || '',
        });
      } else {
        setError('Failed to load journal');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!journal) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/journals/${journalId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            ...formData,
            accounts: accounts,
          }),
        }
      );

      if (response.ok) {
        setEditMode(false);
        await fetchJournal();
      } else {
        setError('Failed to save changes');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAccount = () => {
    if (!newAccount.account) return;
    
    const account: JournalAccount = {
      name: `${journal?.name}-${accounts.length + 1}`,
      account: newAccount.account,
      account_name: newAccount.account,
      debit: newAccount.debit,
      credit: newAccount.credit,
      cost_center: newAccount.cost_center,
    };
    
    setAccounts([...accounts, account]);
    setNewAccount({ account: '', debit: 0, credit: 0, cost_center: '' });
  };

  const handleRemoveAccount = (index: number) => {
    setAccounts(accounts.filter((_, i) => i !== index));
  };

  const handleAccountChange = (index: number, field: string, value: any) => {
    const updated = [...accounts];
    updated[index] = { ...updated[index], [field]: value };
    setAccounts(updated);
  };

  const totalDebit = accounts.reduce((sum, a) => sum + (a.debit || 0), 0);
  const totalCredit = accounts.reduce((sum, a) => sum + (a.credit || 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = Math.abs(difference) < 0.01;

  if (loading) {
    return <div className="p-8 text-center">Loading journal...</div>;
  }

  if (!journal) {
    return <ErrorHandler error="Journal Entry not found" />;
  }

  const isDraft = journal.docstatus === 0;
  const isSubmitted = journal.docstatus === 1;

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{journal.name}</h1>
            <p className="text-sm text-gray-600">{new Date(journal.posting_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && !editMode && (
            <Button onClick={() => setEditMode(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {editMode && (
            <>
              <Button onClick={() => setEditMode(false)} variant="ghost">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !isBalanced}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorHandler error={error} />}

      {/* Status Badges */}
      <div className="flex gap-2">
        {isSubmitted && (
          <Badge className="bg-green-100 text-green-800">
            <Check className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        )}
        {isDraft && (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        )}
        {isBalanced ? (
          <Badge className="bg-green-100 text-green-800">
            <Scale className="h-3 w-3 mr-1" />
            Balanced
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unbalanced
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-gray-900">{journal.company}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-gray-900">
              {new Date(journal.posting_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-900">
              {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Total Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-900">
              {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className={`${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${isBalanced ? 'text-green-900' : 'text-red-900'}`}>
              {Math.abs(difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Details</CardTitle>
          <CardDescription>GL accounts and amounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* Accounts Tab */}
            <TabsContent value="accounts" className="space-y-4">
              {editMode && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <h3 className="font-semibold text-sm">Add Account</h3>
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      placeholder="Account"
                      value={newAccount.account}
                      onChange={(e) => setNewAccount({ ...newAccount, account: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Debit"
                      value={newAccount.debit}
                      onChange={(e) => setNewAccount({ ...newAccount, debit: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Credit"
                      value={newAccount.credit}
                      onChange={(e) => setNewAccount({ ...newAccount, credit: parseFloat(e.target.value) || 0 })}
                    />
                    <Button onClick={handleAddAccount} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Account</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-right p-2 w-24">Debit</th>
                      <th className="text-right p-2 w-24">Credit</th>
                      <th className="text-left p-2">Cost Center</th>
                      {editMode && <th className="text-center p-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {accounts.map((account, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-2 font-medium text-blue-600">{account.account}</td>
                        <td className="p-2 text-gray-600 text-xs">{account.account_type || '-'}</td>
                        <td className="text-right p-2">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 ml-auto"
                              value={account.debit}
                              onChange={(e) => handleAccountChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            account.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          )}
                        </td>
                        <td className="text-right p-2">
                          {editMode ? (
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 ml-auto"
                              value={account.credit}
                              onChange={(e) => handleAccountChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                            />
                          ) : (
                            account.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          )}
                        </td>
                        <td className="p-2 text-gray-600 text-sm">{account.cost_center || '-'}</td>
                        {editMode && (
                          <td className="text-center p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAccount(idx)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="font-bold bg-gray-100 border-t-2">
                      <td colSpan={2} className="p-2">TOTAL</td>
                      <td className="text-right p-2 text-blue-900">
                        {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right p-2 text-orange-900">
                        {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={editMode ? 2 : 1}></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {!isBalanced && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm text-red-800">
                    ⚠️ Journal is not balanced! Difference: {Math.abs(difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Posting Date</label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={formData.posting_date}
                      onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
                    />
                  ) : (
                    <p className="p-2 bg-gray-50 rounded">{formData.posting_date}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Company</label>
                  <p className="p-2 bg-gray-50 rounded">{formData.company}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Narration</label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.narration}
                    onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                    rows={3}
                    placeholder="Describe the journal entry purpose..."
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded whitespace-pre-wrap">{formData.narration || '-'}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Remarks</label>
                {editMode ? (
                  <textarea
                    className="w-full p-2 border rounded"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={2}
                  />
                ) : (
                  <p className="p-2 bg-gray-50 rounded">{formData.remarks || '-'}</p>
                )}
              </div>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Journal Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-blue-700">Total Debit</p>
                      <p className="text-3xl font-bold text-blue-900">
                        {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-orange-700">Total Credit</p>
                      <p className="text-3xl font-bold text-orange-900">
                        {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-gradient-to-br ${isBalanced ? 'from-green-50 to-green-100 border-green-300' : 'from-red-50 to-red-100 border-red-300'}`}>
                <CardHeader>
                  <CardTitle className={`${isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                    Balance Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className={`text-sm ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                    {isBalanced ? '✅ Perfectly balanced' : '❌ Not balanced'}
                  </p>
                  <p className={`text-2xl font-bold ${isBalanced ? 'text-green-900' : 'text-red-900'}`}>
                    Difference: {Math.abs(difference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {!isBalanced && (
                    <div className="bg-red-50 p-2 rounded text-sm text-red-800">
                      You need to adjust accounts to balance the journal before submitting.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-sm">Entry Details</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Total Accounts:</span>
                    <span className="font-bold">{accounts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiscal Year:</span>
                    <span className="font-bold">{journal.fiscal_year || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-bold">{isSubmitted ? 'Submitted' : 'Draft'}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
