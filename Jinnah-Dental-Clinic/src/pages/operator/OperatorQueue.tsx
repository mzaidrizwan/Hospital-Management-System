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
import { startOfDay, endOfDay, parseISO, format } from 'date-fns';
import { useData } from '@/context/DataContext';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';

// const doctors = ['Dr. Smith', 'Dr. Johnson', 'Dr. Wilson', 'Dr. Brown', 'Dr. Taylor'];

export default function OperatorQueue() {
  const {
    queue: contextQueue,
    patients: contextPatients,
    bills: contextBills,
    updateLocal,
    deleteLocal,
    loading: contextLoading,
    updateQueueItemOptimistic,
    licenseDaysLeft,
    staff
  } = useData();

  const isLicenseExpired = licenseDaysLeft <= 0;

  const { presentDoctors } = useAvailableDoctors();
  const availableDoctors = presentDoctors;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showPatientDetails, setShowPatientDetails] = useState<any>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'patient' | 'walk-in'>('walk-in');
  const [selectedPatientData, setSelectedPatientData] = useState<any>(null);
  const [selectedQueueItemForTreatment, setSelectedQueueItemForTreatment] = useState<any>(null);
  const [selectedPatientForPrint, setSelectedPatientForPrint] = useState<QueueItem | null>(null);

  const queueData = React.useMemo(() => {
    if (!contextQueue) return [];
    try {
      const start = startOfDay(parseISO(dateRange.startDate));
      const end = endOfDay(parseISO(dateRange.endDate));
      return contextQueue.filter(item => {
        if (!item.checkInTime) return false;
        const itemDate = parseISO(item.checkInTime);
        return itemDate >= start && itemDate <= end;
      });
    } catch (err) {
      console.warn('Date parsing error', err);
      return [];
    }
  }, [contextQueue, dateRange]);

  const patients = contextPatients || [];
  const loading = { queue: contextLoading, patients: contextLoading };

  const getPatientDataForQueueItem = useCallback((queueItem: QueueItem) => {
    try {
      return patients.find(p =>
        p.patientNumber === queueItem.patientNumber ||
        p.id === queueItem.patientId
      ) || null;
    } catch (error) {
      console.error('Error fetching patient data:', error);
      return null;
    }
  }, [patients]);

  const getBillsForPatient = (patientId: string) => {
    if (!patientId || !contextBills) return [];
    return contextBills.filter(b => b.patientId === patientId);
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

  const handleOpenPaymentModal = async (item: QueueItem) => {
    try {
      const patientData = getPatientDataForQueueItem(item);
      if (!patientData) {
        toast.error('Patient data not found');
        return;
      }

      const patientBills = getBillsForPatient(patientData.id);

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

  const handleDirectPrint = (item: QueueItem) => {
    try {
      // 1. Parse treatments
      const treatmentItems: { name: string; fee: number }[] = [];
      let treatmentString = item.treatment || '';

      // Try to parse "Treatment (Rs. 500), Treatment 2 (Rs. 1000)" format
      const parts = treatmentString.split(/,\s*(?![^(]*\))/);
      parts.forEach(part => {
        const match = part.match(/^(.*?)\s*\(Rs\.\s*([\d,]+)\)$/i);
        if (match) {
          treatmentItems.push({
            name: match[1].trim(),
            fee: parseFloat(match[2].replace(/,/g, ''))
          });
        } else if (part.trim()) {
          treatmentItems.push({
            name: part.trim(),
            fee: 0
          });
        }
      });

      // Fix fees if parsing missed them but total exists
      const parsedTotal = treatmentItems.reduce((sum, t) => sum + t.fee, 0);
      const itemFee = item.fee || 0;
      if (parsedTotal !== itemFee) {
        if (parsedTotal === 0 && treatmentItems.length > 0) {
          treatmentItems[0].fee = itemFee;
        } else if (treatmentItems.length === 0 && itemFee > 0) {
          treatmentItems.push({ name: 'General Treatment', fee: itemFee });
        }
      }

      // 2. Calculate Financials
      const patientData = getPatientDataForQueueItem(item);
      const currentPendingBalance = patientData?.pendingBalance || 0;

      const discount = item.discount || 0;
      const amountPaid = item.amountPaid || 0;
      const treatmentFee = itemFee;

      // Reverse calculate Previous Pending
      // Final Balance = Previous + Fee - Discount - Paid
      // Previous = Final Balance - Fee + Discount + Paid
      let previousPending = currentPendingBalance - treatmentFee + discount + amountPaid;
      if (previousPending < 0) previousPending = 0;

      const totalDueBeforeDiscount = previousPending + treatmentFee;
      const totalDueAfterDiscount = Math.max(0, totalDueBeforeDiscount - discount);
      const remainingAfterPayment = Math.max(0, totalDueAfterDiscount - amountPaid);

      // 3. Prepare Print Content
      const doctorName = staff.find(s => s.id === item.doctorId)?.name || item.doctor || '—';
      const now = new Date(); // Use current date for reprint
      const dateStr = now.toLocaleString('en-PK', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

      const treatmentsRows = treatmentItems.map((t, i) => `
        <tr>
          <td style="border:1px solid #000;padding:3px;">${i + 1}</td>
          <td style="border:1px solid #000;padding:3px;">${t.name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:right;">Rs. ${t.fee.toFixed(0)}</td>
        </tr>
      `).join('');

      const printContent = `
JINNAH DENTAL CLINIC
Token: #${item.tokenNumber || '—'}
Patient: ${item.patientName}
Phone: ${item.patientPhone || 'N/A'}
Date: ${dateStr}
Doctor: ${doctorName}
--------------------------------
TREATMENTS
--------------------------------
<table style="width:100%;border-collapse:collapse;font-size:12px;">
  <thead>
    <tr style="background:#f0f0f0;">
      <th style="border:1px solid #000;padding:3px;">S.No</th>
      <th style="border:1px solid #000;padding:3px;">Treatment</th>
      <th style="border:1px solid #000;padding:3px;">Fee</th>
    </tr>
  </thead>
  <tbody>
    ${treatmentsRows}
    <tr style="font-weight:bold;">
      <td colspan="2" style="border:1px solid #000;padding:3px;">Total Treatments</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;">Rs. ${treatmentFee.toFixed(0)}</td>
    </tr>
  </tbody>
</table>
--------------------------------
PAYMENT SUMMARY
--------------------------------
Previous Pending: Rs. ${previousPending.toFixed(0)}
Current Treatments: Rs. ${treatmentFee.toFixed(0)}
Discount: Rs. ${discount.toFixed(0)}
--------------------------------
Total Due: Rs. ${totalDueAfterDiscount.toFixed(0)}
Paid: Rs. ${amountPaid.toFixed(0)}
Remaining: Rs. ${remainingAfterPayment.toFixed(0)}
--------------------------------
Status: ${item.paymentStatus ? item.paymentStatus.toUpperCase() : 'PENDING'}
Notes: ${item.notes || 'None'}
--------------------------------
Thank You! Visit Again
Powered by Saynz Technologies
`.trim();

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${item.patientName}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { 
                margin: 0; 
                padding: 4mm; 
                font-family: 'Courier New', Courier, monospace; 
                font-size: 12px; 
                line-height: 1.2; 
                width: 72mm; 
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 4px 0; 
              }
              th, td { 
                border: 1px solid #000; 
                padding: 3px; 
                text-align: left;
              }
              .bold { font-weight: bold; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <pre>${printContent}</pre>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 1000);
                }, 300);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to print invoice");
    }
  };

  const handlePrintPatient = (queueItem: QueueItem) => {
    try {
      if (queueItem.status === 'completed') {
        handleDirectPrint(queueItem);
      } else {
        const patientData = getPatientDataForQueueItem(queueItem);
        setSelectedPatientForPrint(queueItem);
        setSelectedPatientData(patientData);
        setShowTreatmentModal(true);
        setSelectedQueueItemForTreatment(queueItem);
      }
    } catch (error) {
      console.error('Error opening print modal:', error);
      toast.error('Failed to load patient data for printing');
    }
  };

  const handleAddPayment = async (queueItem: QueueItem, paymentData: any) => {
    const toastId = toast.loading('Processing payment...');
    // GLOBAL TOAST GUARD
    const timeoutId = setTimeout(() => {
      toast.dismiss(toastId);
      console.warn('TOAST GUARD: Forced payment toast dismissal after 4 seconds');
    }, 4000);

    try {
      const patientData = getPatientDataForQueueItem(queueItem);
      if (!patientData) {
        clearTimeout(timeoutId);
        toast.dismiss(toastId);
        toast.error('Patient data not found');
        return;
      }

      const newPayment = paymentData.amount || 0;
      const currentPaid = queueItem.amountPaid || 0;
      const totalPaid = currentPaid + newPayment;
      const totalDue = (queueItem.fee || 0) + (queueItem.previousPending || 0);

      let paymentStatus: 'pending' | 'partial' | 'paid';

      if (totalPaid >= totalDue) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'pending';
      }

      const updatedQueueItem = {
        ...queueItem,
        amountPaid: totalPaid,
        paymentStatus,
        discount: paymentData.discount || 0,
        notes: (queueItem.notes || '') + `\nPayment: ${newPayment} (${paymentData.paymentMethod})`
      };
      await updateLocal('queue', updatedQueueItem);

      const newBill = {
        id: `BILL-${Date.now()}`,
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
      };
      await updateLocal('bills', newBill);

      const newPending = (patientData.pendingBalance || 0) - newPayment;
      const newTotalPaid = (patientData.totalPaid || 0) + newPayment;
      const updatedPatient = {
        ...patientData,
        pendingBalance: newPending,
        totalPaid: newTotalPaid
      };
      await updateLocal('patients', updatedPatient);

      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.success(`Payment of $${newPayment.toFixed(2)} processed successfully`);
      setShowPaymentModal(null);

    } catch (error) {
      console.error('Payment error:', error);
      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.error('Failed to process payment');

      // Show alert for database errors
      if (typeof window !== 'undefined' && error instanceof Error) {
        window.alert(`Database Error: ${error.message}`);
      }
    }
  };

  const handleWalkInPatient = async (patientData: any) => {
    const toastId = toast.loading('Adding to queue...');
    // GLOBAL TOAST GUARD
    const timeoutId = setTimeout(() => {
      toast.dismiss(toastId);
      console.warn('TOAST GUARD: Forced walk-in toast dismissal after 4 seconds');
    }, 4000);

    try {
      const patientId = patientData.id;
      const isEditing = patientData.isEditing;

      if (isLicenseExpired && !isEditing) {
        toast.error("License Expired. Please renew to add new patients to queue.");
        return;
      }

      if (isEditing) {
        clearTimeout(timeoutId);
        toast.dismiss(toastId);
        toast.success(`Patient ${patientData.name} updated`);
        setShowPatientModal(false);
        return;
      }

      const today = new Date();
      const todayString = today.toDateString();
      const todayQueueItems = contextQueue.filter(item => {
        const d = parseISO(item.checkInTime);
        return d.toDateString() === todayString;
      });

      const nextToken = todayQueueItems.length > 0
        ? Math.max(...todayQueueItems.map(q => q.tokenNumber)) + 1
        : 1;

      const queueItemData = {
        id: `Q-${Date.now()}`,
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
        previousPending: patientData.pendingBalance || 0
      } as QueueItem;

      await updateLocal('queue', queueItemData);

      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.success(`Patient added to queue (Token #${nextToken})`);
      setShowPatientModal(false);
    } catch (error) {
      console.error('Walk-in error:', error);
      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.error('Failed to add to queue');

      // Show alert for database errors
      if (typeof window !== 'undefined' && error instanceof Error) {
        window.alert(`Database Error: ${error.message}`);
      }
    }
  };

  const handleSavePatient = (patientData: any) => {
    // PatientFormModal handles updateLocal internally
    setShowPatientModal(false);
    setSelectedPatient(null);
  };

  const speakAnnouncement = (tokenNumber: number | string) => {
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    const speak = () => {
      const voices = synth.getVoices();
      const femaleVoice =
        voices.find(v => v.name === 'Google UK English Female') ||
        voices.find(v => v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.name.toLowerCase().includes('zira')) ||
        voices.find(v => v.name.toLowerCase().includes('susan')) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang === 'en-US');

      const text = `Token number ${tokenNumber}. please proceed to the treatment room.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = femaleVoice || null;
      utterance.lang = 'en-GB';
      utterance.rate = 0.9;
      utterance.pitch = 1.15;
      utterance.volume = 1;

      synth.cancel();
      synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = speak;
    } else {
      speak();
    }
  };

  const handleQueueAction = async (item: QueueItem, action: string) => {
    try {
      const now = new Date().toISOString();
      let updateData: Partial<QueueItem> = {};

      if (action === 'start-treatment') {
        updateData = {
          status: 'in_treatment' as const,
          treatmentStartTime: now
        };
        speakAnnouncement(item.tokenNumber);
      } else if (action === 'complete') {
        const patientData = getPatientDataForQueueItem(item);
        if (patientData) {
          setSelectedPatientData(patientData);
          setSelectedQueueItemForTreatment(item);
          setShowTreatmentModal(true);
          return;
        }
      } else if (action === 'back-to-waiting') {
        updateData = {
          status: 'waiting' as const,
          treatmentStartTime: null,
          treatment: '',
          fee: 0,
          doctor: ''
        };
      } else if (action === 'back-to-treatment') {
        updateData = {
          status: 'in_treatment' as const,
          treatmentEndTime: null
        };
      } else if (action === 'cancel') {
        const reason = prompt('Cancellation reason:') || 'Patient request';
        updateData = {
          status: 'cancelled' as const,
          cancelledAt: now,
          notes: `${item.notes || ''}\nCancelled: ${reason}`
        };
      } else if (action === 'edit') {
        const patient = patients.find(pt =>
          (item.patientNumber && pt.patientNumber === item.patientNumber) ||
          pt.id === item.patientId
        );
        if (patient) {
          setSelectedPatient(patient);
          setModalMode('walk-in');
          setShowPatientModal(true);
        } else {
          toast.error('Patient record not found');
        }
        return;
      } else if (action === 'delete') {
        if (confirm(`Remove ${item.patientName} from queue?`)) {
          await deleteLocal('queue', item.id);
          toast.success(`Removed ${item.patientName} from queue`);
        }
        return;
      }

      if (Object.keys(updateData).length > 0) {
        // FIX: Use optimistic update function for immediate UI feedback
        // IMPORTANT: Don't await - let it run in background
        updateQueueItemOptimistic(item.id, updateData);
      }

    } catch (error) {
      console.error('Queue action error:', error);
      toast.error('Failed to update queue');

      // Show alert for database errors
      if (typeof window !== 'undefined' && error instanceof Error) {
        window.alert(`Database Error: ${error.message}`);
      }
    }
  };

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

  const handleTreatmentSubmit = async (data: {
    treatment: string;
    fee: number;
    doctor: string;
    doctorId?: string;
  }) => {
    if (!selectedQueueItemForTreatment || !selectedPatientData) return;

    if (isLicenseExpired) {
      toast.error("License Expired. Please renew to complete treatments.");
      return;
    }

    try {
      const now = new Date().toISOString();

      const updateData = {
        status: 'completed' as const,
        treatmentEndTime: now,
        treatment: data.treatment,
        fee: data.fee,
        doctor: data.doctor,
        doctorId: data.doctorId
      };

      // FIX: Use optimistic update for immediate UI feedback
      // Don't await - just trigger it
      updateQueueItemOptimistic(selectedQueueItemForTreatment.id, updateData);

      const newPendingBalance = (selectedPatientData.pendingBalance || 0) + data.fee;
      const newTotalVisits = (selectedPatientData.totalVisits || 0) + 1;

      const updatedPatient = {
        ...selectedPatientData,
        pendingBalance: newPendingBalance,
        totalVisits: newTotalVisits,
        lastVisit: now
      };

      // Update patient data - also don't await
      updateLocal('patients', updatedPatient);

      // Trigger payment modal for receipt generation
      setTimeout(() => {
        const patientBills = contextBills.filter(b => b.patientId === updatedPatient.id);
        setShowPaymentModal({
          queueItem: { ...selectedQueueItemForTreatment, ...updateData },
          patientData: updatedPatient,
          patientBills
        });
      }, 800);

      setShowTreatmentModal(false);
      setSelectedQueueItemForTreatment(null);
      setSelectedPatientData(null);

    } catch (error) {
      console.error('Error completing treatment:', error);
      toast.error('Failed to complete treatment');

      // Show alert for database errors
      if (typeof window !== 'undefined' && error instanceof Error) {
        window.alert(`Database Error: ${error.message}`);
      }
    }
  };

  const handleOpenTreatmentModal = async (item: QueueItem) => {
    try {
      setSelectedQueueItemForTreatment(item);
      const patientData = getPatientDataForQueueItem(item);
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
      const patientData = getPatientDataForQueueItem(item);
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
            disabled={loading.queue || loading.patients || isLicenseExpired}
          >
            <Users className="w-4 h-4" />
            Walk-in Patient
          </Button>
        </div>
      </div>

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
            {availableDoctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
          </select>
        </div>
      </div>

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
            onPrint={handlePrintPatient}
            onDoubleClick={handleOpenPatientDetails}
            showPatientId={true}
          />
          <QueueSection
            title="In Treatment"
            items={inTreatmentPatients}
            status="in_treatment"
            onAction={handleQueueAction}
            onPayment={handleOpenPaymentModal}
            onPrint={handlePrintPatient}
            onDoubleClick={handleOpenPatientDetails}
            showBackButton={true}
            showPatientId={true}
          />
          <QueueSection
            title="Completed"
            items={completedPatients}
            status="completed"
            onAction={handleQueueAction}
            onPrint={handlePrintPatient}
            onDoubleClick={handleOpenPatientDetails}
            showBackButton={true}
            showPatientId={true}
          />
        </div>
      )}

      <PatientFormModal
        open={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSubmit={modalMode === 'walk-in' ? handleWalkInPatient : handleSavePatient}
        patient={selectedPatient}
        isEditing={!!selectedPatient}
        // doctors={availableDoctors} // Prop not supported in PatientFormModal
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
          doctors={availableDoctors}
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
                await deleteLocal('queue', showPatientDetails.id);
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