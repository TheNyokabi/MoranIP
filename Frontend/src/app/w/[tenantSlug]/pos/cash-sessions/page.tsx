'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import {
    ArrowLeft,
    Clock,
    DollarSign,
    Users,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Calendar,
    Filter,
    Download,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';

interface PosSession {
    id: string;
    profile_id: string;
    user: string;
    user_name?: string;
    opening_time: string;
    closing_time?: string;
    status: 'Open' | 'Closed';
    opening_cash?: number;
    closing_cash?: number;
    total_sales: number;
    total_orders: number;
    cash_sales?: number;
    variance?: number;
}

interface CashierSummary {
    user: string;
    user_name?: string;
    session_count: number;
    total_sales: number;
    total_cash_sales: number;
    total_variance: number;
    sessions_with_shortage: number;
    sessions_with_surplus: number;
}

export default function CashSessionsPage() {
    const params = useParams();
    const tenantSlug = params.tenantSlug as string;
    const { token, currentTenant } = useAuthStore();

    // State
    const [sessions, setSessions] = useState<PosSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter state
    const [dateFrom, setDateFrom] = useState<string>(
        format(subDays(new Date(), 7), 'yyyy-MM-dd')
    );
    const [dateTo, setDateTo] = useState<string>(
        format(new Date(), 'yyyy-MM-dd')
    );
    const [selectedCashier, setSelectedCashier] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Load sessions
    const loadSessions = async (showRefresh = false) => {
        if (!token) return;

        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            // Get all sessions (both open and closed)
            const response = await apiFetch<{ sessions: PosSession[] }>(
                '/pos/sessions',
                {},
                token
            );

            setSessions(response.sessions || []);
        } catch (error) {
            console.error('Failed to load sessions:', error);
            setSessions([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, [token, currentTenant]);

    // Filter sessions
    const filteredSessions = useMemo(() => {
        return sessions.filter(session => {
            // Date filter
            if (dateFrom) {
                const sessionDate = parseISO(session.opening_time);
                const fromDate = startOfDay(parseISO(dateFrom));
                if (sessionDate < fromDate) return false;
            }
            if (dateTo) {
                const sessionDate = parseISO(session.opening_time);
                const toDate = endOfDay(parseISO(dateTo));
                if (sessionDate > toDate) return false;
            }

            // Cashier filter
            if (selectedCashier !== 'all' && session.user !== selectedCashier) {
                return false;
            }

            // Status filter
            if (statusFilter !== 'all' && session.status !== statusFilter) {
                return false;
            }

            return true;
        });
    }, [sessions, dateFrom, dateTo, selectedCashier, statusFilter]);

    // Get unique cashiers for filter
    const cashiers = useMemo(() => {
        const uniqueCashiers = new Map<string, string>();
        sessions.forEach(session => {
            uniqueCashiers.set(session.user, session.user_name || session.user);
        });
        return Array.from(uniqueCashiers.entries()).map(([id, name]) => ({
            id,
            name
        }));
    }, [sessions]);

    // Calculate variance for a session
    const calculateVariance = (session: PosSession): number => {
        if (session.variance !== undefined) return session.variance;
        if (session.status !== 'Closed' || session.closing_cash === undefined) return 0;

        const expectedCash = (session.opening_cash || 0) + (session.cash_sales || session.total_sales * 0.6); // Estimate 60% cash if not specified
        return session.closing_cash - expectedCash;
    };

    // Calculate cashier summaries
    const cashierSummaries = useMemo((): CashierSummary[] => {
        const summaryMap = new Map<string, CashierSummary>();

        filteredSessions.forEach(session => {
            const existing = summaryMap.get(session.user) || {
                user: session.user,
                user_name: session.user_name,
                session_count: 0,
                total_sales: 0,
                total_cash_sales: 0,
                total_variance: 0,
                sessions_with_shortage: 0,
                sessions_with_surplus: 0
            };

            const variance = calculateVariance(session);

            existing.session_count += 1;
            existing.total_sales += session.total_sales || 0;
            existing.total_cash_sales += session.cash_sales || 0;
            existing.total_variance += variance;

            if (variance < -10) {
                existing.sessions_with_shortage += 1;
            } else if (variance > 10) {
                existing.sessions_with_surplus += 1;
            }

            summaryMap.set(session.user, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) => 
            Math.abs(b.total_variance) - Math.abs(a.total_variance)
        );
    }, [filteredSessions]);

    // Summary stats
    const summaryStats = useMemo(() => {
        const closedSessions = filteredSessions.filter(s => s.status === 'Closed');
        const totalVariance = closedSessions.reduce((sum, s) => sum + calculateVariance(s), 0);
        const shortages = closedSessions.filter(s => calculateVariance(s) < -10).length;
        const surpluses = closedSessions.filter(s => calculateVariance(s) > 10).length;
        const balanced = closedSessions.filter(s => Math.abs(calculateVariance(s)) <= 10).length;

        return {
            totalSessions: filteredSessions.length,
            closedSessions: closedSessions.length,
            openSessions: filteredSessions.filter(s => s.status === 'Open').length,
            totalVariance,
            shortages,
            surpluses,
            balanced
        };
    }, [filteredSessions]);

    // Get variance badge
    const getVarianceBadge = (variance: number) => {
        if (Math.abs(variance) <= 10) {
            return (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Balanced
                </Badge>
            );
        } else if (variance > 0) {
            return (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Surplus: KES {variance.toLocaleString()}
                </Badge>
            );
        } else {
            return (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Shortage: KES {Math.abs(variance).toLocaleString()}
                </Badge>
            );
        }
    };

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/w/${tenantSlug}/pos`}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to POS
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Cash Sessions Report</h1>
                        <p className="text-muted-foreground">
                            View session variances and cashier performance
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={() => loadSessions(true)}
                    disabled={refreshing}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Sessions</p>
                                <p className="text-2xl font-bold">{summaryStats.totalSessions}</p>
                                <p className="text-xs text-muted-foreground">
                                    {summaryStats.openSessions} open, {summaryStats.closedSessions} closed
                                </p>
                            </div>
                            <Clock className="h-8 w-8 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Net Variance</p>
                                <p className={cn(
                                    "text-2xl font-bold",
                                    summaryStats.totalVariance > 0 ? "text-blue-600" :
                                    summaryStats.totalVariance < 0 ? "text-red-600" : "text-green-600"
                                )}>
                                    {summaryStats.totalVariance >= 0 ? '+' : ''}KES {summaryStats.totalVariance.toLocaleString()}
                                </p>
                            </div>
                            <DollarSign className="h-8 w-8 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Sessions with Shortages</p>
                                <p className="text-2xl font-bold text-red-600">{summaryStats.shortages}</p>
                            </div>
                            <TrendingDown className="h-8 w-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Balanced Sessions</p>
                                <p className="text-2xl font-bold text-green-600">{summaryStats.balanced}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cashier</Label>
                            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All cashiers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cashiers</SelectItem>
                                    {cashiers.map(cashier => (
                                        <SelectItem key={cashier.id} value={cashier.id}>
                                            {cashier.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="Closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cashier Summary */}
            {cashierSummaries.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Variance by Cashier
                        </CardTitle>
                        <CardDescription>
                            Summary of cash variances per cashier in the selected period
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cashierSummaries.map(summary => (
                                <Card key={summary.user} className="bg-muted/30">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Users className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{summary.user_name || summary.user}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {summary.session_count} sessions
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Total Sales</span>
                                                <span className="font-medium">KES {summary.total_sales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Net Variance</span>
                                                <span className={cn(
                                                    "font-bold",
                                                    summary.total_variance > 10 ? "text-blue-600" :
                                                    summary.total_variance < -10 ? "text-red-600" : "text-green-600"
                                                )}>
                                                    {summary.total_variance >= 0 ? '+' : ''}KES {summary.total_variance.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {summary.sessions_with_shortage > 0 && (
                                                    <Badge variant="destructive" className="text-xs">
                                                        {summary.sessions_with_shortage} shortages
                                                    </Badge>
                                                )}
                                                {summary.sessions_with_surplus > 0 && (
                                                    <Badge className="bg-blue-500/10 text-blue-600 text-xs">
                                                        {summary.sessions_with_surplus} surpluses
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sessions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Session Details</CardTitle>
                    <CardDescription>
                        All sessions in the selected period with variance information
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSessions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No sessions found for the selected filters</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[500px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date/Time</TableHead>
                                        <TableHead>Cashier</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Opening Cash</TableHead>
                                        <TableHead className="text-right">Total Sales</TableHead>
                                        <TableHead className="text-right">Closing Cash</TableHead>
                                        <TableHead className="text-right">Variance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSessions.map(session => {
                                        const variance = calculateVariance(session);
                                        return (
                                            <TableRow key={session.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">
                                                            {format(parseISO(session.opening_time), 'MMM dd, yyyy')}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {format(parseISO(session.opening_time), 'HH:mm')}
                                                            {session.closing_time && (
                                                                <> - {format(parseISO(session.closing_time), 'HH:mm')}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium">
                                                        {session.user_name || session.user}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={session.status === 'Open' ? 'default' : 'secondary'}>
                                                        {session.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    KES {(session.opening_cash || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    KES {session.total_sales.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {session.status === 'Closed' ? (
                                                        `KES ${(session.closing_cash || 0).toLocaleString()}`
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {session.status === 'Closed' ? (
                                                        getVarianceBadge(variance)
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
