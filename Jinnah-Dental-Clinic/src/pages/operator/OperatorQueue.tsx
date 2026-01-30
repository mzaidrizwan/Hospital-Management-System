'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Activity, CheckCircle, Search, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import QueueSection from '@/components/dashboard/QueueSection';
import { QueueItem, Patient } from '@/types';
import { toast } from 'sonner';
import PatientFormModal from '@/components/modals/PatientFormModal';
import PaymentModal from '@/components/modals/PaymentModal';
import PatientDetailsModal from '@/components/modals/PatientDetailsModal';
import TreatmentModal from '@/components/modals/TreatmentModal';
import {
  addPatient,
  getAllPatients,
  updatePatient,
  getPatientByNumber,
  updatePatientWithStats
} from '@/services/patientService';
import {
  addQueueItem,
  getAllQueueItems,
  updateQueueItem,
  deleteQueueItem
} from '@/services/queueService';
import { addBill, getPatientBills } from '@/services/billingService';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { useData } from '@/context/DataContext';

const doctors = ['Dr. Smith', 'Dr. Johnson', 'Dr. Wilson', 'Dr. Brown', 'Dr. Taylor'];

export default function OperatorQueue() {
  const [queueData, setQueueData] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);

  // Updated state structure for payment modal
  const [showPaymentModal, setShowPaymentModal] = useState<{
    queueItem: QueueItem;
    patientData: Patient;
    patientBills: any[];
  } | null>(null);

  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDetails, setShowPatientDetails] = useState<QueueItem | null>(null);
  const [modalMode, setModalMode] = useState<'patient' | 'walk-in'>('walk-in');
  const [loading, setLoading] = useState({ queue: true, patients: true });
  const [saving, setSaving] = useState(false);
  const [selectedPatientData, setSelectedPatientData] = useState<Patient | null>(null);

  // Treatment Modal states
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [selectedQueueItemForTreatment, setSelectedQueueItemForTreatment] = useState<QueueItem | null>(null);

  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const { queue: contextQueue, patients: contextPatients, loading: contextLoading } = useData();

  // Sync with context for instant load
  useEffect(() => {
    if (contextQueue && contextQueue.length > 0) {
      const start = startOfDay(parseISO(dateRange.startDate));
      const end = endOfDay(parseISO(dateRange.endDate));
      const filtered = contextQueue.filter(item => {
        const itemDate = parseISO(item.checkInTime);
        return itemDate >= start && itemDate <= end;
      });
      setQueueData(filtered);
      setLoading(prev => ({ ...prev, queue: false }));
    }
  }, [contextQueue, dateRange]);

  useEffect(() => {
    if (contextPatients && contextPatients.length > 0) {
      setPatients(contextPatients);
      setLoading(prev => ({ ...prev, patients: false }));
    }
  }, [contextPatients]);

  // Initial Fetch remains as background revalidation
  useEffect(() => {
    // If context is still loading, don't show custom loading screens unless necessary
    if (!contextLoading) {
      setLoading({ queue: false, patients: false });
    }
  }, [contextLoading]);

  // Memoized data fetching for background sync
  const fetchAllData = useCallback(async () => {
    // Non-blocking background fetch
    fetchQueueData();
    fetchPatientsData();
  }, [dateRange]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const fetchQueueData = async () => {
    try {
      const data = await getAllQueueItems();
      const start = startOfDay(parseISO(dateRange.startDate));
      const end = endOfDay(parseISO(dateRange.endDate));
      const filtered = data.filter(item => {
        const itemDate = parseISO(item.checkInTime);
        return itemDate >= start && itemDate <= end;
      });
      setQueueData(filtered);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(prev => ({ ...prev, queue: false }));
    }
  };

  const fetchPatientsData = async () => {
    try {
      const data = await getAllPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(prev => ({ ...prev, patients: false }));
    }
  };

  const getPatientDataForQueueItem = useCallback(async (queueItem: QueueItem) => {
    try {
      const cachedPatient = patients.find(p =>
        p.patientNumber === queueItem.patientNumber ||
        p.id === queueItem.patientId
      );
      if (cachedPatient) return cachedPatient;

      let patientRef;
      if (queueItem.patientId) {
        patientRef = doc(db, 'patients', queueItem.patientId);
      } else if (queueItem.patientNumber) {
        return await getPatientByNumber(queueItem.patientNumber);
      }

      if (patientRef) {
        const patientDoc = await getDoc(patientRef);
        if (patientDoc.exists()) {
          const patientData = { id: patientDoc.id, ...patientDoc.data() } as Patient;
          setPatients(prev => {
            const exists = prev.some(p => p.id === patientData.id);
            if (!exists) return [...prev, patientData];
            return prev;
          });
          return patientData;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching patient data:', error);
      return null;
    }
  }, [patients]);

  // Fetch bills for a patient
  const getBillsForPatient = async (patientId: string) => {
    try {
      if (!patientId) return [];
      return await getPatientBills(patientId);
    } catch (error) {
      console.error('Error fetching bills:', error);
      return [];
    }
  };

  const filteredQueueData = queueData.filter(item => {
    const matchesSearch =
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.patientPhone?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (item.patientNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesDoctor = selectedDoctor === 'all' || item.doctor === selectedDoctor;
    return matchesSearch && matchesDoctor;
  });

  const waitingPatients = filteredQueueData.filter(p => p.status === 'waiting');
  const inTreatmentPatients = filteredQueueData.filter(p => p.status === 'in_treatment');
  const completedPatients = filteredQueueData.filter(p => p.status === 'completed');

  // ------------------ Open Payment Modal with Bills ------------------
  const handleOpenPaymentModal = async (item: QueueItem) => {
    try {
      const patientData = await getPatientDataForQueueItem(item);
      if (!patientData) {
        toast.error('Patient data not found');
        return;
      }

      const patientBills = await getBillsForPatient(patientData.id);

      setShowPaymentModal({
        queueItem: item,
        patientData,
        patientBills
      });
    } catch (error) {
      console.error('Error opening payment modal:', error);
      toast.error('Failed to load payment details');
    }
  };

  // ------------------ Payment Handler ------------------
  const handleAddPayment = async (queueItem: QueueItem, paymentData: any) => {
    const toastId = toast.loading('Processing payment...');

    try {
      const patientData = await getPatientDataForQueueItem(queueItem);
      if (!patientData) {
        toast.error('Patient data not found', { id: toastId });
        return;
      }

      const newPayment = paymentData.amount || 0;
      const currentPaid = queueItem.amountPaid || 0;
      const totalPaid = currentPaid + newPayment;

      const totalDue =
        (queueItem.fee || 0) + (queueItem.previousPending || 0);

      let paymentStatus: 'pending' | 'partial' | 'paid';

      if (totalPaid >= totalDue) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'pending';
      }

      // 1️⃣ Update queue item payment info
      const updateData = {
        amountPaid: totalPaid,
        paymentStatus,
        discount: paymentData.discount || 0,
        notes:
          (queueItem.notes || '') +
          `\nPayment: ${newPayment} (${paymentData.paymentMethod})`
      };

      await updateQueueItem(queueItem.id, updateData);

      // 2️⃣ Create bill (single source of truth)
      await addBill({
        billNumber: `BILL-${Date.now()}`,
        patientId: patientData.id,
        patientNumber: patientData.patientNumber,
        patientName: queueItem.patientName,
        treatment: queueItem.treatment || '',
        totalAmount: queueItem.fee || 0,
        amountPaid: newPayment,
        discount: paymentData.discount || 0,
        paymentMethod: paymentData.paymentMethod || 'cash',
        paymentStatus,
        createdDate: new Date().toISOString(),
        notes: paymentData.notes || '',
        queueItemId: queueItem.id
      });

      // 3️⃣ Update local queue UI only
      setQueueData(prev =>
        prev.map(item =>
          item.id === queueItem.id
            ? { ...item, ...updateData }
            : item
        )
      );

      // 4️⃣ 🔑 FINAL & MOST IMPORTANT STEP
      await updatePatientWithStats(patientData.id);

      toast.success(
        `Payment of $${newPayment.toFixed(2)} processed successfully`,
        { id: toastId }
      );

      setShowPaymentModal(null);

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to process payment', { id: toastId });
    }
  };


  // ------------------ Walk-in & Edit Patient Handler ------------------
  const handleWalkInPatient = async (patientData: any) => {
    const toastId = toast.loading('Processing patient...');
    try {
      let isNewPatient = false;
      let patientId = patientData.id;

      if (patientData.isExistingPatient && patientData.isEditing) {
        // Update existing patient
        await updatePatient(patientData.id, {
          name: patientData.name,
          phone: patientData.phone,
          age: patientData.age ? Number(patientData.age) : 0,
          gender: patientData.gender || '',
          address: patientData.address || '',
          pendingBalance: Number(patientData.pendingBalance || 0)
        });

        setPatients(prev => prev.map(p =>
          p.id === patientData.id ? {
            ...p,
            name: patientData.name,
            phone: patientData.phone,
            age: patientData.age ? Number(patientData.age) : 0,
            gender: patientData.gender || '',
            address: patientData.address || '',
            pendingBalance: Number(patientData.pendingBalance || 0)
          } : p
        ));

        toast.success(`Patient ${patientData.name} updated successfully`, { id: toastId });
        setShowPatientModal(false);
        return;
      }

      // New patient logic
      if (!patientData.isExistingPatient) {
        const exists = patients.some(p => p.patientNumber === patientData.patientNumber);
        if (exists) {
          toast.error(`Patient Number ${patientData.patientNumber} already exists!`, { id: toastId });
          return;
        }

        const newPatientData = {
          patientNumber: patientData.patientNumber,
          name: patientData.name || '',
          phone: patientData.phone || '',
          age: patientData.age ? Number(patientData.age) : 0,
          gender: patientData.gender || '',
          address: patientData.address || '',
          pendingBalance: Number(patientData.openingBalance || 0),
          totalPaid: 0,
          totalVisits: 0,
          createdAt: new Date().toISOString()
        };

        patientId = await addPatient(newPatientData);
        isNewPatient = true;
        setPatients(prev => [{ id: patientId, ...newPatientData }, ...prev]);
      }

      // Add to queue
      const todayQueue = queueData.filter(item => {
        const d = parseISO(item.checkInTime);
        const today = new Date();
        return d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear();
      });

      const nextToken = todayQueue.length > 0
        ? Math.max(...todayQueue.map(q => q.tokenNumber)) + 1
        : 1;

      const currentPatient = isNewPatient
        ? null
        : patients.find(p => p.patientNumber === patientData.patientNumber);

      const queueItemData = {
        patientId: patientId,
        patientNumber: patientData.patientNumber,
        patientName: patientData.name || '',
        patientPhone: patientData.phone || '',
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
        previousPending: currentPatient?.pendingBalance || Number(patientData.openingBalance || 0)
      };

      const newQueueId = await addQueueItem(queueItemData);
      setQueueData(prev => [...prev, { id: newQueueId, ...queueItemData }]);

      toast.success(
        isNewPatient
          ? `New patient ${patientData.name} added (Token #${nextToken})`
          : `Patient ${patientData.name} added to queue (Token #${nextToken})`,
        { id: toastId }
      );

      setShowPatientModal(false);
    } catch (error) {
      console.error('Walk-in error:', error);
      toast.error('Failed to process', { id: toastId });
    }
  };

  // ------------------ Save New Patient (non-walk-in) ------------------
  const handleSavePatient = async (patientData: any) => {
    const toastId = toast.loading('Saving patient...');
    try {
      const newPatientData = {
        name: patientData.name || '',
        phone: patientData.phone || '',
        age: patientData.age ? Number(patientData.age) : 0,
        gender: patientData.gender || '',
        address: patientData.address || '',
        pendingBalance: Number(patientData.openingBalance || 0),
        totalPaid: 0,
        totalVisits: 0,
        createdAt: new Date().toISOString()
      };

      if (patientData.id && modalMode === 'walk-in') {
        await updatePatient(patientData.id, newPatientData);
        setPatients(prev => prev.map(p => p.id === patientData.id ? { ...p, ...newPatientData } : p));
      } else {
        const newPatientId = await addPatient(newPatientData);
        setPatients(prev => [{ id: newPatientId, ...newPatientData }, ...prev]);
      }

      toast.success(`${patientData.name} saved`, { id: toastId });
      setShowPatientModal(false);
    } catch (error) {
      console.error('Error saving patient:', error);
      toast.error('Failed to save patient', { id: toastId });
    }
  };

  // ------------------ Queue Actions ------------------

  const speakAnnouncement = (tokenNumber: number | string) => {
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const speak = () => {
      const voices = synth.getVoices();

      // 🔥 STRONG female voice detection
      const femaleVoice =
        voices.find(v => v.name === 'Google UK English Female') ||
        voices.find(v => v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.name.toLowerCase().includes('zira')) ||
        voices.find(v => v.name.toLowerCase().includes('susan')) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang === 'en-US');

      const text =
        `Token number ${tokenNumber}. please proceed to the treatment room.`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = femaleVoice || null;
      utterance.lang = 'en-GB';   // smoother female tone
      utterance.rate = 0.9;
      utterance.pitch = 1.15;     // female feel
      utterance.volume = 1;       // 🔊 FULL

      synth.cancel();
      synth.speak(utterance);
    };

    // 🔧 Chrome voice-load fix
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = speak;
    } else {
      speak();
    }
  };


  const handleQueueAction = async (item: QueueItem, action: string) => {
    const toastId = toast.loading('Updating queue...');
    try {
      const now = new Date().toISOString();

      if (action === 'start-treatment') {
        const updateData = {
          status: 'in_treatment' as const,
          treatmentStartTime: now
        };

        await updateQueueItem(item.id, updateData);

        setQueueData(prev =>
          prev.map(p => p.id === item.id ? { ...p, ...updateData } : p)
        );

        // 🔊 ANNOUNCE TOKEN ONLY
        speakAnnouncement(item.tokenNumber);

        toast.success(`Token ${item.tokenNumber} moved to treatment`, { id: toastId });
      } else if (action === 'complete') {

        const patientData = await getPatientDataForQueueItem(item);
        if (patientData) {
          setSelectedPatientData(patientData);
          setSelectedQueueItemForTreatment(item);
          setShowTreatmentModal(true);
        } else {
          toast.error('Could not load patient data', { id: toastId });
        }

      } else if (action === 'back-to-waiting') {

        const updateData = {
          status: 'waiting' as const,
          treatmentStartTime: null,
          treatment: '',
          fee: 0,
          doctor: ''
        };

        await updateQueueItem(item.id, updateData);
        setQueueData(prev =>
          prev.map(p => p.id === item.id ? { ...p, ...updateData } : p)
        );

        toast.info(`${item.patientName} moved back to waiting`, { id: toastId });

      } else if (action === 'back-to-treatment') {

        const updateData = {
          status: 'in_treatment' as const,
          treatmentEndTime: null
        };

        await updateQueueItem(item.id, updateData);
        setQueueData(prev =>
          prev.map(p => p.id === item.id ? { ...p, ...updateData } : p)
        );

        toast.info(`${item.patientName} moved back to treatment`, { id: toastId });

      } else if (action === 'cancel') {

        const reason = prompt('Cancellation reason:') || 'Patient request';

        await updateQueueItem(item.id, {
          status: 'cancelled' as const,
          cancelledAt: now,
          notes: `${item.notes || ''}\nCancelled: ${reason}`
        });

        setQueueData(prev =>
          prev.map(p =>
            p.id === item.id
              ? { ...p, status: 'cancelled', cancelledAt: now, notes: `${p.notes || ''}\nCancelled: ${reason}` }
              : p
          )
        );

        toast.info(`Cancelled treatment for ${item.patientName}`, { id: toastId });

      } else if (action === 'edit') {

        const patient = patients.find(pt => pt.patientNumber === item.patientNumber);
        if (patient) {
          setSelectedPatient(patient);
          setModalMode('walk-in');
          setShowPatientModal(true);
        } else {
          toast.error('Patient record not found', { id: toastId });
        }

      } else if (action === 'delete') {

        if (confirm(`Remove ${item.patientName} from queue?`)) {
          await deleteQueueItem(item.id);
          setQueueData(prev => prev.filter(q => q.id !== item.id));
          toast.success(`Removed ${item.patientName} from queue`, { id: toastId });
        }
      }

    } catch (error) {
      console.error('Queue action error:', error);
      toast.error('Failed to update queue', { id: toastId });
    }
  };



  // const handleQueueAction = async (item: QueueItem, action: string) => {
  //   const toastId = toast.loading('Updating queue...');
  //   try {
  //     const now = new Date().toISOString();

  //     if (action === 'start-treatment') {
  //       const updateData = { status: 'in_treatment' as const, treatmentStartTime: now };
  //       await updateQueueItem(item.id, updateData);
  //       setQueueData(prev => prev.map(p => p.id === item.id ? { ...p, ...updateData } : p));
  //       toast.success(`${item.patientName} moved to treatment`, { id: toastId });
  //     } else if (action === 'complete') {
  //       const patientData = await getPatientDataForQueueItem(item);
  //       if (patientData) {
  //         setSelectedPatientData(patientData);
  //         setSelectedQueueItemForTreatment(item);
  //         setShowTreatmentModal(true);
  //       } else {
  //         toast.error('Could not load patient data', { id: toastId });
  //       }
  //     } else if (action === 'back-to-waiting') {
  //       const updateData = {
  //         status: 'waiting' as const,
  //         treatmentStartTime: null,
  //         treatment: '',
  //         fee: 0,
  //         doctor: ''
  //       };
  //       await updateQueueItem(item.id, updateData);
  //       setQueueData(prev => prev.map(p => p.id === item.id ? { ...p, ...updateData } : p));
  //       toast.info(`${item.patientName} moved back to waiting`, { id: toastId });
  //     } else if (action === 'back-to-treatment') {
  //       const updateData = { status: 'in_treatment' as const, treatmentEndTime: null };
  //       await updateQueueItem(item.id, updateData);
  //       setQueueData(prev => prev.map(p => p.id === item.id ? { ...p, ...updateData } : p));
  //       toast.info(`${item.patientName} moved back to treatment`, { id: toastId });
  //     } else if (action === 'cancel') {
  //       const reason = prompt('Cancellation reason:') || 'Patient request';
  //       await updateQueueItem(item.id, {
  //         status: 'cancelled' as const,
  //         cancelledAt: now,
  //         notes: `${item.notes || ''}\nCancelled: ${reason}`
  //       });
  //       setQueueData(prev => prev.map(p =>
  //         p.id === item.id ? { ...p, status: 'cancelled', cancelledAt: now, notes: `${p.notes || ''}\nCancelled: ${reason}` } : p
  //       ));
  //       toast.info(`Cancelled treatment for ${item.patientName}`, { id: toastId });
  //     } else if (action === 'edit') {
  //       const patient = patients.find(pt => pt.patientNumber === item.patientNumber);
  //       if (patient) {
  //         setSelectedPatient(patient);
  //         setModalMode('walk-in');
  //         setShowPatientModal(true);
  //       } else {
  //         toast.error("Patient record not found", { id: toastId });
  //       }
  //     } else if (action === 'delete') {
  //       if (confirm(`Remove ${item.patientName} from queue?`)) {
  //         await deleteQueueItem(item.id);
  //         setQueueData(prev => prev.filter(q => q.id !== item.id));
  //         toast.success(`Removed ${item.patientName} from queue`, { id: toastId });
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Queue action error:', error);
  //     toast.error('Failed to update queue', { id: toastId });
  //   }
  // };

  // Date handlers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const setToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDateRange({ startDate: today, endDate: today });
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    setDateRange({ startDate: dateStr, endDate: dateStr });
  };

  // OperatorQueue.tsx - handleTreatmentSubmit function ko update karein
  const handleTreatmentSubmit = async (data: {
    treatment: string;
    fee: number;
    doctor: string;
  }) => {
    if (!selectedQueueItemForTreatment || !selectedPatientData) return;

    const toastId = toast.loading('Completing treatment...');

    try {
      const now = new Date().toISOString();

      const updateData = {
        status: 'completed' as const,
        treatmentEndTime: now,
        treatment: data.treatment,
        fee: data.fee,
        doctor: data.doctor
      };

      // 1️⃣ Update queue item
      await updateQueueItem(selectedQueueItemForTreatment.id, updateData);

      const updatedItem = {
        ...selectedQueueItemForTreatment,
        ...updateData
      };

      setQueueData(prev =>
        prev.map(p =>
          p.id === selectedQueueItemForTreatment.id ? updatedItem : p
        )
      );

      // 2️⃣ Update patient basic stats (quick UI sync)
      const newPendingBalance =
        (selectedPatientData.pendingBalance || 0) + data.fee;
      const newTotalVisits =
        (selectedPatientData.totalVisits || 0) + 1;

      await updatePatient(selectedPatientData.id, {
        pendingBalance: newPendingBalance,
        totalVisits: newTotalVisits,
        lastVisit: now
      });

      setPatients(prev =>
        prev.map(p =>
          p.id === selectedPatientData.id
            ? {
              ...p,
              pendingBalance: newPendingBalance,
              totalVisits: newTotalVisits,
              lastVisit: now
            }
            : p
        )
      );

      toast.success(`Treatment completed for ${updatedItem.patientName}`, {
        id: toastId
      });

      // 3️⃣ 🔑 IMPORTANT: Delay before opening payment modal
      setTimeout(async () => {
        const updatedPatientData =
          await getPatientDataForQueueItem(updatedItem);

        if (updatedPatientData) {
          const patientBills = await getBillsForPatient(
            updatedPatientData.id
          );

          setShowPaymentModal({
            queueItem: updatedItem,
            patientData: updatedPatientData,
            patientBills
          });
        }
      }, 800);

      // 4️⃣ Close treatment modal
      setShowTreatmentModal(false);
      setSelectedQueueItemForTreatment(null);
      setSelectedPatientData(null);

      // 5️⃣ 🔑 FINAL SYNC — authoritative recalculation
      await updatePatientWithStats(selectedPatientData.id);

    } catch (error) {
      console.error('Error completing treatment:', error);
      toast.error('Failed to complete treatment', { id: toastId });
    }
  };


  const handleOpenTreatmentModal = async (item: QueueItem) => {
    try {
      setSelectedQueueItemForTreatment(item);
      const patientData = await getPatientDataForQueueItem(item);
      if (patientData) {
        setSelectedPatientData(patientData);
        setShowTreatmentModal(true);
      } else {
        toast.error('Patient data not found');
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Failed to load patient data');
    }
  };

  const handleOpenPatientDetails = async (item: QueueItem) => {
    try {
      const patientData = await getPatientDataForQueueItem(item);
      if (patientData) {
        setSelectedPatientData(patientData);
        setShowPatientDetails(item);
      } else {
        toast.error('Patient data not found');
      }
    } catch (error) {
      console.error('Error fetching patient details:', error);
      toast.error('Failed to load patient details');
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground">
            Total in Queue: {queueData.length} • Saved Patients: {patients.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setModalMode('walk-in');
              setSelectedPatient(null);
              setShowPatientModal(true);
            }}
            className="gap-2 bg-green-600 hover:bg-green-700"
            disabled={loading.queue || loading.patients}
          >
            <Users className="w-4 h-4" />
            Walk-in Patient
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Date Range Filter</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <Input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
              className="w-full"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">End Date</label>
            <Input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
              className="w-full"
            />
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={setYesterday} size="sm">
              Yesterday
            </Button>
            <Button variant="default" onClick={setToday} size="sm">
              Today
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-500 mt-2">
          Showing data from {format(parseISO(dateRange.startDate), 'MMM dd, yyyy')} to {format(parseISO(dateRange.endDate), 'MMM dd, yyyy')}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-700">{waitingPatients.length}</div>
              <div className="text-sm text-blue-600 font-medium">Waiting</div>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-yellow-700">{inTreatmentPatients.length}</div>
              <div className="text-sm text-yellow-600 font-medium">In Treatment</div>
            </div>
            <Activity className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-700">{completedPatients.length}</div>
              <div className="text-sm text-green-600 font-medium">Completed</div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or number..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => {
            setSearchTerm('');
            setSelectedDoctor('all');
          }}>
            Clear Filters
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">All Doctors</option>
            {doctors.map(doctor => (
              <option key={doctor} value={doctor}>{doctor}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue Sections */}
      {loading.queue ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading queue data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <QueueSection
            title="Waiting"
            items={waitingPatients}
            status="waiting"
            onAction={handleQueueAction}
            onPayment={handleOpenPaymentModal}
            onDoubleClick={handleOpenPatientDetails}
            showPatientId={true}
          />
          <QueueSection
            title="In Treatment"
            items={inTreatmentPatients}
            status="in_treatment"
            onAction={handleQueueAction}
            onPayment={handleOpenPaymentModal}
            onDoubleClick={handleOpenPatientDetails}
            showBackButton={true}
            showPatientId={true}
          />
          <QueueSection
            title="Completed"
            items={completedPatients}
            status="completed"
            onAction={handleQueueAction}
            onPayment={handleOpenPaymentModal}
            onDoubleClick={handleOpenPatientDetails}
            showBackButton={true}
            showPatientId={true}
          />
        </div>
      )}

      {/* Modals */}
      <PatientFormModal
        open={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSubmit={modalMode === 'walk-in' ? handleWalkInPatient : handleSavePatient}
        patient={selectedPatient}
        isEditing={!!selectedPatient}
        doctors={doctors}
        mode={modalMode}
        existingPatients={patients}
        title={modalMode === 'walk-in'
          ? (selectedPatient ? 'Edit & Add to Queue' : 'Jinnah Dental Clinic - Add Patient')
          : (selectedPatient ? 'Edit Patient' : 'Save New Patient')}
        loading={loading.patients}
      />

      {showPaymentModal && showPaymentModal.queueItem && (
        <PaymentModal
          queueItem={showPaymentModal.queueItem}
          bills={showPaymentModal.patientBills}
          patientData={showPaymentModal.patientData}
          onClose={() => setShowPaymentModal(null)}
          onSubmit={handleAddPayment}
        />
      )}

      {showTreatmentModal && selectedQueueItemForTreatment && (
        <TreatmentModal
          open={showTreatmentModal}
          onClose={() => {
            setShowTreatmentModal(false);
            setSelectedQueueItemForTreatment(null);
            setSelectedPatientData(null);
          }}
          onSubmit={handleTreatmentSubmit}
          queueItem={selectedQueueItemForTreatment}
          doctors={doctors}
          patientData={selectedPatientData}
          patientHistory={{
            queueHistory: [],
            paymentHistory: [],
            bills: []
          }}
          patientInfo={{
            pendingBalance: selectedPatientData?.pendingBalance || 0
          }}
        />
      )}

      {showPatientDetails && selectedPatientData && (
        <PatientDetailsModal
          patient={showPatientDetails}
          patientInfo={selectedPatientData}
          onClose={() => {
            setShowPatientDetails(null);
            setSelectedPatientData(null);
          }}
          onEdit={() => {
            setSelectedPatient(selectedPatientData);
            setModalMode('walk-in');
            setShowPatientModal(true);
            setShowPatientDetails(null);
            setSelectedPatientData(null);
          }}
          onDelete={async () => {
            if (confirm(`Remove ${showPatientDetails.patientName} from queue?`)) {
              try {
                await deleteQueueItem(showPatientDetails.id);
                setQueueData(prev => prev.filter(q => q.id !== showPatientDetails.id));
                toast.success(`Removed ${showPatientDetails.patientName} from queue`);
                setShowPatientDetails(null);
                setSelectedPatientData(null);
              } catch (error) {
                console.error('Error deleting queue item:', error);
                toast.error('Failed to remove from queue');
              }
            }
          }}
        />
      )}
    </div>
  );
}