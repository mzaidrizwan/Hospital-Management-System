'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Staff } from '@/types'; // Using new types

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Staff>) => void;
  staff: Staff | null;
  isEditing: boolean;
}

const roles = ['Dentist', 'Orthodontist', 'Endodontist', 'Dental Hygienist', 'Assistant', 'Receptionist', 'Nurse'];
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
  const [formData, setFormData] = useState<Partial<Staff>>({
    name: '',
    role: '',
    experience: '',
    phone: '',
    status: 'Active',
    salary: 0,
    salaryDuration: 'monthly',
    joinDate: new Date().toISOString().split('T')[0],
    workingDaysPerWeek: 6
  });

  const [calculatedSalary, setCalculatedSalary] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0
  });

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
        experience: '',
        phone: '',
        status: 'Active',
        salary: 0,
        salaryDuration: 'monthly',
        joinDate: new Date().toISOString().split('T')[0],
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
    
    switch(duration) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim() || !formData.role || !formData.phone?.trim() || Number(formData.salary) <= 0) {
      alert('Please fill required fields');
      return;
    }
    
    onSubmit(formData);
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Staff Member' : 'Add New Staff'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Experience</Label>
              <Input
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="e.g., 5 years"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="joinDate">Join Date</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="joinDate"
                  name="joinDate"
                  type="date"
                  value={formData.joinDate}
                  onChange={handleChange}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Salary Configuration (kept) */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium">Salary Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salaryDuration">Salary Duration *</Label>
                  <select
                    id="salaryDuration"
                    name="salaryDuration"
                    value={formData.salaryDuration}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {salaryDurations.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingDaysPerWeek">Working Days/Week</Label>
                  <Input
                    id="workingDaysPerWeek"
                    name="workingDaysPerWeek"
                    type="number"
                    value={formData.workingDaysPerWeek}
                    onChange={handleChange}
                    min="1"
                    max="7"
                    placeholder="6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary">
                  {formData.salaryDuration === 'daily' ? 'Daily Salary ($) *' :
                   formData.salaryDuration === 'weekly' ? 'Weekly Salary ($) *' :
                   'Monthly Salary ($) *'}
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="salary"
                    name="salary"
                    type="number"
                    value={formData.salary}
                    onChange={handleChange}
                    required
                    placeholder={
                      formData.salaryDuration === 'daily' ? 'e.g., 200' :
                      formData.salaryDuration === 'weekly' ? 'e.g., 1200' :
                      'e.g., 5000'
                    }
                    className="pl-9"
                    min="0"
                  />
                </div>
              </div>

              {/* Salary Conversion Preview (kept) */}
              {Number(formData.salary) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Salary Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-medium">Daily</div>
                      <div className="text-blue-600">${calculatedSalary.daily.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Weekly</div>
                      <div className="text-blue-600">${calculatedSalary.weekly.toFixed(2)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">Monthly</div>
                      <div className="text-blue-600">${calculatedSalary.monthly.toFixed(2)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2 text-center">
                    Based on {formData.workingDaysPerWeek || 6} working days per week
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Update Staff' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}