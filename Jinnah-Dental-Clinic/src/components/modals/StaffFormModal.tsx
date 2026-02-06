'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Clock, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Staff } from '@/types';
import { useData } from '@/context/DataContext';

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Staff>) => Promise<void> | void;
  staff: Staff | null;
  isEditing: boolean;
}


const statuses = ['Active', 'On Leave', 'Inactive'];
const salaryDurations = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export default function StaffFormModal({
  open,
  onClose,
  onSubmit,
  staff,
  isEditing
}: StaffFormModalProps) {
  const { roles } = useData();
  const [formData, setFormData] = useState<Partial<Staff>>({
    name: '',
    role: '',
    phone: '',
    status: 'Active',
    salary: 0,
    salaryDuration: 'monthly',
    salaryType: 'monthly',
    joinDate: new Date().toISOString().split('T')[0],
    lastPaidDate: new Date().toISOString().split('T')[0],
    totalEarned: 0,
    workingDaysPerWeek: 6
  });

  const [calculatedSalary, setCalculatedSalary] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (staff && isEditing) {
      setFormData({
        ...staff,
        salary: staff.salary,
        joinDate: staff.joinDate.split('T')[0],
        workingDaysPerWeek: staff.workingDaysPerWeek || 6
      });

      calculateSalaries(
        Number(staff.salary),
        staff.salaryDuration || 'monthly',
        staff.workingDaysPerWeek || 6
      );
    } else {
      setFormData({
        name: '',
        role: '',
        phone: '',
        status: 'Active',
        salary: 0,
        salaryDuration: 'monthly',
        salaryType: 'monthly',
        joinDate: new Date().toISOString().split('T')[0],
        lastPaidDate: new Date().toISOString().split('T')[0],
        totalEarned: 0,
        workingDaysPerWeek: 6
      });
      setCalculatedSalary({
        daily: 0,
        weekly: 0,
        monthly: 0
      });
    }
  }, [staff, isEditing, open]);

  const calculateSalaries = (amount: number, duration: string, workingDays: number = 6) => {
    const weeksInMonth = 4.33;

    let daily = 0, weekly = 0, monthly = 0;

    switch (duration) {
      case 'daily':
        daily = amount;
        weekly = amount * workingDays;
        monthly = weekly * weeksInMonth;
        break;
      case 'weekly':
        daily = amount / workingDays;
        weekly = amount;
        monthly = amount * weeksInMonth;
        break;
      case 'monthly':
        weekly = amount / weeksInMonth;
        daily = weekly / workingDays;
        monthly = amount;
        break;
    }

    setCalculatedSalary({
      daily: Math.round(daily * 100) / 100,
      weekly: Math.round(weekly * 100) / 100,
      monthly: Math.round(monthly * 100) / 100
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      if (name === 'salary' || name === 'salaryDuration' || name === 'workingDaysPerWeek') {
        const salaryAmount = name === 'salary' ? parseFloat(value) || 0 : Number(prev.salary) || 0;
        const duration = name === 'salaryDuration' ? value : (prev.salaryDuration || 'monthly');
        const workingDays = name === 'workingDaysPerWeek' ? parseFloat(value) || 6 : Number(prev.workingDaysPerWeek) || 6;

        calculateSalaries(salaryAmount, duration as string, workingDays);
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim() || !formData.role || !formData.phone?.trim() || Number(formData.salary) <= 0) {
      alert('Please fill required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Execute parent's submission (which handles construction & local-first update)
      // This ensures the local state and DB are updated immediately
      await onSubmit(formData);

      // Ensure the modal closes immediately
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Fixed dimensions - wider for grid */}
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            {isEditing ? 'Edit Staff Member' : 'Add New Staff'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form Content - 2 Column Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} id="staff-form" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

              {/* Left Column */}
              <div className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-gray-500">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="John Smith"
                    disabled={isSubmitting}
                    className="h-10 focus-visible:ring-primary shadow-sm"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-gray-500">Role *</Label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg bg-white h-10 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select Role</option>
                    {roles && roles.length > 0 ? (
                      roles.map((role: any) => (
                        <option key={role.id} value={role.title}>
                          {role.title}
                        </option>
                      ))
                    ) : (
                      <option disabled>Please add roles in Settings &gt; Clinic Features</option>
                    )}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</Label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg bg-white h-10 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    disabled={isSubmitting}
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Phone Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-gray-500">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+92 3XX XXXXXXX"
                    disabled={isSubmitting}
                    className="h-10 shadow-sm"
                  />
                </div>

                {/* Join Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="joinDate" className="text-xs font-bold uppercase tracking-wider text-gray-500">Join Date</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        id="joinDate"
                        name="joinDate"
                        type="date"
                        value={formData.joinDate}
                        onChange={handleChange}
                        className="pl-9 h-10 shadow-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Salary Configuration */}
                <div className="space-y-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="salaryDuration" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Salary Duration</Label>
                      <select
                        id="salaryDuration"
                        name="salaryDuration"
                        value={formData.salaryDuration}
                        onChange={handleChange}
                        className="w-full px-2 py-1.5 border rounded-lg bg-white h-10 text-xs font-bold shadow-sm outline-none"
                        disabled={isSubmitting}
                      >
                        {salaryDurations.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="workingDaysPerWeek" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Days/Week</Label>
                      <Input
                        id="workingDaysPerWeek"
                        name="workingDaysPerWeek"
                        type="number"
                        value={formData.workingDaysPerWeek}
                        onChange={handleChange}
                        min="1"
                        max="7"
                        className="h-10 text-xs font-bold shadow-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="salary" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (PKR)</Label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="salary"
                        name="salary"
                        type="number"
                        value={formData.salary}
                        onChange={handleChange}
                        required
                        className="pl-9 h-10 text-sm font-bold shadow-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Salary Breakdown Row (Full Width) */}
            {Number(formData.salary) > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 transition-all animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-xs uppercase tracking-widest text-blue-900">Salary Breakdown</h4>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-tighter mb-1">Daily</p>
                    <p className="font-black text-blue-600">{formatCurrency(calculatedSalary.daily)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-tighter mb-1">Weekly</p>
                    <p className="font-black text-blue-600">{formatCurrency(calculatedSalary.weekly)}</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-tighter mb-1">Monthly</p>
                    <p className="font-black text-blue-600">{formatCurrency(calculatedSalary.monthly)}</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="border-t p-4 shrink-0 bg-gray-50/50 flex justify-end gap-3 rounded-b-lg">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="font-bold border-gray-200 hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="staff-form"
            disabled={isSubmitting}
            className="font-black px-8 bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              isEditing ? 'Update Personnel' : 'Add Personnel'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};