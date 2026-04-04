'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Receipt, History, Printer, Loader2, Smartphone, Building, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QueueItem, Bill, Patient, Transaction } from '@/types';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useData } from '@/context/DataContext';

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
  const { licenseDaysLeft } = useData();
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash' as 'cash' | 'online' | 'bank',
    discount: 0,
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================
  // FIXED: Pre-receive from queueItem (NOT from global transactions)
  // ============================================================
  const preReceiveAmount = queueItem.preReceiveAmount || 0;

  // ============================================================
  // Calculations - Using queueItem's pre-receive
  // ============================================================
  const treatmentFee = Number(queueItem.fee || 0);
  const alreadyPaidThisVisit = Number(queueItem.amountPaid || 0);
  
  // Patient's overall pending balance from their record
  const patientOverallPending = Number(patientData.pendingBalance || 0);
  
  // Previous pending = Patient's overall pending minus this treatment fee + already paid
  let previousPending = patientOverallPending - treatmentFee + alreadyPaidThisVisit;
  if (previousPending < 0) previousPending = 0;
  
  // Total due before discount = Previous pending + Current treatment fee
  const totalDueBeforeDiscount = patientOverallPending + treatmentFee;
  
  // FIXED: Pre-receive from queueItem (NOT from all transactions)
  const totalDueAfterPreReceive = Math.max(0, totalDueBeforeDiscount - preReceiveAmount);
  
  // Total due after discount
  const totalDueAfterDiscount = Math.max(0, totalDueAfterPreReceive - paymentData.discount);
  
  // Remaining after this payment
  const remainingAfterThisPayment = Math.max(0, totalDueAfterDiscount - paymentData.amount);
  
  // Maximum payable amount
  const maxPayable = Math.max(0, totalDueAfterPreReceive - alreadyPaidThisVisit);
  const maxDiscount = totalDueAfterPreReceive;
  
  // New pending balance after this payment
  const newPendingBalance = remainingAfterThisPayment;

  // Parse treatments (same as before)
  const parseTreatments = () => {
    if (!queueItem.treatment) return [];
    try {
      return queueItem.treatment.split(',').map(t => {
        const match = t.trim().match(/(.+?)\s*\(?\s*(?:Rs\.?|PKR|\$)?\s*(\d+(?:\.\d+)?)\s*\)?/);
        return {
          name: match ? match[1].trim() : t.trim(),
          fee: match ? Math.round(parseFloat(match[2])) : 0  // Round to integer
        };
      });
    } catch (error) {
      console.error('Error parsing treatments:', error);
      return [{ name: queueItem.treatment || 'Treatment', fee: Math.round(treatmentFee) }];
    }
  };

  const treatments = parseTreatments();

  useEffect(() => {
    setPaymentData(prev => ({ ...prev, amount: maxPayable }));
  }, [maxPayable]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'discount' ? Math.round(Number(value)) || 0 : value
    }));
  };

  const handleFullPayment = () => {
    setPaymentData(prev => ({ ...prev, amount: maxPayable }));
  };

  const handleApplyDiscount = (percent: number) => {
    const disc = (totalDueAfterPreReceive * percent) / 100;
    setPaymentData(prev => ({ ...prev, discount: Math.min(Math.round(disc), maxDiscount) }));
  };

  const handleSubmitWithoutPrint = async (e: React.FormEvent, shouldPrint: boolean = true) => {
    e.preventDefault();

    const payAmount = Math.round(Number(paymentData.amount));
    const disc = Math.round(Number(paymentData.discount));

    if (payAmount <= 0) return toast.error('Enter valid amount');
    if (payAmount > maxPayable) return toast.error(`Cannot pay more than Rs. ${maxPayable}`);
    if (disc > maxDiscount) return toast.error(`Discount cannot exceed Rs. ${maxDiscount}`);

    if (licenseDaysLeft <= 0) {
      toast.error("License Expired. Please renew to process payments.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Processing payment...');

    try {
      if (shouldPrint) {
        handlePrint();
      }

      await onSubmit(queueItem, {
        ...paymentData,
        amount: payAmount,
        discount: disc,
        newPendingBalance: newPendingBalance,
        preReceiveAmount: preReceiveAmount
      });

      toast.success(shouldPrint ? 'Payment processed & bill printed!' : 'Payment processed!', { id: toastId });

    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Payment failed', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    await handleSubmitWithoutPrint(e, true);
  };

  const handleSubmitOnly = async (e: React.FormEvent) => {
    await handleSubmitWithoutPrint(e, false);
  };

  // Print function with rounded numbers
  const handlePrint = () => {
    const now = new Date();
    const dateStr = now.toLocaleString('en-PK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const treatmentsRows = treatments.map((t, i) => `
    <tr>
      <td style="border:1px solid #000;padding:4px;">${i + 1}</td>
      <td style="border:1px solid #000;padding:4px;">${t.name}</td>
      <td style="border:1px solid #000;padding:4px;text-align:right;">Rs. ${t.fee}</td>
    </tr>
    `).join('');

    const printContent = `
================================
Token: #${queueItem.tokenNumber || '—'}
Patient: ${queueItem.patientName}
Phone: ${queueItem.patientPhone || 'N/A'}
Date: ${dateStr}
Doctor: ${queueItem.doctor || '—'}
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
      <td style="border:1px solid #000;padding:5px;text-align:right;">Rs. ${Math.round(treatmentFee)}</td>
    </tr>
  </tbody>
</table>

--------------------------------
PAYMENT SUMMARY
--------------------------------
Previous Pending      : Rs. ${Math.round(previousPending)}
Current Treatments    : Rs. ${Math.round(treatmentFee)}
Total Due Before Disc : Rs. ${Math.round(totalDueBeforeDiscount)}
${preReceiveAmount > 0 ? `Pre-received (ADVANCE) : Rs. -${Math.round(preReceiveAmount)}` : ''}
${paymentData.discount > 0 ? `Discount              : Rs. -${Math.round(paymentData.discount)}` : ''}
--------------------------------
Total Due             : Rs. ${Math.round(totalDueAfterDiscount)}
Paid Now              : Rs. ${Math.round(paymentData.amount)}
**Remaining**         : Rs. ${Math.round(remainingAfterThisPayment)}
--------------------------------
Method: ${paymentData.paymentMethod.toUpperCase()}
Notes: ${paymentData.notes || 'None'}
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
          <title>Receipt - ${queueItem.patientName}</title>
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-semibold truncate">{queueItem.patientName}</p></div>
            <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{queueItem.patientPhone || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Doctor</p><p className="font-medium">{queueItem.doctor || '—'}</p></div>
            
          </div>

          {/* Pre-receive Summary - Using queueItem's pre-receive */}
          {preReceiveAmount > 0 && (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-green-600" />
                Advance Payment (Pre-receive) - This Treatment Only
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Advance Paid for this treatment:</span>
                  <span className="text-lg font-bold text-green-700">Rs. {Math.round(preReceiveAmount)}</span>
                </div>
                <div className="bg-green-100 p-2 rounded text-center text-sm">
                  💡 This amount has been deducted from your total bill
                </div>
              </div>
            </div>
          )}

          {/* Treatments Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b">
              <h3 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Treatments</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="border">S.No</TableHead>
                    <TableHead className="border">Treatment</TableHead>
                    <TableHead className="border text-right">Fee (Rs.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.length > 0 ? (
                    treatments.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="border">{i + 1}</TableCell>
                        <TableCell className="border">{t.name}</TableCell>
                        <TableCell className="border text-right font-medium">Rs. {t.fee}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="border py-4 text-center text-gray-500">No treatments recorded</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell colSpan={2} className="border">Total Treatments</TableCell>
                    <TableCell className="border text-right text-green-700">Rs. {Math.round(treatmentFee)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="border rounded-lg p-5 bg-white shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><History className="h-4 w-4" /> Payment Breakdown</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Previous Pending Balance</span><span className="text-orange-700 font-medium">Rs. {Math.round(patientOverallPending)}</span></div>
              <div className="flex justify-between"><span>Current Treatment Fee</span><span>Rs. {Math.round(treatmentFee)}</span></div>
              <div className="flex justify-between border-b pb-2"><span>Total Due Before Adjustments</span><span className="font-bold">Rs. {Math.round(totalDueBeforeDiscount)}</span></div>
              
              {preReceiveAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Advance Payment (Pre-receive)</span>
                  <span className="font-medium">- Rs. {Math.round(preReceiveAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-2"><span>Total Due After Advance Deduction</span><span className="font-medium">Rs. {Math.round(totalDueAfterPreReceive)}</span></div>

              {/* Discount */}
              {/* <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Discount</span>
                  <Input type="number" name="discount" value={paymentData.discount} onChange={handleChange} min={0} max={maxDiscount} step="1" className="w-28 h-8 text-right" placeholder="0" disabled={isSubmitting} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20].map(p => (
                    <Button key={p} type="button" variant="outline" size="sm" onClick={() => handleApplyDiscount(p)} disabled={isSubmitting} className="text-xs">{p}%</Button>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setPaymentData(prev => ({ ...prev, discount: 0 }))} disabled={isSubmitting} className="text-xs text-red-600">Clear</Button>
                </div>
              </div> */}

              {/* <div className="flex justify-between pt-3 border-t font-bold text-base"><span>Total Due After Discount</span><span className="text-green-700">Rs. {Math.round(totalDueAfterDiscount)}</span></div> */}
              <div className="flex justify-between text-red-600 font-semibold"><span>Remaining to Pay</span><span>Rs. {Math.round(maxPayable)}</span></div>
              <div className="flex justify-between pt-2 border-t text-sm"><span>New Pending Balance (After Payment)</span><span className={`font-bold ${newPendingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>Rs. {Math.round(newPendingBalance)}</span></div>
            </div>
          </div>

          {/* Form & Buttons */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Amount to Pay</Label>
              <div className="flex gap-3">
                <Input name="amount" type="number" value={paymentData.amount} onChange={handleChange} min={0} max={maxPayable} step="1" required className="flex-1" disabled={isSubmitting} />
                <Button type="button" variant="secondary" size="sm" onClick={handleFullPayment} disabled={maxPayable <= 0 || isSubmitting}>Pay Full</Button>
              </div>
              <p className="text-xs text-gray-500">Maximum payable: Rs. {Math.round(maxPayable)}</p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['cash', 'online', 'bank'] as const).map(m => (
                  <Button key={m} type="button" variant={paymentData.paymentMethod === m ? 'default' : 'outline'} className="h-11 flex flex-col gap-1" onClick={() => setPaymentData(prev => ({ ...prev, paymentMethod: m }))} disabled={isSubmitting}>
                    {m === 'cash' && <DollarSign className="h-4 w-4" />}
                    {m === 'online' && <Smartphone className="h-4 w-4" />}
                    {m === 'bank' && <Building className="h-4 w-4" />}
                    <span className="text-xs capitalize">{m}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input name="notes" value={paymentData.notes} onChange={handleChange} placeholder="e.g. Paid via EasyPaisa" disabled={isSubmitting} />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>Cancel</Button>
              <Button type="button" onClick={handleSubmitOnly} disabled={isSubmitting || maxPayable <= 0 || licenseDaysLeft <= 0} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Process Payment'}
              </Button>
              <Button type="submit" disabled={isSubmitting || maxPayable <= 0 || licenseDaysLeft <= 0} className="flex-1 bg-green-600 hover:bg-green-700">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Printer className="mr-2 h-4 w-4" /> Process & Print</>}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}