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
  onCancel?: () => void;
  onSubmit: (queueItem: QueueItem, paymentData: any) => Promise<void> | void;
}

export default function PaymentModal({
  queueItem,
  bills = [],
  patientData,
  onClose,
  onCancel,
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
  // FIXED: Use patient's total available credit (preReceiveBalance)
  // ============================================================
  const totalAvailableCredit = Number(patientData.preReceiveBalance || 0);

  // ============================================================
  // Calculations - Handling Advance Payment Correctly
  // ============================================================
  const treatmentFee = Number(queueItem.fee || 0);
  const alreadyPaidThisVisit = Number(queueItem.amountPaid || 0);
  
  // Patient's overall pending balance (previous bills)
  const patientOverallPending = Number(patientData.pendingBalance || 0);
  
  // Total bill before any adjustments
  const totalDueBeforeAdjustments = patientOverallPending + treatmentFee;
  
  // How much credit can we apply? (Cannot exceed total bill)
  const appliedCredit = Math.min(totalAvailableCredit, totalDueBeforeAdjustments);
  
  // Leftover credit after applying to this bill
  const leftoverCredit = totalAvailableCredit - appliedCredit;
  
  // Total due after applying advance credit
  const totalDueAfterAdvance = Math.max(0, totalDueBeforeAdjustments - appliedCredit);
  
  // Total due after discount
  const totalDueAfterDiscount = Math.max(0, totalDueAfterAdvance - paymentData.discount);
  
  // Remaining amount to be paid in cash/online/bank
  const remainingCashDue = Math.max(0, totalDueAfterDiscount - alreadyPaidThisVisit);
  
  // Final pending balance if no further payment is made
  const finalPendingAfterPayment = Math.max(0, totalDueAfterDiscount - paymentData.amount);

  // Maximum amount they can pay now (cannot pay more than what's left)
  const maxPayable = remainingCashDue;
  const maxDiscount = totalDueAfterAdvance;

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
    const disc = (totalDueAfterAdvance * percent) / 100;
    setPaymentData(prev => ({ ...prev, discount: Math.min(Math.round(disc), maxDiscount) }));
  };

  const handleSubmitWithoutPrint = async (e: React.FormEvent, shouldPrint: boolean = true) => {
    e.preventDefault();

    const payAmount = Math.round(Number(paymentData.amount));
    const disc = Math.round(Number(paymentData.discount));

    if (payAmount < 0) return toast.error('Enter valid amount');
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
        newPendingBalance: finalPendingAfterPayment,
        preReceiveAmount: appliedCredit,
        leftoverPreReceive: leftoverCredit
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
Previous Pending      : Rs. ${Math.round(patientOverallPending)}
Current Treatment(s)  : Rs. ${Math.round(treatmentFee)}
Total Billing Amount  : Rs. ${Math.round(totalDueBeforeAdjustments)}
${appliedCredit > 0 ? `Advance Applied      : Rs. -${Math.round(appliedCredit)}` : ''}
${paymentData.discount > 0 ? `Discount             : Rs. -${Math.round(paymentData.discount)}` : ''}
${alreadyPaidThisVisit > 0 ? `Previously Paid      : Rs. -${Math.round(alreadyPaidThisVisit)}` : ''}
--------------------------------
Net Payable Amount    : Rs. ${Math.round(remainingCashDue)}
Paid Now              : Rs. ${Math.round(paymentData.amount)}
**Final Balance Due**  : Rs. ${Math.round(finalPendingAfterPayment)}
${leftoverCredit > 0 ? `Remaining Advance    : Rs. ${Math.round(leftoverCredit)}` : ''}
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
          <button onClick={onCancel || onClose} className="p-2 hover:bg-gray-100 rounded-full" disabled={isSubmitting}>
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

          {totalAvailableCredit > 0 && (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200 shadow-sm">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-800">
                <CreditCard className="h-4 w-4" />
                Advance Payment Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total Advance Available:</span>
                  <span className="font-bold text-green-700">Rs. {Math.round(totalAvailableCredit)}</span>
                </div>
                
                <div className="bg-white/60 p-3 rounded-lg border border-green-100 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-700 font-medium">Deducted for this bill:</span>
                    <span className="font-bold text-blue-700">- Rs. {Math.round(appliedCredit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-green-100">
                    <span className="text-purple-700 font-semibold">Remaining Advance Balance:</span>
                    <span className="font-bold text-purple-700 text-lg">Rs. {Math.round(leftoverCredit)}</span>
                  </div>
                </div>

                <p className="text-[10px] text-center text-gray-500 italic">
                  {leftoverCredit > 0 
                    ? "Remaining balance will be automatically available for future visits."
                    : "Advance payment has been fully utilized for this treatment."}
                </p>
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
              <div className="flex justify-between border-b pb-2"><span>Total Bill Amount</span><span className="font-bold">Rs. {Math.round(totalDueBeforeAdjustments)}</span></div>
              
              {appliedCredit > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Advance Credit Applied</span>
                  <span>- Rs. {Math.round(appliedCredit)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-2"><span>Balance After Advance Deduction</span><span className="font-medium">Rs. {Math.round(totalDueAfterAdvance)}</span></div>

              <div className="flex justify-between text-red-600 font-semibold border-t pt-2 mt-2"><span>Final Cash/Online/Bank Due</span><span>Rs. {Math.round(remainingCashDue)}</span></div>
              <div className="flex justify-between pt-2 border-t text-sm"><span>Patient's New Pending Balance</span><span className={`font-bold ${finalPendingAfterPayment > 0 ? 'text-red-600' : 'text-green-600'}`}>Rs. {Math.round(finalPendingAfterPayment)}</span></div>
              
              {leftoverCredit > 0 && (
                <div className="flex justify-between text-purple-700 font-bold bg-purple-50 p-2 rounded-lg mt-3 border border-purple-100 shadow-sm animate-pulse">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Leftover Advance Credit</span>
                  </div>
                  <span>Rs. {Math.round(leftoverCredit)}</span>
                </div>
              )}
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
              <Button type="button" variant="outline" onClick={onCancel || onClose} className="flex-1" disabled={isSubmitting}>Cancel</Button>
              <Button type="button" onClick={handleSubmitOnly} disabled={isSubmitting || licenseDaysLeft <= 0} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Process Payment'}
              </Button>
              <Button type="submit" disabled={isSubmitting || licenseDaysLeft <= 0} className="flex-1 bg-green-600 hover:bg-green-700">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><Printer className="mr-2 h-4 w-4" /> Process & Print</>}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}