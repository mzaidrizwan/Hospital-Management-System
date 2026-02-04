'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Users,
  DollarSign,
  Package,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  BarChart,
  ClipboardList,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useData } from '@/context/DataContext';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface ReportStat {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  loading?: boolean;
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

export default function AdminReports() {
  const {
    bills,
    queue,
    patients,
    inventory,
    staff,
    generateStaffReport,
    exportToCSV,
    loading: dataLoading
  } = useData();

  const [generating, setGenerating] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (dataLoading) {
      return {
        todayRevenue: 0,
        todayPatients: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        totalPatients: 0,
        activePatients: 0,
        newPatientsThisMonth: 0,
        totalInventoryItems: 0,
        lowStockItems: 0,
        totalStaff: 0,
        activeStaff: 0,
      };
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 1. Revenue calculations
    let todayRevenue = 0;
    let monthlyRevenue = 0;

    (bills || []).forEach(bill => {
      if (!bill) return;
      // Fixed: Removed createdAt as it might not exist according to lint
      const dateStr = bill.createdDate || bill.date;
      if (!dateStr) return;

      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return;

        const amount = Number(bill.totalAmount || bill.amountPaid || 0);

        if (isWithinInterval(date, { start: todayStart, end: todayEnd })) {
          todayRevenue += amount;
        }

        if (isWithinInterval(date, { start: monthStart, end: monthEnd })) {
          monthlyRevenue += amount;
        }
      } catch (e) {
        console.error('Error parsing bill date:', e);
      }
    });

    // 2. Patient calculations
    const todayPatients = (queue || []).filter(item => {
      if (!item || item.status !== 'completed') return false;
      const dateStr = item.treatmentEndTime || item.checkInTime || item.createdAt;
      if (!dateStr) return false;
      try {
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && isWithinInterval(date, { start: todayStart, end: todayEnd });
      } catch (e) {
        return false;
      }
    }).length;

    let activePatients = 0;
    let newThisMonth = 0;
    (patients || []).forEach(p => {
      if (!p) return;
      if (p.isActive !== false) activePatients++;
      if (p.registrationDate) {
        try {
          const regDate = new Date(p.registrationDate);
          if (!isNaN(regDate.getTime()) && isWithinInterval(regDate, { start: monthStart, end: monthEnd })) {
            newThisMonth++;
          }
        } catch (e) { }
      }
    });

    // 3. Inventory stats
    let lowStock = (inventory || []).filter(item => item && item.quantity < (item.min || 0)).length;

    // 4. Staff stats
    let activeStaff = (staff || []).filter(s => s && s.status === 'Active').length;

    return {
      todayRevenue,
      todayPatients,
      monthlyRevenue,
      monthlyExpenses: 0, // Placeholder
      totalPatients: (patients || []).length,
      activePatients,
      newPatientsThisMonth: newThisMonth,
      totalInventoryItems: (inventory || []).length,
      lowStockItems: lowStock,
      totalStaff: (staff || []).length,
      activeStaff,
    };
  }, [bills, queue, patients, inventory, staff, dataLoading]);

  const hasAnyData = useMemo(() => {
    return stats.totalPatients > 0 || stats.totalInventoryItems > 0 || stats.totalStaff > 0 || stats.monthlyRevenue > 0;
  }, [stats]);

  const generateReport = async (reportName: string) => {
    setGenerating(reportName);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

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

      toast.success(`${reportName} downloaded successfully`);
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  const handleExportStaff = () => {
    try {
      setGenerating('Staff Performance');
      const data = generateStaffReport();
      exportToCSV(data, `Staff_Detailed_Report_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success("Staff performance report downloaded");
    } catch (e) {
      toast.error("Failed to export staff report");
    } finally {
      setGenerating(null);
    }
  };

  const reportTypes = [
    {
      name: 'Daily Summary',
      description: `Revenue: ${formatCurrency(stats.todayRevenue)} • Patients: ${stats.todayPatients}`,
      icon: Calendar,
      stat: `${formatCurrency(stats.todayRevenue)} today`,
      available: stats.todayRevenue > 0 || stats.todayPatients > 0
    },
    {
      name: 'Monthly Financial',
      description: `Revenue: ${formatCurrency(stats.monthlyRevenue)} • Expenses: ${formatCurrency(stats.monthlyExpenses)}`,
      icon: DollarSign,
      stat: `Profit: ${formatCurrency(stats.monthlyRevenue - stats.monthlyExpenses)}`,
      available: stats.monthlyRevenue > 0
    },
    {
      name: 'Patient Statistics',
      description: `Total: ${stats.totalPatients} • Active: ${stats.activePatients}`,
      icon: Users,
      stat: `${stats.newPatientsThisMonth} new this month`,
      available: stats.totalPatients > 0
    },
    {
      name: 'Inventory Report',
      description: `Total Items: ${stats.totalInventoryItems}`,
      icon: Package,
      stat: `${stats.lowStockItems} low stock items`,
      available: stats.totalInventoryItems > 0
    },
    {
      name: 'Staff Performance',
      description: `Total Staff: ${stats.totalStaff} • Active: ${stats.activeStaff}`,
      icon: ClipboardList,
      stat: `${stats.activeStaff} staff currently active`,
      available: stats.totalStaff > 0
    },
  ];

  if (dataLoading) {
    return <LoadingSpinner message="Compiling clinic reports..." />;
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
          </div>
          <p className="text-muted-foreground">Generate and download clinic performance reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleExportStaff}
            className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-md rounded-xl h-11 px-6 font-bold"
            disabled={generating === 'Staff Performance'}
          >
            {generating === 'Staff Performance' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-5 h-5" />}
            Export Staff Performance & Payroll
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="gap-2 rounded-xl h-11 px-5 font-semibold text-gray-600 border-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {!hasAnyData ? (
        <Card className="p-12 text-center border-dashed">
          <CardContent className="flex flex-col items-center gap-4">
            <ClipboardList className="w-12 h-12 text-muted-foreground opacity-20" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No Activity To Report</h3>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                Reports will be available once you start registering patients, inventory, or financial transactions.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => (
            <Card key={report.name} className="hover:shadow-md transition-all border-l-4 border-l-primary">
              <CardContent className="p-6">
                <div className="flex flex-col h-full justify-between">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <report.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg leading-tight">{report.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.description}</p>
                      <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/10">
                        {report.stat}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    className="w-full gap-2 shadow-sm rounded-xl font-bold"
                    onClick={() => report.name === 'Staff Performance' ? handleExportStaff() : generateReport(report.name)}
                    disabled={generating === report.name || !report.available}
                  >
                    {generating === report.name ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {generating === report.name ? 'Generating...' : (!report.available ? 'No Data Available' : 'Download Report')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}