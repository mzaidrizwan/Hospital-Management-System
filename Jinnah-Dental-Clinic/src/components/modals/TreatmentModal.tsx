'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash, DollarSign, CreditCard, History, User, AlertTriangle, Printer, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Staff, QueueItem, Bill, Patient, Transaction } from '@/types';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';

interface TreatmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    treatment: string;
    fee: number;
    doctor: string;
    doctorId?: string;
    treatmentDate?: string;
    treatmentTime?: string;
    isEdit?: boolean;
    originalQueueItem?: QueueItem;
    preReceiveAmount?: number;
  }) => void;
  queueItem: QueueItem | null;
  doctors: Staff[];
  patientData?: Patient | null;
  patientHistory?: {
    queueHistory: QueueItem[];
    paymentHistory: Bill[];
    bills: Bill[];
  };
  patientInfo?: {
    pendingBalance?: number;
  };
}

interface SelectedTreatment {
  name: string;
  fee: number;
  id?: string;
}

export default function TreatmentModal({
  open,
  onClose,
  onSubmit,
  queueItem,
  doctors,
  patientData = null,
  patientHistory = { queueHistory: [], paymentHistory: [], bills: [] },
  patientInfo = { pendingBalance: 0 }
}: TreatmentModalProps) {
  const { treatments, staff, licenseDaysLeft, updateLocal, deleteLocal, transactions } = useData();
  const { presentDoctors } = useAvailableDoctors();
  const [showAllDoctors, setShowAllDoctors] = useState(false);
  const effectiveDoctors = showAllDoctors
    ? staff.filter(s => ['doctor', 'dentist'].includes(s.role?.toLowerCase()))
    : presentDoctors;

  // Treatment related state
  const [selectedTreatments, setSelectedTreatments] = useState<SelectedTreatment[]>([]);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentFee, setNewTreatmentFee] = useState('');

  // Treatment date and time
  const [treatmentDate, setTreatmentDate] = useState('');
  const [treatmentTime, setTreatmentTime] = useState('');

  // Pre-receive payment - stored in queue item
  const [preReceiveAmount, setPreReceiveAmount] = useState('');
  const [preReceiveNotes, setPreReceiveNotes] = useState('');
  const [hasPreReceive, setHasPreReceive] = useState(false);

  // Financial calculations
  const [manualTotal, setManualTotal] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualEdited, setIsManualEdited] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Track the patient's total consistent advance balance to avoid double counting on re-opens
  const [activePatientCredit, setActivePatientCredit] = useState(0);

  const [paymentBreakdown, setPaymentBreakdown] = useState({
    totalTreatments: 0,
    totalAmount: 0,
    totalPaid: 0,
    pendingBalance: 0,
    currentPending: 0,
    newPending: 0,
    preReceived: 0
  });

  const hasLoadedData = useRef(false);
  const isInitialLoad = useRef(true);

  // Check if we're editing an existing completed treatment
  useEffect(() => {
    if (open && queueItem) {
      const hasExistingTreatment = queueItem.treatment && queueItem.treatment !== 'No treatments yet';
      const wasCompleted = queueItem.status === 'completed' || queueItem.treatmentEndTime;

      if (hasExistingTreatment && wasCompleted) {
        setIsEditMode(true);
      } else {
        setIsEditMode(false);
      }

      // Load pre-receive ONLY from queue item (advance added this specific visit)
      const queuePreReceive = queueItem.preReceiveAmount || 0;
      
      // Patient's total credit (from props). If this is a reopening, it ALREADY includes queuePreReceive.
      const baseCredit = patientData?.preReceiveBalance || 0;
      setActivePatientCredit(baseCredit);
      
      if (queuePreReceive > 0) {
        setHasPreReceive(true);
        setPaymentBreakdown(prev => ({ ...prev, preReceived: queuePreReceive }));
      } else {
        setHasPreReceive(false);
        setPaymentBreakdown(prev => ({ ...prev, preReceived: 0 }));
      }
    }
  }, [open, queueItem, patientData]);

  // Initialize date/time
  useEffect(() => {
    if (open && queueItem) {
      if (queueItem.treatmentDate) {
        setTreatmentDate(queueItem.treatmentDate as string);
      } else {
        const now = new Date();
        setTreatmentDate(now.toISOString().split('T')[0]);
      }

      if (queueItem.treatmentTime) {
        setTreatmentTime(queueItem.treatmentTime as string);
      } else {
        const now = new Date();
        setTreatmentTime(now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
      }
    }
  }, [open, queueItem]);

  // Load existing treatments from queue item
  useEffect(() => {
    if (!open || !queueItem || hasLoadedData.current) return;

    const loadExistingData = async () => {
      try {
        if (queueItem.treatment && queueItem.treatment !== 'No treatments yet') {
          const treatmentNames = queueItem.treatment.split(', ');
          const loadedTreatments: SelectedTreatment[] = [];

          // Robust parsing for multiple formats and DEDUPLICATION
          const seenTreatments = new Set<string>();
          for (const t of treatmentNames) {
            const trimmed = t.trim();
            if (!trimmed || seenTreatments.has(trimmed)) continue;
            seenTreatments.add(trimmed);

            const match = trimmed.match(/(.+?)\s*(?:\(Rs\.\s*|Rs\.\s*|)\s*([\d,.]+)\)?/i);
            if (match) {
              loadedTreatments.push({
                name: match[1].trim(),
                fee: parseInt(match[2].replace(/,/g, '')),
                id: `treatment-${Date.now()}-${Math.random()}`
              });
            } else {
              loadedTreatments.push({
                name: trimmed,
                fee: 0,
                id: `treatment-${Date.now()}-${Math.random()}`
              });
            }
          }

          if (loadedTreatments.length > 0) {
            setSelectedTreatments(loadedTreatments);
          } else {
            setSelectedTreatments([]);
          }
        } else {
          setSelectedTreatments([]);
        }

        if (queueItem.doctorId) {
          setSelectedDoctor(queueItem.doctorId);
        }

        hasLoadedData.current = true;
      } catch (error) {
        console.error('Failed to load existing data:', error);
      }
    };

    loadExistingData();
  }, [open, queueItem]);

  // Calculate payment statistics
  useEffect(() => {
    if (!open) return;

    let totalTreatments = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let pendingBalance = 0;
    let currentPending = 0;

    if (patientData) {
      totalTreatments = patientData.totalVisits || 0;
      totalPaid = patientData.totalPaid || 0;
      pendingBalance = patientData.pendingBalance || 0;
      totalAmount = (patientHistory?.queueHistory || []).reduce((sum, item) => sum + (item.fee || 0), 0);

      if (totalAmount === 0 && (pendingBalance > 0 || totalPaid > 0)) {
        totalAmount = pendingBalance + totalPaid;
      }
    } else {
      totalTreatments = patientHistory?.queueHistory?.length || 0;
      totalAmount = (patientHistory?.queueHistory || []).reduce((sum, item) => sum + (item.fee || 0), 0);
      totalPaid = (patientHistory?.paymentHistory || []).reduce((sum, payment) => sum + (payment.amountPaid || 0), 0);
      pendingBalance = patientInfo?.pendingBalance || 0;
    }

    currentPending = pendingBalance - paymentBreakdown.preReceived;

    setPaymentBreakdown(prev => ({
      ...prev,
      totalTreatments,
      totalAmount,
      totalPaid,
      pendingBalance,
      currentPending: Math.max(0, currentPending),
      newPending: Math.max(0, currentPending)
    }));

    if (isInitialLoad.current) {
      setManualTotal(currentPending.toString());
      isInitialLoad.current = false;
    }
  }, [open, patientData, patientHistory, patientInfo, paymentBreakdown.preReceived]);

  const actualTotal = selectedTreatments.reduce((sum, t) => sum + t.fee, 0);

  useEffect(() => {
    if (isManualEdited || !open) return;
    const newManualTotal = (actualTotal + paymentBreakdown.currentPending).toString();
    setManualTotal(newManualTotal);
  }, [actualTotal, paymentBreakdown.currentPending, isManualEdited, open]);

  useEffect(() => {
    if (!open) return;

    const manualAmount = parseFloat(manualTotal) || 0;
    const totalDue = actualTotal + paymentBreakdown.currentPending;

    if (manualAmount < paymentBreakdown.currentPending) {
      toast.warning('Amount cannot be less than previous pending balance');
      setManualTotal(paymentBreakdown.currentPending.toString());
      setDiscount(0);
      return;
    }

    const effectiveDiscount = totalDue - manualAmount;
    setDiscount(effectiveDiscount > 0 ? effectiveDiscount : 0);

    const effectiveFee = manualAmount - paymentBreakdown.currentPending;
    const newPending = paymentBreakdown.currentPending + effectiveFee;
    setPaymentBreakdown(prev => ({
      ...prev,
      newPending
    }));
  }, [manualTotal, actualTotal, paymentBreakdown.currentPending, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setNewTreatmentName('');
        setNewTreatmentFee('');
        setPreReceiveAmount('');
        setPreReceiveNotes('');
        setIsSubmitting(false);
        setIsManualEdited(false);
        hasLoadedData.current = false;
        isInitialLoad.current = true;
        setIsEditMode(false);
        setHasPreReceive(false);
        setSelectedTreatments([]);
        setSelectedDoctor('');
        setDiscount(0);
        setManualTotal('');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualEdited(true);
    setManualTotal(e.target.value);
  };

  const handleAddTreatment = () => {
    const feeNum = parseFloat(newTreatmentFee) || 0;
    if (newTreatmentName && feeNum >= 0) {
      setSelectedTreatments([...selectedTreatments, {
        name: newTreatmentName,
        fee: feeNum,
        id: `treatment-${Date.now()}-${Math.random()}`
      }]);
      setNewTreatmentName('');
      setNewTreatmentFee('');
    } else {
      toast.error('Enter valid treatment name and fee');
    }
  };

  const handleRemoveTreatment = (id: string) => {
    setSelectedTreatments(selectedTreatments.filter(t => t.id !== id));
  };

  // const handleAddPreReceive = async () => {
  //   const amount = parseFloat(preReceiveAmount);
  //   if (isNaN(amount) || amount <= 0) {
  //     toast.error('Please enter a valid amount');
  //     return;
  //   }

  //   try {
  //     const timestamp = new Date().toISOString();

  //     // Save pre-receive to queue item
  //     const updatedQueueItem = {
  //       ...queueItem,
  //       preReceiveAmount: amount,
  //       preReceiveNotes: preReceiveNotes,
  //       updatedAt: timestamp
  //     };

  //     await updateLocal('queue', updatedQueueItem);

  //     setHasPreReceive(true);
  //     setPaymentBreakdown(prev => ({
  //       ...prev,
  //       preReceived: amount,
  //       currentPending: Math.max(0, prev.currentPending - amount)
  //     }));

  //     setPreReceiveAmount('');
  //     setPreReceiveNotes('');

  //     toast.success(`Pre-receive payment of Rs. ${amount} added for this treatment`);
  //   } catch (error) {
  //     console.error('Failed to add pre-receive payment:', error);
  //     toast.error('Failed to add payment');
  //   }
  // };

  const handleAddPreReceive = async () => {
    const amount = parseFloat(preReceiveAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const paymentDate = treatmentDate;
      const paymentTime = treatmentTime;

      // 1. Save advance amount on the queue item (scoped to this visit)
      const updatedQueueItem = {
        ...queueItem,
        preReceiveAmount: amount,
        preReceiveNotes: preReceiveNotes,
        updatedAt: timestamp
      };
      await updateLocal('queue', updatedQueueItem);

      // 2. Save advance on the PATIENT as a persistent credit balance
      //    DO NOT touch pendingBalance here — that is settled in the payment modal
      //    after the treatment fee is known.
      if (patientData) {
        const existingCredit = patientData.preReceiveBalance || 0;
        const updatedPatient = {
          ...patientData,
          preReceiveBalance: existingCredit + amount,  // accumulate credit
          updatedAt: timestamp
        };
        await updateLocal('patients', updatedPatient);

        // 3. Create a transaction record for audit trail
        const newTransaction: Transaction = {
          id: `pre-${Date.now()}`,
          patientId: patientData.id,
          patientNumber: patientData.patientNumber,
          patientName: patientData.name,
          amount: amount,
          date: `${paymentDate}T${paymentTime}`,
          type: 'pre_receive',
          method: 'cash',
          notes: preReceiveNotes || 'Advance payment received',
          paymentDate: paymentDate,
          paymentTime: paymentTime,
          fullPaymentDateTime: `${paymentDate}T${paymentTime}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          queueItemId: queueItem?.id
        };
        await updateLocal('transactions', newTransaction);
      }

      // Update local state to reflect the new total
      setActivePatientCredit(prev => prev + amount);

      setHasPreReceive(true);
      setPaymentBreakdown(prev => ({
        ...prev,
        preReceived: amount
      }));

      setPreReceiveAmount('');
      setPreReceiveNotes('');

      toast.success(`Advance payment of Rs. ${amount} recorded`);
    } catch (error) {
      console.error('Failed to add pre-receive payment:', error);
      toast.error('Failed to record advance payment');
    }
  };

  // const handleDeletePreReceive = async () => {
  //   if (!queueItem) return;

  //   if (!confirm(`Are you sure you want to remove the pre-receive payment?`)) return;

  //   try {
  //     const updatedQueueItem = {
  //       ...queueItem,
  //       preReceiveAmount: 0,
  //       preReceiveNotes: '',
  //       updatedAt: new Date().toISOString()
  //     };

  //     await updateLocal('queue', updatedQueueItem);

  //     setHasPreReceive(false);
  //     setPaymentBreakdown(prev => ({
  //       ...prev,
  //       preReceived: 0,
  //       currentPending: prev.currentPending + (queueItem.preReceiveAmount || 0)
  //     }));

  //     toast.success('Pre-receive payment removed');
  //   } catch (error) {
  //     console.error('Failed to delete pre-receive:', error);
  //     toast.error('Failed to remove payment');
  //   }
  // };

  const handleDeletePreReceive = async () => {
    if (!queueItem) return;

    try {
      const timestamp = new Date().toISOString();
      const removedAmount = queueItem.preReceiveAmount || paymentBreakdown.preReceived || 0;

      // 1. Clear advance amount on the queue item
      const updatedQueueItem = {
        ...queueItem,
        preReceiveAmount: 0,
        preReceiveNotes: '',
        updatedAt: timestamp
      };
      await updateLocal('queue', updatedQueueItem);

      // 2. Reverse the credit on the patient record
      if (patientData && removedAmount > 0) {
        const updatedPatient = {
          ...patientData,
          preReceiveBalance: Math.max(0, (patientData.preReceiveBalance || 0) - removedAmount),
          updatedAt: timestamp
        };
        await updateLocal('patients', updatedPatient);
      }

      // 3. Delete the transaction record if exists
      const preReceiveTransaction = (transactions || []).find(t =>
        t.queueItemId === queueItem.id && t.type === 'pre_receive'
      );
      if (preReceiveTransaction) {
        await deleteLocal('transactions', preReceiveTransaction.id);
      }

      // 4. Update local state
      setHasPreReceive(false);
      setPaymentBreakdown(prev => ({
        ...prev,
        preReceived: 0
      }));

      toast.success('Advance payment removed');

    } catch (error) {
      console.error('Failed to remove advance payment:', error);
      toast.error('Failed to remove advance payment');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    const doctorName = effectiveDoctors.find(d => d.id === selectedDoctor)?.name || 'Not assigned';
    const treatmentDateTime = treatmentDate && treatmentTime
      ? `${new Date(treatmentDate).toLocaleDateString()} at ${treatmentTime}`
      : 'Not specified';

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Treatment Invoice - ${queueItem?.patientName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #1e40af; font-size: 28px; margin-bottom: 5px; }
            .section-title { background: #f1f5f9; padding: 10px 15px; font-weight: bold; color: #1e293b; border-left: 4px solid #2563eb; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #1e40af; color: white; padding: 12px; text-align: left; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            .totals { background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .total-row.grand { border-top: 2px solid #2563eb; margin-top: 10px; padding-top: 15px; font-size: 18px; font-weight: bold; color: #1e40af; }
            .pre-receive { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 15px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Treatment Invoice</h1>
            <p>Date: ${treatmentDate ? new Date(treatmentDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
          </div>
          <div class="info-row"><strong>Patient:</strong> ${queueItem?.patientName}</div>
          <div class="info-row"><strong>Token #:</strong> ${queueItem?.tokenNumber}</div>
          <div class="info-row"><strong>Patient ID:</strong> ${queueItem?.patientNumber || queueItem?.patientId || 'N/A'}</div>
          <div class="info-row"><strong>Doctor:</strong> ${doctorName}</div>
          <div class="info-row"><strong>Treatment Date & Time:</strong> ${treatmentDateTime}</div>
          
          ${selectedTreatments.length > 0 ? `
            <div class="section-title">Treatments</div>
            <table>
              <thead>
                <tr><th>Treatment</th><th style="text-align: right;">Fee (Rs.)</th></tr>
              </thead>
              <tbody>
                ${selectedTreatments.map(t => `<tr><td>${t.name}</td><td style="text-align: right;">Rs. ${t.fee.toLocaleString()}</td></tr>`).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #666; margin: 20px 0;">No treatments added</p>'}
          
          <div class="totals">
            <div class="total-row"><span>Previous Pending Balance:</span><span>Rs. ${paymentBreakdown.pendingBalance.toLocaleString()}</span></div>
            ${selectedTreatments.length > 0 ? `<div class="total-row"><span>Current Treatment Fee:</span><span>Rs. ${actualTotal.toLocaleString()}</span></div>` : ''}
            
            <div class="total-row" style="border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 10px;">
              <span>Total Bill Before Adjustments:</span>
              <span>Rs. ${(paymentBreakdown.pendingBalance + actualTotal).toLocaleString()}</span>
            </div>

            ${paymentBreakdown.preReceived > 0 ? `
              <div class="total-row" style="color: #6d28d9;">
                <span>Advance Credit Applied:</span>
                <span>- Rs. ${paymentBreakdown.preReceived.toLocaleString()}</span>
              </div>
            ` : ''}
            
            ${discount > 0 ? `
              <div class="total-row" style="color: #16a34a;">
                <span>Discount Applied:</span>
                <span>- Rs. ${discount.toLocaleString()}</span>
              </div>
            ` : ''}
            
            <div class="total-row grand">
              <span>Final Total Due:</span>
              <span>Rs. ${(parseFloat(manualTotal) || 0).toLocaleString()}</span>
            </div>
          </div>
          <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer; margin-right: 10px;">Print</button>
            <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 12px 30px; border-radius: 6px; cursor: pointer;">Close</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    toast.success('Print preview opened');
  };

  const handleSubmit = async () => {
    if (licenseDaysLeft <= 0) {
      toast.error("License Expired. Please renew to process treatments.");
      return;
    }

    if (!selectedDoctor) {
      toast.error('Please select a doctor');
      return;
    }

    if (!treatmentDate || !treatmentTime) {
      toast.error('Please select treatment date and time');
      return;
    }

    const manualAmount = parseFloat(manualTotal);
    if (isNaN(manualAmount) || manualAmount < 0) {
      toast.error('Enter valid total amount');
      return;
    }

    if (manualAmount < paymentBreakdown.currentPending) {
      toast.error('Amount cannot be less than previous pending balance');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isEditMode ? 'Updating treatment...' : 'Saving treatment...');

    try {
      const treatmentString = selectedTreatments.length > 0
        ? selectedTreatments.map(t => `${t.name} (Rs. ${t.fee})`).join(', ')
        : 'No treatments yet';

      const effectiveFee = manualAmount - paymentBreakdown.currentPending;

      const assignedDoctor = effectiveDoctors.find(d => d.id === selectedDoctor);

      const data = {
        treatment: treatmentString,
        fee: effectiveFee,
        doctor: assignedDoctor?.name || selectedDoctor,
        doctorId: selectedDoctor,
        treatmentDate: treatmentDate,
        treatmentTime: treatmentTime,
        treatmentDateTime: `${treatmentDate}T${treatmentTime}`,
        isEdit: isEditMode,
        originalQueueItem: isEditMode ? queueItem : undefined,
        preReceiveAmount: paymentBreakdown.preReceived
      };

      onSubmit(data);

      onClose();
      toast.success(isEditMode ? 'Treatment updated successfully!' : 'Treatment saved successfully!', { id: toastId });

    } catch (error) {
      console.error('Error saving treatment:', error);
      toast.error('Failed to save treatment', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return 'Rs. ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!open || !queueItem) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold">
              {isEditMode ? 'Edit Treatment - ' : 'Complete Treatment - '}
              {queueItem.patientName}
            </h2>
            {isEditMode && (
              <p className="text-xs text-amber-600 mt-1">
                Editing existing treatment record. Changes will update the original record.
              </p>
            )}
            <p className="text-sm text-gray-500">Patient ID: {queueItem.patientNumber || queueItem.patientId || 'N/A'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Treatment Date & Time Section */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Treatment Date & Time
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Treatment Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={treatmentDate}
                    onChange={(e) => setTreatmentDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Treatment Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="time"
                    step="1"
                    className="pl-9"
                    value={treatmentTime}
                    onChange={(e) => setTreatmentTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Patient Info & Payment Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Patient Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Name</Label>
                  <p className="font-medium">{queueItem.patientName}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <p className="font-medium">{queueItem.patientPhone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Total Visits</Label>
                  <p className="font-medium">{paymentBreakdown.totalTreatments}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Lifetime Total</Label>
                  <p className="font-medium text-green-700">{formatCurrency(paymentBreakdown.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Financial Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span>Previous Credits (Advance Balance):</span>
                  <span className="font-bold text-purple-700">{formatCurrency(Math.max(0, activePatientCredit - paymentBreakdown.preReceived))}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>New Advance Paid Today:</span>
                  <span className="font-bold text-green-600">+{formatCurrency(paymentBreakdown.preReceived)}</span>
                </div>
                <div className="flex justify-between items-center border-t pt-2 text-sm">
                  <span className="font-semibold">Total Available Advance Credit:</span>
                  <span className="font-extrabold text-blue-700">
                    {formatCurrency(activePatientCredit)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-t border-blue-200 pt-2 text-sm">
                  <span>Pending Dues:</span>
                  <span className="font-medium text-red-600">{formatCurrency(paymentBreakdown.pendingBalance)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-Receive Payment Section */}
          <div className="border rounded-lg p-4 bg-yellow-50">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pre-Receive Payment (Advance payment)
            </h3>
            {hasPreReceive ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-yellow-100 rounded-lg border border-yellow-200">
                  <div>
                    <p className="text-xs text-yellow-700 font-medium">New Advance Added (This Visit)</p>
                    <p className="font-bold text-lg">{formatCurrency(paymentBreakdown.preReceived)}</p>
                    {queueItem?.preReceiveNotes && <p className="text-xs text-gray-600 mt-1">Note: {queueItem.preReceiveNotes}</p>}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeletePreReceive}
                  >
                    <Trash className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
                <div className="bg-green-50 p-2 rounded text-[10px] text-green-700 italic border border-green-100">
                  💡 This amount has been added to the patient's persistent credit balance.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (Rs.)</Label>
                  <Input
                    type="number"
                    placeholder="Enter advance amount"
                    value={preReceiveAmount}
                    onChange={(e) => setPreReceiveAmount(e.target.value)}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes (Optional)</Label>
                  <Input
                    placeholder="Payment notes"
                    value={preReceiveNotes}
                    onChange={(e) => setPreReceiveNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
            {!hasPreReceive && (
              <Button
                onClick={handleAddPreReceive}
                className="mt-3 w-full bg-yellow-600 hover:bg-yellow-700 shadow-sm"
                disabled={!preReceiveAmount}
              >
                <Plus className="w-4 h-4 mr-2" /> Add New Advance Payment
              </Button>
            )}
          </div>

          {/* Add Treatments */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Treatments (Optional)
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={undefined} onValueChange={(val) => {
                  const selected = treatments.find(t => t.id === val);
                  if (selected) {
                    setNewTreatmentName(selected.name);
                    setNewTreatmentFee(selected.fee.toString());
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select treatment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} - Rs. {t.fee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Or type new treatment"
                value={newTreatmentName}
                onChange={e => setNewTreatmentName(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Fee (Rs.)"
                value={newTreatmentFee}
                onChange={e => setNewTreatmentFee(e.target.value)}
                className="w-32"
                min="0"
                step="1"
              />
              <Button onClick={handleAddTreatment} className="gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          {/* Selected Treatments Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-100">
                <TableRow>
                  <TableHead>Treatment</TableHead>
                  <TableHead className="text-right">Fee (Rs.)</TableHead>
                  <TableHead className="w-16 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTreatments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                      No treatments added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedTreatments.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(t.fee)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTreatment(t.id!)}
                        >
                          <Trash className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {selectedTreatments.length > 0 && (
              <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                <span className="font-semibold">Actual Total (Sum of Treatments):</span>
                <span className="text-xl font-bold text-green-700">{formatCurrency(actualTotal)}</span>
              </div>
            )}
          </div>

          {/* Current Treatment Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="manualTotal" className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4" />
                  Final Amount to Collect
                </Label>
                <Input
                  id="manualTotal"
                  type="number"
                  value={manualTotal}
                  onChange={handleManualChange}
                  placeholder="Auto: previous + treatments sum"
                  min={paymentBreakdown.currentPending}
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: Previous pending + current treatments. Edit to apply discount.
                </p>
              </div>

              <div>
                <Label className="mb-2">Discount (Auto Calculated)</Label>
                <Input value={formatCurrency(discount)} disabled className="bg-gray-100" />
                <p className="text-xs text-gray-500 mt-1">
                  {discount > 0
                    ? `Discount applied: ${formatCurrency(discount)}`
                    : 'No discount applied'}
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-amber-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                Updated Pending Amount
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Current Pending:</span>
                  <span className="font-medium text-red-600">{formatCurrency(paymentBreakdown.currentPending)}</span>
                </div>
                {selectedTreatments.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">This Treatment (after discount):</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(paymentBreakdown.newPending - paymentBreakdown.currentPending || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-semibold">New Total Pending (after this):</span>
                  <span className="font-bold text-red-700">
                    {formatCurrency(paymentBreakdown.newPending)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Doctor Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Assign Doctor
              </Label>
              <div className="flex items-center space-x-2">
                <Label htmlFor="show-all" className="text-xs text-muted-foreground cursor-pointer">Show All</Label>
                <Switch id="show-all" checked={showAllDoctors} onCheckedChange={setShowAllDoctors} />
              </div>
            </div>

            {presentDoctors.length === 0 && !showAllDoctors && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No doctors marked as 'Present' today. Please check Staff/Attendance or enable "Show All".</span>
              </div>
            )}

            <Select onValueChange={setSelectedDoctor} value={selectedDoctor}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor..." />
              </SelectTrigger>
              <SelectContent>
                {effectiveDoctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} {d.status === 'Absent' ? '(Absent)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedDoctor || !treatmentDate || !treatmentTime || isSubmitting || licenseDaysLeft <= 0}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditMode ? 'Update Treatment' : 'Save & Complete Treatment'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}