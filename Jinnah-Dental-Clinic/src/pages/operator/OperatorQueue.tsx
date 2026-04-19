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
import { format } from 'date-fns';
import { parseAnyDate, isDateInDateRange, getLocalDateString, getLocalTimeString, formatDisplayDate } from '@/utils/dateUtils';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';
import { getNextToken } from '@/utils/tokenUtils';
import { useData } from '@/context/DataContext';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';
import { formatCurrency } from '@/lib/utils';
import { addToSyncQueue } from '@/services/offlineSync';
import { CustomPrompt } from '@/components/ui/CustomPrompt';

export default function OperatorQueue() {
  const {
    queue: contextQueue,
    patients: contextPatients,
    bills: contextBills,
    transactions: contextTransactions,
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

  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelItem, setCancelItem] = useState<QueueItem | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<any>(null);

  const queueData = React.useMemo(() => {
    if (!contextQueue) return [];
    try {
      const { startDate, endDate } = dateRange;

      return contextQueue.filter(item => {
        if (item.status === 'completed' && item.treatmentDate) {
          return isDateInDateRange(item.treatmentDate, startDate, endDate);
        }

        if (item.status !== 'completed' && item.checkInTime) {
          return isDateInDateRange(item.checkInTime, startDate, endDate);
        }

        return false;
      });
    } catch (err) {
      console.error('Queue calculation error:', err);
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
      return null;
    }
  }, [patients]);

  const getBillsForPatient = (patientId: string) => {
    if (!patientId || !contextBills) return [];
    return contextBills.filter(b => b.patientId === patientId);
  };

  // Get pre-receive total for a patient
  const getPatientPreReceiveTotal = useCallback((patientId: string, patientNumber: string, patientName: string) => {
    const preReceiveTransactions = (contextTransactions || []).filter(t =>
      t.type === 'pre_receive' &&
      (t.patientId === patientId || t.patientNumber === patientNumber || t.patientName === patientName)
    );
    return preReceiveTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [contextTransactions]);

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
      const treatmentItems: { name: string; fee: number }[] = [];
      let treatmentString = item.treatment || '';

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

      const parsedTotal = treatmentItems.reduce((sum, t) => sum + t.fee, 0);
      const itemFee = item.fee || 0;
      if (parsedTotal !== itemFee) {
        if (parsedTotal === 0 && treatmentItems.length > 0) {
          treatmentItems[0].fee = itemFee;
        } else if (treatmentItems.length === 0 && itemFee > 0) {
          treatmentItems.push({ name: 'General Treatment', fee: itemFee });
        }
      }

      const patientData = getPatientDataForQueueItem(item);
      const currentPendingBalance = patientData?.pendingBalance || 0;

      const discount = item.discount || 0;
      const amountPaid = item.amountPaid || 0;
      const treatmentFee = itemFee;
      const appliedPreReceive = item.preReceiveAmount || 0;

      // Deriving previous pending balance from current final balance
      // Current Final = Prev Pending + Treatment Fee - Applied PreReceive - Discount - Amount Paid
      // Prev Pending = Current Final - Treatment Fee + Applied PreReceive + Discount + Amount Paid
      let previousPending = currentPendingBalance - treatmentFee + appliedPreReceive + discount + amountPaid;
      if (previousPending < 0) previousPending = 0;

      const totalDueBeforeAdjustments = previousPending + treatmentFee;
      const totalDueAfterAdjustments = Math.max(0, totalDueBeforeAdjustments - appliedPreReceive - discount);
      const finalPending = Math.max(0, totalDueAfterAdjustments - amountPaid);

      const doctorName = staff.find(s => s.id === item.doctorId)?.name || item.doctor || '—';

      // Use treatmentDateTime or treatmentEndTime if available, otherwise fallback to checkInTime
      const effectiveDateTime = item.treatmentDateTime || item.treatmentEndTime || item.checkInTime || new Date().toISOString();
      const dateObj = new Date(effectiveDateTime);

      const displayDate = formatDisplayDate(dateObj, 'dd/MM/yyyy');
      const displayTime = formatDisplayDate(dateObj, 'hh:mm a');

      const treatmentsRows = treatmentItems.map((t, i) => `
        <tr>
          <td style="border:1px solid #000;padding:4px;">${i + 1}</td>
          <td style="border:1px solid #000;padding:4px;">${t.name}</td>
          <td style="border:1px solid #000;padding:4px;text-align:right;">Rs. ${t.fee.toFixed(0)}</td>
        </tr>
      `).join('');

      const printContent = `
================================
Token: #${item.tokenNumber || '—'}
Patient: ${item.patientName}
Phone: ${item.patientPhone || 'N/A'}
Date: ${displayDate}
Time: ${displayTime}
Doctor: ${doctorName}
================================

TREATMENTS
--------------------------------
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <thead>
    <tr style="background:#f0f0f0;">
      <th style="border:1px solid #000;padding:5px;">S.No</th>
      <th style="border:1px solid #000;padding:5px;">Treatment</th>
      <th style="border:1px solid #000;padding:5px;text-align:right;">Fee</th>
    </tr>
  </thead>
  <tbody>
    ${treatmentsRows}
    <tr style="font-weight:bold;background:#f9f9f9;">
      <td colspan="2" style="border:1px solid #000;padding:5px;">Total Treatments</td>
      <td style="border:1px solid #000;padding:5px;text-align:right;">Rs. ${treatmentFee.toFixed(0)}</td>
    </tr>
  </tbody>
</table>

--------------------------------
PAYMENT SUMMARY
--------------------------------
Previous Pending      : Rs. ${previousPending.toFixed(0)}
Current Treatment(s)  : Rs. ${treatmentFee.toFixed(0)}
Total Billing Amount  : Rs. ${totalDueBeforeAdjustments.toFixed(0)}
${appliedPreReceive > 0 ? `Advance Applied      : Rs. -${appliedPreReceive.toFixed(0)}` : ''}
${discount > 0 ? `Discount             : Rs. -${discount.toFixed(0)}` : ''}
--------------------------------
Net Payable Amount    : Rs. ${totalDueAfterAdjustments.toFixed(0)}
Paid This Visit       : Rs. ${amountPaid.toFixed(0)}
**Final Pending**     : Rs. ${finalPending.toFixed(0)}
--------------------------------
Status: ${item.paymentStatus ? item.paymentStatus.toUpperCase() : 'PENDING'}
Notes: ${item.notes || 'None'}
================================
Thank You! Visit Again
Powered by Saynz Technologies
Contact Us: 0347 1887181
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
              padding: 5mm; 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 12px; 
              line-height: 1.3; 
              width: 72mm; 
            }
            .clinic-title {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 8px;
              letter-spacing: 1px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 6px 0; 
            }
            th, td { 
              border: 1px solid #000; 
              padding: 5px; 
              text-align: left;
            }
            th { background:#f0f0f0; }
            .bold { font-weight: bold; }
            .highlight { font-weight: bold; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="clinic-title">JINNAH DENTAL CLINIC🦷</div>
          <div class="divider"></div>
          
          <pre style="margin:0; font-size:12px;">${printContent}</pre>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 800);
              }, 400);
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
    const timeoutId = setTimeout(() => {
      toast.dismiss(toastId);
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
      const discount = paymentData.discount || 0;
      const currentPaid = queueItem.amountPaid || 0;
      const totalPaid = currentPaid + newPayment;

      // ============================================================
      // CRITICAL FIX: Sirf is treatment ka fee consider karo
      // ============================================================
      const treatmentFee = queueItem.fee || 0;
      const preReceiveAmount = queueItem.preReceiveAmount || 0;
      const totalDueForThisTreatment = Math.max(0, treatmentFee - preReceiveAmount);

      let paymentStatus: 'pending' | 'partial' | 'paid';

      if (totalPaid >= totalDueForThisTreatment) {
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
        discount: discount,
        notes: (queueItem.notes || '') + `\nPayment: Rs. ${newPayment} (${paymentData.paymentMethod})`
      };
      await updateLocal('queue', updatedQueueItem);

      const now = new Date();
      const transactionDate = queueItem.treatmentDateTime || queueItem.treatmentEndTime || now.toISOString();
      
      const newBill: Bill = {
        id: `BILL-${Date.now()}`,
        billNumber: `BILL-${Date.now()}`,
        patientId: patientData.id,
        patientNumber: patientData.patientNumber,
        patientName: queueItem.patientName,
        treatment: queueItem.treatment || '',
        fee: treatmentFee,
        preReceiveApplied: preReceiveAmount,
        totalAmount: totalDueForThisTreatment,
        amountPaid: newPayment,
        discount: discount,
        paymentMethod: paymentData.paymentMethod || 'cash',
        paymentStatus,
        createdDate: transactionDate,
        notes: paymentData.notes || '',
        queueItemId: queueItem.id
      };
      await updateLocal('bills', newBill);

      // ============================================================
      // FIXED: Patient update - Use the values from PaymentModal
      // ============================================================
      const leftoverPreReceive = Number(paymentData.leftoverPreReceive || 0);
      const newPendingBalance = Number(paymentData.newPendingBalance || 0);
      const newTotalPaid = (patientData.totalPaid || 0) + newPayment;

      const updatedPatient = {
        ...patientData,
        pendingBalance: Math.max(0, newPendingBalance),
        preReceiveBalance: leftoverPreReceive, // PERSIST any unspent credit
        totalPaid: newTotalPaid,
        lastVisit: transactionDate,
        updatedAt: now.toISOString()
      };

      console.log('[Payment] Final Stats:', {
        treatmentFee,
        appliedCredit: paymentData.preReceiveAmount,
        leftoverCredit: leftoverPreReceive,
        newPending: newPendingBalance,
        newTotalPaid
      });

      await updateLocal('patients', updatedPatient);

      // 4. Create Transaction record for the payment (for history tracking)
      const transaction: any = {
        id: `TXN-${Date.now()}`,
        patientNumber: patientData.patientNumber,
        patientName: patientData.name,
        amount: newPayment,
        date: transactionDate,
        type: 'treatment_payment',
        method: paymentData.paymentMethod || 'cash',
        notes: paymentData.notes || `Payment for treatment: ${updatedQueueItem.treatment}`,
        paymentDate: getLocalDateString(transactionDate),
        paymentTime: getLocalTimeString(transactionDate),
        fullPaymentDateTime: transactionDate,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        queueItemId: queueItem.id,
        billId: newBill.id
      };
      await updateLocal('transactions', transaction);

      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.success(`Payment of Rs. ${newPayment.toFixed(2)} processed successfully`);
      setShowPaymentModal(null);

    } catch (error) {
      console.error('Payment error:', error);
      clearTimeout(timeoutId);
      toast.dismiss(toastId);
      toast.error('Failed to process payment');
    }
  };

  const handleWalkInPatient = async (patientData: any) => {
    const toastId = toast.loading('Adding to queue...');
    const timeoutId = setTimeout(() => {
      toast.dismiss(toastId);
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

      const nextToken = getNextToken(contextQueue);

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
    }
  };

  const handleSavePatient = (patientData: any) => {
    setShowPatientModal(false);
    setSelectedPatient(null);
  };

  const speakAnnouncement = (tokenNumber: number | string) => {
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;
    // const tokenStr = tokenNumber.toString();
    const tokenStr = String(tokenNumber);

    const speak = () => {
      const voices = synth.getVoices();
      const femaleVoice =
        voices.find(v => v.name === 'Google UK English Female') ||
        voices.find(v => v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.name.toLowerCase().includes('zira')) ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang === 'en-US');

      const text = `Token number ${tokenStr}. please proceed to the treatment room.`;
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

  // Handle cancel confirmation
  const handleCancelConfirm = async (reason: string) => {
    if (!cancelItem) return;

    if (cancelItem.status === 'completed') {
      toast.error('Cannot cancel completed treatment. Use delete instead.');
      setShowCancelPrompt(false);
      setCancelItem(null);
      return;
    }

    const now = new Date().toISOString();
    const updateData = {
      status: 'cancelled' as const,
      cancelledAt: now,
      notes: `${cancelItem.notes || ''}\nCancelled: ${reason}`
    };

    // Your update logic here...
    await updateLocal('queue', { ...cancelItem, ...updateData });

    setShowCancelPrompt(false);
    setCancelItem(null);
    toast.success('Treatment cancelled');
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
      }
      else if (action === 'complete') {
        const patientData = getPatientDataForQueueItem(item);
        if (patientData) {
          setSelectedPatientData(patientData);
          setSelectedQueueItemForTreatment(item);
          setShowTreatmentModal(true);
          return;
        }
      }
      else if (action === 'back-to-waiting') {
        updateData = {
          status: 'waiting' as const,
          treatmentStartTime: null,
          treatment: '',
          fee: 0,
          doctor: '',
          doctorId: '',
          treatmentDate: '',
          treatmentTime: '',
          treatmentDateTime: ''
        };
      }

      // else if (action === 'back-to-treatment') {
      //   const toastId = toast.loading('Reverting treatment...');
      //   let updateData: Partial<QueueItem> = {};

      //   try {
      //     // Get the queue item's pre-receive amount
      //     const preReceiveAmount = item.preReceiveAmount || 0;

      //     // ============================================================
      //     // STEP 1: Delete ALL bills for this queue item (Local + Firebase)
      //     // ============================================================
      //     const queueBills = contextBills.filter(b => b.queueItemId === item.id);
      //     for (const bill of queueBills) {
      //       // Local delete
      //       await deleteLocal('bills', bill.id);
      //       console.log(`[BackToTreatment] Deleted bill locally: ${bill.id}`);

      //       // Direct Firebase delete
      //       try {
      //         const { db } = await import('@/lib/firebase');
      //         const { deleteDoc, doc } = await import('firebase/firestore');
      //         await deleteDoc(doc(db, 'bills', bill.id));
      //         console.log(`[BackToTreatment] Deleted bill from Firebase: ${bill.id}`);
      //       } catch (firebaseErr) {
      //         console.log(`[BackToTreatment] Firebase bill delete failed: ${bill.id}`, firebaseErr);
      //       }
      //     }

      //     // ============================================================
      //     // STEP 2: Delete ALL payment transactions (Local + Firebase)
      //     // ============================================================
      //     const queueTransactions = (contextTransactions || []).filter(t => t.queueItemId === item.id);
      //     for (const txn of queueTransactions) {
      //       // Local delete
      //       await deleteLocal('transactions', txn.id);
      //       console.log(`[BackToTreatment] Deleted transaction locally: ${txn.id}`);

      //       // Direct Firebase delete
      //       try {
      //         const { db } = await import('@/lib/firebase');
      //         const { deleteDoc, doc } = await import('firebase/firestore');
      //         await deleteDoc(doc(db, 'transactions', txn.id));
      //         console.log(`[BackToTreatment] Deleted transaction from Firebase: ${txn.id}`);
      //       } catch (firebaseErr) {
      //         console.log(`[BackToTreatment] Firebase transaction delete failed: ${txn.id}`, firebaseErr);
      //       }
      //     }

      //     // Reverse patient changes
      //     const patientData = getPatientDataForQueueItem(item);
      //     if (patientData) {
      //       const fee = item.fee || 0;
      //       const amountPaid = item.amountPaid || 0;
      //       const effectiveFee = Math.max(0, fee - preReceiveAmount);
      //       const pendingAdded = effectiveFee - amountPaid;

      //       const updatedPatient = {
      //         ...patientData,
      //         pendingBalance: Math.max(0, (patientData.pendingBalance || 0) - pendingAdded),
      //         totalPaid: Math.max(0, (patientData.totalPaid || 0) - amountPaid),
      //         totalVisits: Math.max(0, (patientData.totalVisits || 0) - 1),
      //         updatedAt: new Date().toISOString()
      //       };
      //       await updateLocal('patients', updatedPatient);

      //       // Also update patient in Firebase directly
      //       try {
      //         const { db } = await import('@/lib/firebase');
      //         const { doc, setDoc } = await import('firebase/firestore');
      //         await setDoc(doc(db, 'patients', patientData.id), updatedPatient, { merge: true });
      //         console.log(`[BackToTreatment] Updated patient in Firebase: ${patientData.id}`);
      //       } catch (firebaseErr) {
      //         console.log(`[BackToTreatment] Firebase patient update failed:`, firebaseErr);
      //       }
      //     }

      //     // Reset queue item (clear pre-receive for next time)
      //     updateData = {
      //       status: 'in_treatment' as const,
      //       treatmentEndTime: null,
      //       amountPaid: 0,
      //       discount: 0,
      //       paymentStatus: 'pending' as const,
      //       preReceiveAmount: 0, // CLEAR pre-receive for next treatment
      //       treatment: '',
      //       fee: 0,
      //       doctor: '',
      //       doctorId: '',
      //       treatmentDate: '',
      //       treatmentTime: '',
      //       treatmentDateTime: '',
      //       notes: `${item.notes || ''}\n[${new Date().toLocaleString()}] Treatment reopened`
      //     };

      //     // Update queue item locally
      //     await updateQueueItemOptimistic(item.id, updateData);

      //     // Also update queue item in Firebase directly
      //     try {
      //       const { db } = await import('@/lib/firebase');
      //       const { doc, setDoc } = await import('firebase/firestore');
      //       const updatedQueueItem = { ...item, ...updateData, updatedAt: new Date().toISOString() };
      //       await setDoc(doc(db, 'queue', item.id), updatedQueueItem, { merge: true });
      //       console.log(`[BackToTreatment] Updated queue item in Firebase: ${item.id}`);
      //     } catch (firebaseErr) {
      //       console.log(`[BackToTreatment] Firebase queue update failed:`, firebaseErr);
      //     }

      //     toast.dismiss(toastId);
      //     toast.success('Treatment reopened and payment reversed');

      //   } catch (error) {
      //     toast.dismiss(toastId);
      //     console.error('[BackToTreatment] Error:', error);
      //     toast.error('Failed to revert treatment', { id: toastId });
      //   }

      // }

      else if (action === 'back-to-treatment') {
        const toastId = toast.loading('Reverting treatment...');
        let updateData: Partial<QueueItem> = {};

        try {
          const preReceiveAmount = item.preReceiveAmount || 0;

          // ============================================================
          // STEP 1: Delete bills (Local only - Firebase will sync later)
          // ============================================================
          const queueBills = contextBills.filter(b => b.queueItemId === item.id);
          for (const bill of queueBills) {
            await deleteLocal('bills', bill.id);
            console.log(`[BackToTreatment] Deleted bill locally: ${bill.id}`);

            // Add to sync queue for offline sync
            await addToSyncQueue('bills', 'delete', { id: bill.id });
          }

          // ============================================================
          // STEP 2: Delete transactions (Local only - Firebase will sync later)
          // ============================================================
          const queueTransactions = (contextTransactions || []).filter(t => t.queueItemId === item.id);
          for (const txn of queueTransactions) {
            await deleteLocal('transactions', txn.id);
            console.log(`[BackToTreatment] Deleted transaction locally: ${txn.id}`);

            // Add to sync queue
            await addToSyncQueue('transactions', 'delete', { id: txn.id });
          }

          // ============================================================
          // STEP 3: Reverse patient changes (Local only)
          // ============================================================
          const patientData = getPatientDataForQueueItem(item);
          if (patientData) {
            const fee = item.fee || 0;
            const amountPaid = item.amountPaid || 0;
            const effectiveFee = Math.max(0, fee - preReceiveAmount);
            const pendingAdded = effectiveFee - amountPaid;

            const updatedPatient = {
              ...patientData,
              pendingBalance: Math.max(0, (patientData.pendingBalance || 0) - pendingAdded),
              totalPaid: Math.max(0, (patientData.totalPaid || 0) - amountPaid),
              totalVisits: Math.max(0, (patientData.totalVisits || 0) - 1),
              updatedAt: new Date().toISOString()
            };

            await updateLocal('patients', updatedPatient);
            console.log(`[BackToTreatment] Patient updated locally`);

            // Add to sync queue
            await addToSyncQueue('patients', 'update', updatedPatient);
          }

          // ============================================================
          // STEP 4: Reset queue item (Local only)
          // ============================================================
          updateData = {
            status: 'in_treatment' as const,
            treatmentEndTime: null,
            amountPaid: 0,
            discount: 0,
            paymentStatus: 'pending' as const,
            preReceiveAmount: 0,
            treatment: '',
            fee: 0,
            doctor: '',
            doctorId: '',
            treatmentDate: '',
            treatmentTime: '',
            treatmentDateTime: '',
            notes: `${item.notes || ''}\n[${new Date().toLocaleString()}] Treatment reopened`
          };

          await updateQueueItemOptimistic(item.id, updateData);

          // Add to sync queue
          const updatedQueueItem = { ...item, ...updateData, updatedAt: new Date().toISOString() };
          await addToSyncQueue('queue', 'update', updatedQueueItem);

          toast.dismiss(toastId);

          // Check if online, otherwise show offline message
          if (navigator.onLine) {
            toast.success('Treatment reopened and payment reversed');
          } else {
            toast.warning('Treatment reopened (Offline mode - will sync when online)');
          }

        } catch (error) {
          toast.dismiss(toastId);
          console.error('[BackToTreatment] Error:', error);
          toast.error('Failed to revert treatment');
        }
      }
      // else if (action === 'cancel') {
      //   const reason = prompt('Cancellation reason:') || 'Patient request';

      //   if (item.status === 'completed') {
      //     toast.error('Cannot cancel completed treatment. Use delete instead.');
      //     return;
      //   }

      //   updateData = {
      //     status: 'cancelled' as const,
      //     cancelledAt: now,
      //     notes: `${item.notes || ''}\nCancelled: ${reason}`
      //   };
      // }

      else if (action === 'cancel') {
        // Show custom modal instead of prompt
        setCancelItem(item);
        setShowCancelPrompt(true);
      }

      else if (action === 'edit') {
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
      }
      else if (action === 'delete') {
        if (!confirm(`Remove ${item.patientName} from queue?`)) return;

        const wasCompleted = item.status === 'completed';
        const wasInTreatment = item.status === 'in_treatment';

        if (wasCompleted) {
          const confirmMsg = `WARNING: This treatment was COMPLETED.\n\nDeleting will:\n- Remove all payment records\n- Adjust patient balance\n- Decrease visit count\n\nAre you sure?`;

          if (!confirm(confirmMsg)) return;

          try {
            const queueBills = contextBills.filter(b => b.queueItemId === item.id);
            for (const bill of queueBills) {
              await deleteLocal('bills', bill.id);
            }

            const queueTransactions = (contextTransactions || []).filter(t => t.queueItemId === item.id);
            for (const txn of queueTransactions) {
              await deleteLocal('transactions', txn.id);
            }

            const patientData = getPatientDataForQueueItem(item);
            if (patientData) {
              const fee = item.fee || 0;
              const amountPaid = item.amountPaid || 0;
              const preReceiveTotal = getPatientPreReceiveTotal(patientData.id, patientData.patientNumber, patientData.name);

              const effectiveFee = Math.max(0, fee - preReceiveTotal);
              const pendingAdded = effectiveFee - amountPaid;

              const updatedPatient = {
                ...patientData,
                pendingBalance: Math.max(0, (patientData.pendingBalance || 0) - pendingAdded),
                totalPaid: Math.max(0, (patientData.totalPaid || 0) - amountPaid),
                totalVisits: Math.max(0, (patientData.totalVisits || 0) - 1),
                updatedAt: new Date().toISOString()
              };
              await updateLocal('patients', updatedPatient);
            }

            await deleteLocal('queue', item.id);
            toast.success(`Removed ${item.patientName} and reversed all records`);

          } catch (error) {
            console.error('Error deleting completed treatment:', error);
            toast.error('Failed to delete record');
          }

        } else if (wasInTreatment) {
          if (confirm(`Remove ${item.patientName} from treatment? No visit will be recorded.`)) {
            await deleteLocal('queue', item.id);
            toast.success(`Removed ${item.patientName} from treatment`);
          }

        } else {
          await deleteLocal('queue', item.id);
          toast.success(`Removed ${item.patientName} from queue`);
        }

        return;
      }

      if (Object.keys(updateData).length > 0) {
        await updateQueueItemOptimistic(item.id, updateData);
        if (action === 'back-to-treatment') {
          toast.success('Treatment reopened');
        }
      }

    } catch (error) {
      console.error('Queue action error:', error);
      toast.error('Failed to update queue');
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

  // const handleTreatmentSubmit = async (data: any) => {
  //   if (!selectedQueueItemForTreatment || !selectedPatientData) return;

  //   if (isLicenseExpired) {
  //     toast.error("License Expired. Please renew to complete treatments.");
  //     return;
  //   }

  //   try {
  //     const now = new Date().toISOString();
  //     const treatmentDate = data.treatmentDate || format(new Date(), 'yyyy-MM-dd');
  //     const treatmentTime = data.treatmentTime || format(new Date(), 'HH:mm:ss');

  //     // Get pre-receive amount from the data
  //     const preReceiveAmount = data.preReceiveAmount || selectedQueueItemForTreatment.preReceiveAmount || 0;

  //     // IMPORTANT: Don't set amountPaid here - let payment modal handle it
  //     // Only store the fee and pre-receive amount
  //     const fee = data.fee;

  //     console.log('[TreatmentSubmit] Saving treatment:', {
  //       preReceive: preReceiveAmount,
  //       fee: fee,
  //       treatment: data.treatment
  //     });

  //     // Prepare update data for queue item - WITHOUT amountPaid
  //     const updateData = {
  //       status: 'completed' as const,
  //       treatmentEndTime: now,
  //       treatment: data.treatment,
  //       fee: fee,
  //       doctor: data.doctor,
  //       doctorId: data.doctorId,
  //       treatmentDate: treatmentDate,
  //       treatmentTime: treatmentTime,
  //       treatmentDateTime: `${treatmentDate}T${treatmentTime}`,
  //       preReceiveAmount: preReceiveAmount,
  //       // IMPORTANT: Don't set amountPaid here - leave as 0 or existing
  //       amountPaid: 0,  // Reset to 0, payment modal will handle payment
  //       discount: 0,
  //       paymentStatus: 'pending' as const,
  //       checkInTime: selectedQueueItemForTreatment.checkInTime,
  //       tokenNumber: selectedQueueItemForTreatment.tokenNumber,
  //       patientId: selectedQueueItemForTreatment.patientId,
  //       patientNumber: selectedQueueItemForTreatment.patientNumber,
  //       patientName: selectedQueueItemForTreatment.patientName,
  //       patientPhone: selectedQueueItemForTreatment.patientPhone,
  //       updatedAt: now
  //     };

  //     // Update queue item
  //     await updateLocal('queue', {
  //       ...selectedQueueItemForTreatment,
  //       ...updateData
  //     });

  //     // Don't update patient's totalPaid or pendingBalance here
  //     // Let payment modal handle all financial transactions

  //     // Only increment visit count
  //     const updatedPatient = {
  //       ...selectedPatientData,
  //       totalVisits: (selectedPatientData.totalVisits || 0) + 1,
  //       lastVisit: now,
  //       updatedAt: now
  //     };

  //     await updateLocal('patients', updatedPatient);

  //     toast.success('Treatment saved! Please process payment.');

  //     // Close treatment modal
  //     setShowTreatmentModal(false);

  //     // Store the completed queue item
  //     const completedQueueItem = { ...selectedQueueItemForTreatment, ...updateData };

  //     // Clear selection
  //     setSelectedQueueItemForTreatment(null);

  //     // Show payment modal
  //     setTimeout(() => {
  //       const patientBills = contextBills.filter(b =>
  //         b.patientId === updatedPatient.id || b.patientNumber === updatedPatient.patientNumber
  //       );

  //       setShowPaymentModal({
  //         queueItem: completedQueueItem,
  //         patientData: updatedPatient,
  //         patientBills: patientBills
  //       });
  //     }, 500);

  //   } catch (error) {
  //     console.error('Error completing treatment:', error);
  //     toast.error('Failed to save treatment');
  //   }
  // };

  const handleTreatmentSubmit = async (data: any) => {
    if (!selectedQueueItemForTreatment || !selectedPatientData) return;

    if (isLicenseExpired) {
      toast.error("License Expired. Please renew to complete treatments.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const treatmentDate = data.treatmentDate || format(new Date(), 'yyyy-MM-dd');
      const treatmentTime = data.treatmentTime || format(new Date(), 'HH:mm:ss');

      const preReceiveAmount = data.preReceiveAmount || selectedQueueItemForTreatment.preReceiveAmount || 0;
      const fee = data.fee;

      console.log('[TreatmentSubmit] Saving treatment:', {
        preReceive: preReceiveAmount,
        fee: fee,
        treatment: data.treatment
      });

      const treatmentDateTime = `${treatmentDate}T${treatmentTime}`;

      const updateData = {
        status: 'completed' as const,
        treatmentEndTime: treatmentDateTime,
        treatment: data.treatment,
        fee: fee,
        doctor: data.doctor,
        doctorId: data.doctorId,
        treatmentDate: treatmentDate,
        treatmentTime: treatmentTime,
        treatmentDateTime: treatmentDateTime,
        preReceiveAmount: preReceiveAmount,
        amountPaid: 0,
        discount: 0,
        paymentStatus: 'pending' as const,
        checkInTime: selectedQueueItemForTreatment.checkInTime,
        tokenNumber: selectedQueueItemForTreatment.tokenNumber,
        patientId: selectedQueueItemForTreatment.patientId,
        patientNumber: selectedQueueItemForTreatment.patientNumber,
        patientName: selectedQueueItemForTreatment.patientName,
        patientPhone: selectedQueueItemForTreatment.patientPhone,
        updatedAt: now
      };

      await updateLocal('queue', {
        ...selectedQueueItemForTreatment,
        ...updateData
      });

      // ============================================================
      // CRITICAL FIX: Re-fetch latest patient data to avoid overwriting 
      // pre-receive updates with stale state.
      // ============================================================
      const latestPatient = getPatientDataForQueueItem(selectedQueueItemForTreatment) || selectedPatientData;

      const updatedPatient = {
        ...latestPatient,
        totalVisits: (latestPatient.totalVisits || 0) + 1,
        lastVisit: treatmentDateTime,
        updatedAt: now
      };

      await updateLocal('patients', updatedPatient);

      // toast.success('Treatment saved! Please process payment.');

      setShowTreatmentModal(false);
      const completedQueueItem = { ...selectedQueueItemForTreatment, ...updateData };
      setSelectedQueueItemForTreatment(null);

      setTimeout(() => {
        const patientBills = contextBills.filter(b =>
          b.patientId === updatedPatient.id || b.patientNumber === updatedPatient.patientNumber
        );

        setShowPaymentModal({
          queueItem: completedQueueItem,
          patientData: updatedPatient,
          patientBills: patientBills
        });
      }, 500);

    } catch (error) {
      console.error('Error completing treatment:', error);
      toast.error('Failed to save treatment');
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

  const handlePaymentModalClose = async () => {
    setShowPaymentModal(null);
  };

  const handlePaymentCancel = async () => {
    if (showPaymentModal && showPaymentModal.queueItem) {
      const queueItem = showPaymentModal.queueItem;
      const patientData = showPaymentModal.patientData;

      try {
        // Rollback Queue Item status
        const updatedQueueItem = {
          ...queueItem,
          status: 'in_treatment' as const,
          treatmentEndTime: null,
          updatedAt: new Date().toISOString()
        };
        await updateLocal('queue', updatedQueueItem);

        // Rollback Patient visit count
        const updatedPatient = {
          ...patientData,
          totalVisits: Math.max(0, (patientData.totalVisits || 1) - 1),
          updatedAt: new Date().toISOString()
        };
        await updateLocal('patients', updatedPatient);

        toast.info('Treatment completion cancelled. Patient moved back to "In Treatment".');
      } catch (error) {
        console.error('Error rolling back treatment:', error);
        toast.error('Failed to rollback treatment status');
      }
    }
    setShowPaymentModal(null);
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
            Add Patient
          </Button>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Date Range Filter</h3>
          <span className="text-xs text-gray-500 ml-auto">
            {selectedDoctor !== 'all' ? `Filtered by: ${availableDoctors.find(d => d.id === selectedDoctor)?.name || selectedDoctor}` : ''}
          </span>
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
          Showing data from {formatDisplayDate(dateRange.startDate, 'MMM dd, yyyy')} to {formatDisplayDate(dateRange.endDate, 'MMM dd, yyyy')}
          <span className="ml-2 text-blue-600">
            (Completed treatments by treatment date, others by check-in date)
          </span>
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

          <CustomPrompt
            open={showCancelPrompt}
            title="Cancel Treatment"
            message="Please enter cancellation reason:"
            defaultValue="Patient request"
            onConfirm={handleCancelConfirm}
            onCancel={() => {
              setShowCancelPrompt(false);
              setCancelItem(null);
            }}
          />
        </div>
      )}

      <PatientFormModal
        open={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSubmit={modalMode === 'walk-in' ? handleWalkInPatient : handleSavePatient}
        patient={selectedPatient}
        isEditing={!!selectedPatient}
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
          onClose={handlePaymentModalClose}
          onCancel={handlePaymentCancel}
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
            setPatientToDelete(showPatientDetails);
            setShowDeleteConfirm(true);
          }}
        />
      )}

      <DeleteConfirmationModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={async () => {
          if (!patientToDelete) return;
          try {
            setIsDeleting(true);
            await deleteLocal('queue', patientToDelete.id);
            toast.success(`Removed ${patientToDelete.patientName} from queue`);
            setShowDeleteConfirm(false);
            setPatientToDelete(null);
            setShowPatientDetails(null);
            setSelectedPatientData(null);
          } catch (error) {
            console.error('Error deleting queue item:', error);
            toast.error('Failed to remove from queue');
          } finally {
            setIsDeleting(false);
          }
        }}
        title="Remove from Queue?"
        description={
            <div className="space-y-3">
                <p>Are you sure you want to remove <span className="font-bold text-red-600">{patientToDelete?.patientName}</span> from the active queue?</p>
                <p className="text-sm text-gray-500 italic pb-2">This will remove their token and visit from today's list.</p>
            </div>
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}