'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Users,
  RefreshCw,
  Eye,
  CreditCard,
  FileText,
  Plus,
  Clock
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
import { Patient, QueueItem, Bill, Transaction } from '@/types';
import { toast } from 'sonner';
import PatientFormModal from '@/components/modals/PatientFormModal';
import PatientDetailsModal from '@/components/modals/PatientDetailsModal';
import { useData } from '@/context/DataContext';
import { format, parseISO } from 'date-fns';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OperatorPatients() {
  const {
    patients: contextPatients,
    queue: contextQueue,
    bills: contextBills,
    transactions: contextTransactions,
    sales: contextSales,
    loading: contextLoading,
    deleteLocal,
    updateLocal,
    refreshCollection,
    deletePatientWithAllRecords,
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
    transactions: Transaction[];
    preReceiveTotal: number;
  }>({ queueHistory: [], bills: [], transactions: [], preReceiveTotal: 0 });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const patientsPerPage = 10;

  // Calculate pre-receive total for a patient
  const getPatientPreReceiveTotal = useCallback((patientId: string, patientNumber: string, patientName: string) => {
    const preReceiveTransactions = (contextTransactions || []).filter(t =>
      t.type === 'pre_receive' &&
      (t.patientId === patientId || t.patientNumber === patientNumber || t.patientName === patientName)
    );
    return preReceiveTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [contextTransactions]);

  // Comprehensive delete function for patient with all records
  // const deletePatientWithAllRecords = async (patient: Patient): Promise<boolean> => {
  //   console.log(`[deletePatientWithAllRecords] Deleting patient: ${patient.name}`);
  //   console.log(`[deletePatientWithAllRecords] Patient ID: ${patient.id}`);
  //   console.log(`[deletePatientWithAllRecords] Patient Number: ${patient.patientNumber}`);

  //   try {
  //     // Import Firebase and dbManager
  //     const { dbManager } = await import('@/lib/indexedDB');
  //     const { db } = await import('@/lib/firebase');
  //     const { deleteDoc, doc } = await import('firebase/firestore');

  //     // Fetch directly from IndexedDB
  //     const allQueueItems = await dbManager.getFromLocal('queue') || [];
  //     const allBills = await dbManager.getFromLocal('bills') || [];
  //     const allTransactions = await dbManager.getFromLocal('transactions') || [];

  //     // CRITICAL: Match by ALL possible fields
  //     const patientQueueItems = allQueueItems.filter((q: any) => {
  //       const matchById = q.patientId === patient.id;
  //       const matchByNumber = q.patientNumber === patient.patientNumber;
  //       const matchByName = q.patientName === patient.name;
  //       return matchById || matchByNumber || matchByName;
  //     });

  //     const patientBills = allBills.filter((b: any) => {
  //       const matchById = b.patientId === patient.id;
  //       const matchByNumber = b.patientNumber === patient.patientNumber;
  //       return matchById || matchByNumber;
  //     });

  //     const patientTransactions = allTransactions.filter((t: any) => {
  //       const matchById = t.patientId === patient.id;
  //       const matchByNumber = t.patientNumber === patient.patientNumber;
  //       const matchByName = t.patientName === patient.name;
  //       return matchById || matchByNumber || matchByName;
  //     });

  //     console.log(`[deletePatientWithAllRecords] Found: 
  //     - ${patientQueueItems.length} queue items
  //     - ${patientBills.length} bills
  //     - ${patientTransactions.length} transactions`);

  //     // Delete all queue items (Local + Firebase)
  //     for (const item of patientQueueItems) {
  //       try {
  //         // Local delete
  //         await deleteLocal('queue', item.id);
  //         console.log(`✅ Deleted queue locally: ${item.id}`);

  //         // Direct Firebase delete
  //         try {
  //           await deleteDoc(doc(db, 'queue', item.id));
  //           console.log(`✅ Deleted queue from Firebase: ${item.id}`);
  //         } catch (firebaseErr) {
  //           console.log(`Firebase delete failed for ${item.id}:`, firebaseErr);
  //         }
  //       } catch (err) {
  //         console.error(`Failed to delete queue ${item.id}:`, err);
  //       }
  //     }

  //     // Delete all bills (Local + Firebase)
  //     for (const bill of patientBills) {
  //       try {
  //         await deleteLocal('bills', bill.id);
  //         console.log(`✅ Deleted bill locally: ${bill.id}`);

  //         try {
  //           await deleteDoc(doc(db, 'bills', bill.id));
  //           console.log(`✅ Deleted bill from Firebase: ${bill.id}`);
  //         } catch (firebaseErr) {
  //           console.log(`Firebase delete failed for bill ${bill.id}:`, firebaseErr);
  //         }
  //       } catch (err) {
  //         console.error(`Failed to delete bill ${bill.id}:`, err);
  //       }
  //     }

  //     // Delete all transactions (Local + Firebase)
  //     for (const txn of patientTransactions) {
  //       try {
  //         await deleteLocal('transactions', txn.id);
  //         console.log(`✅ Deleted transaction locally: ${txn.id}`);

  //         try {
  //           await deleteDoc(doc(db, 'transactions', txn.id));
  //           console.log(`✅ Deleted transaction from Firebase: ${txn.id}`);
  //         } catch (firebaseErr) {
  //           console.log(`Firebase delete failed for transaction ${txn.id}:`, firebaseErr);
  //         }
  //       } catch (err) {
  //         console.error(`Failed to delete transaction ${txn.id}:`, err);
  //       }
  //     }

  //     // Delete patient (Local + Firebase)
  //     await deleteLocal('patients', patient.id);
  //     console.log(`✅ Deleted patient locally: ${patient.id}`);

  //     try {
  //       await deleteDoc(doc(db, 'patients', patient.id));
  //       console.log(`✅ Deleted patient from Firebase: ${patient.id}`);
  //     } catch (firebaseErr) {
  //       console.log(`Firebase delete failed for patient:`, firebaseErr);
  //     }

  //     // Force refresh collections
  //     await refreshCollection('queue');
  //     await refreshCollection('bills');
  //     await refreshCollection('transactions');
  //     await refreshCollection('patients');

  //     toast.success(`${patient.name} and all associated records deleted successfully from local and cloud`);
  //     return true;

  //   } catch (error) {
  //     console.error('[deletePatientWithAllRecords] Error:', error);
  //     toast.error(`Failed to delete ${patient.name}. Please try again.`);
  //     return false;
  //   }
  // };

  // const deletePatientWithAllRecords = async (
  //   patient: Patient,
  //   setFilteredPatients: React.Dispatch<React.SetStateAction<Patient[]>>
  // ): Promise<boolean> => {
  //   console.log(`[deletePatientWithAllRecords] Deleting patient: ${patient.name}`);
  //   console.log(`[deletePatientWithAllRecords] Patient ID: ${patient.id}`);
  //   console.log(`[deletePatientWithAllRecords] Patient Number: ${patient.patientNumber}`);

  //   try {
  //     const { dbManager } = await import('@/lib/indexedDB');
  //     const { db } = await import('@/lib/firebase');
  //     const { deleteDoc, doc } = await import('firebase/firestore');

  //     // ============================================
  //     // STEP 1: Fetch all data from IndexedDB
  //     // ============================================
  //     const allQueueItems = await dbManager.getFromLocal('queue') || [];
  //     const allBills = await dbManager.getFromLocal('bills') || [];
  //     const allTransactions = await dbManager.getFromLocal('transactions') || [];

  //     // Match by ALL possible fields
  //     const patientQueueItems = allQueueItems.filter((q: any) => {
  //       return q.patientId === patient.id ||
  //         q.patientNumber === patient.patientNumber ||
  //         q.patientName === patient.name;
  //     });

  //     const patientBills = allBills.filter((b: any) => {
  //       return b.patientId === patient.id || b.patientNumber === patient.patientNumber;
  //     });

  //     const patientTransactions = allTransactions.filter((t: any) => {
  //       return t.patientId === patient.id ||
  //         t.patientNumber === patient.patientNumber ||
  //         t.patientName === patient.name;
  //     });

  //     console.log(`Found: ${patientQueueItems.length} queue, ${patientBills.length} bills, ${patientTransactions.length} transactions`);

  //     // ============================================
  //     // STEP 2: FIRST DELETE FROM LOCAL (IndexedDB)
  //     // ============================================
  //     console.log('🗑️ Deleting from LOCAL first...');

  //     // Delete queue items locally
  //     for (const item of patientQueueItems) {
  //       try {
  //         await deleteLocal('queue', item.id);
  //         console.log(`✅ Deleted queue locally: ${item.id}`);
  //       } catch (err) {
  //         console.error(`Failed to delete queue ${item.id}:`, err);
  //       }
  //     }

  //     // Delete bills locally
  //     for (const bill of patientBills) {
  //       try {
  //         await deleteLocal('bills', bill.id);
  //         console.log(`✅ Deleted bill locally: ${bill.id}`);
  //       } catch (err) {
  //         console.error(`Failed to delete bill ${bill.id}:`, err);
  //       }
  //     }

  //     // Delete transactions locally
  //     for (const txn of patientTransactions) {
  //       try {
  //         await deleteLocal('transactions', txn.id);
  //         console.log(`✅ Deleted transaction locally: ${txn.id}`);
  //       } catch (err) {
  //         console.error(`Failed to delete transaction ${txn.id}:`, err);
  //       }
  //     }

  //     // Delete patient locally
  //     await deleteLocal('patients', patient.id);
  //     console.log(`✅ Deleted patient locally: ${patient.id}`);

  //     setFilteredPatients(prev => prev.filter(p => p.id !== patient.id));

  //     // ============================================
  //     // STEP 3: SAVE DELETED RECORDS FOR SYNC (if Firebase fails)
  //     // ============================================
  //     const pendingDeletes = {
  //       patientId: patient.id,
  //       patientNumber: patient.patientNumber,
  //       patientName: patient.name,
  //       queueItems: patientQueueItems.map(i => i.id),
  //       bills: patientBills.map(b => b.id),
  //       transactions: patientTransactions.map(t => t.id),
  //       timestamp: new Date().toISOString()
  //     };

  //     localStorage.setItem('pending_firebase_deletes', JSON.stringify(pendingDeletes));
  //     console.log('📝 Saved pending deletes for Firebase sync');

  //     // ============================================
  //     // STEP 4: THEN DELETE FROM FIREBASE (if online)
  //     // ============================================
  //     let firebaseSuccess = true;
  //     const failedDeletes: string[] = [];

  //     console.log('☁️ Deleting from Firebase...');

  //     // Delete queue items from Firebase
  //     for (const item of patientQueueItems) {
  //       try {
  //         await deleteDoc(doc(db, 'queue', item.id));
  //         console.log(`✅ Deleted queue from Firebase: ${item.id}`);
  //       } catch (firebaseErr) {
  //         console.log(`❌ Firebase delete failed for queue ${item.id}:`, firebaseErr);
  //         failedDeletes.push(`queue/${item.id}`);
  //         firebaseSuccess = false;
  //       }
  //     }

  //     // Delete bills from Firebase
  //     for (const bill of patientBills) {
  //       try {
  //         await deleteDoc(doc(db, 'bills', bill.id));
  //         console.log(`✅ Deleted bill from Firebase: ${bill.id}`);
  //       } catch (firebaseErr) {
  //         console.log(`❌ Firebase delete failed for bill ${bill.id}:`, firebaseErr);
  //         failedDeletes.push(`bills/${bill.id}`);
  //         firebaseSuccess = false;
  //       }
  //     }

  //     // Delete transactions from Firebase
  //     for (const txn of patientTransactions) {
  //       try {
  //         await deleteDoc(doc(db, 'transactions', txn.id));
  //         console.log(`✅ Deleted transaction from Firebase: ${txn.id}`);
  //       } catch (firebaseErr) {
  //         console.log(`❌ Firebase delete failed for transaction ${txn.id}:`, firebaseErr);
  //         failedDeletes.push(`transactions/${txn.id}`);
  //         firebaseSuccess = false;
  //       }
  //     }

  //     // Delete patient from Firebase
  //     try {
  //       await deleteDoc(doc(db, 'patients', patient.id));
  //       console.log(`✅ Deleted patient from Firebase: ${patient.id}`);
  //     } catch (firebaseErr) {
  //       console.log(`❌ Firebase delete failed for patient:`, firebaseErr);
  //       failedDeletes.push(`patients/${patient.id}`);
  //       firebaseSuccess = false;
  //     }

  //     // ============================================
  //     // STEP 5: UPDATE SYNC STATUS
  //     // ============================================
  //     if (!firebaseSuccess) {
  //       console.log(`⚠️ Some Firebase deletes failed. ${failedDeletes.length} items pending sync.`);
  //       localStorage.setItem('pending_firebase_deletes', JSON.stringify({
  //         ...pendingDeletes,
  //         failedItems: failedDeletes,
  //         retryCount: 1
  //       }));
  //       toast.warning(`${patient.name} deleted locally. Some cloud deletes pending. Will sync when online.`);
  //     } else {
  //       // All Firebase deletes successful
  //       localStorage.removeItem('pending_firebase_deletes');
  //       console.log('✅ All Firebase deletes successful!');
  //       toast.success(`${patient.name} deleted successfully from local and cloud`);
  //     }

  //     return true;

  //   } catch (error) {
  //     console.error('[deletePatientWithAllRecords] Error:', error);
  //     toast.error(`Failed to delete ${patient.name}. Please try again.`);
  //     return false;
  //   }
  // };

  // Function to sync pending Firebase deletes when back online
  const syncPendingFirebaseDeletes = async () => {
    const pendingData = localStorage.getItem('pending_firebase_deletes');
    if (!pendingData) return;

    try {
      const pending = JSON.parse(pendingData);
      console.log('🔄 Syncing pending Firebase deletes...', pending);

      const { db } = await import('@/lib/firebase');
      const { deleteDoc, doc } = await import('firebase/firestore');

      let allSuccess = true;

      // Try to delete patient again
      try {
        await deleteDoc(doc(db, 'patients', pending.patientId));
        console.log(`✅ Synced patient delete: ${pending.patientId}`);
      } catch (err) {
        console.log(`Patient already deleted or not found: ${pending.patientId}`);
      }

      // Try to delete queue items
      for (const queueId of pending.queueItems) {
        try {
          await deleteDoc(doc(db, 'queue', queueId));
          console.log(`✅ Synced queue delete: ${queueId}`);
        } catch (err) {
          console.log(`Queue item ${queueId} already deleted`);
        }
      }

      // Try to delete bills
      for (const billId of pending.bills) {
        try {
          await deleteDoc(doc(db, 'bills', billId));
          console.log(`✅ Synced bill delete: ${billId}`);
        } catch (err) {
          console.log(`Bill ${billId} already deleted`);
        }
      }

      // Try to delete transactions
      for (const txnId of pending.transactions) {
        try {
          await deleteDoc(doc(db, 'transactions', txnId));
          console.log(`✅ Synced transaction delete: ${txnId}`);
        } catch (err) {
          console.log(`Transaction ${txnId} already deleted`);
        }
      }

      // Clear pending deletes after successful sync
      localStorage.removeItem('pending_firebase_deletes');
      toast.success('Pending cloud deletes synced successfully');

    } catch (error) {
      console.error('Sync pending deletes error:', error);
    }
  };

  // Add online event listener
  useEffect(() => {
    const handleOnline = () => {
      console.log('🟢 Back online! Syncing pending deletes...');
      syncPendingFirebaseDeletes();
    };

    window.addEventListener('online', handleOnline);

    // Also check on component mount
    syncPendingFirebaseDeletes();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Filter patients when search or filters change or context data updates
  useEffect(() => {
    try {
      if (!contextPatients || !Array.isArray(contextPatients)) {
        setFilteredPatients([]);
        return;
      }

      let result = [...contextPatients].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.registrationDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.registrationDate || 0).getTime();
        return dateB - dateA;
      });

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

  useEffect(() => {
    const deletedPatients = JSON.parse(localStorage.getItem('deleted_patients') || '[]');
    if (deletedPatients.length > 0) {
      setFilteredPatients(prev => prev.filter(p => !deletedPatients.includes(p.id)));
    }
  }, [contextPatients]);


  // Derived Stats
  const stats = useMemo(() => {
    try {
      if (!contextPatients || !Array.isArray(contextPatients)) {
        return {
          total: 0,
          active: 0,
          pendingBalance: 0,
          totalVisits: 0,
          totalRevenue: 0,
          creditPatients: 0,
          totalPreReceive: 0
        };
      }

      const treatmentRevenue = (contextBills || []).reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
      const salesRevenue = (contextSales || []).reduce((sum, s) => sum + (Number(s.total || s.amount || s.totalPrice || 0)), 0);
      const preReceiveTotal = (contextTransactions || []).filter(t => t.type === 'pre_receive').reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRevenue = treatmentRevenue + salesRevenue;
      console.log(contextTransactions)

      return {
        total: contextPatients.length,
        active: contextPatients.filter(p => p && p.isActive !== false).length,
        pendingBalance: contextPatients.reduce((sum, p) => sum + (p?.pendingBalance || 0), 0),
        totalVisits: (contextQueue || []).filter(q => q.status === 'completed').length,
        totalRevenue: totalRevenue,
        creditPatients: contextPatients.filter(p => p && (p.pendingBalance || 0) < 0).length,
        totalPreReceive: preReceiveTotal
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        total: 0,
        active: 0,
        pendingBalance: 0,
        totalVisits: 0,
        totalRevenue: 0,
        creditPatients: 0,
        totalPreReceive: 0
      };
    }
  }, [contextPatients, contextBills, contextQueue, contextSales, contextTransactions]);

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

  // Handle delete patient with all records
  // const handleDeletePatient = async (patient: Patient) => {
  //   if (!patient || !patient.id) return;

  //   const queueCount = (contextQueue || []).filter(q => q.patientId === patient.id || q.patientNumber === patient.patientNumber).length;
  //   const billsCount = (contextBills || []).filter(b => b.patientId === patient.id || b.patientNumber === patient.patientNumber).length;
  //   const transactionCount = (contextTransactions || []).filter(t => t.patientId === patient.id || t.patientName === patient.name).length;

  //   const confirmMessage =
  //     `⚠️⚠️⚠️ PERMANENT DELETE WARNING ⚠️⚠️⚠️\n\n` +
  //     `Deleting "${patient.name}" (${patient.patientNumber}) will permanently remove:\n\n` +
  //     `📊 Patient Record: ${patient.name}\n` +
  //     `📅 Queue History: ${queueCount} record(s)\n` +
  //     `💰 Bills: ${billsCount} bill(s)\n` +
  //     `💳 Transactions: ${transactionCount} transaction(s)\n` +
  //     `💵 Pre-receive Payments: Any pre-receive payments will also be deleted\n\n` +
  //     `This will also delete from CLOUD (Firebase) and cannot be recovered!\n\n` +
  //     `Are you absolutely sure you want to delete this patient?`;

  //   if (!confirm(confirmMessage)) return;

  //   try {
  //     setSyncingPatientId(patient.id);
  //      const success = await deletePatientWithAllRecords(patient, setFilteredPatients);

  //     if (success) {
  //       if (selectedPatient?.id === patient.id) {
  //         setShowPatientDetails(false);
  //         setSelectedPatient(null);
  //       }
  //       toast.success(`${patient.name} and all records deleted from local and cloud`);
  //     }
  //   } catch (error) {
  //     console.error('Error deleting patient:', error);
  //     toast.error('Failed to delete patient');
  //   } finally {
  //     setSyncingPatientId(null);
  //   }
  // };

  const handleDeletePatient = async (patient: Patient) => {
    if (!patient || !patient.id) return;

    const queueCount = (contextQueue || []).filter(q => q.patientId === patient.id || q.patientNumber === patient.patientNumber).length;
    const billsCount = (contextBills || []).filter(b => b.patientId === patient.id || b.patientNumber === patient.patientNumber).length;
    const transactionCount = (contextTransactions || []).filter(t => t.patientId === patient.id || t.patientName === patient.name).length;

    const confirmMessage = `⚠️⚠️⚠️ PERMANENT DELETE WARNING ⚠️⚠️⚠️\n\n` +
      `Deleting "${patient.name}" (${patient.patientNumber}) will permanently remove:\n\n` +
      `📊 Patient Record: ${patient.name}\n` +
      `📅 Queue History: ${queueCount} record(s)\n` +
      `💰 Bills: ${billsCount} bill(s)\n` +
      `💳 Transactions: ${transactionCount} transaction(s)\n\n` +
      `Are you absolutely sure?`;

    if (!confirm(confirmMessage)) return;

    try {
      setSyncingPatientId(patient.id);

      // ✅ USE DATACONTEXT's delete function - NOT your custom one
      const success = await deletePatientWithAllRecords(patient);

      if (success) {
        if (selectedPatient?.id === patient.id) {
          setShowPatientDetails(false);
          setSelectedPatient(null);
        }
        // UI automatically updates because DataContext handles state
        toast.success(`${patient.name} and all records deleted`);
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error('Failed to delete patient');
    } finally {
      setSyncingPatientId(null);
    }
  };

  // Handle add to waiting queue
  const handleAddToWaiting = async (patient: Patient) => {
    if (!patient) return;

    try {
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

      await updateLocal('queue', queueItemData);
      toast.success(`${patient.name} added to Waiting (Token #${nextToken})`);
    } catch (error) {
      console.error('Error adding to waiting:', error);
      toast.error('Failed to add to waiting queue');
    }
  };

  // Handle save patient
  const handleSavePatient = (patientData: any) => {
    setSelectedPatient(null);
    setShowPatientForm(false);
  };

  // Handle view patient details
  const handleViewPatientDetails = (patient: Patient) => {
    if (!patient) return;

    setSelectedPatient(patient);

    try {
      const queueHistory = (contextQueue || [])
        .filter(item => item && (item.patientId === patient.id || item.patientNumber === patient.patientNumber))
        .sort((a, b) => new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime());

      const patientBills = (contextBills || [])
        .filter(bill => bill && (bill.patientId === patient.id || bill.patientNumber === patient.patientNumber))
        .sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());

      const patientTransactions = (contextTransactions || [])
        .filter(t => t && (t.patientId === patient.id || t.patientNumber === patient.patientNumber || t.patientName === patient.name))
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      const preReceiveTotal = patientTransactions
        .filter(t => t.type === 'pre_receive')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      setSelectedPatientHistory({
        queueHistory,
        bills: patientBills,
        transactions: patientTransactions,
        preReceiveTotal
      });
      setShowPatientDetails(true);
    } catch (error) {
      console.error('Error loading patient history:', error);
      setSelectedPatientHistory({ queueHistory: [], bills: [], transactions: [], preReceiveTotal: 0 });
      setShowPatientDetails(true);
    }
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
        'Address', 'Registration Date', 'Total Visits', 'Total Paid',
        'Pending Balance', 'Pre-receive Total', 'Status'
      ];

      const csvData = filteredPatients.map(p => {
        if (!p) return [];
        const preReceiveTotal = getPatientPreReceiveTotal(p.id, p.patientNumber, p.name);
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
          preReceiveTotal,
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
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return 'N/A';
    }
  };

  // Format currency
  const formatCurrency = (amount: number | undefined): string => {
    const numAmount = amount || 0;
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
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
    if (!patient) return <span className="text-gray-400">--</span>;

    const visits = patient.totalVisits || 0;

    if (visits === 0) {
      return <span className="text-gray-400 text-sm">--</span>;
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
  const PatientRow = React.memo(({ patient, onEdit, onDelete, onViewDetails, onAddToWaiting, isSyncing }: {
    patient: Patient;
    onEdit: (p: Patient) => void;
    onDelete: (p: Patient) => void;
    onViewDetails: (p: Patient) => void;
    onAddToWaiting: (p: Patient) => void;
    isSyncing: boolean;
  }) => {
    if (!patient) return null;
    const preReceiveTotal = getPatientPreReceiveTotal(patient.id, patient.patientNumber, patient.name);

    return (
      <TableRow key={patient.id} className="hover:bg-gray-50 transition-colors">
        <TableCell className="font-medium text-blue-600">
          {patient.patientNumber || '--'}
        </TableCell>
        <TableCell>
          <div className="font-semibold">{patient.name || '--'}</div>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <div className="text-sm">{patient.phone || '--'}</div>
        </TableCell>
        <TableCell className="hidden md:table-cell text-sm">
          {patient.age ? `${patient.age}y` : '--'} / {patient.gender || '--'}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {getVisitsBadge(patient)}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            {getPendingDisplay(patient)}
            {preReceiveTotal > 0 && (
              <Badge variant="outline" className="text-[10px] border-purple-200 bg-purple-50 text-purple-700">
                Pre-receive: {formatCurrency(preReceiveTotal)}
              </Badge>
            )}
            {getStatusBadge(patient)}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => onViewDetails(patient)}
              title="View Details"
              disabled={isSyncing}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 gap-1"
              onClick={() => onAddToWaiting(patient)}
              title="Add to Waiting"
              disabled={isSyncing}
            >
              <Clock className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => onEdit(patient)}
              title="Edit Patient"
              disabled={isSyncing}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(patient)}
              title="Delete Patient"
              disabled={isSyncing}
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
            onClick={syncPendingFirebaseDeletes}
            className="gap-2"
            title="Sync pending cloud deletes"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Pending
          </Button>
          {localStorage.getItem('pending_firebase_deletes') && (
            <Badge variant="destructive" className="ml-2">
              Pending Sync
            </Badge>
          )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div> */}

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingBalance)}</div>
              <div className="text-sm text-gray-600">Pending Balance</div>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        {/* <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{stats.totalVisits}</div>
              <div className="text-sm text-gray-600">Total Visits</div>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </div> */}

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalPreReceive)}</div>
              <div className="text-sm text-gray-600">Pre-receive Total</div>
            </div>
            <CreditCard className="w-8 h-8 text-purple-500" />
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  <TableHead className="font-semibold hidden sm:table-cell">Contact</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Age/Gender</TableHead>
                  <TableHead className="font-semibold hidden lg:table-cell">Visits</TableHead>
                  <TableHead className="font-semibold">Balance Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
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
                      onAddToWaiting={handleAddToWaiting}
                      isSyncing={syncingPatientId === patient.id}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredPatients.length > 0 && (
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
          )}
        </>
      )}

      {/* Patient Form Modal */}
      {showPatientForm && (
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
      )}

      {/* Patient Details Modal */}
      {showPatientDetails && selectedPatient && (
        <PatientDetailsModal
          patient={selectedPatient}
          patientInfo={selectedPatient}
          queueHistory={selectedPatientHistory.queueHistory}
          bills={selectedPatientHistory.bills}
          transactions={selectedPatientHistory.transactions}
          preReceiveTotal={selectedPatientHistory.preReceiveTotal}
          onClose={() => {
            setShowPatientDetails(false);
            setSelectedPatient(null);
          }}
          onEdit={() => {
            setShowPatientDetails(false);
            setShowPatientForm(true);
          }}
          onDelete={() => handleDeletePatient(selectedPatient)}
        />
      )}
    </div>
  );
}