import React, { useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Patient } from '@/types';

interface AddToQueueModalProps {
  patients: Patient[];
  treatments: string[];
  doctors: string[];
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function AddToQueueModal({ 
  patients = [], 
  treatments = [], 
  doctors = [], 
  onClose, 
  onSubmit 
}: AddToQueueModalProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    treatment: '',
    doctor: '',
    priority: 'normal',
    notes: ''
  });
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatientData, setNewPatientData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: ''
  });

  // Filter patients based on search (with safety check)
  const filteredPatients = (patients || []).filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchTerm('');
  };

  const handleNewPatientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPatientData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showNewPatient) {
      // Create new patient and add to queue
      const newPatientId = `p${patients.length + 1}`;
      
      onSubmit({
        patientId: newPatientId,
        patientName: newPatientData.name,
        phone: newPatientData.phone,
        ...formData
      });
    } else if (selectedPatient) {
      // Add existing patient to queue
      onSubmit({
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        phone: selectedPatient.phone,
        ...formData
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Patient to Queue</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Patient Selection */}
          {!selectedPatient && !showNewPatient && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search existing patient..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowNewPatient(true)}
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  New
                </Button>
              </div>

              {/* Patient List */}
              {searchTerm && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No patients found
                    </div>
                  ) : (
                    filteredPatients.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-0"
                      >
                        <div className="font-medium">{patient.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {patient.phone} • {patient.age} years • {patient.gender}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* New Patient Form */}
          {showNewPatient && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">New Patient Details</h3>
                <button 
                  type="button" 
                  onClick={() => setShowNewPatient(false)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Back to search
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={newPatientData.name}
                    onChange={handleNewPatientChange}
                    required
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={newPatientData.phone}
                    onChange={handleNewPatientChange}
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
                      value={newPatientData.age}
                      onChange={handleNewPatientChange}
                      placeholder="30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      name="gender"
                      value={newPatientData.gender}
                      onChange={handleNewPatientChange}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Patient Info */}
          {selectedPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{selectedPatient.name}</div>
                  <div className="text-sm text-blue-700">
                    {selectedPatient.phone} • {selectedPatient.age} years • {selectedPatient.gender}
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedPatient(null)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Treatment Details */}
          {(selectedPatient || showNewPatient) && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="treatment">Treatment *</Label>
                  <select
                    id="treatment"
                    name="treatment"
                    value={formData.treatment}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select Treatment</option>
                    {(treatments || []).map(treatment => (
                      <option key={treatment} value={treatment}>{treatment}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doctor">Doctor *</Label>
                  <select
                    id="doctor"
                    name="doctor"
                    value={formData.doctor}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select Doctor</option>
                    {(doctors || []).map(doctor => (
                      <option key={doctor} value={doctor}>{doctor}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    placeholder="Any special instructions..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {(selectedPatient || showNewPatient) && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Add to Queue
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}