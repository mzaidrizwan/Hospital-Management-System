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
    const { queue, patients, updateQueueItemOptimistic, updateLocal, deleteLocal, loading, staff, treatments } = useData();
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

    const getPatientDataForQueueItem = (item: QueueItem) => {
        return patients.find(p => p.id === item.patientId || p.patientNumber === item.patientNumber);
    };

    const handleDirectPrint = (item: QueueItem) => {
        try {
            // 1. Parse treatments
            const treatmentItems: { name: string; fee: number }[] = [];
            let treatmentString = item.treatment || '';

            // Try to parse "Treatment (Rs. 500), Treatment 2 (Rs. 1000)" format
            const parts = treatmentString.split(/,\s*(?![^(]*\))/);
            parts.forEach(part => {
                const match = part.match(/^(.*?)\s*\(Rs\.\s*([\d,]+)\)$/i);
                if (match) {
                    treatmentItems.push({
                        name: match[1].trim(),
                        fee: parseFloat(match[2].replace(/,/g, ''))
                    });
                } else if (part.trim()) {
                    treatmentItems.push({
                        name: part.trim(),
                        fee: 0
                    });
                }
            });

            // Fix fees if parsing missed them but total exists
            const parsedTotal = treatmentItems.reduce((sum, t) => sum + t.fee, 0);
            const itemFee = item.fee || 0;
            if (parsedTotal !== itemFee) {
                if (parsedTotal === 0 && treatmentItems.length > 0) {
                    treatmentItems[0].fee = itemFee;
                } else if (treatmentItems.length === 0 && itemFee > 0) {
                    treatmentItems.push({ name: 'General Treatment', fee: itemFee });
                }
            }

            // 2. Calculate Financials
            const patientData = getPatientDataForQueueItem(item);
            const currentPendingBalance = patientData?.pendingBalance || 0;

            const discount = item.discount || 0;
            const amountPaid = item.amountPaid || 0;
            const treatmentFee = itemFee;

            // Reverse calculate Previous Pending
            // Final Balance = Previous + Fee - Discount - Paid
            // Previous = Final Balance - Fee + Discount + Paid
            let previousPending = currentPendingBalance - treatmentFee + discount + amountPaid;
            if (previousPending < 0) previousPending = 0;

            const totalDueBeforeDiscount = previousPending + treatmentFee;
            const totalDueAfterDiscount = Math.max(0, totalDueBeforeDiscount - discount);
            const remainingAfterPayment = Math.max(0, totalDueAfterDiscount - amountPaid);

            // 3. Prepare Print Content
            const doctorName = staff.find(s => s.id === item.doctorId)?.name || item.doctor || '—';
            const now = new Date(); // Use current date for reprint
            const dateStr = now.toLocaleString('en-PK', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: true
            });

            const treatmentsRows = treatmentItems.map((t, i) => `
        <tr>
          <td style="border:1px solid #000;padding:3px;">${i + 1}</td>
          <td style="border:1px solid #000;padding:3px;">${t.name}</td>
          <td style="border:1px solid #000;padding:3px;text-align:right;">Rs. ${t.fee.toFixed(0)}</td>
        </tr>
      `).join('');

            const printContent = `
JINNAH DENTAL CLINIC
Token: #${item.tokenNumber || '—'}
Patient: ${item.patientName}
Phone: ${item.patientPhone || 'N/A'}
Date: ${dateStr}
Doctor: ${doctorName}
--------------------------------
TREATMENTS
--------------------------------
<table style="width:100%;border-collapse:collapse;font-size:12px;">
  <thead>
    <tr style="background:#f0f0f0;">
      <th style="border:1px solid #000;padding:3px;">S.No</th>
      <th style="border:1px solid #000;padding:3px;">Treatment</th>
      <th style="border:1px solid #000;padding:3px;">Fee</th>
    </tr>
  </thead>
  <tbody>
    ${treatmentsRows}
    <tr style="font-weight:bold;">
      <td colspan="2" style="border:1px solid #000;padding:3px;">Total Treatments</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;">Rs. ${treatmentFee.toFixed(0)}</td>
    </tr>
  </tbody>
</table>
--------------------------------
PAYMENT SUMMARY
--------------------------------
Previous Pending: Rs. ${previousPending.toFixed(0)}
Current Treatments: Rs. ${treatmentFee.toFixed(0)}
Discount: Rs. ${discount.toFixed(0)}
--------------------------------
Total Due: Rs. ${totalDueAfterDiscount.toFixed(0)}
Paid: Rs. ${amountPaid.toFixed(0)}
Remaining: Rs. ${remainingAfterPayment.toFixed(0)}
--------------------------------
Status: ${item.paymentStatus ? item.paymentStatus.toUpperCase() : 'PENDING'}
Notes: ${item.notes || 'None'}
--------------------------------
Thank You! Visit Again
Powered by Saynz Technologies
`.trim();

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                toast.error('Please allow popups to print');
                return;
            }

            printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${item.patientName}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { 
                margin: 0; 
                padding: 4mm; 
                font-family: 'Courier New', Courier, monospace; 
                font-size: 12px; 
                line-height: 1.2; 
                width: 72mm; 
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 4px 0; 
              }
              th, td { 
                border: 1px solid #000; 
                padding: 3px; 
                text-align: left;
              }
              .bold { font-weight: bold; }
              pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
          </head>
          <body>
            <pre>${printContent}</pre>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() {
                    window.close();
                  }, 1000);
                }, 300);
              }
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();

        } catch (error) {
            console.error("Print error:", error);
            toast.error("Failed to print invoice");
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
                                            if (p.status?.toLowerCase() === 'completed') {
                                                handleDirectPrint(p);
                                            } else {
                                                setSelectedPatient(p);
                                                setShowTreatmentModal(true);
                                            }
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
