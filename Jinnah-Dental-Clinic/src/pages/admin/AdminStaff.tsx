'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  UserCog,
  Edit,
  DollarSign,
  Phone,
  Calendar,
  Clock,
  Briefcase,
  Trash2,
  Filter,
  X,
  TrendingUp,
  CalendarDays,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import StaffFormModal from '@/components/modals/StaffFormModal';
import StaffDetailsModal from '@/components/modals/StaffDetailsModal';
import PaySalaryModal from '@/components/modals/PaySalaryModal';
import AttendanceModal from '@/components/modals/AttendanceModal';
import { Staff, SalaryPayment, Attendance } from '@/types';

// Firebase
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query
} from 'firebase/firestore';

// IndexedDB Utilities
import { saveToLocal, getFromLocal, deleteFromLocal, openDB } from '@/services/indexedDbUtils';

// Firebase helpers
const syncToFirebase = (collectionName: string, item: any) => {
  setDoc(doc(db, collectionName, item.id), item).catch(console.error); // Background, no await
};

const loadFromFirebase = async (collectionName: string): Promise<any[]> => {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.error("Firebase load failed:", err);
    return [];
  }
};

// Updated Salary Helpers - Period-based
const calculatePendingSalary = (staffMember: Staff): number => {
  if (!staffMember.joinDate) return 0;
  const joinDate = new Date(staffMember.joinDate);
  const today = new Date();
  const lastDate = staffMember.lastSalaryDate ? new Date(staffMember.lastSalaryDate) : joinDate;

  if (lastDate >= today) return 0;

  let pendingPeriods = 0;

  switch (staffMember.salaryDuration) {
    case 'daily':
      const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
      pendingPeriods = daysDiff;
      break;

    case 'weekly':
      const weeksDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24 * 7));
      pendingPeriods = weeksDiff;
      break;

    case 'monthly':
      let monthsDiff = (today.getFullYear() - lastDate.getFullYear()) * 12;
      monthsDiff += today.getMonth() - lastDate.getMonth();
      if (today.getDate() < lastDate.getDate()) monthsDiff--;
      pendingPeriods = Math.max(0, monthsDiff);
      break;

    default:
      return 0;
  }

  return pendingPeriods * staffMember.salary;
};

