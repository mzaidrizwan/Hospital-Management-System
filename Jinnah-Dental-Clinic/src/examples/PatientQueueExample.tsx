import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import PatientCard from '@/components/billing/PatientCard';
import { QueueItem, Patient } from '@/types';
import { toast } from 'sonner';
import TreatmentModal from '@/components/modals/TreatmentModal';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';

export default function PatientQueueExample() {
    const { patients, handleMovePatient, staff } = useData();
    const { presentDoctors } = useAvailableDoctors();

    // Modal state
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null);

    // Filter patients by status for column-based layout
    const waitingPatients = patients.filter(p => p.status === 'waiting');
    const inTreatmentPatients = patients.filter(p => p.status === 'in_treatment');
    const completedPatients = patients.filter(p => p.status === 'completed');

    /**
     * Handle status updates using the new handleMovePatient function
     */
    const handleUpdateStatus = async (id: string, newStatus: 'waiting' | 'in_treatment' | 'completed') => {
        try {
            const item = patients.find(p => p.id === id);
            if (!item) {
                toast.error('Patient not found');
                return;
            }

            const currentStatus = item.status;

            // Determine the action based on status transition
            let action: 'start' | 'complete' | 'back';

            if (newStatus === 'in_treatment' && currentStatus === 'waiting') {
                action = 'start';
            } else if (newStatus === 'completed') {
                action = 'complete';
            } else if (
                (newStatus === 'waiting' && currentStatus === 'in_treatment') ||
                (newStatus === 'in_treatment' && currentStatus === 'completed')
            ) {
                action = 'back';
            } else {
                toast.error('Invalid status transition');
                return;
            }

            // Call the centralized function
            await handleMovePatient(id, action, currentStatus);

            // Success feedback
            const messages = {
                start: 'Treatment started',
                complete: 'Treatment completed',
                back: 'Patient moved back'
            };
            toast.success(messages[action]);

        } catch (error) {
            console.error('Status update failed:', error);
            toast.error('Failed to update patient status');
        }
    };

    const handleEdit = (patient: QueueItem) => {
        // Open edit modal
        console.log('Edit patient:', patient);
        toast.info(`Edit mode for ${patient.patientName}`);
    };

    const handleDelete = (patient: QueueItem) => {
        // Delete patient logic
        if (confirm(`Are you sure you want to delete ${patient.patientName}?`)) {
            console.log('Delete patient:', patient);
            toast.success('Patient deleted (mock)');
        }
    };

    const handleTreatmentSubmit = (data: { treatment: string; fee: number; doctor: string }) => {
        console.log('Treatment submitted:', data);
        setShowTreatmentModal(false);
        toast.success('Treatment details saved');
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Queue Workflow Integration</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Waiting Column */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Waiting ({waitingPatients.length})
                    </h2>
                    <div className="space-y-4">
                        {waitingPatients.map(patient => (
                            <PatientCard
                                key={patient.id}
                                patient={patient as QueueItem}
                                onUpdateStatus={handleUpdateStatus}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onPrint={(p) => {
                                    setSelectedPatient(p);
                                    setShowTreatmentModal(true);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* In Treatment Column */}
                <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        In Treatment ({inTreatmentPatients.length})
                    </h2>
                    <div className="space-y-4">
                        {inTreatmentPatients.map(patient => (
                            <PatientCard
                                key={patient.id}
                                patient={patient as QueueItem}
                                onUpdateStatus={handleUpdateStatus}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onPrint={(p) => {
                                    setSelectedPatient(p);
                                    setShowTreatmentModal(true);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Completed Column */}
                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Completed ({completedPatients.length})
                    </h2>
                    <div className="space-y-4">
                        {completedPatients.map(patient => (
                            <PatientCard
                                key={patient.id}
                                patient={patient as QueueItem}
                                onUpdateStatus={handleUpdateStatus}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onPrint={(p) => {
                                    setSelectedPatient(p);
                                    setShowTreatmentModal(true);
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Treatment Modal Wiring */}
            {showTreatmentModal && selectedPatient && (
                <TreatmentModal
                    open={showTreatmentModal}
                    onClose={() => setShowTreatmentModal(false)}
                    onSubmit={handleTreatmentSubmit}
                    queueItem={selectedPatient}
                    doctors={presentDoctors}
                    patientData={null} // Can be fetched if needed
                />
            )}
        </div>
    );
}
