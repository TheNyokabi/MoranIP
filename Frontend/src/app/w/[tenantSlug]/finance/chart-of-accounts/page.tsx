'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderTree, Download, Settings } from 'lucide-react';
import { useModuleStore } from '@/store/module-store';
import { ErrorHandler } from '@/components/error-handler';
import { DataTable } from '@/components/data-table';
import { useState as useStateHook } from 'react';

interface Account {
  name: string;
  account_name: string;
  account_type: string;
  is_group: boolean;
  parent_account: string | null;
  balance: number;
  company: string;
}

export default function ChartOfAccountsPage() {
  const params = useParams() as any;
  const tenantSlug = params.tenantSlug as string;
  const tenantId = tenantSlug;
  
  const { accounts, loading, error, fetchAccounts, clearError } = useModuleStore();
  const [activeTab, setActiveTab] = useState('list');
  const [filterType, setFilterType] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: 'Expense',
    parent_account: '',
    is_group: false,
  });

  useEffect(() => {
    if (tenantId) {
      fetchAccounts(tenantId);
    }
  }, [tenantId, fetchAccounts]);

  const handleCreateAccount = async () => {
    try {
      const payload = {
        account_name: formData.account_name,
        account_type: formData.account_type,
        parent_account: formData.parent_account || undefined,
        is_group: formData.is_group,
        company: tenantId,
      };

      const response = await fetch(`/api/tenants/${tenantId}/erp/accounting/chart-of-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setFormData({ account_name: '', account_type: 'Expense', parent_account: '', is_group: false });
        setShowNewForm(false);
        await fetchAccounts(tenantId);
      }
    } catch (err) {
      console.error('Failed to create account:', err);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;
    try {
      const response = await fetch(
        `/api/tenants/${tenantId}/erp/accounting/chart-of-accounts/${selectedAccount.name}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (response.ok) {
        setSelectedAccount(null);
        setFormData({ account_name: '', account_type: 'Expense', parent_account: '', is_group: false });
        await fetchAccounts(tenantId);
      }
    } catch (err) {
      console.error('Failed to update account:', err);
    }
  };

  const accountColumns = [
    { key: 'account_name', label: 'Account Name' },
    { key: 'account_type', label: 'Type' },
    { key: 'parent_account', label: 'Parent Account' },
    { key: 'is_group', label: 'Group' },
    { key: 'balance', label: 'Balance' },
  ];

  const filteredAccounts = filterType 
    ? accounts.filter((acc: Account) => acc.account_type === filterType)
    : accounts;

  const accountTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
  const totalAssets = accounts
    .filter((acc: Account) => acc.account_type === 'Asset')
    .reduce((sum: number, acc: Account) => sum + (acc.balance || 0), 0);
  const totalLiabilities = accounts
    .filter((acc: Account) => acc.account_type === 'Liability')
    .reduce((sum: number, acc: Account) => sum + (acc.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-gray-600 mt-1">Manage your accounting structure and account hierarchy</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowNewForm(true)}>
            <Plus className="h-4 w-4" />
            New Account
          </Button>
        </div>
      </div>

      <ErrorHandler error={error} onDismiss={clearError} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Asset Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter((acc: Account) => acc.account_type === 'Asset').length}
            </div>
            <p className="text-sm text-gray-600">Balance: {totalAssets.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Liability Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter((acc: Account) => acc.account_type === 'Liability').length}
            </div>
            <p className="text-sm text-gray-600">Balance: {totalLiabilities.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Income Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter((acc: Account) => acc.account_type === 'Income').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">Account List</TabsTrigger>
          <TabsTrigger value="tree">
            <FolderTree className="h-4 w-4 mr-2" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filterType === '' ? 'default' : 'outline'}
                  onClick={() => setFilterType('')}
                >
                  All
                </Button>
                {accountTypes.map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={filterType === type ? 'default' : 'outline'}
                    onClick={() => setFilterType(type)}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                {filteredAccounts.length} accounts found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading accounts...</div>
              ) : (
                <DataTable columns={accountColumns} data={filteredAccounts} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hierarchy View */}
        <TabsContent value="tree" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Hierarchy</CardTitle>
              <CardDescription>View accounts organized by their parent relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accountTypes.map((type) => (
                  <div key={type}>
                    <h3 className="font-semibold text-sm mb-2">{type}</h3>
                    <ul className="ml-4 space-y-1">
                      {accounts
                        .filter((acc: Account) => acc.account_type === type && acc.is_group)
                        .map((acc: Account) => (
                          <li key={acc.name} className="text-sm">
                            <span className="font-medium">{acc.account_name}</span>
                            <ul className="ml-4 text-gray-600">
                              {accounts
                                .filter((child: Account) => child.parent_account === acc.name)
                                .map((child: Account) => (
                                  <li key={child.name}>{child.account_name}</li>
                                ))}
                            </ul>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts Settings</CardTitle>
              <CardDescription>Configure your chart of accounts structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Accounting Standard</label>
                <Input defaultValue="Standard" className="mt-2" />
              </div>
              <div>
                <label className="text-sm font-medium">Currency</label>
                <Input defaultValue="KES" className="mt-2" />
              </div>
              <div>
                <label className="text-sm font-medium">Fiscal Year Start</label>
                <Input type="date" className="mt-2" />
              </div>
              <Button>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New/Edit Account Modal */}
      {(showNewForm || selectedAccount) && (
        <Card className="fixed right-4 bottom-4 w-96 z-50 shadow-lg">
          <CardHeader>
            <CardTitle>{selectedAccount ? 'Edit Account' : 'New Account'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Account Name *</label>
              <Input
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="e.g., Petty Cash"
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Account Type *</label>
              <select
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full mt-2 border rounded p-2"
              >
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Parent Account</label>
              <select
                value={formData.parent_account}
                onChange={(e) => setFormData({ ...formData, parent_account: e.target.value })}
                className="w-full mt-2 border rounded p-2"
              >
                <option value="">None</option>
                {accounts
                  .filter((acc: Account) => acc.is_group)
                  .map((acc: Account) => (
                    <option key={acc.name} value={acc.name}>
                      {acc.account_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_group}
                onChange={(e) => setFormData({ ...formData, is_group: e.target.checked })}
                id="is_group"
              />
              <label htmlFor="is_group" className="text-sm font-medium">
                Is Group Account (can have sub-accounts)
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={selectedAccount ? handleUpdateAccount : handleCreateAccount}
                className="flex-1"
              >
                {selectedAccount ? 'Update' : 'Create'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setSelectedAccount(null);
                  setFormData({ account_name: '', account_type: 'Expense', parent_account: '', is_group: false });
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
