'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import PatientCard from '@/components/billing/PatientCard';
import TreatmentModal from '@/components/modals/TreatmentModal';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';
import { QueueItem } from '@/types';
import { toast } from 'sonner';

export default function Bill() {
    const { queue, handleMovePatient } = useData();
    const { presentDoctors } = useAvailableDoctors();

    // Modal state
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null);

    // Handle status updates using the centralized handleMovePatient function
    const handleUpdateStatus = async (id: string, newStatus: 'waiting' | 'in_treatment' | 'completed') => {
        try {
            const item = queue.find(q => q.id === id);
            if (!item) {
                toast.error('Queue item not found');
                return;
            }

            const currentStatus = item.status;
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

            await handleMovePatient(id, action, currentStatus);
        } catch (error) {
            console.error('Status update failed:', error);
            toast.error('Failed to update status');
        }
    };

    const handleTreatmentSubmit = (data: { treatment: string; fee: number; doctor: string }) => {
        console.log('Treatment data submitted:', data);
        setShowTreatmentModal(false);
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 italic">Bill Management</h1>
                    <p className="text-gray-500">Manage patient treatments and billing cycles</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {queue.map((item) => (
                    <PatientCard
                        key={item.id}
                        patient={item}
                        onUpdateStatus={handleUpdateStatus}
                        onEdit={(p) => toast.info(`Editing ${p.patientName}`)}
                        onDelete={(p) => alert(`Delete ${p.patientName}? (Action restricted)`)}
                        onPrint={(p) => {
                            setSelectedPatient(p);
                            setShowTreatmentModal(true);
                        }}
                    />
                ))}
            </div>

            {queue.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500">No active queue items found. Visit the Queue page to add patients.</p>
                </div>
            )}

            {/* Treatment Modal Wiring */}
            {showTreatmentModal && selectedPatient && (
                <TreatmentModal
                    open={showTreatmentModal}
                    onClose={() => setShowTreatmentModal(false)}
                    onSubmit={handleTreatmentSubmit}
                    queueItem={selectedPatient}
                    doctors={presentDoctors}
                />
            )}
        </div>
    );
}
