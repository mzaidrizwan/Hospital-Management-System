'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

import { useData } from '@/context/DataContext';
import { calculateFinancialStats, formatCurrency, parseDate } from '@/utils/financialUtils';

// Interfaces
interface Bill {
  id: string;
  totalAmount: number;
  amountPaid: number;
  discount: number;
  createdAt: any;
  createdDate: string;
  patientName: string;
  paymentStatus: string;
  billNumber: string;
  date?: string;
}

interface Sale {
  id: string;
  amount: number;
  totalPrice: number;
  buyingPrice?: number;
  sellingPrice?: number;
  total?: number;
  date: string;
  createdAt: any;
  productName?: string;
  itemName?: string;
  category?: string;
  quantity?: number;
  customerName?: string;
  paymentStatus: string;
  paymentMethod?: string;
}

interface Expense {
  id: string;
  amount: number;
  date: string;
  category: string;
  title: string;
  status: string;
  description?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  minQuantity?: number;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  isActive: boolean;
  age?: number;
  gender?: string;
}

interface SalaryPayment {
  id: string;
  amount: number;
  date: string;
  staffName: string;
}

// Redundant local definitions removed



// Removed redundant getDateRangeData as it's now in financialUtils.ts

const getDailyRevenueExpenseData = (
  combinedRevenue: any[],
  expenses: Expense[],
  salaryPayments: SalaryPayment[],
  dateRange: DateRange
) => {
  if (!dateRange.from || !dateRange.to) return [];

  const result: { date: string; revenue: number; expenses: number; profit: number }[] = [];

  const current = new Date(dateRange.from);
  current.setHours(0, 0, 0, 0);
  const to = new Date(dateRange.to);
  to.setHours(23, 59, 59, 999);

  while (current <= to) {
    // USE LOCAL DATE FORMATTING TO AVOID TIMEZONE SHIFT
    const targetDateStr = format(current, 'yyyy-MM-dd');

    // Calculate daily revenue
    const dayRevenue = combinedRevenue
      .filter(item => {
        const itemDate = parseDate(item.createdDate || item.date || item.createdAt);
        if (!itemDate) return false;
        return format(itemDate, 'yyyy-MM-dd') === targetDateStr;
      })
      .reduce((sum, item) => sum + (Number(item.amount || item.total || item.totalPrice || 0)), 0);

    // Calculate daily regular expenses
    const dayExpensesRegular = expenses
      .filter(expense => {
        const expenseDate = parseDate(expense.date);
        if (!expenseDate) return false;
        return format(expenseDate, 'yyyy-MM-dd') === targetDateStr;
      })
      .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

    // Calculate daily salaries
    const dayExpensesSalaries = salaryPayments
      .filter(salary => {
        const salaryDate = parseDate(salary.date);
        if (!salaryDate) return false;
        return format(salaryDate, 'yyyy-MM-dd') === targetDateStr;
      })
      .reduce((sum, salary) => sum + (Number(salary.amount) || 0), 0);

    const dayExpenses = dayExpensesRegular + dayExpensesSalaries;
    const dayProfit = dayRevenue - dayExpenses;

    result.push({
      date: format(current, 'MMM dd'),
      revenue: Math.max(0, dayRevenue),
      expenses: Math.max(0, dayExpenses),
      profit: dayProfit
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
};

const getLowStock = (inv: InventoryItem[]) =>
  inv.filter(i => (i.quantity || 0) < (i.minQuantity || 10));

const getRecentPatients = (patients: Patient[]) => {
  return patients
    .filter(p => p.isActive)
    .sort((a, b) => {
      const dateA = parseDate(a.lastVisit);
      const dateB = parseDate(b.lastVisit);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);
};

const getRecentTransactions = (bills: Bill[], sales: Sale[], limit: number = 5) => {
  const allTransactions = [
    ...bills.map(bill => ({
      ...bill,
      type: 'bill',
      displayName: bill.patientName || 'Patient',
      amount: bill.amountPaid || 0,
      date: bill.createdDate || bill.createdAt,
      color: '#3b82f6'
    })),
    ...sales.map(sale => ({
      ...sale,
      type: 'sale',
      displayName: sale.customerName || sale.productName || 'Sale',
      amount: sale.amount || sale.totalPrice || 0,
      date: sale.date || sale.createdAt,
      color: '#10b981'
    }))
  ];

  return allTransactions
    .sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, limit);
};

export default function AdminDashboard() {
  const {
    bills,
    sales,
    expenses: contextExpenses,
    inventory,
    patients,
    salaryPayments,
    loading: dataLoading
  } = useData();
  const { status, daysLeft } = useLicenseStatus();

  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: new Date()
  });

  // Memoized calculations for better performance
  const memoizedData = useMemo(() => {
    if (dataLoading) {
      return {
        filteredBills: [],
        filteredSales: [],
        filteredExpenses: [],
        filteredSalaries: [],
        combinedRevenue: [],
        dailyData: [],
        recentTransactions: [],
        totalRevenue: 0,
        totalExpenses: 0,
        totalSalaries: 0,
        netProfit: 0,
        totalPatients: 0,
        totalTransactions: 0,
        lowStockItems: [],
        recentPatients: []
      };
    }

    // Get filtered data for selected date range using central utility
    const stats = calculateFinancialStats(
      bills as Bill[],
      sales as Sale[],
      contextExpenses as Expense[],
      salaryPayments as SalaryPayment[],
      dateRange
    );

    // Calculate daily data for chart
    const dailyData = getDailyRevenueExpenseData(
      stats.combinedRevenue,
      stats.filteredExpenses,
      stats.filteredSalaries,
      dateRange
    );

    // Other calculations
    const totalPatients = patients.filter(p => p.isActive).length;
    const totalTransactions = stats.filteredBills.length + stats.filteredSales.length;
    const lowStockItems = getLowStock(inventory);
    const recentPatients = getRecentPatients(patients);
    const recentTransactions = getRecentTransactions(stats.filteredBills, stats.filteredSales as any, 5);

    return {
      ...stats,
      dailyData,
      recentTransactions,
      totalPatients,
      totalTransactions,
      lowStockItems,
      recentPatients
    };

  }, [bills, sales, contextExpenses, salaryPayments, inventory, patients, dateRange, dataLoading]);

  // Calculate trends (previous period comparison)
  const getPreviousPeriodData = () => {
    if (!dateRange.from || !dateRange.to) return { revenue: 0, expenses: 0 };

    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const prevFrom = new Date(from);
    const prevTo = new Date(to);
    prevFrom.setDate(prevFrom.getDate() - diffDays - 1);
    prevTo.setDate(prevTo.getDate() - diffDays - 1);

    const prevStats = calculateFinancialStats(
      bills as Bill[],
      sales as Sale[],
      contextExpenses as Expense[],
      salaryPayments as SalaryPayment[],
      { from: prevFrom, to: prevTo }
    );

    return {
      revenue: prevStats.totalRevenue,
      expenses: prevStats.totalExpenses
    };

  };

  const prevPeriod = getPreviousPeriodData();

  // Calculate trends
  const revenueTrend = {
    value: prevPeriod.revenue > 0
      ? ((memoizedData.totalRevenue - prevPeriod.revenue) / prevPeriod.revenue * 100).toFixed(1)
      : memoizedData.totalRevenue > 0 ? '100' : '0',
    isPositive: memoizedData.totalRevenue > prevPeriod.revenue
  };

  const expensesTrend = {
    value: prevPeriod.expenses > 0
      ? ((memoizedData.totalExpenses - prevPeriod.expenses) / prevPeriod.expenses * 100).toFixed(1)
      : memoizedData.totalExpenses > 0 ? '100' : '0',
    isPositive: memoizedData.totalExpenses < prevPeriod.expenses
  };

  const profitTrend = {
    value: memoizedData.netProfit > 0 ? '100' : '0',
    isPositive: memoizedData.netProfit > 0
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {status !== 'active' && (
        <Alert variant={status === 'expired' ? 'destructive' : 'default'} className={cn(
          "border-l-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500",
          status === 'warning' && "border-l-amber-500 bg-amber-50"
        )}>
          {status === 'expired' ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4 text-amber-600" />}
          <AlertTitle className={cn(
            "font-bold",
            status === 'expired' ? "text-red-800" : "text-amber-800"
          )}>
            {status === 'expired' ? 'License Expired' : 'License Expiring Soon'}
          </AlertTitle>
          <AlertDescription className={cn(
            "text-sm font-medium",
            status === 'expired' ? "text-red-700" : "text-amber-700"
          )}>
            {status === 'expired'
              ? "Your license has expired. Some features may be limited. Please contact support to renew."
              : `Your license will expire in ${daysLeft} days. Please consider renewing it soon to avoid service interruption.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Page Header with Date Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Showing data from{' '}
            {dateRange.from ? format(dateRange.from, 'MMM dd, yyyy') : 'N/A'}
            {' to '}
            {dateRange.to ? format(dateRange.to, 'MMM dd, yyyy') : 'N/A'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => {
              const today = new Date();
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              setDateRange({ from: firstDay, to: today });
            }}
          >
            This Month
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const today = new Date();
              const sevenDaysAgo = subDays(today, 7);
              setDateRange({ from: sevenDaysAgo, to: today });
            }}
          >
            Last 7 Days
          </Button>
        </div>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(memoizedData.totalRevenue)}
          subtitle={`${memoizedData.combinedRevenue.length} transactions`}
          icon={DollarSign}
          trend={revenueTrend}
          variant="primary"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(memoizedData.totalExpenses)}
          subtitle={`Incl. ${formatCurrency(memoizedData.totalSalaries)} salaries`}
          icon={TrendingDown}
          trend={expensesTrend}
          variant="warning"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(memoizedData.netProfit)}
          subtitle="Revenue - Expenses"
          icon={TrendingUp}
          trend={profitTrend}
          variant={memoizedData.netProfit >= 0 ? "success" : "warning"}
        />
        <StatCard
          title="Active Patients"
          value={memoizedData.totalPatients.toString()}
          subtitle={`Total: ${patients.length}`}
          icon={Users}
          variant="default"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="font-medium text-blue-800">Bills</div>
          <div className="text-xl font-bold text-blue-900">{memoizedData.filteredBills.length}</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <div className="font-medium text-green-800">Sales</div>
          <div className="text-xl font-bold text-green-900">{memoizedData.filteredSales.length}</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <div className="font-medium text-amber-800">Expenses</div>
          <div className="text-xl font-bold text-amber-900">{memoizedData.filteredExpenses.length}</div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
          <div className="font-medium text-purple-800">Salaries</div>
          <div className="text-xl font-bold text-purple-900">{memoizedData.filteredSalaries.length}</div>
        </div>
      </div>

      {/* Bottom Row - Three Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Recent Transactions</span>
              <Badge variant="outline">{memoizedData.recentTransactions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memoizedData.recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No transactions in selected period</p>
              ) : (
                memoizedData.recentTransactions.map((transaction) => {
                  const transactionDate = parseDate(transaction.date);
                  return (
                    <div
                      key={`${transaction.type}-${transaction.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-8 rounded"
                          style={{ backgroundColor: transaction.color }}
                        />
                        <div>
                          <p className="font-medium text-sm">{transaction.displayName}</p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                backgroundColor: transaction.color + '20',
                                borderColor: transaction.color,
                                color: transaction.color
                              }}
                            >
                              {transaction.type === 'bill' ? 'Bill' : 'Sale'}
                            </Badge>
                            {transaction.type === 'bill' && transaction.billNumber && (
                              <p className="text-xs text-muted-foreground">
                                #{transaction.billNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(transaction.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {transactionDate ? format(transactionDate, 'MMM dd') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Recent Patients</span>
              <Badge variant="outline">{memoizedData.recentPatients.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memoizedData.recentPatients.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No recent patients</p>
              ) : (
                memoizedData.recentPatients.map((patient) => {
                  const lastVisitDate = parseDate(patient.lastVisit);
                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {patient.age ? `${patient.age} years` : ''}
                          {patient.gender ? ` • ${patient.gender}` : ''}
                          {patient.phone ? ` • ${patient.phone}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {lastVisitDate ? format(lastVisitDate, 'MMM dd') : 'N/A'}
                        </p>
                        <Badge
                          variant={patient.isActive ? "default" : "outline"}
                          className="text-xs mt-1"
                        >
                          {patient.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            {memoizedData.lowStockItems.length > 0 && (
              <Badge variant="destructive">{memoizedData.lowStockItems.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {memoizedData.lowStockItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">All items are sufficiently stocked</p>
              ) : (
                memoizedData.lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-amber-600">
                        Min. required: {item.minQuantity || 10} units
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-bold text-amber-700">{item.quantity}</p>
                      <p className="text-xs text-amber-600">in stock</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Revenue & Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {memoizedData.dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memoizedData.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const formattedValue = formatCurrency(Number(value));
                      const label = name === 'Revenue' ? 'Revenue' :
                        name === 'Expenses' ? 'Expenses' : 'Net Profit';
                      return [formattedValue, label];
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend iconType="circle" />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No data for selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}