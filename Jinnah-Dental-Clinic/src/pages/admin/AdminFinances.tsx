'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Download, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/StatCard'; // Assuming you have this
import { toast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useData } from '@/context/DataContext';

export default function AdminFinances() {
  const { bills, expenses, patients, loading: dataLoading } = useData();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    outstanding: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  useEffect(() => {
    if (dataLoading) return;

    try {
      setLoading(true);

      // 1. Filter bills for current month
      const currentMonthBills = bills.filter(bill => {
        const date = bill.createdDate || bill.date;
        if (!date) return false;
        const billDate = new Date(date);
        return billDate >= currentMonthStart && billDate <= currentMonthEnd;
      });

      let revenue = 0;
      const transactions: any[] = [];

      currentMonthBills.forEach((bill) => {
        const amount = Number(bill.totalAmount || bill.amountPaid || 0);
        revenue += amount;

        transactions.push({
          id: bill.id,
          type: 'Bill',
          amount,
          date: bill.createdDate || bill.date || new Date().toISOString(),
          patient: bill.patientName || 'Unknown',
          status: bill.paymentStatus || 'Pending',
        });
      });

      // 2. Filter expenses for current month
      const currentMonthExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        return expDate >= currentMonthStart && expDate <= currentMonthEnd;
      });

      const totalExpenses = currentMonthExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

      // 3. Outstanding from patients
      const outstanding = patients.reduce((sum, p) => sum + Number(p.pendingBalance || 0), 0);

      // 4. Net Profit
      const netProfit = revenue - totalExpenses;

      // 5. Sort transactions
      const sortedTransactions = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setStats({ totalRevenue: revenue, totalExpenses, netProfit, outstanding });
      setRecentTransactions(sortedTransactions);
      setLoading(false);
    } catch (err) {
      console.error('Error calculating financial stats:', err);
      setError('Error processing data');
      setLoading(false);
    }
  }, [bills, expenses, patients, dataLoading]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateTrend = (current: number, previous: number = 0) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const diff = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(diff * 10) / 10),
      isPositive: diff >= 0,
    };
  };

  // Placeholder previous values (you can fetch real previous month later)
  const prevRevenue = stats.totalRevenue * 0.88;
  const prevExpenses = stats.totalExpenses * 0.92;
  const prevProfit = prevRevenue - prevExpenses;

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground">Current month performance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-32 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded w-40 animate-pulse mb-2" />
                <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            subtitle="This month"
            icon={DollarSign}
            trend={calculateTrend(stats.totalRevenue, prevRevenue)}
            variant="primary"
          />

          <StatCard
            title="Total Expenses"
            value={formatCurrency(stats.totalExpenses)}
            subtitle="This month"
            icon={TrendingDown}
            trend={calculateTrend(stats.totalExpenses, prevExpenses)}
            variant="warning"
          />

          <StatCard
            title="Net Profit"
            value={formatCurrency(stats.netProfit)}
            subtitle="This month"
            icon={TrendingUp}
            trend={calculateTrend(stats.netProfit, prevProfit)}
            variant="success"
          />

          <StatCard
            title="Outstanding"
            value={formatCurrency(stats.outstanding)}
            subtitle="Pending collection"
            icon={DollarSign}
            variant="info"
          />
        </div>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4 py-8">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <div className="space-y-2">
                    <div className="h-5 bg-muted rounded w-48 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  </div>
                  <div className="h-6 bg-muted rounded w-24 animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No recent transactions found this month
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{tx.type} - {tx.patient}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(tx.date), 'MMM dd, yyyy hh:mm a')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        tx.status === 'paid' ? 'bg-green-100 text-green-800' :
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                      }
                    >
                      {tx.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}