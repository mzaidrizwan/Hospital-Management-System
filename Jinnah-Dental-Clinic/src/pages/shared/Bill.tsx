'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import PatientCard from '@/components/billing/PatientCard';
import TreatmentModal from '@/components/modals/TreatmentModal';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';
import { QueueItem } from '@/types';
import { toast } from 'sonner';
import { Clock, Activity, CheckCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function Bill() {
    const { queue, patients, updateQueueItemOptimistic, updateLocal, deleteLocal, loading } = useData();
    const { presentDoctors } = useAvailableDoctors();

    // Modal state
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Handle status updates using the centralized handleMovePatient function
    const handleUpdateStatus = async (id: string, newStatus: 'waiting' | 'in_treatment' | 'completed') => {
        try {
            const item = queue.find(q => q.id === id);
            if (!item) {
                toast.error('Queue item not found');
                return;
            }

            const currentStatus = item.status;
            let action: 'start' | 'complete' | 'back' | '';

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
                action = '';
            }

            const now = new Date().toISOString();
            let updates: Partial<QueueItem> = { status: newStatus };

            if (action === 'start') {
                updates.treatmentStartTime = now;
            } else if (action === 'complete') {
                updates.treatmentEndTime = now;
                // Note: For billing, completion might need fee/doctor input
                setSelectedPatient(item);
                setShowTreatmentModal(true);
                return;
            } else if (action === 'back') {
                if (newStatus === 'waiting') {
                    updates.treatmentStartTime = null;
                } else if (newStatus === 'in_treatment') {
                    updates.treatmentEndTime = null;
                }
            }

            await updateQueueItemOptimistic(id, updates);
            toast.success(`Patient moved to ${newStatus.replace('_', ' ')}`);
        } catch (error) {
            console.error('Status update failed:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (item: QueueItem) => {
        if (confirm(`Are you sure you want to remove ${item.patientName} from the billing queue?`)) {
            try {
                await deleteLocal('queue', item.id);
                toast.success('Patient removed from queue');
            } catch (error) {
                toast.error('Failed to remove patient');
            }
        }
    };

    const handleTreatmentSubmit = async (data: { treatment: string; fee: number; doctor: string; doctorId?: string }) => {
        if (!selectedPatient) return;

        try {
            const now = new Date().toISOString();
            const updates: Partial<QueueItem> = {
                status: 'completed',
                treatment: data.treatment,
                fee: data.fee,
                doctor: data.doctor,
                doctorId: data.doctorId,
                treatmentEndTime: now
            };

            // 1. Update Queue Item
            await updateQueueItemOptimistic(selectedPatient.id, updates);

            // 2. Update Patient Record (Syncing balance and visits)
            const patientData = patients.find(p => p.id === selectedPatient.patientId || p.patientNumber === selectedPatient.patientNumber);
            if (patientData) {
                const updatedPatient = {
                    ...patientData,
                    pendingBalance: (patientData.pendingBalance || 0) + data.fee,
                    totalVisits: (patientData.totalVisits || 0) + 1,
                    lastVisit: now
                };
                await updateLocal('patients', updatedPatient);
            }

            toast.success('Treatment completed and billing updated');
            setShowTreatmentModal(false);
            setSelectedPatient(null);
        } catch (error) {
            console.error('Failed to submit treatment:', error);
            toast.error('Failed to update billing info');
        }
    };

    // Filter and group queue items
    const filteredQueue = useMemo(() => {
        return queue.filter(item =>
            item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.patientPhone?.includes(searchTerm)) ||
            (item.tokenNumber.toString() === searchTerm)
        );
    }, [queue, searchTerm]);

    const sections = [
        { title: 'Waiting', status: 'waiting', icon: <Clock className="w-5 h-5 text-blue-600" />, bgColor: 'bg-blue-50/50' },
        { title: 'In Treatment', status: 'in_treatment', icon: <Activity className="w-5 h-5 text-yellow-600" />, bgColor: 'bg-yellow-50/50' },
        { title: 'Completed', status: 'completed', icon: <CheckCircle className="w-5 h-5 text-green-600" />, bgColor: 'bg-green-50/50' }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
                    <p className="text-gray-500">Track and manage patient billing across different treatment stages</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search patient name, phone or token..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {sections.map((section) => (
                    <div key={section.status} className={`flex flex-col rounded-2xl border border-gray-100 ${section.bgColor} min-h-[600px]`}>
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50 rounded-t-2xl">
                            <div className="flex items-center gap-2">
                                {section.icon}
                                <h2 className="font-bold text-gray-800">{section.title}</h2>
                            </div>
                            <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-gray-500 shadow-sm border">
                                {filteredQueue.filter(item => item.status === section.status).length}
                            </span>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1 max-h-[calc(100vh-300px)]">
                            {filteredQueue
                                .filter(item => item.status === section.status)
                                .map((item) => (
                                    <PatientCard
                                        key={item.id}
                                        patient={item}
                                        onUpdateStatus={handleUpdateStatus}
                                        onEdit={(p) => toast.info(`Editing ${p.patientName}`)}
                                        onDelete={handleDelete}
                                        onPrint={(p) => {
                                            setSelectedPatient(p);
                                            setShowTreatmentModal(true);
                                        }}
                                    />
                                ))}

                            {filteredQueue.filter(item => item.status === section.status).length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-sm text-gray-500">No patients {section.title.toLowerCase()}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {queue.length === 0 && !loading && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-500">No active queue items found. Visit the Queue page to add patients.</p>
                </div>
            )}

            {/* Treatment Modal Wiring */}
            {showTreatmentModal && selectedPatient && (
                <TreatmentModal
                    open={showTreatmentModal}
                    onClose={() => {
                        setShowTreatmentModal(false);
                        setSelectedPatient(null);
                    }}
                    onSubmit={handleTreatmentSubmit}
                    queueItem={selectedPatient}
                    doctors={presentDoctors}
                />
            )}
        </div>
    );
}
