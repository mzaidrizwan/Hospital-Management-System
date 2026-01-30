'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar } from 'lucide-react';
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
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    notes: ''
  });

  useEffect(() => {
    if (!open || !staff) return;

    setPaymentData(prev => {
      if (prev.amount === staff.pendingSalary) return prev; // Prevent loop
      return {
        amount: staff.pendingSalary,
        paymentMethod: 'bank',
        month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        notes: ''
      };
    });
  }, [open, staff?.pendingSalary]); // Dependencies primitive pe

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || paymentData.amount <= 0 || paymentData.amount > staff.pendingSalary) {
      alert('Invalid amount');
      return;
    }
    onSubmit(staff, paymentData);
  };

  if (!open || !staff) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg w-full max-w-md p-4">
        <div className="flex items-center justify-between border-b pb-2 mb-4 bg-white">
          <h2 className="text-lg font-semibold">Pay Salary to {staff.name}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input id="amount" name="amount" type="number" value={paymentData.amount} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Method</Label>
            <select id="paymentMethod" name="paymentMethod" value={paymentData.paymentMethod} onChange={handleChange} className="w-full border p-2 rounded">
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" value={paymentData.notes} onChange={handleChange} />
          </div>
          <Button type="submit">Pay</Button>
        </form>
      </div>
    </div>
  );
}