const calculateNextSalaryDate = (staffMember: Staff): string => {
  const lastDate = staffMember.lastSalaryDate || staffMember.joinDate;
  if (!lastDate) return '';

  const last = new Date(lastDate);
  const next = new Date(last);

  switch (staffMember.salaryDuration) {
    case 'daily':
      next.setDate(last.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(last.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(last.getMonth() + 1);
      break;
  }
  return next.toISOString().split('T')[0];
};

const formatPeriod = (staffMember: Staff): string => {
  if (!staffMember.joinDate) return 'N/A';
  const joinDate = new Date(staffMember.joinDate);
  const today = new Date();
  const timeDiff = today.getTime() - joinDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

  switch (staffMember.salaryDuration) {
    case 'daily':
      return `Day ${daysDiff + 1}`;
    case 'weekly':
      const weeks = Math.floor(daysDiff / 7);
      return `Week ${weeks + 1}`;
    case 'monthly':
      const months = Math.floor(daysDiff / 30);
      return `Month ${months + 1}`;
    default:
      return 'N/A';
  }
};

export default function AdminStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDuration, setSelectedDuration] = useState('all');

  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showStaffDetails, setShowStaffDetails] = useState<Staff | null>(null);
  const [showPaySalary, setShowPaySalary] = useState<Staff | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState<Staff | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load from IndexedDB on mount + SWR
  useEffect(() => {
    async function loadLocalAndSync() {
      try {
        await openDB();

        // 1. STALE: Load from local
        const [localStaff, localPayments, localAttendance] = await Promise.all([
          getFromLocal('staff'),
          getFromLocal('salaryPayments'),
          getFromLocal('attendance')
        ]);

        if (localStaff) {
          const updatedStaff = (localStaff as Staff[]).map(s => ({
            ...s,
            pendingSalary: calculatePendingSalary(s),
            nextSalaryDate: calculateNextSalaryDate(s)
          }));
          setStaff(updatedStaff);
        }
        if (localPayments) setSalaryPayments(localPayments as SalaryPayment[]);
        if (localAttendance) setAttendance(localAttendance as Attendance[]);

        // 2. REVALIDATE: Automatic background sync if online
        if (navigator.onLine) {
          handleSync(false); // Silent sync
        }
      } catch (error) {
        console.error("Error loading staff data:", error);
      }
    }
    loadLocalAndSync();
  }, []);

  // Manual/Automatic Sync function
  const handleSync = async (showToast = true) => {
    if (showToast) toast.info('Syncing staff data...');
    setIsSyncing(true);
    try {
      const [remoteStaff, remotePayments, remoteAttendance] = await Promise.all([
        loadFromFirebase('staff') as Promise<Staff[]>,
        loadFromFirebase('salaryPayments') as Promise<SalaryPayment[]>,
        loadFromFirebase('attendance') as Promise<Attendance[]>
      ]);

      // Update state with calculated fields
      const updatedStaff = remoteStaff.map(s => ({
        ...s,
        pendingSalary: calculatePendingSalary(s),
        nextSalaryDate: calculateNextSalaryDate(s)
      }));

      setStaff(updatedStaff);
      setSalaryPayments(remotePayments);
      setAttendance(remoteAttendance);

      // Save to local IndexedDB in parallel
      await Promise.all([
        ...updatedStaff.map(item => saveToLocal('staff', item)),
        ...remotePayments.map(item => saveToLocal('salaryPayments', item)),
        ...remoteAttendance.map(item => saveToLocal('attendance', item))
      ]);

      if (showToast) toast.success('Staff data synced!');
    } catch (err) {
      console.error("Sync error:", err);
      if (showToast) toast.error('Sync failed. Check connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter staff
  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.phone.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === 'all' || member.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || member.status === selectedStatus;
    const matchesDuration = selectedDuration === 'all' || member.salaryDuration === selectedDuration;

    return matchesSearch && matchesRole && matchesStatus && matchesDuration;
  });

  // Get unique values for filters
  const roles = Array.from(new Set(staff.map(s => s.role)));
  const statuses = Array.from(new Set(staff.map(s => s.status)));
  const durations = Array.from(new Set(staff.map(s => s.salaryDuration)));

  // Handle add/edit staff
  const handleStaffSubmit = async (staffData: Partial<Staff>) => {
    const salaryAmount = Number(staffData.salary) || 0;
    const joinDate = staffData.joinDate || new Date().toISOString().split('T')[0];

    let updatedStaff: Staff;

    if (isEditing && selectedStaff) {
      updatedStaff = {
        ...selectedStaff,
        ...staffData,
        salary: salaryAmount,
        salaryDuration: staffData.salaryDuration || 'monthly',
        workingDaysPerWeek: Number(staffData.workingDaysPerWeek) || 6,
        pendingSalary: calculatePendingSalary({ ...selectedStaff, ...staffData, salary: salaryAmount } as Staff),
        nextSalaryDate: calculateNextSalaryDate({ ...selectedStaff, ...staffData } as Staff)
      };

      setStaff(prev => prev.map(s => s.id === selectedStaff.id ? updatedStaff : s));
      toast.success(`${staffData.name} updated successfully`);
    } else {
      updatedStaff = {
        id: Date.now().toString(),
        name: staffData.name || '',
        role: staffData.role || '',
        experience: staffData.experience || '',
        phone: staffData.phone || '',
        joinDate: joinDate,
        status: 'Active',
        salary: salaryAmount,
        salaryDuration: staffData.salaryDuration || 'monthly',
        workingDaysPerWeek: Number(staffData.workingDaysPerWeek) || 6,
        pendingSalary: calculatePendingSalary({ salary: salaryAmount, joinDate } as Staff),
        totalPaid: 0,
        lastSalaryDate: joinDate,
        nextSalaryDate: calculateNextSalaryDate({ joinDate, salaryDuration: staffData.salaryDuration || 'monthly' } as Staff)
      };

      setStaff(prev => [...prev, updatedStaff]);
      toast.success(`${staffData.name} added to staff`);
    }

    // Local save first
    await saveToLocal('staff', updatedStaff);

    // Close modal immediately
    setShowStaffForm(false);
    setSelectedStaff(null);

    // Background sync
    syncToFirebase('staff', updatedStaff);
  };

  // Handle delete staff
  const handleDeleteStaff = async (staffMember: Staff) => {
    if (confirm(`Delete ${staffMember.name} from staff?`)) {
      setStaff(prev => prev.filter(s => s.id !== staffMember.id));

      // Local delete first
      await deleteFromLocal('staff', staffMember.id);

      // Background delete from Firebase
      deleteDoc(doc(db, 'staff', staffMember.id)).catch(console.error);

      toast.success(`${staffMember.name} deleted`);
    }
  };

  // Handle pay salary
  const handlePaySalary = async (staffMember: Staff, paymentData: any) => {
    const paymentDate = new Date().toISOString().split('T')[0];
    const period = formatPeriod(staffMember);

    let updatedStaff: Staff | null = null;

    // Update staff in state
    setStaff(prev => prev.map(s => {
      if (s.id === staffMember.id) {
        const newPending = Math.max(0, s.pendingSalary - paymentData.amount);
        const newTotalPaid = s.totalPaid + paymentData.amount;
        updatedStaff = {
          ...s,
          pendingSalary: newPending,
          totalPaid: newTotalPaid,
          lastSalaryDate: paymentDate,
          nextSalaryDate: calculateNextSalaryDate({ ...s, lastSalaryDate: paymentDate })
        };
        return updatedStaff;
      }
      return s;
    }));

    if (!updatedStaff) return;

    // Create new payment
    const newPayment: SalaryPayment = {
      id: Date.now().toString(),
      staffId: staffMember.id,
      staffName: staffMember.name,
      amount: paymentData.amount,
      date: paymentDate,
      period,
      periodType: staffMember.salaryDuration,
      status: 'paid',
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes,
      startDate: paymentDate,
      endDate: paymentDate
    };

    // Update payments state
    setSalaryPayments(prev => [...prev, newPayment]);

    // Save to local storage
    await Promise.all([
      saveToLocal('staff', updatedStaff),
      saveToLocal('salaryPayments', newPayment)
    ]);

    // Close modal
    setShowPaySalary(null);

    // Background sync
    syncToFirebase('staff', updatedStaff);
    syncToFirebase('salaryPayments', newPayment);

    toast.success(`Salary paid for ${period} - $${paymentData.amount}`);
  };

  // Handle mark attendance
  const handleMarkAttendance = async (staffMember: Staff, attData: { date: string; status: string; notes: string }) => {
    const newAtt: Attendance = {
      id: Date.now().toString(),
      staffId: staffMember.id,
      date: attData.date,
      status: attData.status as 'present' | 'absent' | 'leave',
      notes: attData.notes
    };

    // Update state
    setAttendance(prev => [...prev, newAtt]);

    // Save to local storage
    await saveToLocal('attendance', newAtt);

    // Close modal
    setShowAttendanceModal(null);

    // Background sync
    syncToFirebase('attendance', newAtt);

    toast.success(`Attendance marked for ${staffMember.name}`);
  };

  // Stats calculations
  const totalStaff = staff.length;
  const activeStaff = staff.filter(s => s.status === 'Active').length;
  const totalPendingSalary = staff.reduce((sum, s) => sum + s.pendingSalary, 0);
  const totalPaidSalary = staff.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalMonthlyEquivalent = staff.reduce((sum, s) => {
    let monthlyEquivalent = s.salary;
    switch (s.salaryDuration) {
      case 'daily':
        monthlyEquivalent = s.salary * (s.workingDaysPerWeek || 6) * 4.33;
        break;
      case 'weekly':
        monthlyEquivalent = s.salary * 4.33;
        break;
    }
    return sum + monthlyEquivalent;
  }, 0);

  const salaryByDuration = {
    daily: staff.filter(s => s.salaryDuration === 'daily').reduce((sum, s) => sum + s.pendingSalary, 0),
    weekly: staff.filter(s => s.salaryDuration === 'weekly').reduce((sum, s) => sum + s.pendingSalary, 0),
    monthly: staff.filter(s => s.salaryDuration === 'monthly').reduce((sum, s) => sum + s.pendingSalary, 0)
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header with Sync button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Staff Management</h1>
          {/* <p className="text-muted-foreground text-sm md:text-base">
            Total: {totalStaff} staff • Active: {activeStaff} • Monthly Budget: ${totalMonthlyEquivalent.toFixed(2)}
          </p> */}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={() => handleSync(true)}
            variant="outline"
            disabled={isSyncing}
            className="gap-2 w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync with Firebase'}
          </Button>
          <Button
            onClick={() => {
              setSelectedStaff(null);
              setIsEditing(false);
              setShowStaffForm(true);
            }}
            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add New Staff
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl md:text-2xl font-bold text-blue-700">{totalStaff}</div>
              <div className="text-xs md:text-sm text-blue-600 font-medium">Total Staff</div>
            </div>
            <UserCog className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl md:text-2xl font-bold text-green-700">${totalPendingSalary.toFixed(2)}</div>
              <div className="text-xs md:text-sm text-green-600 font-medium">Pending Salary</div>
            </div>
            <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl md:text-2xl font-bold text-purple-700">${totalPaidSalary.toFixed(2)}</div>
              <div className="text-xs md:text-sm text-purple-600 font-medium">Total Paid</div>
            </div>
            <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl md:text-2xl font-bold text-yellow-700">{activeStaff}</div>
              <div className="text-xs md:text-sm text-yellow-600 font-medium">Active Staff</div>
            </div>
            <Briefcase className="w-6 h-6 md:w-8 md:h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Pending Salary by Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-red-200">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base md:text-lg font-bold text-red-700">${salaryByDuration.daily.toFixed(2)}</div>
                <div className="text-xs md:text-sm text-red-600">Daily Salary Pending</div>
              </div>
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base md:text-lg font-bold text-orange-700">${salaryByDuration.weekly.toFixed(2)}</div>
                <div className="text-xs md:text-sm text-orange-600">Weekly Salary Pending</div>
              </div>
              <CalendarDays className="w-6 h-6 md:w-8 md:h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base md:text-lg font-bold text-green-700">${salaryByDuration.monthly.toFixed(2)}</div>
                <div className="text-xs md:text-sm text-green-600">Monthly Salary Pending</div>
              </div>
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setSelectedRole('all');
              setSelectedStatus('all');
              setSelectedDuration('all');
            }}
            className="w-full sm:w-auto"
          >
            Clear Filters
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              className="border rounded-md px-2 py-1.5 text-sm w-32 md:w-40"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              {roles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              className="border rounded-md px-2 py-1.5 text-sm w-32 md:w-40"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Duration Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              className="border rounded-md px-2 py-1.5 text-sm w-32 md:w-40"
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
            >
              <option value="all">All Durations</option>
              {durations.map(duration => (
                <option key={duration} value={duration}>{duration.charAt(0).toUpperCase() + duration.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Staff Cards */}
      {filteredStaff.length === 0 ? (
        <div className="text-center py-8 md:py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <UserCog className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No staff members found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staffMember) => (
            <Card
              key={staffMember.id}
              className="hover:shadow-lg transition-shadow cursor-pointer group border-border/50"
              onDoubleClick={() => setShowStaffDetails(staffMember)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <UserCog className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-base md:text-lg truncate">{staffMember.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Briefcase className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-sm text-blue-600 font-medium truncate">{staffMember.role}</span>
                        </div>
                      </div>
                      <Badge className={
                        staffMember.status === 'Active' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                          staffMember.status === 'On Leave' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' :
                            'bg-red-100 text-red-800 hover:bg-red-100'
                      }>
                        {staffMember.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{staffMember.phone}</span>
                      </div>

                      {/* Salary Info */}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="font-medium">${staffMember.salary}</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {staffMember.salaryDuration}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-xs mt-2">
                          <span className="text-muted-foreground">Pending:</span>
                          <span className={`font-medium ${staffMember.pendingSalary > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${staffMember.pendingSalary.toFixed(2)}
                          </span>
                        </div>

                        {staffMember.nextSalaryDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="truncate">Next: {new Date(staffMember.nextSalaryDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStaff(staffMember);
                          setIsEditing(true);
                          setShowStaffForm(true);
                        }}
                        className="gap-1 h-8 text-xs px-2"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPaySalary(staffMember);
                        }}
                        className="gap-1 h-8 text-xs px-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                        disabled={staffMember.pendingSalary <= 0}
                      >
                        <DollarSign className="w-3 h-3" />
                        Pay Salary
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAttendanceModal(staffMember);
                        }}
                        className="gap-1 h-8 text-xs px-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Calendar className="w-3 h-3" />
                        Attendance
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStaff(staffMember);
                        }}
                        className="gap-1 h-8 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Salary Payments */}
      {salaryPayments.length > 0 && (
        <div className="bg-white rounded-lg border p-3 md:p-4">
          <h3 className="font-semibold mb-3">Recent Salary Payments</h3>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 md:px-3">Staff</th>
                  <th className="text-left py-2 px-2 md:px-3">Amount</th>
                  <th className="text-left py-2 px-2 md:px-3">Period</th>
                  <th className="text-left py-2 px-2 md:px-3">Date</th>
                  <th className="text-left py-2 px-2 md:px-3">Method</th>
                  <th className="text-left py-2 px-2 md:px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {salaryPayments
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map(payment => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 md:px-3 truncate max-w-[120px]">{payment.staffName}</td>
                      <td className="py-2 px-2 md:px-3 font-medium">${payment.amount}</td>
                      <td className="py-2 px-2 md:px-3 truncate max-w-[100px]">{payment.period}</td>
                      <td className="py-2 px-2 md:px-3 whitespace-nowrap">{new Date(payment.date).toLocaleDateString()}</td>
                      <td className="py-2 px-2 md:px-3">{payment.paymentMethod}</td>
                      <td className="py-2 px-2 md:px-3">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                          Paid
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <StaffFormModal
        open={showStaffForm}
        onClose={() => {
          setShowStaffForm(false);
          setSelectedStaff(null);
        }}
        onSubmit={handleStaffSubmit}
        staff={selectedStaff}
        isEditing={isEditing}
      />

      <StaffDetailsModal
        open={!!showStaffDetails}
        onClose={() => setShowStaffDetails(null)}
        staff={showStaffDetails}
        salaryPayments={salaryPayments.filter(p => p.staffId === showStaffDetails?.id)}
        attendance={attendance.filter(a => a.staffId === showStaffDetails?.id)}
        onEdit={() => {
          if (showStaffDetails) {
            setSelectedStaff(showStaffDetails);
            setIsEditing(true);
            setShowStaffForm(true);
            setShowStaffDetails(null);
          }
        }}
        onDelete={handleDeleteStaff}
        onPaySalary={() => {
          if (showStaffDetails) {
            setShowPaySalary(showStaffDetails);
            setShowStaffDetails(null);
          }
        }}
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
        existingAttendance={attendance}
        onSubmit={handleMarkAttendance}
      />
    </div>
  );
}