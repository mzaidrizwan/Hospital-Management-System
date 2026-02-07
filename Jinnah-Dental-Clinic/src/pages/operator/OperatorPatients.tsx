'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Search,
  Edit,
  Trash2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Download,
  Phone,
  Calendar,
  MapPin,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  RefreshCw,
  Eye,
  CreditCard,
  FileText,
  Plus,
  Clock // Added for 'Add to Waiting' button
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Patient, QueueItem, Bill } from '@/types';
import { toast } from 'sonner';
import PatientFormModal from '@/components/modals/PatientFormModal';
import PatientDetailsModal from '@/components/modals/PatientDetailsModal';
import { deleteFromLocal } from '@/services/indexedDbUtils';
import { smartSync, smartDelete } from '@/services/syncService';
import { formatCurrency } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { format, parseISO } from 'date-fns';

export default function OperatorPatients() {
  const {
    patients: contextPatients,
    queue: contextQueue,
    bills: contextBills,
    loading: contextLoading,
    deleteLocal,
    updateLocal
  } = useData();

  // State Management
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingPatientId, setSyncingPatientId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Modals
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<{
    queueHistory: QueueItem[];
    bills: Bill[];
  }>({ queueHistory: [], bills: [] });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 10;

  // Filter patients when search or filters change or context data updates
  useEffect(() => {
    try {
      if (!contextPatients || !Array.isArray(contextPatients)) {
        setFilteredPatients([]);
        return;
      }

      let result = [...contextPatients];

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        result = result.filter(patient => {
          if (!patient) return false;

          const nameMatch = patient.name?.toLowerCase().includes(term) || false;
          const phoneMatch = patient.phone?.toLowerCase().includes(term) || false;
          const patientNumberMatch = patient.patientNumber?.toLowerCase().includes(term) || false;
          const emailMatch = patient.email?.toLowerCase().includes(term) || false;
          const addressMatch = patient.address?.toLowerCase().includes(term) || false;
          return nameMatch || phoneMatch || patientNumberMatch || emailMatch || addressMatch;
        });
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          result = result.filter(p => p && p.isActive !== false);
        } else if (statusFilter === 'inactive') {
          result = result.filter(p => p && p.isActive === false);
        }
      }

      // Balance filter
      if (balanceFilter !== 'all') {
        if (balanceFilter === 'zero') {
          result = result.filter(p => p && (p.pendingBalance || 0) === 0);
        } else if (balanceFilter === 'pending') {
          result = result.filter(p => p && (p.pendingBalance || 0) > 0);
        } else if (balanceFilter === 'credit') {
          result = result.filter(p => p && (p.pendingBalance || 0) < 0);
        }
      }

      // Date filter (last visit)
      if (dateFilter !== 'all') {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

        if (dateFilter === 'recent') {
          result = result.filter(p => {
            if (!p || !p.lastVisit) return false;
            try {
              const lastVisitDate = new Date(p.lastVisit);
              return !isNaN(lastVisitDate.getTime()) && lastVisitDate >= thirtyDaysAgo;
            } catch (error) {
              return false;
            }
          });
        } else if (dateFilter === 'old') {
          result = result.filter(p => {
            if (!p || !p.lastVisit) return true;
            try {
              const lastVisitDate = new Date(p.lastVisit);
              return !isNaN(lastVisitDate.getTime()) && lastVisitDate < thirtyDaysAgo;
            } catch (error) {
              return false;
            }
          });
        }
      }

      setFilteredPatients(result);
      setCurrentPage(1);
      setHasError(false);
    } catch (error) {
      console.error('Error filtering patients:', error);
      setFilteredPatients([]);
      setHasError(true);
    }
  }, [contextPatients, searchTerm, statusFilter, balanceFilter, dateFilter]);

  // Derived Stats
  const stats = React.useMemo(() => {
    try {
      if (!contextPatients || !Array.isArray(contextPatients)) {
        return {
          total: 0,
          active: 0,
          pendingBalance: 0,
          totalVisits: 0,
          totalRevenue: 0,
          creditPatients: 0
        };
      }

      return {
        total: contextPatients.length,
        active: contextPatients.filter(p => p && p.isActive !== false).length,
        pendingBalance: contextPatients.reduce((sum, p) => sum + (p?.pendingBalance || 0), 0),
        totalVisits: contextPatients.reduce((sum, p) => sum + (p?.totalVisits || 0), 0),
        totalRevenue: contextPatients.reduce((sum, p) => sum + (p?.totalPaid || 0), 0),
        creditPatients: contextPatients.filter(p => p && (p.pendingBalance || 0) < 0).length
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        total: 0,
        active: 0,
        pendingBalance: 0,
        totalVisits: 0,
        totalRevenue: 0,
        creditPatients: 0
      };
    }
  }, [contextPatients]);

  // Handle search (controlled by searchTerm state)
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Handle add new patient
  const handleAddPatient = () => {
    setSelectedPatient(null);
    setShowPatientForm(true);
  };

  // Handle edit patient
  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientForm(true);
  };

  // Handle delete patient
  const handleDeletePatient = async (patient: Patient) => {
    if (!patient || !patient.id) return;

    if (!confirm(`Are you sure you want to delete patient ${patient.name} (${patient.patientNumber})?\nThis action cannot be undone.`)) {
      return;
    }

    try {
      // 1. Local-first delete (State + IndexedDB Updates UI instantly)
      await deleteLocal('patients', patient.id);

      // 2. Background Firebase delete (non-blocking)
      smartDelete('patients', patient.id).catch(err => {
        console.error('Background delete failed:', err);
      });

      toast.success(`Patient ${patient.name} removed successfully`);

      if (selectedPatient?.id === patient.id) {
        setShowPatientDetails(false);
        setSelectedPatient(null);
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error('Failed to delete patient');
    }
  };

  // Handle add to waiting queue
  const handleAddToWaiting = async (patient: Patient) => {
    if (!patient) return;

    try {
      // 1. Get today's queue to calculate next token
      const today = new Date();
      const todayString = today.toDateString();
      const todayQueueItems = (contextQueue || []).filter(item => {
        if (!item.checkInTime) return false;
        try {
          const d = parseISO(item.checkInTime);
          return d.toDateString() === todayString;
        } catch (e) {
          return false;
        }
      });

      const nextToken = todayQueueItems.length > 0
        ? Math.max(...todayQueueItems.map(q => q.tokenNumber)) + 1
        : 1;

      // 2. Create queue item
      const queueItemData = {
        id: `Q-${Date.now()}`,
        patientId: patient.id,
        patientNumber: patient.patientNumber,
        patientName: patient.name || '',
        patientPhone: patient.phone || '',
        tokenNumber: nextToken,
        status: 'waiting' as const,
        checkInTime: new Date().toISOString(),
        treatment: '',
        doctor: '',
        priority: 'normal',
        notes: '',
        fee: 0,
        paymentStatus: 'pending' as const,
        amountPaid: 0,
        previousPending: patient.pendingBalance || 0
      } as QueueItem;

      // 3. Save to local (State + IndexedDB)
      await updateLocal('queue', queueItemData);
      toast.success(`${patient.name} added to Waiting (Token #${nextToken})`);
    } catch (error) {
      console.error('Error adding to waiting:', error);
      toast.error('Failed to add to waiting queue');
    }
  };

  // Handle save patient
  const handleSavePatient = (patientData: any) => {
    // Note: PatientFormModal now handles updateLocal and smartSync internally
    // for immediate UI feedback and non-blocking submission.
    setSelectedPatient(null);
  };

  // Handle view patient details - derived from context
  const handleViewPatientDetails = (patient: Patient) => {
    if (!patient) return;

    setSelectedPatient(patient);

    try {
      // Filter history from context data
      const queueHistory = (contextQueue || [])
        .filter(item => item && item.patientNumber === patient.patientNumber)
        .sort((a, b) => new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime());

      const patientBills = (contextBills || [])
        .filter(bill => bill && bill.patientId === patient.patientNumber)
        .sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());

      setSelectedPatientHistory({
        queueHistory,
        bills: patientBills
      });
      setShowPatientDetails(true);
    } catch (error) {
      console.error('Error loading patient history:', error);
      setSelectedPatientHistory({ queueHistory: [], bills: [] });
      setShowPatientDetails(true);
    }
  };

  // Handle local recalculate (no cloud sync button needed)
  const handleRecalculateStats = async (patient: Patient) => {
    if (!patient) return;

    toast.info(`Recalculating ${patient.name} local stats...`);
    // Calculation logic stays local
    toast.success(`${patient.name} stats updated`);
  };

  // Handle export data
  const handleExportData = () => {
    try {
      if (!filteredPatients || filteredPatients.length === 0) {
        toast.error('No data to export');
        return;
      }

      const headers = [
        'Patient ID', 'Name', 'Phone', 'Email', 'Age', 'Gender',
        'Address', 'Registration Date', 'Total Visits',
        'Total Paid', 'Pending Balance', 'Status'
      ];

      const csvData = filteredPatients.map(p => {
        if (!p) return [];
        return [
          p.patientNumber || 'N/A',
          p.name || 'N/A',
          p.phone || 'N/A',
          p.email || '',
          p.age || 0,
          p.gender || 'N/A',
          p.address || '',
          safeFormatDate(p.registrationDate) || 'N/A',
          p.totalVisits || 0,
          p.totalPaid || 0,
          p.pendingBalance || 0,
          p.isActive !== false ? 'Active' : 'Inactive'
        ];
      }).filter(row => row.length > 0);

      if (csvData.length === 0) {
        toast.error('No valid data to export');
        return;
      }

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setBalanceFilter('all');
    setDateFilter('all');
  };

  // Safe date formatting
  const safeFormatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';

    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          return 'N/A';
        }
        return format(date, 'MMM dd, yyyy');
      } catch {
        return 'N/A';
      }
    }
  };

  // Format currency
  const formatCurrency = (amount: number | undefined): string => {
    const numAmount = amount || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  // Get status badge
  const getStatusBadge = (patient: Patient) => {
    if (!patient) return null;

    if (patient.isActive === false) {
      return <Badge variant="destructive" className="text-xs">Inactive</Badge>;
    }

    const pending = patient.pendingBalance || 0;

    if (pending > 0) {
      return (
        <Badge variant="outline" className="border-orange-200 text-orange-800 bg-orange-50 text-xs">
          Payment Due
        </Badge>
      );
    } else if (pending < 0) {
      return (
        <Badge variant="outline" className="border-blue-200 text-blue-800 bg-blue-50 text-xs">
          Credit Available
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="border-green-200 text-green-800 bg-green-50 text-xs">
        Active
      </Badge>
    );
  };

  // Get pending amount display
  const getPendingDisplay = (patient: Patient) => {
    if (!patient) return <span className="text-gray-600 text-sm">--</span>;

    const pending = patient.pendingBalance || 0;

    if (pending === 0) {
      return <span className="text-gray-600 text-sm">--</span>;
    }

    const colorClass = pending > 0 ? 'text-orange-600' : 'text-blue-600';
    const prefix = pending < 0 ? '(Credit) ' : '';
    const absAmount = Math.abs(pending);

    return (
      <span className={`font-semibold text-sm ${colorClass}`}>
        {prefix}{formatCurrency(absAmount)}
      </span>
    );
  };

  // Get visits badge
  const getVisitsBadge = (patient: Patient) => {
    if (!patient) return <Badge variant="outline" className="bg-gray-50 text-xs">New</Badge>;

    const visits = patient.totalVisits || 0;

    if (visits === 0) {
      return <Badge variant="outline" className="bg-gray-50 text-xs">New</Badge>;
    }

    let variant: "secondary" | "default" | "outline" = "secondary";
    if (visits >= 10) variant = "default";

    return (
      <Badge variant={variant} className="text-xs">
        {visits} visit{visits !== 1 ? 's' : ''}
      </Badge>
    );
  };

  // Pagination calculations
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);

  // Memoized row component
  const PatientRow = React.memo(({ patient, onEdit, onDelete, onViewDetails, onRecalculate, onAddToWaiting }: {
    patient: Patient;
    onEdit: (p: Patient) => void;
    onDelete: (p: Patient) => void;
    onViewDetails: (p: Patient) => void;
    onRecalculate: (p: Patient) => void;
    onAddToWaiting: (p: Patient) => void;
  }) => {
    if (!patient) return null;

    return (
      <TableRow key={patient.id} className="hover:bg-gray-50 transition-colors">
        <TableCell className="font-medium text-blue-600">
          {patient.patientNumber || 'N/A'}
        </TableCell>
        <TableCell>
          <div className="font-semibold">{patient.name || 'Unnamed'}</div>
          <div className="text-xs text-gray-500">{patient.phone || 'No phone'}</div>
        </TableCell>
        <TableCell className="hidden md:table-cell text-sm">
          {patient.age ? `${patient.age}y` : '--'} / {patient.gender || '--'}
        </TableCell>
        <TableCell className="hidden lg:table-cell text-xs text-gray-500 max-w-[150px] truncate">
          {patient.address || '--'}
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="text-sm">{safeFormatDate(patient.lastVisit)}</div>
        </TableCell>
        <TableCell>
          {getVisitsBadge(patient)}
        </TableCell>
        <TableCell>
          {getPendingDisplay(patient)}
        </TableCell>
        <TableCell>
          {getStatusBadge(patient)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => onViewDetails(patient)}
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 gap-1"
              onClick={() => onAddToWaiting(patient)}
              title="Add to Waiting"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider"></span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => onEdit(patient)}
              title="Edit Patient"
            >
              <Edit className="w-4 h-4" />
            </Button>
            {/* <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => onRecalculate(patient)}
              title="Recalculate Stats"
            >
              <RefreshCw className="w-4 h-4" />
            </Button> */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(patient)}
              title="Delete Patient"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  });

  // Handle errors gracefully
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">There was an error loading patient data</p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Patient Management</h1>
          <p className="text-muted-foreground">
            Manage all patient records and track payments
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleExportData}
            className="gap-2"
            disabled={contextLoading}
          >
            <Download className="w-4 h-4" />
            Generate Report
          </Button>
          <Button
            onClick={handleAddPatient}
            className="gap-2"
            disabled={contextLoading}
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingBalance)}</div>
              <div className="text-sm text-gray-600">Pending Balance</div>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.totalVisits}</div>
              <div className="text-sm text-gray-600">Total Visits</div>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border rounded-lg p-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, ID, email..."
              className="pl-9"
              value={searchTerm}
              onChange={handleSearch}
              disabled={contextLoading}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={balanceFilter} onValueChange={setBalanceFilter}>
            <SelectTrigger className="w-[160px]">
              <CreditCard className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Balance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Balance</SelectItem>
              <SelectItem value="zero">Zero Balance</SelectItem>
              <SelectItem value="pending">Has Pending</SelectItem>
              <SelectItem value="credit">Has Credit</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Last Visit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Visits</SelectItem>
              <SelectItem value="recent">Recent (30 days)</SelectItem>
              <SelectItem value="old">Older (30+ days)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={contextLoading}
          >
            Clear Filters
          </Button>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Showing {filteredPatients.length} of {contextPatients?.length || 0} patients
            {searchTerm && ` • Search: "${searchTerm}"`}
          </div>
          <div className="text-sm text-gray-500">
            {stats.creditPatients} patient(s) with credit balance
          </div>
        </div>
      </div>

      {/* Loading State */}
      {contextLoading && (!contextPatients || contextPatients.length === 0) ? (
        <div className="flex flex-col justify-center items-center h-64 bg-white border rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <span className="text-gray-600">Loading patients...</span>
        </div>
      ) : (
        <>
          {/* Patients Table */}
          <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Patient ID</TableHead>
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Contact</TableHead>
                  <TableHead className="font-semibold">Age/Gender</TableHead>
                  <TableHead className="font-semibold">Visits</TableHead>
                  <TableHead className="font-semibold">Balance Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!currentPatients || currentPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="space-y-3">
                        <Users className="w-16 h-16 mx-auto text-gray-300" />
                        <p className="text-lg font-medium">No patients found</p>
                        <p className="text-sm text-gray-500">
                          {searchTerm || statusFilter !== 'all' || balanceFilter !== 'all'
                            ? 'Try changing your search or filters'
                            : 'Add your first patient to get started'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentPatients.map((patient) => (
                    <PatientRow
                      key={patient.id || Math.random().toString()}
                      patient={patient}
                      onEdit={handleEditPatient}
                      onDelete={handleDeletePatient}
                      onViewDetails={handleViewPatientDetails}
                      onRecalculate={handleRecalculateStats}
                      onAddToWaiting={handleAddToWaiting}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {
            filteredPatients.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border rounded-lg p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  Showing {indexOfFirstPatient + 1} to {Math.min(indexOfLastPatient, filteredPatients.length)} of {filteredPatients.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="h-8 w-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          }
        </>
      )
      }

      {/* Patient Form Modal */}
      {
        showPatientForm && (
          <PatientFormModal
            open={showPatientForm}
            onClose={() => {
              setShowPatientForm(false);
              setSelectedPatient(null);
            }}
            onSubmit={handleSavePatient}
            patient={selectedPatient}
            isEditing={!!selectedPatient}
            mode="patient"
            existingPatients={contextPatients}
            title={selectedPatient ? 'Edit Patient' : 'Add New Patient'}
            loading={saving}
          />
        )
      }

      {/* Patient Details Modal */}
      {
        showPatientDetails && selectedPatient && (
          <PatientDetailsModal
            patient={selectedPatient}
            patientInfo={selectedPatient}
            onClose={() => {
              setShowPatientDetails(false);
              setSelectedPatient(null);
            }}
            onEdit={() => {
              setShowPatientDetails(false);
              setShowPatientForm(true);
            }}
            onDelete={() => handleDeletePatient(selectedPatient)}
            queueHistory={selectedPatientHistory.queueHistory}
            bills={selectedPatientHistory.bills}
          />
        )
      }
    </div >
  );
}