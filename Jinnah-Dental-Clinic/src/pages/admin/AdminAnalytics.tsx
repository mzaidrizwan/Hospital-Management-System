'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, TrendingUp, BarChart2 } from 'lucide-react';
import { toast } from "sonner";
import { useData } from '@/context/DataContext';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface MonthlyData {
  name: string;           // e.g. "Jan"
  revenue: number;        // total billed/paid from bills
  patients: number;       // count of completed queue items
}

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return 'PKR 0';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function AdminAnalytics() {
  const { queue, bills, loading: dataLoading } = useData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ], []);

  const monthlyData = useMemo(() => {
    if (dataLoading) return [];

    try {
      const currentYear = new Date().getFullYear();
      const monthlyMap: Record<string, MonthlyData> = {};

      // Initialize all 12 months with 0
      months.forEach((month) => {
        monthlyMap[month] = { name: month, revenue: 0, patients: 0 };
      });

      // Process queue items (patients) - only completed ones
      (queue || []).forEach((item) => {
        if (!item || (item.status !== 'completed' && item.status !== 'in_treatment')) return;

        const dateStr = item.checkInTime || item.createdAt;
        if (!dateStr) return;

        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime()) || date.getFullYear() !== currentYear) return;

          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];

          if (monthlyMap[monthName]) {
            monthlyMap[monthName].patients += 1;
          }
        } catch (e) {
          console.error('Error parsing queue date:', e);
        }
      });

      // Process bills (revenue)
      (bills || []).forEach((bill) => {
        if (!bill) return;
        const dateStr = bill.createdDate || bill.date;
        if (!dateStr) return;

        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime()) || date.getFullYear() !== currentYear) return;

          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];

          const amount = Number(bill.totalAmount || bill.amountPaid || 0);
          if (monthlyMap[monthName]) {
            monthlyMap[monthName].revenue += amount;
          }
        } catch (e) {
          console.error('Error parsing bill date:', e);
        }
      });

      return months.map((month) => monthlyMap[month]);
    } catch (err) {
      console.error('Analytics aggregation error:', err);
      setError('Error processing analytics');
      return [];
    }
  }, [queue, bills, dataLoading, months]);

  const hasData = useMemo(() => {
    return monthlyData.some(d => d.revenue > 0 || d.patients > 0);
  }, [monthlyData]);

  useEffect(() => {
    if (!dataLoading) {
      setLoading(false);
    }
  }, [dataLoading]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-4 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">
            Revenue: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-muted-foreground">
            Patients: {payload[1]?.value || payload[0].payload.patients || 0}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <LoadingSpinner message="Generating analytics reports..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Clinic Analytics</h1>
          </div>
          <p className="text-muted-foreground">Real-time performance overview for {new Date().getFullYear()}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {!hasData ? (
        <Card className="p-12 text-center border-dashed">
          <CardContent className="flex flex-col items-center gap-4">
            <BarChart2 className="w-12 h-12 text-muted-foreground opacity-20" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No Analytics Data Yet</h3>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                We couldn't find any financial or patient activity for the year {new Date().getFullYear()}. Data will appear here once treatments are recorded.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Check Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Trend */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Monthly Revenue Trend</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `PKR ${value / 1000}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Patient Volume */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold">Patient Volume</CardTitle>
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="patients"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}