'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon,
  RefreshCw
} from 'lucide-react';
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
  date: string;
  createdAt: any;
  productName?: string;
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

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return 'PKR 0';

  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const parseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;

  try {
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }

    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    if (dateValue instanceof Date) {
      return dateValue;
    }

    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

const getDateRangeData = (
  bills: Bill[],
  sales: Sale[],
  expenses: Expense[],
  salaryPayments: SalaryPayment[],
  dateRange: DateRange
) => {
  if (!dateRange.from || !dateRange.to) {
    return {
      bills: [],
      sales: [],
      expenses: [],
      salaryPayments: [],
      combinedRevenue: []
    };
  }

  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);
  to.setHours(23, 59, 59, 999);

  const isInDateRange = (itemDate: Date | null): boolean => {
    if (!itemDate) return false;
    return itemDate >= from && itemDate <= to;
  };

  // Filter bills (only paid ones count as revenue)
  const filteredBills = bills.filter(bill => {
    if (bill.paymentStatus !== 'paid') return false;

    const billDate = parseDate(bill.createdDate || bill.date || bill.createdAt);
    return isInDateRange(billDate);
  });

  // Filter sales (only paid ones count as revenue)
  const filteredSales = sales.filter(sale => {
    if (sale.paymentStatus !== 'paid') return false;

    const saleDate = parseDate(sale.date || sale.createdAt);
    return isInDateRange(saleDate);
  });

  // Filter expenses (only paid ones)
  const filteredExpenses = expenses.filter(expense => {
    if (expense.status !== 'paid') return false;

    const expenseDate = parseDate(expense.date);
    return isInDateRange(expenseDate);
  });

  // Filter salary payments
  const filteredSalaries = salaryPayments.filter(salary => {
    const salaryDate = parseDate(salary.date);
    return isInDateRange(salaryDate);
  });

  // Combine all revenue sources
  const combinedRevenue = [
    ...filteredBills.map(bill => ({
      ...bill,
      amount: bill.amountPaid || 0,
      type: 'bill'
    })),
    ...filteredSales.map(sale => ({
      ...sale,
      amount: sale.amount || sale.totalPrice || 0,
      type: 'sale'
    }))
  ];

  return {
    bills: filteredBills,
    sales: filteredSales,
    expenses: filteredExpenses,
    salaryPayments: filteredSalaries,
    combinedRevenue
  };
};

const getDailyRevenueExpenseData = (
  combinedRevenue: any[],
  expenses: Expense[],
  salaryPayments: SalaryPayment[],
  dateRange: DateRange
) => {
  if (!dateRange.from || !dateRange.to) return [];

  const result: { date: string; revenue: number; expenses: number; profit: number }[] = [];
  const current = new Date(dateRange.from);
  const to = new Date(dateRange.to);

  while (current <= to) {
    const dateStr = current.toISOString().split('T')[0];

    // Calculate daily revenue
    const dayRevenue = combinedRevenue
      .filter(item => {
        const itemDate = parseDate(item.date || item.createdDate || item.createdAt);
        if (!itemDate) return false;
        return itemDate.toISOString().split('T')[0] === dateStr;
      })
      .reduce((sum, item) => sum + (item.amount || 0), 0);

    // Calculate daily expenses (regular expenses + salaries)
    const dayExpensesRegular = expenses
      .filter(expense => {
        const expenseDate = parseDate(expense.date);
        if (!expenseDate) return false;
        return expenseDate.toISOString().split('T')[0] === dateStr;
      })
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);

    const dayExpensesSalaries = salaryPayments
      .filter(salary => {
        const salaryDate = parseDate(salary.date);
        if (!salaryDate) return false;
        return salaryDate.toISOString().split('T')[0] === dateStr;
      })
      .reduce((sum, salary) => sum + (salary.amount || 0), 0);

    const dayExpenses = dayExpensesRegular + dayExpensesSalaries;

    result.push({
      date: format(current, 'MMM dd'),
      revenue: dayRevenue,
      expenses: dayExpenses,
      profit: dayRevenue - dayExpenses
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

    // Get filtered data for selected date range
    const {
      bills: filteredBills,
      sales: filteredSales,
      expenses: filteredExpenses,
      salaryPayments: filteredSalaries,
      combinedRevenue
    } = getDateRangeData(
      bills as Bill[],
      sales as Sale[],
      contextExpenses as Expense[],
      salaryPayments as SalaryPayment[],
      dateRange
    );

    // Calculate daily data for chart
    const dailyData = getDailyRevenueExpenseData(
      combinedRevenue,
      filteredExpenses,
      filteredSalaries,
      dateRange
    );

    // Calculate totals
    const totalRevenue = combinedRevenue.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalSalaries = filteredSalaries.reduce((sum, sal) => sum + (sal.amount || 0), 0);
    const totalExpensesAll = totalExpenses + totalSalaries;
    const netProfit = totalRevenue - totalExpensesAll;

    // Other calculations
    const totalPatients = patients.filter(p => p.isActive).length;
    const totalTransactions = filteredBills.length + filteredSales.length;
    const lowStockItems = getLowStock(inventory);
    const recentPatients = getRecentPatients(patients);
    const recentTransactions = getRecentTransactions(filteredBills, filteredSales, 5);

    return {
      filteredBills,
      filteredSales,
      filteredExpenses,
      filteredSalaries,
      combinedRevenue,
      dailyData,
      recentTransactions,
      totalRevenue,
      totalExpenses: totalExpensesAll,
      totalSalaries,
      netProfit,
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

    const prevData = getDateRangeData(
      bills as Bill[],
      sales as Sale[],
      contextExpenses as Expense[],
      salaryPayments as SalaryPayment[],
      { from: prevFrom, to: prevTo }
    );

    const prevRevenue = prevData.combinedRevenue.reduce((sum, item) => sum + (item.amount || 0), 0);
    const prevExpensesTotal = prevData.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const prevSalariesTotal = prevData.salaryPayments.reduce((sum, sal) => sum + (sal.amount || 0), 0);

    return {
      revenue: prevRevenue,
      expenses: prevExpensesTotal + prevSalariesTotal
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(value) => `PKR ${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const formattedValue = formatCurrency(Number(value));
                      const label = name === 'revenue' ? 'Revenue' :
                        name === 'expenses' ? 'Expenses' : 'Profit';
                      return [formattedValue, label];
                    }}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px'
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
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