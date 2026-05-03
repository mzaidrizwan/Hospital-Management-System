'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, MapPin, Activity, DollarSign, FileText, Edit, Trash2, Clock, UserCheck, AlertCircle, TrendingUp, CreditCard, History, ClipboardList, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Patient, QueueItem, Bill, Transaction } from '@/types';
import { format } from 'date-fns';
import { parseAnyDate, formatDisplayDate, getLocalDateString } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';

interface PatientDetailsModalProps {
  patient: Patient;
  patientInfo?: Patient | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showActions?: boolean;
  queueHistory?: QueueItem[];
  bills?: Bill[];
  transactions?: Transaction[];
  preReceiveTotal?: number;
}

export default function PatientDetailsModal({
  patient,
  patientInfo,
  onClose,
  onEdit,
  onDelete,
  showActions = true,
  queueHistory = [],
  bills = [],
  transactions = [],
  preReceiveTotal = 0
}: PatientDetailsModalProps) {
  const { updateLocal, patients } = useData();
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'bills'>('overview');
  const [loading, setLoading] = useState(false);

  const displayPatient = patients?.find(p => p.id === patient.id) || patient;

  // Payment State
  const [isPaymentMode, setIsPaymentMode] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDiscount, setPaymentDiscount] = useState('');
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  const [history, setHistory] = useState<{
    queueHistory: QueueItem[];
    bills: Bill[];
  }>({
    queueHistory: [],
    bills: []
  });

  const hasPreReceive = preReceiveTotal > 0 && transactions && transactions.length > 0;
  const preReceiveTransactions = transactions?.filter(t => t.type === 'pre_receive' || t.type === 'pre_receive_return') || [];
  const [isDiscountMode, setIsDiscountMode] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [isDiscountSubmitting, setIsDiscountSubmitting] = useState(false);

  const [isEditAdvanceMode, setIsEditAdvanceMode] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [isReturnAdvanceMode, setIsReturnAdvanceMode] = useState(false);
  const [returnAmount, setReturnAmount] = useState('');

  const handleEditAdvanceSubmit = async () => {
    const amount = parseFloat(advanceAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsPaymentSubmitting(true);

      const now = new Date().toISOString();
      const difference = amount - (displayPatient.preReceiveBalance || 0);

      if (difference !== 0) {
        const txnType = difference > 0 ? 'pre_receive' : 'treatment_payment';
        const newTxn: Transaction = {
          id: `TXN-${Date.now()}`,
          patientId: displayPatient.id,
          patientNumber: displayPatient.patientNumber,
          patientName: displayPatient.name,
          amount: Math.abs(difference),
          date: now,
          fullPaymentDateTime: now,
          type: txnType,
          method: 'adjustment',
          notes: 'Manual adjustment of advance credit via Patient Details',
          paymentDate: getLocalDateString(new Date()),
          paymentTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          createdAt: now,
          updatedAt: now
        };
        await updateLocal('transactions', newTxn);
      }

      const updatedPatient = {
        ...displayPatient,
        preReceiveBalance: amount,
        updatedAt: now
      };

      await updateLocal('patients', updatedPatient);

      toast.success(`Advance credit updated to Rs. ${amount}`);
      setIsEditAdvanceMode(false);
    } catch (error) {
      toast.error("Failed to update advance credit");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handleReturnAdvanceSubmit = async () => {
    const amount = parseFloat(returnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > (displayPatient.preReceiveBalance || 0)) {
      toast.error("Return amount cannot exceed current pre-receive balance");
      return;
    }

    try {
      setIsPaymentSubmitting(true);

      const now = new Date().toISOString();
      const newPreReceiveBalance = (displayPatient.preReceiveBalance || 0) - amount;

      // Create a transaction for the return
      const newTxn: Transaction = {
        id: `TXN-${Date.now()}`,
        patientId: displayPatient.id,
        patientNumber: displayPatient.patientNumber,
        patientName: displayPatient.name,
        amount: amount,
        date: now,
        fullPaymentDateTime: now,
        type: 'pre_receive_return',
        method: 'cash',
        notes: 'Pre-receive amount returned to patient',
        paymentDate: getLocalDateString(new Date()),
        paymentTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        createdAt: now,
        updatedAt: now
      };
      
      await updateLocal('transactions', newTxn);

      const updatedPatient = {
        ...displayPatient,
        preReceiveBalance: newPreReceiveBalance,
        updatedAt: now
      };

      await updateLocal('patients', updatedPatient);

      toast.success(`Rs. ${amount} returned to patient. New advance credit: Rs. ${newPreReceiveBalance}`);
      setIsReturnAdvanceMode(false);
      setReturnAmount('');
    } catch (error) {
      console.error("Return error:", error);
      toast.error("Failed to process return");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };
  //   const amount = parseFloat(paymentAmount);
  //   if (!amount || amount <= 0) {
  //     toast.error("Please enter a valid amount");
  //     return;
  //   }

  //   try {
  //     setIsPaymentSubmitting(true);

  //     const now = new Date();
  //     const [year, month, day] = paymentDate.split('-').map(Number);
  //     const selectedDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
  //     const finalDateISO = selectedDate.toISOString();

  //     const newBill: Bill = {
  //       id: `BILL-${Date.now()}`,
  //       billNumber: `PAY-${Date.now()}`,
  //       patientId: displayPatient.patientNumber,
  //       patientNumber: displayPatient.patientNumber,
  //       patientName: displayPatient.name,
  //       treatment: 'Balance Payment / Credit Update',
  //       totalAmount: 0,
  //       amountPaid: amount,
  //       discount: 0,
  //       paymentMethod: paymentMethod,
  //       paymentStatus: 'paid',
  //       createdDate: finalDateISO,
  //       notes: paymentNotes || 'Manual balance update via Patient Details',
  //     };

  //     const currentPending = displayPatient.pendingBalance || 0;
  //     const currentTotalPaid = displayPatient.totalPaid || 0;

  //     const newPendingBalance = currentPending - amount;
  //     const newTotalPaid = currentTotalPaid + amount;

  //     const updatedPatient = {
  //       ...displayPatient,
  //       pendingBalance: newPendingBalance,
  //       totalPaid: newTotalPaid,
  //       lastVisit: finalDateISO,
  //       updatedAt: finalDateISO
  //     };

  //     await updateLocal('bills', newBill);
  //     await updateLocal('patients', updatedPatient);

  //     setHistory(prev => ({
  //       ...prev,
  //       bills: [newBill, ...prev.bills]
  //     }));

  //     toast.success(`Payment of Rs. ${amount} recorded successfully`);
  //     setIsPaymentMode(false);
  //     setPaymentAmount('');
  //     setPaymentDate(new Date().toISOString().split('T')[0]);
  //     setPaymentNotes('');
  //   } catch (error) {
  //     console.error("Payment error:", error);
  //     toast.error("Failed to record payment");
  //   } finally {
  //     setIsPaymentSubmitting(false);
  //   }
  // };

  const handlePaymentSubmit = async (shouldPrint: boolean = true) => {
    const amount = parseFloat(paymentAmount) || 0;
    const discount = parseFloat(paymentDiscount) || 0;
    
    if (amount <= 0 && discount <= 0) {
      toast.error("Please enter a valid amount or discount");
      return;
    }

    try {
      setIsPaymentSubmitting(true);

      const now = new Date();
      const [year, month, day] = paymentDate.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      const finalDateISO = selectedDate.toISOString();

      const newBill: Bill = {
        id: `BILL-${Date.now()}`,
        billNumber: `PAY-${Date.now()}`,
        patientId: displayPatient.id,
        patientNumber: displayPatient.patientNumber,
        patientName: displayPatient.name,
        treatment: discount > 0 ? `Balance Payment & Discount` : 'Balance Payment / Credit Update',
        totalAmount: discount, // Representing the adjustment
        amountPaid: amount,
        discount: discount,
        paymentMethod: paymentMethod,
        paymentStatus: 'paid',
        createdDate: finalDateISO,
        notes: paymentNotes || 'Manual balance update via Patient Details',
      };

      const currentPending = displayPatient.pendingBalance || 0;
      const currentTotalPaid = displayPatient.totalPaid || 0;

      const newPendingBalance = currentPending - amount - discount;
      const newTotalPaid = currentTotalPaid + amount;

      const updatedPatient = {
        ...displayPatient,
        pendingBalance: newPendingBalance,
        totalPaid: newTotalPaid,
        lastVisit: finalDateISO,
        updatedAt: finalDateISO
      };

      await updateLocal('bills', newBill);
      
      // Add transaction records for audit trail
      if (amount > 0) {
        const paymentTxn: Transaction = {
          id: `tx-pay-${Date.now()}`,
          patientId: displayPatient.id,
          patientNumber: displayPatient.patientNumber,
          patientName: displayPatient.name,
          amount: amount,
          date: finalDateISO,
          fullPaymentDateTime: finalDateISO,
          type: 'treatment_payment',
          method: paymentMethod as any,
          notes: paymentNotes || 'Balance payment',
          paymentDate: paymentDate,
          paymentTime: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          createdAt: finalDateISO,
          updatedAt: finalDateISO
        };
        await updateLocal('transactions', paymentTxn);
      }

      if (discount > 0) {
        const discountTxn: Transaction = {
          id: `tx-disc-${Date.now()}`,
          patientId: displayPatient.id,
          patientNumber: displayPatient.patientNumber,
          patientName: displayPatient.name,
          amount: discount,
          date: finalDateISO,
          fullPaymentDateTime: finalDateISO,
          type: 'treatment_payment', // Or maybe a new type? Let's stay with treatment_payment for now or 'adjustment'
          method: 'adjustment' as any,
          notes: `Discount applied: ${paymentNotes || 'No reason'}`,
          paymentDate: paymentDate,
          paymentTime: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          createdAt: finalDateISO,
          updatedAt: finalDateISO
        };
        await updateLocal('transactions', discountTxn);
      }

      await updateLocal('patients', updatedPatient);

      setHistory(prev => ({
        ...prev,
        bills: [newBill, ...prev.bills]
      }));

      // Print receipt if requested
      if (shouldPrint) {
        handlePrintReceipt(amount, newPendingBalance, newTotalPaid, discount);
      }

      toast.success(`Payment of Rs. ${amount} ${discount > 0 ? `and Discount of Rs. ${discount} ` : ''}recorded successfully`);
      setIsPaymentMode(false);
      setPaymentAmount('');
      setPaymentDiscount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentNotes('');
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to record payment");
    } finally {
      setIsPaymentSubmitting(false);
    }
  };

  const handlePrintReceipt = (amount: number, newPendingBalance: number, newTotalPaid: number, discount: number = 0) => {
    const now = new Date();
    const dateStr = now.toLocaleString('en-PK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const printContent = `
Receipt Type: BALANCE PAYMENT
Date: ${dateStr}
Patient: ${displayPatient.name}
Patient ID: ${displayPatient.patientNumber || displayPatient.id || 'N/A'}
Phone: ${displayPatient.phone || 'N/A'}
================================

PAYMENT DETAILS
--------------------------------
Cash Received      : Rs. ${amount.toFixed(0)}
${discount > 0 ? `Discount Applied   : Rs. ${discount.toFixed(0)}\n` : ''}Payment Method     : ${paymentMethod.toUpperCase()}
Payment Date       : ${paymentDate}
--------------------------------

BALANCE SUMMARY
--------------------------------
Previous Balance   : Rs. ${(displayPatient.pendingBalance || 0).toFixed(0)}
Cash Paid          : - Rs. ${amount.toFixed(0)}
${discount > 0 ? `Discount Applied   : - Rs. ${discount.toFixed(0)}\n` : ''}--------------------------------
New Balance        : Rs. ${newPendingBalance.toFixed(0)}
================================
${paymentNotes || ''}
================================
Thank You! Visit Again
Powered by Saynz Technologies
Contact: 0347 1887181
`.trim();

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt - ${displayPatient.name}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              margin: 0; 
              padding: 5mm; 
              font-family: Arial, Helvetica, sans-serif; 
              font-size: 13px; 
              line-height: 1.4; 
              width: 72mm; 
              word-wrap: break-word;
              font-weight: 600;
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
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="clinic-title">JINNAH DENTAL CLINIC 🦷</div>
          <div class="divider"></div>
          
          <pre style="margin: 0; font-size:12px;">${printContent}</pre>

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
    }
  };

  const handleDiscountSubmit = async (shouldPrint: boolean = true) => {
    const discount = parseFloat(discountAmount) || 0;

    if (discount <= 0) {
      toast.error("Please enter a valid discount amount");
      return;
    }

    try {
      setIsDiscountSubmitting(true);

      const now = new Date();
      const finalDateISO = now.toISOString();
      const currentPending = displayPatient.pendingBalance || 0;

      // Validate discount
      if (discount > currentPending) {
        toast.error(`Discount cannot exceed pending balance of ${formatCurrency(currentPending)}`);
        setIsDiscountSubmitting(false);
        return;
      }

      const newPendingBalance = currentPending - discount;

      const newBill: Bill = {
        id: `BILL-${Date.now()}`,
        billNumber: `DISC-${Date.now()}`,
        patientId: displayPatient.id,
        patientNumber: displayPatient.patientNumber,
        patientName: displayPatient.name,
        treatment: `Discount Applied: ${discountReason || 'Discount'}`,
        totalAmount: discount,
        amountPaid: 0,
        discount: discount,
        paymentMethod: 'discount',
        paymentStatus: newPendingBalance === 0 ? 'paid' : 'partial',
        createdDate: finalDateISO,
        notes: `Discount: ${discountReason || 'No reason'} | Applied by: ${User?.name || 'Admin'}`,
      };

      const updatedPatient = {
        ...displayPatient,
        pendingBalance: newPendingBalance,
        // totalPaid DOES NOT change for discount
        lastVisit: finalDateISO,
        updatedAt: finalDateISO
      };

      await updateLocal('bills', newBill);
      
      // Add transaction record for audit trail
      const discountTxn: Transaction = {
        id: `tx-disc-${Date.now()}`,
        patientId: displayPatient.id,
        patientNumber: displayPatient.patientNumber,
        patientName: displayPatient.name,
        amount: discount,
        date: finalDateISO,
        fullPaymentDateTime: finalDateISO,
        type: 'treatment_payment', // Using this for general balance adjustments
        method: 'adjustment' as any,
        notes: `Discount applied (Balance Update): ${discountReason || 'No reason'}`,
        paymentDate: getLocalDateString(new Date()),
        paymentTime: now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        createdAt: finalDateISO,
        updatedAt: finalDateISO
      };
      await updateLocal('transactions', discountTxn);

      await updateLocal('patients', updatedPatient);

      setHistory(prev => ({
        ...prev,
        bills: [newBill, ...prev.bills]
      }));

      // Print receipt if requested
      if (shouldPrint) {
        handlePrintDiscountReceipt(discount, newPendingBalance);
      }

      toast.success(`Discount of ${formatCurrency(discount)} applied successfully`);

      setIsDiscountMode(false);
      setDiscountAmount('');
      setDiscountReason('');

    } catch (error) {
      console.error("Discount error:", error);
      toast.error("Failed to apply discount");
    } finally {
      setIsDiscountSubmitting(false);
    }
  };

  // Add discount print function
  const handlePrintDiscountReceipt = (discount: number, newPendingBalance: number) => {
    const now = new Date();
    const dateStr = now.toLocaleString('en-PK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const printContent = `
================================
JINNAH DENTAL CLINIC 🦷
================================
Receipt Type: DISCOUNT ADJUSTMENT
Date: ${dateStr}
Patient: ${displayPatient.name}
Patient ID: ${displayPatient.patientNumber || displayPatient.id || 'N/A'}
Phone: ${displayPatient.phone || 'N/A'}
================================

DISCOUNT DETAILS
--------------------------------
Discount Amount    : Rs. ${discount.toFixed(0)}
Reason             : ${discountReason || 'N/A'}
--------------------------------

BALANCE SUMMARY
--------------------------------
Previous Balance   : Rs. ${(displayPatient.pendingBalance || 0).toFixed(0)}
Discount Applied   : - Rs. ${discount.toFixed(0)}
--------------------------------
New Balance        : Rs. ${newPendingBalance.toFixed(0)}
--------------------------------
Total Paid to Date : Rs. ${(displayPatient.totalPaid || 0).toFixed(0)}
================================
${discountReason || ''}
================================
Thank You! Visit Again
Powered by Saynz Technologies
Contact: 0347 1887181
`.trim();

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
      <html>
        <head>
          <title>Discount Receipt - ${displayPatient.name}</title>
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
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="clinic-title">JINNAH DENTAL CLINIC 🦷</div>
          <div class="divider"></div>
          <pre style="margin: 0; font-size:12px;">${printContent}</pre>
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
    }
  };

  useEffect(() => {
    if (queueHistory !== undefined || bills !== undefined) {
      setHistory({
        queueHistory: queueHistory || [],
        bills: bills || []
      });
    } else {
      fetchPatientHistory();
    }
  }, [queueHistory, bills]);

  const fetchPatientHistory = async () => {
    try {
      setLoading(true);
      setHistory({
        queueHistory: [],
        bills: []
      });
    } catch (error) {
      console.error('Error fetching patient history:', error);
      toast.error('Failed to load patient history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_treatment': return 'bg-yellow-100 text-yellow-800';
      case 'waiting': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    const numAmount = amount || 0;
    return 'Rs. ' + new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  const safeFormatDate = (dateString: string | undefined | null): string => {
    return formatDisplayDate(dateString);
  };

  if (!patient) return null;

  return (
    // <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
    //   <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto overflow-hidden">
    //     {/* Header */}
    //     <div className="flex items-center justify-between p-5 border-b bg-white sticky top-0 z-10">
    //       <div className="flex items-center gap-4">
    //         <div className="bg-primary/10 p-3 rounded-xl">
    //           <User className="w-7 h-7 text-primary" />
    //         </div>
    //         <div>
    //           <h2 className="text-2xl font-semibold tracking-tight">
    //             {displayPatient.name || 'N/A'}
    //           </h2>
    //           <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
    //             <span>ID: <strong className="font-mono">{displayPatient.patientNumber || displayPatient.id || 'N/A'}</strong></span>
    //             <span>•</span>
    //             <span>Since {safeFormatDate(displayPatient.createdAt)}</span>
    //           </div>
    //         </div>
    //       </div>

    //       <div className="flex items-center gap-3">
    //         {showActions && (
    //           <>
    //             <Button variant="outline" size="sm" onClick={onEdit} className="gap-2 h-9">
    //               <Edit className="w-4 h-4" /> Edit
    //             </Button>
    //             <Button
    //               variant="outline"
    //               size="sm"
    //               onClick={onDelete}
    //               className="gap-2 h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
    //             >
    //               <Trash2 className="w-4 h-4" /> Delete
    //             </Button>
    //           </>
    //         )}
    //         <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 hover:bg-gray-100">
    //           <X className="w-5 h-5" />
    //         </Button>
    //       </div>
    //     </div>

    //     {/* Financial Overview */}
    //     <div className="p-5 bg-gray-50 border-b">
    //       <div className="flex justify-between items-center mb-4">
    //         <h3 className="text-lg font-semibold flex items-center gap-2">
    //           <DollarSign className="w-5 h-5 text-primary" />
    //           Financial Overview
    //         </h3>
    //         <div className="flex gap-2">
    //           <Button
    //             size="sm"
    //             onClick={() => setIsDiscountMode(!isDiscountMode)}
    //             variant={isDiscountMode ? "secondary" : "outline"}
    //             className="font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
    //           >
    //             {isDiscountMode ? "Cancel Discount" : "Apply Discount"}
    //           </Button>
    //           <Button
    //             size="sm"
    //             onClick={() => setIsPaymentMode(!isPaymentMode)}
    //             variant={isPaymentMode ? "secondary" : "default"}
    //             className="font-medium"
    //           >
    //             {isPaymentMode ? "Cancel Payment" : "Receive Payment"}
    //           </Button>
    //         </div>
    //       </div>

    //       {/* Discount Mode Form */}
    //       {isDiscountMode && (
    //         <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-sm">
    //           <h4 className="font-semibold mb-4 text-base text-purple-700">Apply Discount</h4>
    //           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    //             <div className="space-y-2">
    //               <Label className="text-sm font-medium">Discount Amount (Rs.)</Label>
    //               <Input
    //                 type="number"
    //                 value={discountAmount}
    //                 onChange={(e) => setDiscountAmount(e.target.value)}
    //                 placeholder="Enter discount amount"
    //                 min="0"
    //                 max={displayPatient.pendingBalance || 0}
    //                 className="h-10"
    //               />
    //               <p className="text-xs text-purple-600">Max discount: {formatCurrency(displayPatient.pendingBalance || 0)}</p>
    //             </div>
    //             <div className="space-y-2">
    //               <Label className="text-sm font-medium">Discount Reason (Optional)</Label>
    //               <Input
    //                 value={discountReason}
    //                 onChange={(e) => setDiscountReason(e.target.value)}
    //                 placeholder="e.g., Special offer, Loyalty discount"
    //                 className="h-10"
    //               />
    //             </div>
    //           </div>
    //           <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-purple-200">
    //             <Button variant="outline" onClick={() => setIsDiscountMode(false)} className="h-9 px-4">
    //               Cancel
    //             </Button>
    //             <Button
    //               onClick={() => handleDiscountSubmit(false)}
    //               disabled={isDiscountSubmitting || !discountAmount}
    //               className="h-9 px-6 bg-purple-600 hover:bg-purple-700"
    //             >
    //               {isDiscountSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
    //               Apply Discount Only
    //             </Button>
    //             <Button
    //               onClick={() => handleDiscountSubmit(true)}
    //               disabled={isDiscountSubmitting || !discountAmount}
    //               className="h-9 px-6 bg-purple-700 hover:bg-purple-800"
    //             >
    //               {isDiscountSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
    //               Apply & Print
    //             </Button>
    //           </div>
    //         </div>
    //       )}

    //       {isPaymentMode ? (
    //         <div className="bg-white p-5 rounded-xl border shadow-sm">
    //           <h4 className="font-semibold mb-4 text-base">Record Payment</h4>
    //           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    //             <div className="space-y-2">
    //               <Label className="text-sm font-medium">Amount (Rs.)</Label>
    //               <Input
    //                 type="number"
    //                 value={paymentAmount}
    //                 onChange={(e) => setPaymentAmount(e.target.value)}
    //                 placeholder="Enter amount"
    //                 min="0"
    //                 className="h-10"
    //               />
    //             </div>
    //             <div className="space-y-2">
    //               <Label className="text-sm font-medium">Payment Date</Label>
    //               <Input
    //                 type="date"
    //                 value={paymentDate}
    //                 onChange={(e) => setPaymentDate(e.target.value)}
    //                 className="h-10"
    //               />
    //             </div>
    //             <div className="space-y-2">
    //               <Label className="text-sm font-medium">Payment Method</Label>
    //               <Select value={paymentMethod} onValueChange={setPaymentMethod}>
    //                 <SelectTrigger className="h-10">
    //                   <SelectValue placeholder="Select method" />
    //                 </SelectTrigger>
    //                 <SelectContent>
    //                   <SelectItem value="cash">Cash</SelectItem>
    //                   <SelectItem value="online">Online Transfer</SelectItem>
    //                 </SelectContent>
    //               </Select>
    //             </div>
    //             <div className="space-y-2 md:col-span-2">
    //               <Label className="text-sm font-medium">Notes (optional)</Label>
    //               <Input
    //                 value={paymentNotes}
    //                 onChange={(e) => setPaymentNotes(e.target.value)}
    //                 placeholder="Reason for payment (optional)"
    //                 className="h-10"
    //               />
    //             </div>
    //           </div>
    //           <div className="flex justify-end gap-3 mt-5 pt-3 border-t">
    //             <Button variant="outline" onClick={() => setIsPaymentMode(false)} className="h-9 px-4">
    //               Cancel
    //             </Button>
    //             <Button
    //               onClick={() => handlePaymentSubmit(false)}
    //               disabled={isPaymentSubmitting || !paymentAmount}
    //               className="h-9 px-6 bg-blue-600 hover:bg-blue-700"
    //             >
    //               {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
    //               Process Only
    //             </Button>
    //             <Button
    //               onClick={() => handlePaymentSubmit(true)}
    //               disabled={isPaymentSubmitting || !paymentAmount}
    //               className="h-9 px-6 bg-green-600 hover:bg-green-700"
    //             >
    //               {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
    //               Process & Print
    //             </Button>
    //           </div>
    //         </div>
    //       ) : (
    //         <>
    //           {/* Financial Stats Cards */}
    //           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    //             <div className="bg-white p-4 rounded-xl border shadow-sm">
    //               <div className="text-xs text-gray-500 mb-1">Total Treatments</div>
    //               <div className="text-3xl font-bold text-purple-700 tracking-tight">
    //                 {displayPatient.totalVisits || 0}
    //               </div>
    //             </div>

    //             <div className="bg-white p-4 rounded-xl border shadow-sm">
    //               <div className="text-xs text-gray-500 mb-1">Total Paid</div>
    //               <div className="text-3xl font-bold text-green-700 tracking-tight">
    //                 {formatCurrency(displayPatient.totalPaid || 0)}
    //               </div>
    //               {preReceiveTotal > 0 && (
    //                 <p className="text-xs text-purple-600 mt-1">
    //                   + Advance: {formatCurrency(preReceiveTotal)}
    //                 </p>
    //               )}
    //             </div>

    //             <div className="bg-white p-4 rounded-xl border shadow-sm">
    //               <div className="text-xs text-gray-500 mb-1">Pending Balance</div>
    //               <div className={`text-3xl font-bold tracking-tight ${(displayPatient.pendingBalance || 0) > 0 ? 'text-red-600' :
    //                 (displayPatient.pendingBalance || 0) < 0 ? 'text-blue-600' : 'text-gray-800'
    //                 }`}>
    //                 {formatCurrency(Math.abs(displayPatient.pendingBalance || 0))}
    //               </div>
    //               <div className="text-xs mt-1 font-medium">
    //                 {(displayPatient.pendingBalance || 0) > 0 ? 'Due' :
    //                   (displayPatient.pendingBalance || 0) < 0 ? 'Credit Balance' : 'Fully Settled'}
    //               </div>
    //             </div>

    //             <div className="bg-white p-4 rounded-xl border shadow-sm">
    //               <div className="text-xs text-gray-500 mb-1">Opening Balance</div>
    //               <div className="text-3xl font-bold text-gray-700 tracking-tight">
    //                 {formatCurrency(displayPatient.openingBalance || 0)}
    //               </div>
    //             </div>
    //           </div>

    //           {/* Advance Payment Highlight */}
    //           {preReceiveTotal > 0 && (
    //             <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-xl flex items-center gap-3">
    //               <div className="text-2xl">💰</div>
    //               <div>
    //                 <p className="font-medium text-purple-700">Advance Payment Received</p>
    //                 <p className="text-lg font-semibold text-purple-800">
    //                   {formatCurrency(preReceiveTotal)}
    //                 </p>
    //               </div>
    //             </div>
    //           )}
    //         </>
    //       )}
    //     </div>

    //     {/* Tabs */}
    //     <div className="border-b px-5 bg-white">
    //       <div className="flex space-x-8 text-sm">
    //         {['overview', 'queue', 'bills'].map((tab) => (
    //           <button
    //             key={tab}
    //             className={`py-4 font-medium border-b-2 transition-all ${activeTab === tab
    //               ? 'border-primary text-primary'
    //               : 'border-transparent text-gray-600 hover:text-gray-900'
    //               }`}
    //             onClick={() => setActiveTab(tab as any)}
    //           >
    //             {tab === 'overview' && 'Overview'}
    //             {tab === 'queue' && `Queue History (${history?.queueHistory?.length || 0})`}
    //             {tab === 'bills' && `Bills (${history?.bills?.length || 0})`}
    //           </button>
    //         ))}
    //       </div>
    //     </div>

    //     {/* Main Content */}
    //     <div className="flex-1 overflow-y-auto p-5 bg-white">
    //       {loading ? (
    //         <div className="flex justify-center items-center h-64">
    //           <Loader2 className="w-8 h-8 animate-spin text-primary" />
    //           <span className="ml-3 text-muted-foreground">Loading patient history...</span>
    //         </div>
    //       ) : (
    //         <>
    //           {/* Overview Tab */}
    //           {activeTab === 'overview' && (
    //             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
    //               <div className="lg:col-span-2 space-y-5">
    //                 <h3 className="text-lg font-semibold flex items-center gap-2">
    //                   <User className="w-5 h-5" /> Personal Information
    //                 </h3>
    //                 <div className="bg-gray-50 border rounded-2xl p-6 space-y-6">
    //                   <div className="flex gap-4">
    //                     <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
    //                     <div>
    //                       <div className="text-xs text-gray-500">Phone Number</div>
    //                       <div className="font-medium">{patient.phone || 'N/A'}</div>
    //                     </div>
    //                   </div>
    //                   <div className="flex gap-4">
    //                     <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
    //                     <div>
    //                       <div className="text-xs text-gray-500">Age & Gender</div>
    //                       <div className="font-medium">
    //                         {patient.age || 'N/A'} years • {patient.gender || 'N/A'}
    //                       </div>
    //                     </div>
    //                   </div>
    //                   <div className="flex gap-4">
    //                     <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
    //                     <div>
    //                       <div className="text-xs text-gray-500">Address</div>
    //                       <div className="font-medium leading-relaxed">{patient.address || 'N/A'}</div>
    //                     </div>
    //                   </div>
    //                 </div>
    //               </div>

    //               <div className="lg:col-span-3 space-y-5">
    //                 <h3 className="text-lg font-semibold flex items-center gap-2">
    //                   <History className="w-5 h-5" /> Recent Activity
    //                 </h3>
    //                 {history?.queueHistory?.length > 0 ? (
    //                   <div className="space-y-3">
    //                     {history.queueHistory.slice(0, 3).map((item) => (
    //                       <div key={item.id} className="bg-white border rounded-2xl p-5 hover:shadow transition-shadow">
    //                         <div className="flex justify-between">
    //                           <div>
    //                             <div className="font-medium">{item.treatment || 'Treatment'}</div>
    //                             <div className="text-xs text-gray-500 mt-1">
    //                               {safeFormatDate(item.checkInTime)}
    //                             </div>
    //                           </div>
    //                           <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
    //                             {item.status?.replace('_', ' ').toUpperCase()}
    //                           </Badge>
    //                         </div>
    //                         <div className="mt-4 flex justify-between text-sm">
    //                           <span>Fee: <span className="font-medium">{formatCurrency(item.fee)}</span></span>
    //                           <span>Doctor: {item.doctor || 'N/A'}</span>
    //                         </div>
    //                       </div>
    //                     ))}
    //                   </div>
    //                 ) : (
    //                   <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-2xl border">
    //                     No recent activity found
    //                   </div>
    //                 )}
    //               </div>
    //             </div>
    //           )}

    //           {/* Queue History Tab */}
    //           {activeTab === 'queue' && (
    //             <div className="space-y-4">
    //               <h3 className="text-lg font-semibold">Queue History</h3>
    //               {history?.queueHistory?.length > 0 ? (
    //                 <div className="border rounded-2xl overflow-hidden">
    //                   <div className="overflow-x-auto">
    //                     <table className="w-full min-w-[700px]">
    //                       <thead className="bg-gray-50">
    //                         <tr>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Date</th>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Token</th>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Treatment</th>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Status</th>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Fee</th>
    //                           <th className="p-4 text-left text-xs font-medium text-gray-500">Doctor</th>
    //                         </tr>
    //                       </thead>
    //                       <tbody className="divide-y">
    //                         {history.queueHistory.map((item) => (
    //                           <tr key={item.id} className="hover:bg-gray-50 transition-colors">
    //                             <td className="p-4 text-sm">{safeFormatDate(item.checkInTime)}</td>
    //                             <td className="p-4 font-mono font-medium">#{item.tokenNumber || '—'}</td>
    //                             <td className="p-4 text-sm">{item.treatment || '—'}</td>
    //                             <td className="p-4">
    //                               <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
    //                                 {(item.status || '').replace('_', ' ').toUpperCase()}
    //                               </Badge>
    //                             </td>
    //                             <td className="p-4 font-medium text-sm">{formatCurrency(item.fee)}</td>
    //                             <td className="p-4 text-sm text-gray-600">{item.doctor || 'N/A'}</td>
    //                           </tr>
    //                         ))}
    //                       </tbody>
    //                     </table>
    //                   </div>
    //                 </div>
    //               ) : (
    //                 <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border">
    //                   No queue history found
    //                 </div>
    //               )}
    //             </div>
    //           )}

    //           {/* Bills Tab */}
    //           {activeTab === 'bills' && (
    //             <div className="space-y-4">
    //               <h3 className="text-lg font-semibold">Bill History</h3>
    //               {history?.bills?.length > 0 ? (
    //                 <div className="space-y-4">
    //                   {history.bills.map((bill) => (
    //                     <div key={bill.id} className="border rounded-2xl p-6 hover:shadow-sm transition-all">
    //                       <div className="flex justify-between items-start">
    //                         <div>
    //                           <div className="flex items-center gap-2 text-base font-semibold">
    //                             <FileText className="w-4 h-4 text-gray-500" />
    //                             Bill #{bill.billNumber || '—'}
    //                           </div>
    //                           <p className="text-xs text-gray-500 mt-1">
    //                             {safeFormatDate(bill.createdDate)}
    //                           </p>
    //                         </div>
    //                         <div className="text-right">
    //                           <div className="text-2xl font-bold text-green-700">
    //                             {formatCurrency(bill.totalAmount)}
    //                           </div>
    //                           <Badge className={`mt-2 ${getPaymentStatusColor(bill.paymentStatus || '')}`}>
    //                             {bill.paymentStatus?.toUpperCase() || 'UNKNOWN'}
    //                           </Badge>
    //                         </div>
    //                       </div>
    //                       <div className="mt-5 pt-5 border-t">
    //                         <div className="font-medium">{bill.treatment || 'General Treatment'}</div>
    //                         {bill.notes && <p className="text-sm text-gray-600 mt-1">{bill.notes}</p>}
    //                       </div>
    //                       <div className="mt-6 flex justify-between text-sm">
    //                         <div>Paid: <span className="font-semibold text-green-600">{formatCurrency(bill.amountPaid)}</span></div>
    //                         <div>Method: <span className="font-medium">{bill.paymentMethod || '—'}</span></div>
    //                       </div>
    //                     </div>
    //                   ))}
    //                 </div>
    //               ) : (
    //                 <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border">
    //                   No bills generated yet
    //                 </div>
    //               )}
    //             </div>
    //           )}
    //         </>
    //       )}
    //     </div>

    //     {/* Footer */}
    //     <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center text-xs text-gray-500">
    //       <div>
    //         Last updated: {displayPatient.updatedAt ? safeFormatDate(displayPatient.updatedAt) : 'Never'}
    //       </div>
    //       <Button variant="outline" onClick={onClose} className="h-9 px-6">
    //         Close
    //       </Button>
    //     </div>
    //   </div>
    // </div>

    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between p-5 border-b bg-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {displayPatient.name || 'N/A'}
              </h2>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                <span>ID: <strong className="font-mono">{displayPatient.patientNumber || displayPatient.id || 'N/A'}</strong></span>
                <span>•</span>
                <span>Since {safeFormatDate(displayPatient.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {showActions && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-2 h-9">
                  <Edit className="w-4 h-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="gap-2 h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Financial Overview */}
          <div className="p-5 bg-gray-50 border-b">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Financial Overview
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsEditAdvanceMode(!isEditAdvanceMode);
                    setIsReturnAdvanceMode(false);
                    if (!isEditAdvanceMode) setAdvanceAmount((displayPatient.preReceiveBalance || 0).toString());
                  }}
                  variant={isEditAdvanceMode ? "secondary" : "outline"}
                  className="font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {isEditAdvanceMode ? "Done" : "Edit Pre-Recieve"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsReturnAdvanceMode(!isReturnAdvanceMode);
                    setIsEditAdvanceMode(false);
                    if (!isReturnAdvanceMode) setReturnAmount('');
                  }}
                  variant={isReturnAdvanceMode ? "secondary" : "outline"}
                  className="font-medium border-red-200 text-red-700 hover:bg-red-50"
                >
                  {isReturnAdvanceMode ? "Cancel Return" : "Return Money"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsDiscountMode(!isDiscountMode)}
                  variant={isDiscountMode ? "secondary" : "outline"}
                  className="font-medium border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {isDiscountMode ? "Cancel Discount" : "Apply Discount"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsPaymentMode(!isPaymentMode)}
                  variant={isPaymentMode ? "secondary" : "default"}
                  className="font-medium"
                >
                  {isPaymentMode ? "Cancel Payment" : "Receive Payment"}
                </Button>
              </div>
            </div>

            {/* Discount Mode Form */}
            {isDiscountMode && (
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-sm mb-4">
                <h4 className="font-semibold mb-4 text-base text-purple-700">Apply Discount</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Discount Amount (Rs.)</Label>
                    <Input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="Enter discount amount"
                      min="0"
                      max={displayPatient.pendingBalance || 0}
                      className="h-10"
                    />
                    <p className="text-xs text-purple-600">Max discount: {formatCurrency(displayPatient.pendingBalance || 0)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Discount Reason (Optional)</Label>
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="e.g., Special offer, Loyalty discount"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-purple-200">
                  <Button variant="outline" onClick={() => setIsDiscountMode(false)} className="h-9 px-4">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleDiscountSubmit(false)}
                    disabled={isDiscountSubmitting || !discountAmount}
                    className="h-9 px-6 bg-purple-600 hover:bg-purple-700"
                  >
                    {isDiscountSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Apply Discount Only
                  </Button>
                  <Button
                    onClick={() => handleDiscountSubmit(true)}
                    disabled={isDiscountSubmitting || !discountAmount}
                    className="h-9 px-6 bg-purple-700 hover:bg-purple-800"
                  >
                    {isDiscountSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                    Apply & Print
                  </Button>
                </div>
              </div>
            )}

            {/* Edit Pre-Recieve Mode Form */}
            {isEditAdvanceMode && (
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 shadow-sm mb-4">
                <h4 className="font-semibold mb-4 text-base text-purple-700">Edit Pre-Recieve Credit</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New Advance Amount (Rs.)</Label>
                    <Input
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      placeholder="Enter new advance amount"
                      min="0"
                      className="h-10"
                    />
                    <p className="text-xs text-purple-600">Update the total persistent advance manually.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-purple-200">
                  <Button variant="outline" onClick={() => setIsEditAdvanceMode(false)} className="h-9 px-4">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditAdvanceSubmit}
                    disabled={isPaymentSubmitting || !advanceAmount}
                    className="h-9 px-6 bg-purple-600 hover:bg-purple-700"
                  >
                    {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Update Advance
                  </Button>
                </div>
              </div>
            )}

            {/* Return Pre-Recieve Form */}
            {isReturnAdvanceMode && (
              <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm mb-4">
                <h4 className="font-semibold mb-4 text-base text-red-700">Return Pre-Recieve Money</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Return Amount (Rs.)</Label>
                    <Input
                      type="number"
                      value={returnAmount}
                      onChange={(e) => setReturnAmount(e.target.value)}
                      placeholder="Enter amount to return"
                      min="0"
                      max={displayPatient.preReceiveBalance || 0}
                      className="h-10"
                    />
                    <p className="text-xs text-red-600">Available to return: {formatCurrency(displayPatient.preReceiveBalance || 0)}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-red-200">
                  <Button variant="outline" onClick={() => setIsReturnAdvanceMode(false)} className="h-9 px-4">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReturnAdvanceSubmit}
                    disabled={isPaymentSubmitting || !returnAmount}
                    className="h-9 px-6 bg-red-600 hover:bg-red-700"
                  >
                    {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Process Return
                  </Button>
                </div>
              </div>
            )}

            {isPaymentMode ? (
              <div className="bg-white p-5 rounded-xl border shadow-sm">
                <h4 className="font-semibold mb-4 text-base">Record Payment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Cash Received (Rs.)</Label>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Actual cash received"
                      min="0"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Discount (Rs.)</Label>
                    <Input
                      type="number"
                      value={paymentDiscount}
                      onChange={(e) => setPaymentDiscount(e.target.value)}
                      placeholder="Enter discount"
                      min="0"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="online">Online Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-sm font-medium">Notes (optional)</Label>
                    <Input
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Reason for payment (optional)"
                      className="h-10"
                    />
                  </div>
                  
                  {/* Real-time Calculation Summary */}
                  <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-100">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Payment Summary</span>
                      <span className="text-xs text-gray-500">Live Calculation</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Current Pending Balance:</span>
                        <span className="font-bold">{formatCurrency(displayPatient.pendingBalance || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>Total Settlement (Cash + Discount):</span>
                        <span className="font-bold">
                          {formatCurrency((parseFloat(paymentAmount) || 0) + (parseFloat(paymentDiscount) || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-base border-t border-blue-200 pt-2 mt-1">
                        <span className="font-bold text-gray-900">Remaining Balance:</span>
                        <span className={`font-black ${(displayPatient.pendingBalance || 0) - (parseFloat(paymentAmount) || 0) - (parseFloat(paymentDiscount) || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency((displayPatient.pendingBalance || 0) - (parseFloat(paymentAmount) || 0) - (parseFloat(paymentDiscount) || 0))}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-600/70 mt-3 italic text-center">
                      Tip: Enter actual cash in "Cash Received" and reduction in "Discount".
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-5 pt-3 border-t">
                  <Button variant="outline" onClick={() => setIsPaymentMode(false)} className="h-9 px-4">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handlePaymentSubmit(false)}
                    disabled={isPaymentSubmitting || (!paymentAmount && !paymentDiscount)}
                    className="h-9 px-6 bg-blue-600 hover:bg-blue-700"
                  >
                    {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Process Only
                  </Button>
                  <Button
                    onClick={() => handlePaymentSubmit(true)}
                    disabled={isPaymentSubmitting || (!paymentAmount && !paymentDiscount)}
                    className="h-9 px-6 bg-green-600 hover:bg-green-700"
                  >
                    {isPaymentSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                    Process & Print
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Financial Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Total Treatments</div>
                    <div className="text-3xl font-bold text-purple-700 tracking-tight">
                      {displayPatient.totalVisits || 0}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Total Paid</div>
                    <div className="text-3xl font-bold text-green-700 tracking-tight">
                      {formatCurrency(displayPatient.totalPaid || 0)}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border shadow-sm border-purple-100 bg-purple-50/30">
                    <div className="text-xs text-purple-600 mb-1 font-medium">Advance Credit</div>
                    <div className="text-3xl font-bold text-purple-700 tracking-tight">
                      {formatCurrency(displayPatient.preReceiveBalance || 0)}
                    </div>
                    <div className="text-xs mt-1 text-purple-500 italic">Remaining Balance</div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Pending Balance</div>
                    <div className={`text-3xl font-bold tracking-tight ${(displayPatient.pendingBalance || 0) > 0 ? 'text-red-600' :
                      (displayPatient.pendingBalance || 0) < 0 ? 'text-blue-600' : 'text-gray-800'
                      }`}>
                      {formatCurrency(Math.abs(displayPatient.pendingBalance || 0))}
                    </div>
                    <div className="text-xs mt-1 font-medium">
                      {(displayPatient.pendingBalance || 0) > 0 ? 'Due' :
                        (displayPatient.pendingBalance || 0) < 0 ? 'Credit Balance' : 'Fully Settled'}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">Opening Balance</div>
                    <div className="text-3xl font-bold text-gray-700 tracking-tight">
                      {formatCurrency(displayPatient.openingBalance || 0)}
                    </div>
                  </div>
                </div>

                {/* Advance Payment Highlight */}
                {(displayPatient.preReceiveBalance || 0) > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-xl flex items-center gap-3 shadow-sm shadow-purple-100/50">
                    <div className="text-2xl">💳</div>
                    <div>
                      <p className="font-medium text-purple-700">Persistent Advance Credit</p>
                      <p className="text-lg font-semibold text-purple-800">
                        {formatCurrency(displayPatient.preReceiveBalance || 0)}
                      </p>
                      <p className="text-[10px] text-purple-600/70">This amount is available for deduction from future bills.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b px-5 bg-white sticky top-0 z-10 bg-white">
            <div className="flex space-x-8 text-sm">
              {['overview', 'queue', 'bills'].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 font-medium border-b-2 transition-all ${activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  onClick={() => setActiveTab(tab as any)}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'queue' && `Queue History (${history?.queueHistory?.length || 0})`}
                  {tab === 'bills' && `Bills (${history?.bills?.length || 0})`}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content - Scrollable */}
          <div className="p-5">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading patient history...</span>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 space-y-5">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <User className="w-5 h-5" /> Personal Information
                      </h3>
                      <div className="bg-gray-50 border rounded-2xl p-6 space-y-6">
                        <div className="flex gap-4">
                          <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500">Phone Number</div>
                            <div className="font-medium">{displayPatient.phone || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500">Age & Gender</div>
                            <div className="font-medium">
                              {displayPatient.age || 'N/A'} years • {displayPatient.gender || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                          <div>
                            <div className="text-xs text-gray-500">Address</div>
                            <div className="font-medium leading-relaxed">{displayPatient.address || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-3 space-y-5">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <History className="w-5 h-5" /> Recent Activity
                      </h3>
                      {history?.queueHistory?.length > 0 ? (
                        <div className="space-y-3">
                          {history.queueHistory.slice(0, 3).map((item) => (
                            <div key={item.id} className="bg-white border rounded-2xl p-5 hover:shadow transition-shadow">
                              <div className="flex justify-between">
                                <div>
                                  <div className="font-medium">{item.treatment || 'Treatment'}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {safeFormatDate(item.treatmentDateTime || item.treatmentEndTime || item.checkInTime)}
                                  </div>
                                </div>
                                <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
                                  {item.status?.replace('_', ' ').toUpperCase()}
                                </Badge>
                              </div>
                              <div className="mt-4 flex justify-between text-sm">
                                <span>Fee: <span className="font-medium">{formatCurrency(item.fee)}</span></span>
                                <span>Doctor: {item.doctor || 'N/A'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-2xl border">
                          No recent activity found
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Queue History Tab */}
                {activeTab === 'queue' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Queue History</h3>
                    {history?.queueHistory?.length > 0 ? (
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px]">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Date</th>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Token</th>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Treatment</th>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Status</th>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Fee</th>
                                <th className="p-4 text-left text-xs font-medium text-gray-500">Doctor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {history.queueHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-4 text-sm">{safeFormatDate(item.treatmentDateTime || item.treatmentEndTime || item.checkInTime)}</td>
                                  <td className="p-4 font-mono font-medium">#{item.tokenNumber || '—'}</td>
                                  <td className="p-4 text-sm">{item.treatment || '—'}</td>
                                  <td className="p-4">
                                    <Badge className={`text-xs ${getStatusColor(item.status || '')}`}>
                                      {(item.status || '').replace('_', ' ').toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="p-4 font-medium text-sm">{formatCurrency(item.fee)}</td>
                                  <td className="p-4 text-sm text-gray-600">{item.doctor || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border">
                        No queue history found
                      </div>
                    )}
                  </div>
                )}

                {/* Bills Tab */}
                {activeTab === 'bills' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Bill History</h3>
                    {history?.bills?.length > 0 ? (
                      <div className="space-y-4">
                        {history.bills.map((bill) => (
                          <div key={bill.id} className="border rounded-2xl p-6 hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 text-base font-semibold">
                                  <FileText className="w-4 h-4 text-gray-500" />
                                  Bill #{bill.billNumber || '—'}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {safeFormatDate(bill.createdDate)}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-700">
                                  {formatCurrency(bill.totalAmount)}
                                </div>
                                <Badge className={`mt-2 ${getPaymentStatusColor(bill.paymentStatus || '')}`}>
                                  {bill.paymentStatus?.toUpperCase() || 'UNKNOWN'}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-5 pt-5 border-t">
                              <div className="font-medium">{bill.treatment || 'General Treatment'}</div>
                              {bill.notes && <p className="text-sm text-gray-600 mt-1">{bill.notes}</p>}
                            </div>
                            <div className="mt-4 space-y-2 text-sm bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                              {(bill.fee !== undefined || (bill.preReceiveApplied && bill.preReceiveApplied > 0)) && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Total Fee:</span>
                                    <span className="font-medium">{formatCurrency(bill.fee || ((bill.totalAmount || 0) + (bill.preReceiveApplied || 0) + (bill.discount || 0)))}</span>
                                  </div>
                                  {(bill.preReceiveApplied && bill.preReceiveApplied > 0) ? (
                                    <div className="flex justify-between text-purple-700 bg-purple-50/50 -mx-2 px-2 py-1 rounded">
                                      <span>Covered by Advance:</span>
                                      <span className="font-medium">-{formatCurrency(bill.preReceiveApplied)}</span>
                                    </div>
                                  ) : null}
                                  {(bill.discount && bill.discount > 0) ? (
                                    <div className="flex justify-between text-orange-600">
                                      <span>Discount:</span>
                                      <span className="font-medium">-{formatCurrency(bill.discount)}</span>
                                    </div>
                                  ) : null}
                                  <div className="w-full h-px bg-gray-200 my-1"></div>
                                </>
                              )}
                              <div className="flex justify-between items-center">
                                <span className="text-gray-900 font-medium">Net Payable:</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(bill.totalAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-900 font-medium">Actual Paid (Cash/Bank):</span>
                                <span className="font-bold text-green-600">{formatCurrency(bill.amountPaid)}</span>
                              </div>
                              {(bill.amountPaid || 0) > 0 && (
                                <div className="flex justify-end pt-1">
                                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border shadow-sm">Method: {bill.paymentMethod || '—'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-2xl border">
                        No bills generated yet
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="px-5 py-4 border-t bg-gray-50 flex justify-between items-center text-xs text-gray-500 shrink-0">
            <div>
              Last updated: {displayPatient.updatedAt ? safeFormatDate(displayPatient.updatedAt) : 'Never'}
            </div>
            <Button variant="outline" onClick={onClose} className="h-9 px-6">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}