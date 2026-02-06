'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  UserCog,
  Edit,
  Phone,
  Calendar,
  Clock,
  Briefcase,
  Trash2,
  Trash,
  Filter,
  X,
  TrendingUp,
  CalendarDays,
  RefreshCw,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Users,
  Mail,
  Loader2,
  Download,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import StaffFormModal from '@/components/modals/StaffFormModal';
import StaffDetailsModal from '@/components/modals/StaffDetailsModal';
import PaySalaryModal from '@/components/modals/PaySalaryModal';
import AttendanceModal from '@/components/modals/AttendanceModal';
import StaffActivityModal from '@/components/staff/StaffActivityModal';
import { Staff, SalaryPayment, Attendance, Transaction, Expense } from '@/types';
import { smartSync, smartDelete } from '@/services/syncService';
import { cn } from '@/lib/utils';
import { useSalaryLogic } from '@/hooks/useSalaryLogic';

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return 'PKR 0';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};



const calculateNextSalaryDate = (staffMember: Staff): string => {
  const lastDate = staffMember?.lastSalaryDate || staffMember?.joinDate;
  if (!lastDate) return '';
  try {
    const last = new Date(lastDate);
    if (isNaN(last.getTime())) return '';
    const next = new Date(last);
    switch (staffMember.salaryDuration) {
      case 'daily': next.setDate(last.getDate() + 1); break;
      case 'weekly': next.setDate(last.getDate() + 7); break;
      case 'monthly': next.setMonth(last.getMonth() + 1); break;
    }
    return next.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

export default function AdminStaff() {
  const {
    staff: contextStaff,
    setStaff,
    salaryPayments: contextPayments,
    setSalaryPayments,
    attendance: contextAttendance,
    setAttendance,
    transactions,
    setTransactions,
    expenses,
    setExpenses,
    loading: dataLoading,
    updateLocal,
    updateAttendance,
    deleteLocal,
    generateStaffReport,
    exportToCSV
  } = useData();

  const { getSalaryStatus } = useSalaryLogic();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDuration, setSelectedDuration] = useState('all');

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showStaffDetails, setShowStaffDetails] = useState<Staff | null>(null);
  const [showPaySalary, setShowPaySalary] = useState<Staff | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState<Staff | null>(null);
  const [showActivityModal, setShowActivityModal] = useState<Staff | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedStaffForHistory, setSelectedStaffForHistory] = useState<Staff | null>(null);

  const isPaymentDue = (staff: Staff): boolean => {
    if (!staff.lastPaidDate) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPaid = new Date(staff.lastPaidDate);
    lastPaid.setHours(0, 0, 0, 0);

    // Calculate difference in days
    const diffTime = Math.abs(today.getTime() - lastPaid.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (staff.salaryDuration === 'daily') {
      // Due if LAST PAID DATE IS NOT TODAY
      // If last paid date IS today, then payment IS NOT due.
      return lastPaid.getTime() !== today.getTime();
    } else if (staff.salaryDuration === 'weekly') {
      // Due if last payment was > 7 days ago
      return diffDays >= 7;
    } else {
      // Monthly: rely on the standard amountDue logic or a similar check
      // For now, let's say monthly is due if it's been > 30 days or pendingSalary > 0
      return diffDays >= 30;
    }
  };

  const processedStaff = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return (contextStaff || []).map(s => {
      if (!s) return null;

      // Calculate today's attendance status
      const todayAttendance = (contextAttendance || []).find(a => a.staffId === s.id && a.date === todayStr);
      let attendanceStatus = s.attendanceStatus; // Keep manual update if present

      if (todayAttendance) {
        attendanceStatus = todayAttendance.status === 'present' ? 'Present' :
          todayAttendance.status === 'absent' ? 'Absent' : 'Leave';
      }

      const { status: salStatus, amountDue } = getSalaryStatus(s);
      const paymentDue = isPaymentDue(s);

      return {
        ...s,
        pendingSalary: amountDue,
        salaryStatus: salStatus,
        isPaymentDue: paymentDue, // Add this new field
        nextSalaryDate: calculateNextSalaryDate(s),
        ...(attendanceStatus && { attendanceStatus })
      };
    }).filter(Boolean) as (Staff & { isPaymentDue: boolean })[];
  }, [contextStaff, contextAttendance, getSalaryStatus]);

  const filteredStaff = useMemo(() => {
    return processedStaff.filter(member => {
      const matchesSearch = (member.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (member.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === 'all' || member.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || member.status === selectedStatus;
      const matchesDuration = selectedDuration === 'all' || member.salaryDuration === selectedDuration;
      return matchesSearch && matchesRole && matchesStatus && matchesDuration;
    });
  }, [processedStaff, searchTerm, selectedRole, selectedStatus, selectedDuration]);

  const stats = useMemo(() => {
    const totalStaff = processedStaff.length;
    const activeStaff = processedStaff.filter(s => s.status === 'Active').length;
    const totalPendingSalary = processedStaff.reduce((sum, s) => sum + (s.pendingSalary || 0), 0);
    const totalPaidSalary = (contextPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return { totalStaff, activeStaff, totalPendingSalary, totalPaidSalary };
  }, [processedStaff, contextPayments]);

  const roles = useMemo(() => Array.from(new Set(processedStaff.map(s => s.role).filter(Boolean))), [processedStaff]);
  const statuses = useMemo(() => Array.from(new Set(processedStaff.map(s => s.status).filter(Boolean))), [processedStaff]);
  const durations = useMemo(() => Array.from(new Set(processedStaff.map(s => s.salaryDuration).filter(Boolean))), [processedStaff]);

  const handleStaffSubmit = async (staffData: Partial<Staff>) => {
    // Validation: Prevent creating staff with empty names
    if (!staffData.name || staffData.name.trim() === '') {
      console.error('Blocked attempt to create staff member with empty name');
      toast.error('Staff name is required');
      return;
    }

    const salaryAmount = Number(staffData.salary) || 0;
    const joinDate = staffData.joinDate || new Date().toISOString().split('T')[0];

    try {
      let updatedStaff: Staff;
      if (isEditing && selectedStaff) {
        updatedStaff = {
          ...selectedStaff,
          ...staffData,
          salary: salaryAmount,
          salaryDuration: staffData.salaryDuration || 'monthly',
          workingDaysPerWeek: Number(staffData.workingDaysPerWeek) || 6,
          pendingSalary: selectedStaff.pendingSalary,
          lastUpdated: Date.now(),
          updatedAt: new Date().toISOString()
        } as Staff;
      } else {
        updatedStaff = {
          id: `staff-${Date.now()}`,
          name: staffData.name || '',
          role: staffData.role || '',
          phone: staffData.phone || '',
          joinDate: joinDate,
          status: 'Active',
          salary: salaryAmount,
          salaryDuration: staffData.salaryDuration || 'monthly',
          salaryType: staffData.salaryDuration || 'monthly',
          workingDaysPerWeek: Number(staffData.workingDaysPerWeek) || 6,
          totalPaid: 0,
          totalEarned: 0,
          pendingSalary: 0,
          lastSalaryDate: joinDate,
          lastPaidDate: joinDate,
          createdAt: new Date().toISOString(),
          lastUpdated: Date.now(),
          updatedAt: new Date().toISOString()
        } as Staff;
      }

      // 1. Update LOCAL immediately (State + IndexedDB)
      // This is fast and ensures the UI updates instantly
      await updateLocal('staff', updatedStaff);

      // 2. Close Modal immediately
      setShowStaffForm(false);
      setSelectedStaff(null);

      // 3. Trigger Firebase Sync in background (no await)
      smartSync('staff', updatedStaff).catch(err => {
        console.error('Background sync failed:', err);
      });

      toast.success(isEditing ? 'Staff updated successfully' : 'Staff added to directory');

    } catch (error) {
      console.error('Staff operation failed:', error);
      toast.error('Failed to save staff information');
    }
  };

  const handleDeleteStaff = async (staffMember: Staff) => {
    if (!window.confirm(`Are you sure you want to remove ${staffMember.name}?`)) return;

    try {
      // 1. Update LOCAL immediately (State + IndexedDB)
      // This makes the card disappear instantly
      await deleteLocal('staff', staffMember.id);

      // 2. Trigger Firebase Delete in background (no await)
      smartDelete('staff', staffMember.id).catch(err => {
        console.error('Background delete failed:', err);
      });

      toast.success(`${staffMember.name} removed from record`);
    } catch (error) {
      console.error('Delete operation failed:', error);
      toast.error('Failed to remove staff member');
    }
  };

  const handlePaySalary = async (staffMember: Staff, paymentData: any) => {
    const timestamp = new Date().toISOString();
    try {
      const expenseId = `exp-sal-${Date.now()}`;

      const newTransaction: Transaction = {
        id: `txn-${Date.now()}`,
        staffId: staffMember.id,
        staffName: staffMember.name,
        amount: paymentData.amount,
        date: timestamp,
        type: 'Salary',
        method: paymentData.paymentMethod,
        notes: paymentData.notes,
        expenseId: expenseId
      };

      const newExpense: Expense = {
        id: expenseId,
        title: `Staff Salary: ${staffMember.name}`,
        amount: paymentData.amount,
        category: 'salary',
        paymentMethod: (paymentData.paymentMethod === 'bank' ? 'bank_transfer' : 'cash') as any,
        date: timestamp,
        description: `Monthly salary payment for ${staffMember.name}. ${paymentData.notes || ''}`,
        status: 'paid',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const newSalaryPayment: any = {
        id: `sp-${Date.now()}`,
        staffId: staffMember.id,
        staffName: staffMember.name,
        amount: paymentData.amount,
        date: timestamp,
        method: paymentData.paymentMethod,
        notes: paymentData.notes,
        month: paymentData.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
      };

      const updatedStaff: Staff = {
        ...staffMember,
        totalPaid: (staffMember.totalPaid || 0) + paymentData.amount,
        totalEarned: (staffMember.totalEarned || 0) + paymentData.amount,
        lastSalaryDate: timestamp.split('T')[0],
        lastPaidDate: timestamp,
        updatedAt: timestamp,
        salaryStatus: 'Paid'
      };

      // 1. OPTIMISTIC UPDATE: Immediate UI cleanup
      setShowPaySalary(null);

      // Update local React states directly
      setTransactions(prev => [newTransaction, ...(prev || [])]);
      setStaff(prev => prev.map(s => s.id === updatedStaff.id ? updatedStaff : s));
      setExpenses(prev => [newExpense, ...(prev || [])]);

      // 2. Show success toast immediately
      toast.success(`Salary Payment recorded for ${staffMember.name}`);

      // 3. Background Synchronization
      const performSync = async () => {
        try {
          await Promise.all([
            smartSync('transactions', newTransaction),
            updateLocal('transactions', newTransaction),
            smartSync('expenses', newExpense),
            updateLocal('expenses', newExpense),
            updateLocal('staff', updatedStaff),
            smartSync('salaryPayments', newSalaryPayment),
            updateLocal('salaryPayments', newSalaryPayment)
          ]);
        } catch (error) {
          console.error('Background payment sync failed:', error);
        }
      };

      performSync();
    } catch (error) {
      console.error('Payment processing failed:', error);
      toast.error('Failed to process payment');
    }
  };

  const handleDownloadReport = () => {
    const reportData = generateStaffReport();
    exportToCSV(reportData, `Staff_Detailed_Report_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success("Staff report generated and downloaded");
  };

  const handleMarkAttendance = async (staffMember: Staff, attData: any) => {
    try {
      const newAtt: Attendance = {
        id: attData.id || `att-${Date.now()}`,
        staffId: staffMember.id,
        date: attData.date,
        status: attData.status as 'present' | 'absent' | 'leave',
        notes: attData.notes
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = attData.date === todayStr;

      // 1. OPTIMISTIC UI: Close modal immediately
      setShowAttendanceModal(null);

      // 2. Use centralized context function (Handles State + Local DB + Background Sync)
      await updateAttendance(newAtt);

      // 3. Success Feedback
      toast.success(isToday
        ? `Marked ${staffMember.name} as ${newAtt.status} for today`
        : `Attendance updated for ${attData.date}`
      );

    } catch (error) {
      console.error('Attendance recording failed:', error);
      toast.error('Failed to record attendance');
    }
  };

  if (dataLoading && processedStaff.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Synchronizing staff records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Staff Directory</h1>
          </div>
          <p className="text-muted-foreground font-medium">Manage clinic personnel, payroll, and attendance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadReport}
            className="gap-2 border-gray-200 hover:bg-gray-50 h-11 px-6 font-bold rounded-xl"
          >
            <Download className="w-5 h-5" />
            Export Report
          </Button>
          <Button
            onClick={() => { setSelectedStaff(null); setIsEditing(false); setShowStaffForm(true); }}
            className="gap-2 bg-primary hover:bg-primary/90 shadow-md h-11 px-6 font-bold rounded-xl"
          >
            <Plus className="w-5 h-5" />
            Add Staff
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-blue-50/50 border border-blue-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Active Staff</p>
                <h3 className="text-3xl font-black text-blue-900">{stats.activeStaff} / {stats.totalStaff}</h3>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Briefcase className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-amber-50/50 border border-amber-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Pending Payroll</p>
                <h3 className="text-3xl font-black text-amber-900">{formatCurrency(stats.totalPendingSalary)}</h3>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl text-amber-600"><Wallet className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-green-50/50 border border-green-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-green-600 uppercase tracking-widest">Total Disbursements</p>
                <h3 className="text-3xl font-black text-green-900">{formatCurrency(stats.totalPaidSalary)}</h3>
              </div>
              <div className="p-3 bg-green-100 rounded-xl text-green-600"><CheckCircle2 className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-purple-50/50 border border-purple-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-black text-purple-600 uppercase tracking-widest">Today Activity</p>
                <h3 className="text-3xl font-black text-purple-900">Normal</h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl text-purple-600"><TrendingUp className="w-6 h-6" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, role or phone..."
            className="pl-10 h-11 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[140px] h-11 font-medium"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Roles</SelectItem>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[140px] h-11 font-medium"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" onClick={() => { setSearchTerm(''); setSelectedRole('all'); setSelectedStatus('all'); }} className="h-11">Reset</Button>
        </div>
      </div>

      {/* Staff Grid */}
      {(!filteredStaff || filteredStaff.length === 0) ? (
        <Card className="border-2 border-dashed border-muted/50 py-20">
          <CardContent className="flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-muted-foreground">No personnel matching criteria</h3>
            <Button variant="link" onClick={() => setSearchTerm('')}>Clear search filters</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff?.map((staffMember) => (
            <Card key={staffMember.id} className="group hover:shadow-xl transition-all border-none shadow-md overflow-hidden bg-white">
              <div className={`h-1.5 w-full ${staffMember.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors pointer-cursor" onClick={() => setShowActivityModal(staffMember)}>
                      <UserCog className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 tracking-tight cursor-pointer hover:text-primary transition-colors" onClick={() => setShowActivityModal(staffMember)}>
                        {staffMember.name}
                      </h3>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">{staffMember.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={staffMember.status === 'Active' ? 'default' : 'destructive'} className="font-bold">
                      {staffMember.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-black text-[10px] uppercase tracking-widest",
                        staffMember.salaryStatus === 'Paid'
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      )}
                    >
                      Salary: {staffMember.salaryStatus}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                    <Phone className="w-4 h-4 text-muted-foreground" /> {staffMember.phone}
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                    <Calendar className="w-4 h-4 text-muted-foreground" /> Joined: {staffMember.joinDate ? new Date(staffMember.joinDate).toLocaleDateString() : 'No Date Provided'}
                  </div>
                  <div className="pt-3 border-t grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Base Salary</p>
                      <p className="text-sm font-bold text-gray-900">{staffMember.salary && staffMember.salary > 0 ? formatCurrency(staffMember.salary) : 'Not Set'} {staffMember.salary && staffMember.salary > 0 && <span className="text-[10px] font-normal text-muted-foreground">/{staffMember.salaryDuration}</span>}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pending</p>
                      <p className={`text-sm font-black ${staffMember.pendingSalary > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {formatCurrency(staffMember.pendingSalary)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t mt-4">
                    <div className="flex items-center justify-between gap-3">
                      {!staffMember.isPaymentDue ? (
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex-1 justify-center shadow-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-black uppercase tracking-widest">Paid</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 gap-2 font-bold border-primary/20 text-primary hover:bg-primary hover:text-white shadow-sm active:scale-95 transition-all flex-1 rounded-xl"
                          onClick={() => setShowPaySalary(staffMember)}
                        >
                          <Wallet className="w-4 h-4" /> Pay Salary
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "font-bold h-9 rounded-xl border border-blue-100 transition-all px-0",
                          staffMember.attendanceStatus === 'Present'
                            ? "bg-green-50 text-green-700 border-green-200"
                            : staffMember.attendanceStatus === 'Absent'
                              ? "bg-red-50 text-red-700 border-red-200"
                              : staffMember.attendanceStatus === 'Leave'
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "text-blue-700 hover:bg-blue-50 bg-blue-50/30"
                        )}
                        title="Mark Attendance"
                        onClick={() => setShowAttendanceModal(staffMember)}
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-bold h-9 rounded-xl hover:bg-blue-50 text-blue-600 border border-transparent hover:border-blue-100 px-0"
                        title="Activity History"
                        onClick={() => {
                          setSelectedStaffForHistory(staffMember);
                          setIsHistoryOpen(true);
                        }}
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-bold h-9 rounded-xl hover:bg-gray-100 text-gray-500 px-0"
                        title="Edit Staff"
                        onClick={() => { setSelectedStaff(staffMember); setIsEditing(true); setShowStaffForm(true); }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-bold h-9 rounded-xl text-destructive/70 hover:text-destructive hover:bg-destructive/5 px-0"
                        title="Delete Staff"
                        onClick={() => handleDeleteStaff(staffMember)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <StaffFormModal
        open={showStaffForm}
        onClose={() => { setShowStaffForm(false); setSelectedStaff(null); }}
        onSubmit={handleStaffSubmit}
        staff={selectedStaff}
        isEditing={isEditing}
      />

      <PaySalaryModal
        open={!!showPaySalary}
        onClose={() => setShowPaySalary(null)}
        staff={showPaySalary}
        onSubmit={handlePaySalary}
      />

      <AttendanceModal
        open={!!showAttendanceModal}
        onClose={() => setShowAttendanceModal(null)}
        staff={showAttendanceModal}
        existingAttendance={contextAttendance || []}
        onSubmit={handleMarkAttendance}
      />

      <StaffDetailsModal
        open={!!showStaffDetails}
        onClose={() => setShowStaffDetails(null)}
        staff={showStaffDetails}
        salaryPayments={contextPayments?.filter(p => p.staffId === showStaffDetails?.id) || []}
        attendance={contextAttendance?.filter(a => a.staffId === showStaffDetails?.id) || []}
        onEdit={() => {
          setSelectedStaff(showStaffDetails);
          setIsEditing(true);
          setShowStaffForm(true);
          setShowStaffDetails(null);
        }}
        onDelete={(s) => {
          handleDeleteStaff(s);
          setShowStaffDetails(null);
        }}
        onPaySalary={() => {
          setShowPaySalary(showStaffDetails);
          setShowStaffDetails(null);
        }}
      />

      <StaffActivityModal
        open={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setSelectedStaffForHistory(null);
        }}
        staff={selectedStaffForHistory}
      />
    </div>
  );
}