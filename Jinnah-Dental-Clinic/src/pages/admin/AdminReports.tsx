'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Users, DollarSign, Package, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

interface ReportStat {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  loading?: boolean;
}

export default function AdminReports() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayPatients: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0, // Placeholder
    totalPatients: 0,
    activePatients: 0,
    newPatientsThisMonth: 0,
    totalInventoryItems: 0,
    lowStockItems: 0,
    totalStaff: 0,
    activeStaff: 0,
  });

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Today's revenue & patients (from bills & queue)
      const todayBillsQuery = query(
        collection(db, 'bills'),
        where('createdDate', '>=', todayStart.toISOString()),
        where('createdDate', '<=', todayEnd.toISOString())
      );
      const todayBillsSnap = await getDocs(todayBillsQuery);
      let todayRevenue = 0;
      todayBillsSnap.forEach(doc => {
        const data = doc.data();
        todayRevenue += Number(data.totalAmount || data.amountPaid || 0);
      });

      const todayQueueQuery = query(
        collection(db, 'queue'),
        where('status', '==', 'completed'),
        where('treatmentEndTime', '>=', todayStart.toISOString()),
        where('treatmentEndTime', '<=', todayEnd.toISOString())
      );
      const todayQueueSnap = await getDocs(todayQueueQuery);
      const todayPatients = todayQueueSnap.size;

      // 2. Monthly revenue
      const monthlyBillsQuery = query(
        collection(db, 'bills'),
        where('createdDate', '>=', monthStart.toISOString()),
        where('createdDate', '<=', monthEnd.toISOString())
      );
      const monthlyBillsSnap = await getDocs(monthlyBillsQuery);
      let monthlyRevenue = 0;
      monthlyBillsSnap.forEach(doc => {
        const data = doc.data();
        monthlyRevenue += Number(data.totalAmount || data.amountPaid || 0);
      });

      // 3. Patients stats
      const patientsSnap = await getDocs(collection(db, 'patients'));
      let totalPatients = patientsSnap.size;
      let activePatients = 0;
      let newThisMonth = 0;

      patientsSnap.forEach(doc => {
        const data = doc.data();
        if (data.isActive !== false) activePatients++;
        if (data.registrationDate) {
          const regDate = new Date(data.registrationDate);
          if (regDate >= monthStart && regDate <= monthEnd) {
            newThisMonth++;
          }
        }
      });

      // 4. Inventory stats (placeholder - add real inventory fetch)
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      let totalInventory = inventorySnap.size;
      let lowStock = 0;
      inventorySnap.forEach(doc => {
        const data = doc.data();
        if (data.quantity < (data.min || 0)) lowStock++;
      });

      // 5. Staff stats
      const staffSnap = await getDocs(collection(db, 'staff'));
      let totalStaff = staffSnap.size;
      let activeStaff = 0;
      staffSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Active') activeStaff++;
      });

      setStats({
        todayRevenue,
        todayPatients,
        monthlyRevenue,
        monthlyExpenses: 0, // ← Replace when expenses collection exists
        totalPatients,
        activePatients,
        newPatientsThisMonth: newThisMonth,
        totalInventoryItems: totalInventory,
        lowStockItems: lowStock,
        totalStaff,
        activeStaff,
      });

      toast({
        title: "Reports Loaded",
        description: "All statistics updated from live data",
      });
    } catch (err: any) {
      console.error('Reports fetch error:', err);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const generateReport = async (reportName: string) => {
    setGenerating(reportName);
    try {
      // Simulate report generation delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Simple CSV generation example (you can make it more advanced)
      let csvContent = "data:text/csv;charset=utf-8,";
      let filename = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

      if (reportName === 'Daily Summary') {
        csvContent += "Metric,Value\n";
        csvContent += `Today Revenue,${stats.todayRevenue}\n`;
        csvContent += `Today Patients,${stats.todayPatients}\n`;
      } else if (reportName === 'Monthly Financial') {
        csvContent += "Metric,Value\n";
        csvContent += `Monthly Revenue,${stats.monthlyRevenue}\n`;
        csvContent += `Monthly Expenses,${stats.monthlyExpenses}\n`;
        csvContent += `Net Profit,${stats.monthlyRevenue - stats.monthlyExpenses}\n`;
      } else if (reportName === 'Patient Statistics') {
        csvContent += "Metric,Value\n";
        csvContent += `Total Patients,${stats.totalPatients}\n`;
        csvContent += `Active Patients,${stats.activePatients}\n`;
        csvContent += `New This Month,${stats.newPatientsThisMonth}\n`;
      } else if (reportName === 'Inventory Report') {
        csvContent += "Metric,Value\n";
        csvContent += `Total Items,${stats.totalInventoryItems}\n`;
        csvContent += `Low Stock Items,${stats.lowStockItems}\n`;
      } else if (reportName === 'Staff Performance') {
        csvContent += "Metric,Value\n";
        csvContent += `Total Staff,${stats.totalStaff}\n`;
        csvContent += `Active Staff,${stats.activeStaff}\n`;
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Report Generated",
        description: `${reportName} downloaded successfully`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const reportTypes = [
    {
      name: 'Daily Summary',
      description: `Revenue: $${stats.todayRevenue} • Patients: ${stats.todayPatients}`,
      icon: Calendar,
      stat: `$${stats.todayRevenue} today`,
    },
    {
      name: 'Monthly Financial',
      description: `Revenue: $${stats.monthlyRevenue} • Expenses: $${stats.monthlyExpenses}`,
      icon: DollarSign,
      stat: `Profit: $${stats.monthlyRevenue - stats.monthlyExpenses}`,
    },
    {
      name: 'Patient Statistics',
      description: `Total: ${stats.totalPatients} • Active: ${stats.activePatients}`,
      icon: Users,
      stat: `${stats.newPatientsThisMonth} new this month`,
    },
    {
      name: 'Inventory Report',
      description: `Total Items: ${stats.totalInventoryItems}`,
      icon: Package,
      stat: `${stats.lowStockItems} low stock`,
    },
    {
      name: 'Staff Performance',
      description: `Total Staff: ${stats.totalStaff}`,
      icon: Users,
      stat: `${stats.activeStaff} active`,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and download clinic reports</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchReportData}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <Card key={report.name} className="hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <report.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{report.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                    <p className="text-xs font-medium mt-2 text-primary">
                      {report.stat}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => generateReport(report.name)}
                  disabled={generating === report.name || loading}
                >
                  {generating === report.name ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {generating === report.name ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}