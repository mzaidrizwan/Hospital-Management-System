'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  onSubmit: (data: any) => void;
  existingPatients: Patient[]; // Existing patients from database
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
    }
  }, [open]);

  // Filter existing patients based on search
  const filteredPatients = existingPatients.filter(patient => 
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery) ||
    patient.id.includes(searchQuery)
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    
    // If searching by patient ID
    if (value.startsWith('PAT') || value.length >= 3) {
      const foundPatient = existingPatients.find(p => 
        p.id === value || p.name.toLowerCase().includes(value.toLowerCase())
      );
      
      if (foundPatient) {
        // Auto-fill form if patient exists
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
        // Reset form if patient doesn't exist
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      alert('Please enter patient name');
      return;
    }
    if (!formData.phone.trim()) {
      alert('Please enter phone number');
      return;
    }
    
    // Prepare data for submission
    const submitData = {
      ...formData,
      // Ensure no undefined values
      name: formData.name || '',
      phone: formData.phone || '',
      age: formData.age || '',
      gender: formData.gender || '',
      address: formData.address || '',
      medicalHistory: formData.medicalHistory || '',
      priority: formData.priority || 'normal',
      notes: formData.notes || '',
      isNewPatient: !isExistingPatient,
      createdAt: new Date()
    };
    
    onSubmit(submitData);
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Patient Search/ID Section */}
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
                />
              </div>
              
              {/* Dropdown for existing patients */}
              {showDropdown && searchQuery && (
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

            {/* Manual Patient ID Input */}
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID (Optional)</Label>
              <Input
                id="patientId"
                name="patientId"
                value={formData.patientId}
                onChange={handleChange}
                placeholder="PAT001 or leave blank for auto-generate"
              />
              <p className="text-xs text-gray-500">
                If left blank, system will auto-generate ID
              </p>
            </div>
          </div>

          {/* Patient Details */}
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
              />
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="medicalHistory">Medical History</Label>
              <Textarea
                id="medicalHistory"
                name="medicalHistory"
                value={formData.medicalHistory}
                onChange={handleChange}
                placeholder="Any medical conditions or allergies..."
                rows={2}
              />
            </div> */}
          </div>

          {/* Priority and Notes */}
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
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-green-600 hover:bg-green-700"
            >
              Add to Queue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}