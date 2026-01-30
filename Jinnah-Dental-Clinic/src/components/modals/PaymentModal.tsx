'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Receipt, History, Printer, Loader2, Smartphone, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueueItem, Bill, Patient } from '@/types';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { updateQueueItem, addBill } from '@/services/queueService';

// IndexedDB Utilities
import { saveToLocal, openDB } from '@/services/indexedDbUtils';

interface PaymentModalProps {
  queueItem: QueueItem;
  bills: Bill[];
  patientData: Patient;
  onClose: () => void;
  onSubmit: (queueItem: QueueItem, paymentData: any) => Promise<void> | void;
}

export default function PaymentModal({
  queueItem,
  bills = [],
  patientData,
  onClose,
  onSubmit
}: PaymentModalProps) {
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'online' | 'bank',
    discount: 0,
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // ────────────────────────────────────────────────
  // Calculations
  // ────────────────────────────────────────────────

  const treatmentFee = Number(queueItem.fee || 0);
  const alreadyPaidThisVisit = Number(queueItem.amountPaid || 0);

  const patientPendingBalance = Number(patientData.pendingBalance || 0);
  const previousPending = Math.max(0, patientPendingBalance - treatmentFee + alreadyPaidThisVisit);

  const totalDueBeforeDiscount = previousPending + treatmentFee;
  const totalDueAfterDiscount = Math.max(0, totalDueBeforeDiscount - paymentData.discount);
  const remainingAfterThisPayment = Math.max(0, totalDueAfterDiscount - paymentData.amount);

  const maxPayable = Math.max(0, totalDueBeforeDiscount - alreadyPaidThisVisit);
  const maxDiscount = totalDueBeforeDiscount;

  // Parse treatments
  const parseTreatments = () => {
    if (!queueItem.treatment) return [];
    try {
      return queueItem.treatment.split(',').map(t => {
        const match = t.trim().match(/(.+?)\s*\(?\s*\$?(\d+(?:\.\d+)?)\s*\)?/);
        return {
          name: match ? match[1].trim() : t.trim(),
          fee: match ? parseFloat(match[2]) : 0
        };
      });
    } catch (error) {
      console.error('Error parsing treatments:', error);
      return [{ name: queueItem.treatment || 'Treatment', fee: treatmentFee }];
    }
  };

  const treatments = parseTreatments();

  // Initialize IndexedDB on mount
  useEffect(() => {
    const initDB = async () => {
      try {
        await openDB();
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error);
        toast.error('Local storage unavailable - using cloud only');
      }
    };
    initDB();
  }, []);

  useEffect(() => {
    setPaymentData(prev => ({ ...prev, amount: maxPayable }));
  }, [maxPayable]);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'discount' ? Number(value) || 0 : value
    }));
  };

  const handleFullPayment = () => {
    setPaymentData(prev => ({ ...prev, amount: maxPayable }));
  };

  const handleApplyDiscount = (percent: number) => {
    const disc = (totalDueBeforeDiscount * percent) / 100;
    setPaymentData(prev => ({ ...prev, discount: Math.min(disc, maxDiscount) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payAmount = Number(paymentData.amount);
    const disc = Number(paymentData.discount);

    if (payAmount <= 0) return toast.error('Enter valid amount');
    if (payAmount > maxPayable) return toast.error(`Cannot pay more than $${maxPayable.toFixed(2)}`);
    if (disc > maxDiscount) return toast.error(`Discount cannot exceed $${maxDiscount.toFixed(2)}`);

    setIsSubmitting(true);
    const toastId = toast.loading('Processing payment...');

    try {
      // Calculate payment status - FIXED TYPE ERROR
      let paymentStatus: 'pending' | 'partial' | 'paid';
      if (payAmount >= maxPayable) {
        paymentStatus = 'paid';
      } else if (payAmount > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'pending';
      }

      // 1. Save locally to IndexedDB if available
      if (dbInitialized) {
        try {
          const updatedQueue = {
            ...queueItem,
            amountPaid: alreadyPaidThisVisit + payAmount,
            discount: disc,
            paymentStatus: paymentStatus, // FIXED: Now correct type
            updatedAt: new Date().toISOString()
          };

          await saveToLocal('queue', updatedQueue);

          // Create bill record
          const newBill = {
            id: `bill-${Date.now()}`,
            billNumber: `BILL-${Date.now()}`,
            patientId: patientData.id || queueItem.patientNumber,
            patientNumber: queueItem.patientNumber,
            patientName: queueItem.patientName,
            treatment: queueItem.treatment || '',
            totalAmount: totalDueBeforeDiscount,
            amountPaid: payAmount,
            discount: disc,
            paymentMethod: paymentData.paymentMethod,
            paymentStatus: paymentStatus,
            createdDate: new Date().toISOString(),
            notes: paymentData.notes,
            queueItemId: queueItem.id
          };

          await saveToLocal('bills', newBill);

          console.log('Saved to IndexedDB successfully');
        } catch (dbError) {
          console.warn('IndexedDB save failed, continuing with cloud:', dbError);
        }
      }

      // 2. Close modal first for better UX
      onClose();
      toast.success('Payment processed!', { id: toastId });

      // 3. Call parent handler (for queue updates)
      await onSubmit(queueItem, {
        ...paymentData,
        amount: payAmount,
        discount: disc
      });

      // 4. Background Firebase sync (non-blocking)
      try {
        const updateData: Partial<QueueItem> = {
          amountPaid: alreadyPaidThisVisit + payAmount,
          discount: disc,
          paymentStatus: paymentStatus // This should match the type
        };

        await updateQueueItem(queueItem.id, updateData);

        const billData = {
          billNumber: `BILL-${Date.now()}`,
          patientId: patientData.id || queueItem.patientNumber,
          patientNumber: queueItem.patientNumber,
          patientName: queueItem.patientName,
          treatment: queueItem.treatment || '',
          totalAmount: totalDueBeforeDiscount,
          amountPaid: payAmount,
          discount: disc,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentStatus,
          createdDate: new Date().toISOString(),
          notes: paymentData.notes,
          queueItemId: queueItem.id
        };

        // await addBill(billData);
        // console.log('Firebase sync completed');
      } catch (firebaseError) {
        console.error('Firebase sync failed:', firebaseError);
        toast.warning('Cloud sync failed, but local data is saved');
      }

      // 5. Print receipt
      handlePrint();

    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Payment failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────
  // Print Function
  // ────────────────────────────────────────────────

  const handlePrint = () => {
    setIsPrinting(true);

    const now = new Date();
    const dateStr = now.toLocaleString('en-PK', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const treatmentsRows = treatments.map((t, i) => `
      <tr>
        <td style="border:1px solid #000;padding:3px;">${i + 1}</td>
        <td style="border:1px solid #000;padding:3px;">${t.name}</td>
        <td style="border:1px solid #000;padding:3px;text-align:right;">PKR ${t.fee.toFixed(0)}</td>
      </tr>
    `).join('');

    const printContent = `
JINNAH DENTAL CLINIC
Token: #${queueItem.tokenNumber || '—'}
Patient: ${queueItem.patientName}
Phone: ${queueItem.patientPhone || 'N/A'}
Date: ${dateStr}
Doctor: ${queueItem.doctor || '—'}
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
      <td style="border:1px solid #000;padding:3px;text-align:right;">PKR ${treatmentFee.toFixed(0)}</td>
    </tr>
  </tbody>
</table>
--------------------------------
PAYMENT SUMMARY
--------------------------------
Previous Pending: PKR ${previousPending.toFixed(0)}
Current Treatments: PKR ${treatmentFee.toFixed(0)}
Discount: PKR ${paymentData.discount.toFixed(0)}
--------------------------------
Total Due: PKR ${totalDueAfterDiscount.toFixed(0)}
Paid Now: PKR ${Number(paymentData.amount).toFixed(0)}
Remaining: PKR ${remainingAfterThisPayment.toFixed(0)}
--------------------------------
Method: ${paymentData.paymentMethod.toUpperCase()}
Notes: ${paymentData.notes || 'None'}
--------------------------------
Thank You! Visit Again
Powered by Saynz Technologies
`.trim();

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${queueItem.patientName}</title>
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
    }

    setTimeout(() => setIsPrinting(false), 1500);
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Payment – {queueItem.patientName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" disabled={isSubmitting}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div>
              <p className="text-xs text-muted-foreground">Patient</p>
              <p className="font-semibold truncate">{queueItem.patientName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium">{queueItem.patientPhone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Doctor</p>
              <p className="font-medium">{queueItem.doctor || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Already Paid</p>
              <p className="font-medium text-green-600">${alreadyPaidThisVisit.toFixed(2)}</p>
            </div>
          </div>

          {/* Treatments Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Treatments
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="border">S.No</TableHead>
                    <TableHead className="border">Treatment</TableHead>
                    <TableHead className="border text-right">Fee ($)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.length > 0 ? (
                    treatments.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="border">{i + 1}</TableCell>
                        <TableCell className="border">{t.name}</TableCell>
                        <TableCell className="border text-right font-medium">${t.fee.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="border py-4 text-center text-gray-500">
                        No treatments recorded
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2} className="border">Total Treatments</TableCell>
                    <TableCell className="border text-right text-green-700">${treatmentFee.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border rounded-lg p-5 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payment Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Previous Pending Balance</span>
                <span className="text-orange-700 font-medium">${previousPending.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Treatment Fee</span>
                <span>${treatmentFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>Total Due</span>
                <span>${totalDueBeforeDiscount.toFixed(2)}</span>
              </div>

              {/* Discount */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Discount</span>
                  <Input
                    type="number"
                    name="discount"
                    value={paymentData.discount}
                    onChange={handleChange}
                    min={0}
                    max={maxDiscount}
                    step={0.01}
                    className="w-28 h-8 text-right"
                    placeholder="0.00"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20].map(p => (
                    <Button
                      key={p}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyDiscount(p)}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      {p}%
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentData(prev => ({ ...prev, discount: 0 }))}
                    disabled={isSubmitting}
                    className="text-xs text-red-600"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t font-bold text-base">
                <span>Total After Discount</span>
                <span className="text-green-700">${totalDueAfterDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Remaining to Pay</span>
                <span>${maxPayable.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Form & Buttons */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount to Pay</Label>
              <div className="flex gap-3">
                <Input
                  name="amount"
                  type="number"
                  value={paymentData.amount}
                  onChange={handleChange}
                  min={0}
                  max={maxPayable}
                  step={0.01}
                  required
                  className="flex-1"
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFullPayment}
                  disabled={maxPayable <= 0 || isSubmitting}
                >
                  Pay Full
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Maximum payable: ${maxPayable.toFixed(2)}
              </p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['cash', 'online', 'bank'] as const).map(m => (
                  <Button
                    key={m}
                    type="button"
                    variant={paymentData.paymentMethod === m ? 'default' : 'outline'}
                    className="h-11 flex flex-col gap-1"
                    onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: m }))}
                    disabled={isSubmitting}
                  >
                    {m === 'cash' && <DollarSign className="h-4 w-4" />}
                    {m === 'online' && <Smartphone className="h-4 w-4" />}
                    {m === 'bank' && <Building className="h-4 w-4" />}
                    <span className="text-xs capitalize">{m}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                name="notes"
                value={paymentData.notes}
                onChange={handleChange}
                placeholder="e.g. Paid via EasyPaisa"
                disabled={isSubmitting}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                disabled={isPrinting || isSubmitting}
                className="flex-1"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Bill
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || maxPayable <= 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Payment'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}