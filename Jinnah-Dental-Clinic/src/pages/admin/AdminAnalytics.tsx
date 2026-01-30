'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';

interface MonthlyData {
  name: string;           // e.g. "Jan"
  revenue: number;        // total billed/paid from bills
  patients: number;       // count of completed queue items
}

export default function AdminAnalytics() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const currentYear = new Date().getFullYear();

      // 1. Fetch completed treatments from queue collection
      const queueQuery = query(
        collection(db, 'queue'),
        where('status', '==', 'completed')
      );
      const queueSnapshot = await getDocs(queueQuery);

      // 2. Fetch all bills (for revenue)
      const billsSnapshot = await getDocs(collection(db, 'bills'));

      // Aggregate monthly
      const monthlyMap: Record<string, MonthlyData> = {};

      // Initialize all 12 months with 0
      months.forEach((month, index) => {
        const monthNum = (index + 1).toString().padStart(2, '0');
        monthlyMap[month] = { name: month, revenue: 0, patients: 0 };
      });

      // Process queue items (patients)
      queueSnapshot.forEach((doc) => {
        const data = doc.data();
        const checkInTime = data.checkInTime || data.createdAt;
        if (!checkInTime) return;

        const date = new Date(checkInTime);
        if (date.getFullYear() !== currentYear) return;

        const monthIndex = date.getMonth();
        const monthName = months[monthIndex];

        monthlyMap[monthName].patients += 1;
      });

      // Process bills (revenue)
      billsSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdDate = data.createdDate || data.createdAt;
        if (!createdDate) return;

        const date = new Date(createdDate);
        if (date.getFullYear() !== currentYear) return;

        const monthIndex = date.getMonth();
        const monthName = months[monthIndex];

        // Use totalAmount or amountPaid — decide based on your need
        const amount = data.totalAmount || data.amountPaid || 0;
        monthlyMap[monthName].revenue += Number(amount);
      });

      // Convert map to array in correct order
      const dataArray = months.map((month) => monthlyMap[month]);

      setMonthlyData(dataArray);

      toast({
        title: "Data Loaded",
        description: `Showing analytics for ${currentYear}`,
      });
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError('Failed to load analytics data. Please try again.');
      toast({
        title: "Error",
        description: "Could not load analytics. Check your connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
            Patients: {payload[1]?.value || payload[0].payload.patients}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Clinic Analytics</h1>
          <p className="text-muted-foreground">Real-time performance overview</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAnalyticsData}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="h-6 bg-muted rounded w-48 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-72 bg-muted/40 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Patient Volume */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="patients"
                      fill="hsl(var(--success))"
                      radius={[4, 4, 0, 0]}
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