'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  Calendar as CalendarIcon
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

// Firebase imports
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';

// IndexedDB Manager
import { saveToLocal, getFromLocal, openDB } from '@/services/indexedDbUtils';

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

// Helper functions
const loadFromFirebase = async (coll: string) => {
  try {
    const q = query(collection(db, coll), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(`Failed to load ${coll}:`, e);
    return [];
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getDateRangeData = (bills: Bill[], sales: Sale[], expenses: Expense[], dateRange: DateRange) => {
  if (!dateRange.from || !dateRange.to) return { bills: [], sales: [], expenses: [] };

  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);
  to.setHours(23, 59, 59, 999);

  const filterByDate = (item: any, dateFields: string[]) => {
    for (const field of dateFields) {
      if (item[field]) {
        try {
          const itemDate = item[field]?.toDate ? item[field].toDate() : new Date(item[field]);
          if (itemDate >= from && itemDate <= to) return true;
        } catch (e) {
          console.error('Date parsing error:', e);
        }
      }
    }
    return false;
  };

  const filteredBills = bills.filter(bill =>
    filterByDate(bill, ['createdDate', 'date', 'createdAt']) &&
    bill.paymentStatus === 'paid'
  );

  const filteredSales = sales.filter(sale =>
    filterByDate(sale, ['date', 'createdAt']) &&
    sale.paymentStatus === 'paid'
  );

  const filteredExpenses = expenses.filter(expense =>
    filterByDate(expense, ['date', 'createdAt']) &&
    expense.status === 'paid'
  );

  return {
    bills: filteredBills,
    sales: filteredSales,
    expenses: filteredExpenses,
    combinedRevenue: [...filteredBills, ...filteredSales]
  };
};

const getDailyRevenueExpenseData = (combinedRevenue: any[], expenses: Expense[], dateRange: DateRange) => {
  if (!dateRange.from || !dateRange.to) return [];

  const result: { date: string; revenue: number; expenses: number; profit: number }[] = [];
  const current = new Date(dateRange.from);
  const to = new Date(dateRange.to);

  while (current <= to) {
    const dateStr = current.toISOString().split('T')[0];

    const dayRevenue = combinedRevenue
      .filter(item => {
        try {
          const itemDate = item.date ? new Date(item.date).toISOString().split('T')[0] :
            (item.createdAt?.toDate ? item.createdAt.toDate().toISOString().split('T')[0] :
              new Date(item.createdDate || item.createdAt).toISOString().split('T')[0]);
          return itemDate === dateStr;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum, item) => sum + (item.amountPaid || item.amount || item.totalPrice || 0), 0);

    const dayExpenses = expenses
      .filter(expense => {
        try {
          const expenseDate = new Date(expense.date).toISOString().split('T')[0];
          return expenseDate === dateStr;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum, expense) => sum + (expense.amount || 0), 0);

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
      try {
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      } catch (e) {
        return 0;
      }
    })
    .slice(0, 5);
};

const getRecentTransactions = (bills: Bill[], sales: Sale[], limit: number = 5) => {
  const allTransactions = [
    ...bills.map(bill => ({
      ...bill,
      type: 'bill',
      displayName: bill.patientName,
      amount: bill.amountPaid,
      date: bill.createdDate || bill.createdAt,
      color: '#3b82f6'
    })),
    ...sales.map(sale => ({
      ...sale,
      type: 'sale',
      displayName: sale.customerName || sale.productName || 'Sale',
      amount: sale.amount || sale.totalPrice,
      date: sale.date || sale.createdAt,
      color: '#10b981'
    }))
  ];

  return allTransactions
    .sort((a, b) => {
      try {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
        return dateB - dateA;
      } catch (e) {
        return 0;
      }
    })
    .slice(0, limit);
};

export default function AdminDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // Filtered data based on date range
  const {
    bills: filteredBills,
    sales: filteredSales,
    expenses: filteredExpenses,
    combinedRevenue
  } = getDateRangeData(bills, sales, expenses, dateRange);


  const dailyData = getDailyRevenueExpenseData(combinedRevenue, filteredExpenses, dateRange);
  const recentTransactions = getRecentTransactions(filteredBills, filteredSales, 5);

  useEffect(() => {
    async function fetchData() {
      await openDB();

      // 1. STALE: Load everything from IndexedDB in parallel (Milliseconds)
      try {
        const [
          localBills,
          localSales,
          localExpenses,
          localInventory,
          localPatients,
          localSalaries
        ] = await Promise.all([
          getFromLocal('bills'),
          getFromLocal('sales'),
          getFromLocal('expenses'),
          getFromLocal('inventory'),
          getFromLocal('patients'),
          getFromLocal('salaryPayments')
        ]);

        const mappedSalaries = (localSalaries as any[]).map(sal => ({
          id: `salary-${sal.id}`,
          amount: sal.amount || 0,
          date: sal.date || new Date().toISOString(),
          category: 'salary',
          title: `Salary - ${sal.staffName || 'Staff'}`,
          status: 'paid',
          description: 'Salary payment'
        }));

        setBills(localBills || []);
        setSales(localSales || []);
        setInventory(localInventory || []);
        setPatients(localPatients || []);
        setExpenses([...(localExpenses || []), ...mappedSalaries]);

        // Data is ready from local, switch off loading immediately
        setLoading(false);

        // 2. REVALIDATE: Sync with Firebase in background (Non-blocking)
        const syncCollection = async (coll: string, setter: (data: any) => void, localData: any[]) => {
          // Only fetch if online and we don't have too many items (or always if you want fresh cloud data)
          if (!navigator.onLine) return;

          try {
            const remoteData = await loadFromFirebase(coll);
            if (remoteData && remoteData.length > 0) {
              setter(remoteData);
              // Save to local for next time
              await Promise.all(remoteData.map(item => saveToLocal(coll, item)));
            }
          } catch (e) {
            console.warn(`Background sync failed for ${coll}`, e);
          }
        };

        // Trigger background syncs
        syncCollection('bills', setBills, localBills);
        syncCollection('sales', setSales, localSales);
        syncCollection('expenses', (data) => setExpenses([...data, ...mappedSalaries]), localExpenses);
        syncCollection('inventory', setInventory, localInventory);
        syncCollection('patients', setPatients, localPatients);

      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Calculate stats for selected date range
  const totalRevenue = combinedRevenue.reduce((sum, item) =>
    sum + (item.amountPaid || item.amount || item.totalPrice || 0), 0);

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  console.log('Total Expenses:',);

  const netProfit = totalRevenue - totalExpenses;

  // Count stats
  const totalPatients = patients.filter(p => p.isActive).length;
  const totalTransactions = filteredBills.length + filteredSales.length;

  // Calculate trends
  const getPreviousPeriodData = () => {
    if (!dateRange.from || !dateRange.to) return { revenue: 0, expenses: 0 };

    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    const diffDays = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const prevFrom = new Date(from);
    const prevTo = new Date(to);
    prevFrom.setDate(prevFrom.getDate() - diffDays - 1);
    prevTo.setDate(prevTo.getDate() - diffDays - 1);

    const prevData = getDateRangeData(bills, sales, expenses, { from: prevFrom, to: prevTo });

    const prevRevenue = prevData.combinedRevenue.reduce((sum, item) =>
      sum + (item.amountPaid || item.amount || item.totalPrice || 0), 0);

    const prevExpensesTotal = prevData.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return { revenue: prevRevenue, expenses: prevExpensesTotal };
  };

  const prevPeriod = getPreviousPeriodData();

  const revenueTrend = {
    value: prevPeriod.revenue > 0
      ? ((totalRevenue - prevPeriod.revenue) / prevPeriod.revenue * 100).toFixed(1)
      : totalRevenue > 0 ? '100' : '0',
    isPositive: totalRevenue > prevPeriod.revenue
  };

  const expensesTrend = {
    value: prevPeriod.expenses > 0
      ? ((totalExpenses - prevPeriod.expenses) / prevPeriod.expenses * 100).toFixed(1)
      : totalExpenses > 0 ? '100' : '0',
    isPositive: totalExpenses < prevPeriod.expenses
  };

  const profitTrend = {
    value: netProfit > 0 ? '100' : '0',
    isPositive: netProfit > 0
  };

  // Get low stock items
  const lowStockItems = getLowStock(inventory);
  const recentPatients = getRecentPatients(patients);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header with Date Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Clinic performance overview</p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
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
        </div>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle="Bills + Sales"
          icon={DollarSign}
          trend={revenueTrend}
          variant="primary"
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          subtitle="Including salaries"
          icon={TrendingDown}
          trend={expensesTrend}
          variant="warning"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(netProfit)}
          subtitle="Revenue - Expenses"
          icon={TrendingUp}
          trend={profitTrend}
          variant="success"
        />
        <StatCard
          title="Total Patients"
          value={totalPatients.toString()}
          subtitle="Active patients"
          icon={Users}
          variant="default"
        />
      </div>

      {/* Bottom Row - Three Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No recent transactions</p>
              ) : (
                recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
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
                          <p className="text-xs text-muted-foreground">
                            {transaction.type === 'bill' ? transaction.billNumber : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(transaction.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            return format(
                              transaction.date?.toDate ? transaction.date.toDate() :
                                new Date(transaction.date),
                              'MMM dd'
                            );
                          } catch (e) {
                            return 'N/A';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPatients.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No recent patients</p>
              ) : (
                recentPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.age ? `${patient.age} years` : ''}
                        {patient.gender ? ` • ${patient.gender}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            return patient.lastVisit ? format(new Date(patient.lastVisit), 'MMM dd') : 'N/A';
                          } catch (e) {
                            return 'N/A';
                          }
                        })()}
                      </p>
                      {patient.phone && (
                        <p className="text-xs text-muted-foreground">{patient.phone}</p>
                      )}
                    </div>
                  </div>
                ))
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
            {lowStockItems.length > 0 && (
              <Badge variant="destructive">{lowStockItems.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">All items are sufficiently stocked</p>
              ) : (
                lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-amber-600">
                        Min. required: {item.minQuantity || 10} units
                      </p>
                    </div>
                    <div className="text-right">
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

      {/* Combined Revenue & Expenses Chart - MOVED TO LAST POSITION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}