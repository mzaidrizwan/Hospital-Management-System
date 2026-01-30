'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash, DollarSign, CreditCard, History, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QueueItem, Bill, Patient } from '@/types'; // Added Patient type
import { toast } from 'sonner';
import { updateQueueItem } from '@/services/queueService';

// IndexedDB Utilities
import { saveToLocal, openDB } from '@/services/indexedDbUtils';

interface TreatmentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { treatment: string; fee: number; doctor: string }) => void;
  queueItem: QueueItem | null;
  doctors: string[];
  patientData?: Patient | null; // ADDED: Direct patient data
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
}

export default function TreatmentModal({
  open,
  onClose,
  onSubmit,
  queueItem,
  doctors,
  patientData = null, // ADDED: Direct patient data
  patientHistory = { queueHistory: [], paymentHistory: [], bills: [] },
  patientInfo = { pendingBalance: 0 }
}: TreatmentModalProps) {
  const defaultTreatments = [
    'Teeth Cleaning',
    'Root Canal',
    'Filling',
    'Extraction',
    'Braces Adjustment',
    'Whitening',
    'Crown Placement',
    'Scaling & Polishing',
  ];

  const [selectedTreatments, setSelectedTreatments] = useState<SelectedTreatment[]>([]);
  const [newTreatmentName, setNewTreatmentName] = useState('');
  const [newTreatmentFee, setNewTreatmentFee] = useState('');
  const [manualTotal, setManualTotal] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    totalTreatments: 0,
    totalAmount: 0,
    totalPaid: 0,
    pendingBalance: 0,
    currentPending: 0,
    newPending: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualEdited, setIsManualEdited] = useState(false);

  // Use refs to prevent infinite loops
  const isInitialLoad = useRef(true);

  if (!open || !queueItem) return null;

  // Calculate payment statistics from patient data - FIXED: Use patientData directly
  useEffect(() => {
    if (!open) return;

    console.log('Patient Data in TreatmentModal:', patientData);
    console.log('Patient History:', patientHistory);
    console.log('Patient Info:', patientInfo);

    // Use patientData if available, otherwise use patientHistory/patientInfo
    let totalTreatments = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let pendingBalance = 0;
    let currentPending = 0;

    if (patientData) {
      // Use patientData from Firestore
      totalTreatments = patientData.totalVisits || 0;
      totalPaid = patientData.totalPaid || 0;
      pendingBalance = patientData.pendingBalance || 0;

      // Calculate totalAmount from patientHistory or use pendingBalance + totalPaid
      totalAmount = (patientHistory?.queueHistory || []).reduce((sum, item) => sum + (item.fee || 0), 0);

      // If totalAmount is 0 but we have pendingBalance and totalPaid
      if (totalAmount === 0 && (pendingBalance > 0 || totalPaid > 0)) {
        totalAmount = pendingBalance + totalPaid;
      }
    } else {
      // Fallback to patientHistory/patientInfo
      totalTreatments = patientHistory?.queueHistory?.length || 0;
      totalAmount = (patientHistory?.queueHistory || []).reduce((sum, item) => sum + (item.fee || 0), 0);
      totalPaid = (patientHistory?.paymentHistory || []).reduce((sum, payment) => sum + (payment.amountPaid || 0), 0);
      pendingBalance = patientInfo?.pendingBalance || 0;
    }

    currentPending = pendingBalance; // Current pending is the patient's pending balance

    console.log('Calculated Values:', {
      totalTreatments,
      totalAmount,
      totalPaid,
      pendingBalance,
      currentPending
    });

    setPaymentBreakdown({
      totalTreatments,
      totalAmount,
      totalPaid,
      pendingBalance,
      currentPending,
      newPending: currentPending
    });

    // Set initial manual total only once
    if (isInitialLoad.current) {
      setManualTotal(currentPending.toFixed(2));
      isInitialLoad.current = false;
    }
  }, [open, patientData, patientHistory, patientInfo]);

  // Auto-calculate actual total (current treatments)
  const actualTotal = selectedTreatments.reduce((sum, t) => sum + t.fee, 0);

  // Auto-update manual total when treatments change (if not manually edited)
  useEffect(() => {
    if (isManualEdited || !open) return;

    const newManualTotal = (actualTotal + paymentBreakdown.currentPending).toFixed(2);
    setManualTotal(newManualTotal);
  }, [actualTotal, paymentBreakdown.currentPending, isManualEdited, open]);

  // Calculate discount and new pending
  useEffect(() => {
    if (!open) return;

    const manual = parseFloat(manualTotal) || 0;
    const totalDue = actualTotal + paymentBreakdown.currentPending;

    // Prevent manual total from going below previous pending
    if (manual < paymentBreakdown.currentPending) {
      toast.warning('Amount cannot be less than previous pending balance');
      setManualTotal(paymentBreakdown.currentPending.toFixed(2));
      setDiscount(0);
      return;
    }

    // Discount = total due - what user entered
    const effectiveDiscount = totalDue - manual;
    setDiscount(effectiveDiscount > 0 ? effectiveDiscount : 0);

    // New pending after this treatment (before any new payment)
    // = previous pending + current fee (after discount)
    const effectiveFee = manual - paymentBreakdown.currentPending;
    const newPending = paymentBreakdown.currentPending + effectiveFee;
    setPaymentBreakdown(prev => ({
      ...prev,
      newPending
    }));
  }, [manualTotal, actualTotal, paymentBreakdown.currentPending, open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setSelectedTreatments([]);
        setNewTreatmentName('');
        setNewTreatmentFee('');
        setManualTotal('');
        setDiscount(0);
        setSelectedDoctor('');
        setIsSubmitting(false);
        setIsManualEdited(false);
        isInitialLoad.current = true;
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
    if (newTreatmentName && feeNum >= 0 && !selectedTreatments.some(t => t.name === newTreatmentName)) {
      setSelectedTreatments([...selectedTreatments, { name: newTreatmentName, fee: feeNum }]);
      setNewTreatmentName('');
      setNewTreatmentFee('');
    } else {
      toast.error('Enter valid treatment name and fee');
    }
  };

  const handleRemoveTreatment = (name: string) => {
    setSelectedTreatments(selectedTreatments.filter(t => t.name !== name));
  };

  const handleSubmit = async () => {
    if (selectedTreatments.length === 0) {
      toast.error('At least one treatment is required');
      return;
    }
    const manual = parseFloat(manualTotal);
    if (isNaN(manual) || manual < 0) {
      toast.error('Enter valid manual total amount');
      return;
    }
    if (manual < paymentBreakdown.currentPending) {
      toast.error('Amount cannot be less than previous pending balance');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Please select a doctor');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Saving treatment...');

    try {
      const treatmentString = selectedTreatments.map(t => `${t.name} ($${t.fee})`).join(', ');
      const manual = parseFloat(manualTotal);
      const effectiveFee = manual - paymentBreakdown.currentPending;

      const data = {
        treatment: treatmentString,
        fee: effectiveFee,
        doctor: selectedDoctor
      };

      // Save to IndexedDB first
      await saveToLocal('queue', {
        ...queueItem,
        ...data,
        updatedAt: new Date().toISOString()
      });

      // Modal immediately close
      onClose();
      toast.success('Treatment saved locally!', { id: toastId });

      // Background Firebase sync
      updateQueueItem(queueItem.id, data).catch(err => {
        console.error('Firebase sync failed:', err);
        toast.error('Failed to sync to cloud (saved locally only)');
      });

      // Parent onSubmit
      onSubmit(data);

    } catch (error) {
      console.error('Error saving treatment:', error);
      toast.error('Failed to save treatment', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold">Complete Treatment - {queueItem.patientName}</h2>
            <p className="text-sm text-gray-500">Patient ID: {queueItem.patientNumber || queueItem.patientId || 'N/A'}</p>
            {patientData && (
              <p className="text-xs text-gray-400 mt-1">
                Total Visits: {patientData.totalVisits || 0} |
                Pending: {formatCurrency(patientData.pendingBalance || 0)} |
                Paid: {formatCurrency(patientData.totalPaid || 0)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Info & Payment Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Patient Details */}
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

            {/* Payment Summary */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Previous Total:</span>
                  <span className="font-medium">{formatCurrency(paymentBreakdown.totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Amount Paid:</span>
                  <span className="font-medium text-green-600">{formatCurrency(paymentBreakdown.totalPaid)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Pending Balance:</span>
                  <span className={`font-medium ${paymentBreakdown.pendingBalance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatCurrency(paymentBreakdown.pendingBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-semibold">Current Pending:</span>
                  <span className="font-bold text-red-600">{formatCurrency(paymentBreakdown.currentPending)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rest of the modal remains the same... */}
          {/* Add Treatments */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Treatment
            </Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select onValueChange={setNewTreatmentName} value={newTreatmentName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultTreatments.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
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
                placeholder="Fee ($)"
                value={newTreatmentFee}
                onChange={e => setNewTreatmentFee(e.target.value)}
                className="w-32"
                min="0"
                step="0.01"
              />
              <Button onClick={handleAddTreatment} className="gap-1" disabled={isSubmitting}>
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
          </div>

          {/* Selected Treatments Table */}
          {selectedTreatments.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-100">
                  <TableRow>
                    <TableHead>Treatment</TableHead>
                    <TableHead className="text-right">Fee ($)</TableHead>
                    <TableHead className="w-16 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTreatments.map((t, index) => (
                    <TableRow key={index}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(t.fee)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTreatment(t.name)}
                          disabled={isSubmitting}
                        >
                          <Trash className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Actual Total */}
              <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                <span className="font-semibold">Actual Total (Sum of Treatments):</span>
                <span className="text-xl font-bold text-green-700">{formatCurrency(actualTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border rounded-lg">
              No treatments added yet
            </div>
          )}

          {/* Current Treatment Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="manualTotal" className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4" />
                  Final Amount to Collect (Previous + Treatments)
                </Label>
                <Input
                  id="manualTotal"
                  type="number"
                  value={manualTotal}
                  onChange={handleManualChange}
                  placeholder="Auto: previous + treatments sum"
                  min={paymentBreakdown.currentPending}
                  step="0.01"
                  disabled={isSubmitting}
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
                    ? `Discount applied: ${formatCurrency(discount)} (user entered less amount)`
                    : 'No discount (full amount entered)'}
                </p>
              </div>
            </div>

            {/* New Pending Summary */}
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
                <div className="flex justify-between items-center">
                  <span className="text-sm">This Treatment (after discount):</span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(paymentBreakdown.newPending - paymentBreakdown.currentPending || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-sm font-semibold">New Total Pending (after this):</span>
                  <span className="font-bold text-red-700">
                    {formatCurrency(paymentBreakdown.newPending)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  After adding this treatment, patient&apos;s total pending amount will be updated
                </p>
              </div>
            </div>
          </div>

          {/* Doctor Selection */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4" />
              Assign Doctor
            </Label>
            <Select onValueChange={setSelectedDoctor} value={selectedDoctor} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedTreatments.length === 0 || !manualTotal || !selectedDoctor || isSubmitting}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save & Complete Treatment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}