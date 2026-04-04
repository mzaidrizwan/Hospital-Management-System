// 'use client';

// import React, { useState, useEffect } from 'react';
// import { X, DollarSign, Calendar } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
// import { Staff } from '@/types';

// interface PaySalaryModalProps {
//   open: boolean;
//   onClose: () => void;
//   staff: Staff | null;
//   onSubmit: (staff: Staff, data: any) => void;
// }

// export default function PaySalaryModal({
//   open,
//   onClose,
//   staff,
//   onSubmit
// }: PaySalaryModalProps) {
//   const [paymentData, setPaymentData] = useState<{
//     amount: number | string;
//     paymentMethod: string;
//     month: string;
//     notes: string;
//   }>({
//     amount: 0,
//     paymentMethod: 'bank',
//     month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
//     notes: ''
//   });

//   useEffect(() => {
//     if (!open || !staff) return;

//     setPaymentData(prev => {
//       if (prev.amount == staff.pendingSalary) return prev; // Prevent loop
//       return {
//         amount: staff.pendingSalary,
//         paymentMethod: 'bank',
//         month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
//         notes: ''
//       };
//     });
//   }, [open, staff?.pendingSalary]); // Dependencies primitive pe

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
//     const { name, value } = e.target;
//     setPaymentData(prev => ({
//       ...prev,
//       [name]: value
//     }));
//   };

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     const numericAmount = Number(paymentData.amount);

//     if (!staff || !numericAmount || numericAmount <= 0) {
//       alert("Invalid amount");
//       return;
//     }

//     // Create a new object with the numeric amount to pass to onSubmit
//     const submissionData = {
//       ...paymentData,
//       amount: numericAmount
//     };

//     onSubmit(staff, submissionData);
//   };

//   if (!open || !staff) return null;

//   return (
//     <div
//       className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
//       onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
//     >
//       <div className="bg-white rounded-lg w-full max-w-md p-4">
//         <div className="flex items-center justify-between border-b pb-2 mb-4 bg-white">
//           <h2 className="text-lg font-semibold">Pay Salary to {staff.name}</h2>
//           <button onClick={onClose}><X className="w-5 h-5" /></button>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="paymentDate">Payment Date</Label>
//             <Input
//               id="paymentDate"
//               name="paymentDate"
//               type="date"
//               // value={paymentData.paymentDate}
//               onChange={handleChange}
//             />
//           </div>
//           <div className="space-y-2">
//             <Label htmlFor="amount">Amount (Rs.)</Label>
//             <Input
//               id="amount"
//               name="amount"
//               type="number"
//               step="0.01"
//               value={paymentData.amount}
//               onChange={handleChange}
//             />
//           </div>
//           <div className="space-y-2">
//             <Label htmlFor="paymentMethod">Method</Label>
//             <select id="paymentMethod" name="paymentMethod" value={paymentData.paymentMethod} onChange={handleChange} className="w-full border p-2 rounded">
//               <option value="bank">Bank</option>
//               <option value="cash">Cash</option>
//             </select>
//           </div>
//           <div className="space-y-2">
//             <Label htmlFor="notes">Notes</Label>
//             <Textarea id="notes" name="notes" value={paymentData.notes} onChange={handleChange} />
//           </div>
//           <Button type="submit">Pay</Button>
//         </form>
//       </div>
//     </div>
//   );
// }



'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Staff } from '@/types';

interface PaySalaryModalProps {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
  onSubmit: (staff: Staff, data: any) => void;
}

export default function PaySalaryModal({
  open,
  onClose,
  staff,
  onSubmit
}: PaySalaryModalProps) {
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'bank',
    paymentDate: new Date().toISOString().split('T')[0],     // YYYY-MM-DD
    paymentTime: new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }),                                                     // HH:MM (24 hour format)
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    notes: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (!open || !staff) return;

    const now = new Date();

    setPaymentData({
      amount: staff.pendingSalary || 0,
      paymentMethod: 'bank',
      paymentDate: now.toISOString().split('T')[0],
      paymentTime: now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      notes: ''
    });
  }, [open, staff]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(paymentData.amount);

    if (!staff || !numericAmount || numericAmount <= 0) {
      alert("Invalid amount");
      return;
    }

    const submissionData = {
      ...paymentData,
      amount: numericAmount,
      // Combine date and time into ISO string for easy storage
      fullPaymentDateTime: `${paymentData.paymentDate}T${paymentData.paymentTime}:00`
    };

    onSubmit(staff, submissionData);
    onClose();
  };

  if (!open || !staff) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between border-b pb-3 mb-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Pay Salary to {staff.name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (Rs.)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              value={paymentData.amount}
              onChange={handleChange}
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Payment Date
            </Label>
            <Input
              id="paymentDate"
              name="paymentDate"
              type="date"
              value={paymentData.paymentDate}
              onChange={handleChange}
            />
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="paymentTime" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Payment Time
            </Label>
            <Input
              id="paymentTime"
              name="paymentTime"
              type="time"
              value={paymentData.paymentTime}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <select 
              id="paymentMethod" 
              name="paymentMethod" 
              value={paymentData.paymentMethod} 
              onChange={handleChange} 
              className="w-full border border-gray-300 p-2 rounded-md"
            >
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea 
              id="notes" 
              name="notes" 
              value={paymentData.notes} 
              onChange={handleChange} 
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Pay Salary
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}