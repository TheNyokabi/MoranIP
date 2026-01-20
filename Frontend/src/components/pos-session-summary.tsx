'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, ShoppingCart, AlertCircle } from 'lucide-react';
// Note: POS session summary endpoint may need to be added to posApi
// For now, using direct API call
import { apiFetch } from '@/lib/api';
import { ErrorHandler } from '@/components/error-handler';

interface SessionSummaryProps {
  tenantId: string;
  sessionId: string;
}

interface PaymentBreakdown {
  [key: string]: number;
}

interface TopItem {
  name: string;
  qty: number;
  amount: number;
}

interface SessionSummary {
  session_id: string;
  status: string;
  total_sales: number;
  total_items: number;
  payment_breakdown: PaymentBreakdown;
  top_items: TopItem[];
  cash_variance?: number;
  currency: string;
}

export function POSSessionSummary({ tenantId, sessionId }: SessionSummaryProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        // POS session summary endpoint
        const result = await apiFetch<{ summary: SessionSummary }>(`/api/pos/sessions/${sessionId}/summary`);
        setSummary(result.summary || (result as any)?.data?.summary || (result as any));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [tenantId, sessionId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Loading session summary...</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorHandler error={error} onDismiss={() => setError(null)} />
        </CardContent>
      </Card>
    );
  }

  const cashVariance = summary.cash_variance || 0;
  const varianceStatus = Math.abs(cashVariance) < 0.01 ? 'balanced' : cashVariance > 0 ? 'surplus' : 'shortage';

  return (
    <div className="space-y-4">
      <ErrorHandler error={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.total_sales.toFixed(2)} {summary.currency}
            </div>
            <p className="text-xs text-gray-500">Session total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_items}</div>
            <p className="text-xs text-gray-500">Units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Avg Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.total_sales / Math.max(summary.total_items, 1)).toFixed(2)}
            </div>
            <p className="text-xs text-gray-500">Per item</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Cash Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              varianceStatus === 'balanced' ? 'text-green-600' :
              varianceStatus === 'surplus' ? 'text-blue-600' :
              'text-red-600'
            }`}>
              {cashVariance.toFixed(2)}
            </div>
            <Badge className={`mt-2 ${
              varianceStatus === 'balanced' ? 'bg-green-100 text-green-800' :
              varianceStatus === 'surplus' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            }`}>
              {varianceStatus.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="payments">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payments">Payment Breakdown</TabsTrigger>
              <TabsTrigger value="items">Top Items</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-4">
              <div className="space-y-3">
                {Object.entries(summary.payment_breakdown).map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium text-gray-700">{method}</span>
                    <span className="font-semibold">
                      {amount.toFixed(2)} {summary.currency}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="items" className="mt-4">
              <div className="space-y-3">
                {summary.top_items && summary.top_items.length > 0 ? (
                  summary.top_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-gray-700">{item.name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.qty}</p>
                      </div>
                      <span className="font-semibold">
                        {item.amount.toFixed(2)} {summary.currency}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500">No items sold in this session</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
