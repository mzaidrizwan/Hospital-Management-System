'use client';

import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Patient {
  id: string;           // Firebase document ID
  patientNumber?: string;   // Custom 4-digit number (0001, 0002...)
  name: string;
  phone: string;
  age?: string | number;
  gender?: string;
  address?: string;
  openingBalance?: number;
}

interface PatientFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  patient?: Patient | null;
  isEditing?: boolean;
  mode?: 'patient' | 'walk-in';
  existingPatients?: Patient[];
  title?: string;
  loading?: boolean;
}

export default function PatientFormModal({
  open,
  onClose,
  onSubmit,
  patient,
  isEditing = false,
  mode = 'walk-in',
  existingPatients = [],
  title = 'Patient Registration',
  loading = false
}: PatientFormModalProps) {
  const [formData, setFormData] = useState({
    patientNumber: '',
    name: '',
    phone: '',
    age: '',
    gender: '',
    address: '',
    openingBalance: '0'
  });

  const [idError, setIdError] = useState('');
  const [lastGeneratedId, setLastGeneratedId] = useState('');

  // Generate next available 4-digit number
  const generateNextSequentialNumber = () => {
    if (existingPatients.length === 0) return '0001';

    const numericIds = existingPatients
      .map(p => p.patientNumber || '')
      .filter(id => /^\d{4}$/.test(id))
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id >= 1 && id <= 9999);

    if (numericIds.length === 0) return '0001';

    let nextId = Math.max(...numericIds) + 1;

    while (numericIds.includes(nextId) && nextId <= 9999) {
      nextId++;
    }

    if (nextId > 9999) {
      for (let i = 1; i <= 9999; i++) {
        if (!numericIds.includes(i)) {
          nextId = i;
          break;
        }
      }
    }

    return nextId.toString().padStart(4, '0');
  };

  const checkNumberExists = (id: string) =>
    existingPatients.some(p => p.patientNumber === id);

  // Initialize form when modal opens
  useEffect(() => {
    if (!open) return;

    if (patient && isEditing) {
      // Editing existing patient
      setFormData({
        patientNumber: patient.patientNumber || '',
        name: patient.name || '',
        phone: patient.phone || '',
        age: patient.age?.toString() || '',
        gender: patient.gender || '',
        address: patient.address || '',
        openingBalance: patient.openingBalance?.toString() || '0'
      });
      setIdError('');
    } else {
      // New patient / walk-in
      const newNumber = generateNextSequentialNumber();
      setFormData({
        patientNumber: newNumber,
        name: '',
        phone: '',
        age: '',
        gender: '',
        address: '',
        openingBalance: '0'
      });
      setLastGeneratedId(newNumber);
      setIdError('');
    }
  }, [open, patient, isEditing, existingPatients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === 'patientNumber') {
      let newValue = value.replace(/\D/g, '').slice(0, 4);

      if (newValue.length > 0 && newValue.length !== 4) {
        setIdError('Number must be exactly 4 digits');
      } else if (newValue && checkNumberExists(newValue)) {
        setIdError(`Number ${newValue} already exists`);
      } else {
        setIdError('');
      }

      setFormData(prev => ({ ...prev, [name]: newValue }));
    }
    else if (name === 'openingBalance') {
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const parts = cleaned.split('.');
      const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
      setFormData(prev => ({ ...prev, [name]: formatted }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name.trim()) return toast.error('Patient name is required');
    if (!formData.phone.trim()) return toast.error('Phone number is required');
    if (!formData.patientNumber || formData.patientNumber.length !== 4) {
      return toast.error('Patient Number must be exactly 4 digits (0001-9999)');
    }

    // Duplicate number prevention
    if (checkNumberExists(formData.patientNumber) && !(isEditing && patient?.patientNumber === formData.patientNumber)) {
      toast.error(`Patient Number ${formData.patientNumber} already exists! Please use a different number.`);
      setIdError(`Number ${formData.patientNumber} already exists`);
      return;
    }

    let openingBalance = 0;
    if (formData.openingBalance) {
      const num = parseFloat(formData.openingBalance);
      if (!isNaN(num)) openingBalance = num;
    }

    const submitData = {
      id: patient?.id,
      patientNumber: formData.patientNumber,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      age: formData.age ? parseInt(formData.age) : undefined,
      gender: formData.gender || undefined,
      address: formData.address?.trim() || undefined,
      openingBalance,
      isEditing,
    };

    console.log('Submitting:', submitData);
    onSubmit(submitData);
  };

  const handleGenerateNewNumber = () => {
    const newNumber = generateNextSequentialNumber();
    setFormData(prev => ({ ...prev, patientNumber: newNumber }));
    setLastGeneratedId(newNumber);
    setIdError('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Patient Number and Basic Info */}
            <div className="space-y-6">
              {/* Patient Number Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="patientNumber" className="text-base font-medium flex items-center gap-1.5">
                    Patient Number <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleGenerateNewNumber}
                    className="text-sm flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded-md"
                  >
                    <RefreshCw size={14} />
                    Generate New
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
                  <Input
                    id="patientNumber"
                    name="patientNumber"
                    value={formData.patientNumber}
                    onChange={handleChange}
                    placeholder="0001"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    className="font-mono text-center text-lg tracking-wider flex-1"
                    required
                    disabled={loading}
                  />
                  <div className="text-sm bg-gray-50 px-4 py-2.5 rounded-lg">
                    <div className="font-medium">Next Available</div>
                    <div className="text-blue-600 font-bold">{generateNextSequentialNumber()}</div>
                  </div>
                </div>
                
                {idError && (
                  <p className="text-red-600 text-sm flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
                    <AlertCircle size={16} />
                    {idError}
                  </p>
                )}
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-base font-medium text-gray-700 pb-2 border-b">Basic Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="03001234567"
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Additional Information */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-base font-medium text-gray-700 pb-2 border-b">Additional Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      value={formData.age}
                      onChange={handleChange}
                      placeholder="25"
                      min="0"
                      max="120"
                      disabled={loading}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 h-11"
                      disabled={loading}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="House #, Street, Area, City"
                    disabled={loading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openingBalance" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Opening Balance
                  </Label>
                  <Input
                    id="openingBalance"
                    name="openingBalance"
                    value={formData.openingBalance}
                    onChange={handleChange}
                    placeholder="0.00"
                    disabled={loading}
                    className="h-11"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive for amount due, negative for credit balance
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-8 mt-8 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="h-11 px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !!idError}
              className={`h-11 px-8 ${mode === 'walk-in' 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? 'Saving...' : (
                mode === 'walk-in'
                  ? (isEditing ? 'Update & Add to Queue' : 'Add to Queue')
                  : (isEditing ? 'Update Patient' : 'Save Patient')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}