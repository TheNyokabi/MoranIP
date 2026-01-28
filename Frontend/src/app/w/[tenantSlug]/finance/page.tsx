"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { accountingApi, Account, GLEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    FileText,
    ListTree,
    TrendingUp,
    TrendingDown,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Download
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
}

export default function FinancePage() {
    const { token } = useAuthStore();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [entries, setEntries] = useState<GLEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        Promise.all([
            accountingApi.listAccounts(),
            accountingApi.listGLEntries()
        ]).then(([accs, gls]) => {
            setAccounts(accs.data);
            setEntries(gls.data);
            setLoading(false);
        });
    }, [token]);

    // Derived Metrics
    const totalIncome = entries
        .filter(e => e.account.startsWith("Sales") || e.account.startsWith("Income")) // Simplified check
        .reduce((sum, e) => sum + e.credit - e.debit, 0);

    const totalExpense = entries
        .filter(e => e.account.startsWith("Cost of Goods") || e.account.startsWith("Expense"))
        .reduce((sum, e) => sum + e.debit - e.credit, 0);

    const netProfit = totalIncome - totalExpense;

    type AccountTreeNode = Account & { children: AccountTreeNode[] };

    // Build Tree Structure for CoA
    const buildTree = (parentId: string | null): AccountTreeNode[] => {
        return accounts
            .filter(a => a.parent_account === parentId)
            .map((a) => ({
                ...(a as Account),
                children: buildTree(a.name)
            }));
    };
    const accountTree: AccountTreeNode[] = buildTree(null);

    const AccountNode = ({ node, level = 0 }: { node: AccountTreeNode, level?: number }) => (
        <div className="text-white/80">
            <div
                className={`flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors ${level === 0 ? 'font-bold text-lg mt-4' : 'text-sm'}`}
                style={{ paddingLeft: `${level * 20 + 8}px` }}
            >
                <div className="flex items-center gap-2">
                    {node.is_group === 1 ? <ListTree className="h-4 w-4 opacity-50" /> : <FileText className="h-3 w-3 opacity-30" />}
                    <span>{node.account_name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="opacity-40 text-xs">{node.root_type}</span>
                </div>
            </div>
            {node.children.map((child) => <AccountNode key={child.name} node={child} level={level + 1} />)}
        </div>
    );

    if (loading) return <div className="p-8 text-white">Loading Financial Data...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <div className="relative z-10">
                <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Finance & Accounting
                </h1>
                <p className="text-white/40 mt-1">Real-time financial overview and ledger management</p>
            </div>

            <Tabs defaultValue="dashboard" className="space-y-6 relative z-10">
                <TabsList className="bg-white/5 border border-white/10 p-1">
                    <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white">Dashboard</TabsTrigger>
                    <TabsTrigger value="gl" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white">General Ledger</TabsTrigger>
                    <TabsTrigger value="coa" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white">Chart of Accounts</TabsTrigger>
                </TabsList>

                {/* DASHBOARD TAB */}
                <TabsContent value="dashboard" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Income Card */}
                        <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp className="h-16 w-16 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Total Income</p>
                                <p className="text-3xl font-bold text-emerald-400 mt-2">{formatCurrency(totalIncome)}</p>
                                <div className="mt-4 flex items-center text-xs text-emerald-400/60">
                                    <ArrowUpRight className="h-3 w-3 mr-1" />
                                    <span>From Sales & Services</span>
                                </div>
                            </div>
                        </div>

                        {/* Expense Card */}
                        <div className="glass p-6 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingDown className="h-16 w-16 text-red-400" />
                            </div>
                            <div>
                                <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Total Expenses</p>
                                <p className="text-3xl font-bold text-red-400 mt-2">{formatCurrency(totalExpense)}</p>
                                <div className="mt-4 flex items-center text-xs text-red-400/60">
                                    <ArrowDownRight className="h-3 w-3 mr-1" />
                                    <span>COGS & Operating Costs</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Profit Card */}
                        <div className="glass p-6 rounded-2xl relative overflow-hidden group border-emerald-500/30">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <DollarSign className="h-16 w-16 text-emerald-200" />
                            </div>
                            <div>
                                <p className="text-sm text-white/40 font-medium uppercase tracking-wider">Net Profit</p>
                                <p className="text-3xl font-bold text-white mt-2">{formatCurrency(netProfit)}</p>
                                <div className="mt-4 flex items-center text-xs text-white/40">
                                    <span>Net earnings after expenses</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-2xl border border-white/5">
                        <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/50 uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Reference</th>
                                        <th className="p-3">Account</th>
                                        <th className="p-3 text-right">Debit</th>
                                        <th className="p-3 text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {entries.slice(-5).reverse().map((entry) => (
                                        <tr key={entry.name} className="hover:bg-white/5">
                                            <td className="p-3">{entry.posting_date}</td>
                                            <td className="p-3 opacity-70">{entry.voucher_no}</td>
                                            <td className="p-3 font-medium text-emerald-400">{entry.account}</td>
                                            <td className="p-3 text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                                            <td className="p-3 text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* GENERAL LEDGER TAB */}
                <TabsContent value="gl">
                    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-white">General Ledger Entries</h3>
                            <Button variant="outline" className="border-white/10 text-white hover:bg-white/10">
                                <Download className="h-4 w-4 mr-2" /> Export
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-white/50 uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Voucher No</th>
                                        <th className="p-4">Account</th>
                                        <th className="p-4">Remarks</th>
                                        <th className="p-4 text-right">Debit</th>
                                        <th className="p-4 text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {entries.slice().reverse().map((entry) => (
                                        <tr key={entry.name} className="hover:bg-white/5">
                                            <td className="p-4">{entry.posting_date}</td>
                                            <td className="p-4">
                                                <div className="font-mono text-xs opacity-70">{entry.voucher_no}</div>
                                                <div className="text-[10px] opacity-40">{entry.voucher_type}</div>
                                            </td>
                                            <td className="p-4 font-medium text-emerald-400">{entry.account}</td>
                                            <td className="p-4 opacity-70 max-w-xs truncate" title={entry.remarks}>{entry.remarks}</td>
                                            <td className="p-4 text-right font-mono">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                                            <td className="p-4 text-right font-mono">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* CHART OF ACCOUNTS TAB */}
                <TabsContent value="coa">
                    <div className="glass p-6 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Chart of Accounts</h3>
                                <p className="text-sm text-white/40">Hierarchical view of your financial structure</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                                <input
                                    placeholder="Search accounts..."
                                    className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                />
                            </div>
                        </div>
                        <div className="border border-white/10 rounded-xl p-4 bg-black/20">
                            {accountTree.map(node => <AccountNode key={node.name} node={node} />)}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
