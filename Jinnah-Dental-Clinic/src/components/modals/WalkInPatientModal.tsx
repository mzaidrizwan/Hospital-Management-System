'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';

interface Patient {
  id: string;
  name: string;
  phone: string;
  age?: string;
  gender?: string;
  address?: string;
  medicalHistory?: string;
}

interface WalkInPatientModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void> | void;
  existingPatients: Patient[];
}

export default function WalkInPatientModal({
  open,
  onClose,
  onSubmit,
  existingPatients = []
}: WalkInPatientModalProps) {
  const [formData, setFormData] = useState({
    patientId: '',
    name: '',
    phone: '',
    age: '',
    gender: '',
    address: '',
    medicalHistory: '',
    priority: 'normal',
    notes: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFormData({
        patientId: '',
        name: '',
        phone: '',
        age: '',
        gender: '',
        address: '',
        medicalHistory: '',
        priority: 'normal',
        notes: ''
      });
      setSearchQuery('');
      setShowDropdown(false);
      setIsExistingPatient(false);
      setIsSubmitting(false);
    }
  }, [open]);

  const filteredPatients = existingPatients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery) ||
    patient.id.includes(searchQuery)
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);

    if (value.startsWith('PAT') || value.length >= 3) {
      const foundPatient = existingPatients.find(p =>
        p.id === value || p.name.toLowerCase().includes(value.toLowerCase())
      );

      if (foundPatient) {
        setFormData(prev => ({
          ...prev,
          patientId: foundPatient.id,
          name: foundPatient.name,
          phone: foundPatient.phone || '',
          age: foundPatient.age || '',
          gender: foundPatient.gender || '',
          address: foundPatient.address || '',
          medicalHistory: foundPatient.medicalHistory || ''
        }));
        setIsExistingPatient(true);
      } else {
        setFormData(prev => ({
          ...prev,
          patientId: value,
          name: '',
          phone: '',
          age: '',
          gender: '',
          address: '',
          medicalHistory: ''
        }));
        setIsExistingPatient(false);
      }
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setFormData({
      patientId: patient.id,
      name: patient.name,
      phone: patient.phone || '',
      age: patient.age || '',
      gender: patient.gender || '',
      address: patient.address || '',
      medicalHistory: patient.medicalHistory || '',
      priority: 'normal',
      notes: ''
    });
    setSearchQuery(patient.name);
    setShowDropdown(false);
    setIsExistingPatient(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const { addItem } = useData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name.trim()) {
      toast.error('Please enter patient name');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter phone number');
      return;
    }

    setIsSubmitting(true);
    const tid = toast.loading('Adding to queue...');
    // GLOBAL TOAST GUARD: Force dismiss after 4 seconds
    const timeoutId = setTimeout(() => {
      toast.dismiss(tid);
      console.warn('TOAST GUARD: Forced toast dismissal after 4 seconds');
      if (isSubmitting) {
        setIsSubmitting(false);
        toast.error('Operation timed out. The patient was added locally, but sync may be delayed.');
      }
    }, 4000);

    try {
      console.log("Attempting to add patient...", formData);

      // 1. Save/Update Patient in Master List
      const patientId = formData.patientId || `PAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const patientData = {
        id: patientId,
        name: formData.name,
        phone: formData.phone,
        age: formData.age,
        gender: formData.gender,
        address: formData.address,
        medicalHistory: formData.medicalHistory,
        timestamp: new Date().toISOString()
      };

      console.log("Saving patient data:", patientData);
      const savedPatient = await addItem("patients", patientData);
      console.log("Patient saved successfully:", savedPatient);

      // 2. Add to Queue
      const queueItem = {
        id: `Q-${Date.now()}`,
        patientId: savedPatient.id,
        patientName: savedPatient.name,
        status: 'waiting',
        checkInTime: new Date().toISOString(),
        phone: savedPatient.phone,
        priority: formData.priority || 'normal',
        notes: formData.notes || ''
      };

      console.log("Adding to queue:", queueItem);
      await addItem("queue", queueItem);
      console.log("Queue item added successfully");

      toast.success("Patient added to queue successfully!", { id: tid });
      
      // Short delay to ensure toast is seen
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err) {
      console.error("Modal Submit Error:", err);
      toast.error("Failed to add patient. Please try again.", { id: tid });
      
      // Show alert for database errors
      if (typeof window !== 'undefined' && err instanceof Error) {
        window.alert(`Database Error: ${err.message}`);
      }
    } finally {
      // CRITICAL: ALWAYS clean up toast and timer
      clearTimeout(timeoutId);
      toast.dismiss(tid);
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Walk-in Patient Registration</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            type="button"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-600">Patient Identification</h3>

            <div className="space-y-2 relative">
              <Label htmlFor="search">
                Patient ID or Name Search
                {isExistingPatient && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Existing Patient
                  </span>
                )}
              </Label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Enter Patient ID (e.g., PAT001) or Name..."
                  className="pl-10"
                  onFocus={() => setShowDropdown(true)}
                  disabled={isSubmitting}
                />
              </div>

              {showDropdown && searchQuery && !isSubmitting && (
                <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map(patient => (
                      <div
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex items-center gap-3"
                      >
                        <User className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-xs text-gray-500">
                            ID: {patient.id} | Phone: {patient.phone}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-gray-500">
                      <div>Patient not found</div>
                      <div className="text-xs mt-1">
                        Enter details below to register new patient
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID (Optional)</Label>
              <Input
                id="patientId"
                name="patientId"
                value={formData.patientId}
                onChange={handleChange}
                placeholder="PAT001 or leave blank for auto-generate"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                If left blank, system will auto-generate ID
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h3 className="font-medium text-sm text-gray-600">Patient Details</h3>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  value={formData.age}
                  onChange={handleChange}
                  placeholder="30"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isSubmitting}
                >
                  <option value="">Select</option>
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
                placeholder="Street, City"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h3 className="font-medium text-sm text-gray-600">Additional Information</h3>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isSubmitting}
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any special instructions..."
                rows={2}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                'Add to Queue'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}