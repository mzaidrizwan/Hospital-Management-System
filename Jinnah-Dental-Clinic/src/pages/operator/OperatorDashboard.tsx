'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, Clock, CheckCircle2, Activity,
  Loader2, AlertTriangle, RefreshCw,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useLicenseStatus } from '@/hooks/useLicenseStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/StatCard';
import QueueSection from '@/components/dashboard/QueueSection';
import TreatmentModal from '@/components/modals/TreatmentModal';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { Button } from '@/components/ui/button';
import { QueueItem, Patient } from '@/types';
import { toast } from 'sonner';
import {
  getAllQueueItems,
  getTodayTokenCount
} from '@/services/queueService';
import { getAllPatients } from '@/services/patientService';
import { useData } from '@/context/DataContext';


export default function OperatorDashboard() {
  const {
    queue: queueData,
    patients,
    inventory,
    loading: dataLoading,
    updateLocal,
    deleteLocal,
    updateQueueItemOptimistic
  } = useData();
  const { status, daysLeft } = useLicenseStatus();
  const { presentDoctors } = useAvailableDoctors();

  const waitingPatients = queueData.filter(p => p.status === 'waiting');
  const inTreatmentPatients = queueData.filter(p => p.status === 'in_treatment');
  const completedPatients = queueData.filter(p => p.status === 'completed');
  const lowStockItems = inventory.filter(item => item.quantity < (item.min || 0));

  // Today's token count calculation (from queue items created today)
  const today = new Date().toISOString().split('T')[0];
  const todayTokenCount = queueData.filter(item => {
    const itemDate = (item.checkInTime || item.createdAt || '').split('T')[0];
    return itemDate === today;
  }).length;

  const [selectedPatientData, setSelectedPatientData] = useState<any>(null);
  const [selectedQueueItemForTreatment, setSelectedQueueItemForTreatment] = useState<any>(null);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null);

  const getPatientDataForQueueItem = (queueItem: QueueItem) => {
    return patients.find(p =>
      p.patientNumber === queueItem.patientNumber ||
      p.id === queueItem.patientId
    ) || null;
  };

  const speakAnnouncement = (tokenNumber: number | string) => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const speak = () => {
      const voices = synth.getVoices();
      const femaleVoice =
        voices.find(v => v.name === 'Google UK English Female') ||
        voices.find(v => v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang === 'en-GB');

      const text = `Token number ${tokenNumber}. please proceed to the treatment room.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = femaleVoice || null;
      utterance.lang = 'en-GB';
      utterance.rate = 0.9;
      synth.cancel();
      synth.speak(utterance);
    };
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = speak;
    } else {
      speak();
    }
  };

  const handleQueueAction = async (item: QueueItem, action: string) => {
    try {
      const now = new Date().toISOString();
      let updateData: Partial<QueueItem> = {};

      if (action === 'start-treatment') {
        updateData = {
          status: 'in_treatment' as const,
          treatmentStartTime: now
        };
        speakAnnouncement(item.tokenNumber);
      } else if (action === 'complete') {
        const patientData = getPatientDataForQueueItem(item);
        if (patientData) {
          setSelectedPatientData(patientData);
          setSelectedQueueItemForTreatment(item);
          setShowTreatmentModal(true);
          return;
        }
      } else if (action === 'back-to-waiting') {
        updateData = {
          status: 'waiting' as const,
          treatmentStartTime: null,
          treatment: '',
          fee: 0,
          doctor: ''
        };
      } else if (action === 'cancel') {
        const reason = prompt('Cancellation reason:') || 'Patient request';
        updateData = {
          status: 'cancelled' as const,
          cancelledAt: now,
          notes: `${item.notes || ''}\nCancelled: ${reason}`
        };
      } else if (action === 'delete') {
        if (confirm(`Remove ${item.patientName} from queue?`)) {
          await deleteLocal('queue', item.id);
          toast.success(`Removed ${item.patientName} from queue`);
        }
        return;
      }

      if (Object.keys(updateData).length > 0) {
        await updateQueueItemOptimistic(item.id, updateData);
      }
    } catch (error) {
      console.error('Queue action error:', error);
      toast.error('Failed to update queue');
    }
  };

  const handleTreatmentSubmit = async (data: {
    treatment: string;
    fee: number;
    doctor: string;
    doctorId?: string;
  }) => {
    if (!selectedQueueItemForTreatment || !selectedPatientData) return;

    try {
      const now = new Date().toISOString();
      const updateData = {
        status: 'completed' as const,
        treatmentEndTime: now,
        treatment: data.treatment,
        fee: data.fee,
        doctor: data.doctor,
        doctorId: data.doctorId
      };

      await updateQueueItemOptimistic(selectedQueueItemForTreatment.id, updateData);

      const updatedPatient = {
        ...selectedPatientData,
        pendingBalance: (selectedPatientData.pendingBalance || 0) + data.fee,
        totalVisits: (selectedPatientData.totalVisits || 0) + 1,
        lastVisit: now
      };

      await updateLocal('patients', updatedPatient);
      setShowTreatmentModal(false);
      toast.success('Treatment completed');
    } catch (error) {
      console.error('Error completing treatment:', error);
      toast.error('Failed to complete treatment');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {status !== 'active' && (
        <Alert variant={status === 'expired' ? 'destructive' : 'default'} className={cn(
          "border-l-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500",
          status === 'warning' && "border-l-amber-500 bg-amber-50"
        )}>
          {status === 'expired' ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4 text-amber-600" />}
          <AlertTitle className={cn(
            "font-bold",
            status === 'expired' ? "text-red-800" : "text-amber-800"
          )}>
            {status === 'expired' ? 'License Expired' : 'License Expiring Soon'}
          </AlertTitle>
          <AlertDescription className={cn(
            "text-sm font-medium",
            status === 'expired' ? "text-red-700" : "text-amber-700"
          )}>
            {status === 'expired'
              ? "Your license has expired. Some features may be limited. Please contact support to renew."
              : `Your license will expire in ${daysLeft} days. Please renew soon.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Operator Dashboard</h1>
            {dataLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
          <p className="text-muted-foreground">View queue and inventory overview</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Patients"
          value={patients.length}
          subtitle="Registered patients"
          icon={Users}
          variant="info"
        />
        <StatCard
          title="Waiting Patients"
          value={waitingPatients.length}
          subtitle="In queue"
          icon={Clock}
          variant="warning"
          trend={waitingPatients.length > 2 ? { value: 10, isPositive: false } : undefined}
        />
        <StatCard
          title="In Treatment"
          value={inTreatmentPatients.length}
          subtitle="Currently being treated"
          icon={Activity}
          variant="primary"
        />
        <StatCard
          title="Completed Today"
          value={completedPatients.length}
          subtitle="Finished treatments"
          icon={CheckCircle2}
          variant="success"
          trend={completedPatients.length > 3 ? { value: 15, isPositive: true } : undefined}
        />
      </div>

      {/* Low Stock Card */}
      <StatCard
        title="Low Stock Items"
        value={lowStockItems.length}
        subtitle="Items below minimum stock"
        icon={AlertTriangle}
        variant="warning"
      />

      {/* Queue Management (Read-only, no actions) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h2 className="text-lg font-semibold">Today's Queue</h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Total in queue: <span className="font-semibold">{queueData.length}</span>
            </div>
            <div className="flex gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="text-xs">Waiting ({waitingPatients.length})</span>
              <span className="w-3 h-3 rounded-full bg-blue-500 ml-2"></span>
              <span className="text-xs">In Treatment ({inTreatmentPatients.length})</span>
              <span className="w-3 h-3 rounded-full bg-green-500 ml-2"></span>
              <span className="text-xs">Completed ({completedPatients.length})</span>
            </div>
          </div>
        </div>

        {dataLoading && queueData.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2">Loading queue data...</span>
          </div>
        ) : queueData.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No patients in queue today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <QueueSection
              title="Waiting"
              items={waitingPatients}
              status="waiting"
              onAction={handleQueueAction}
              showPatientId={true}
            />
            <QueueSection
              title="In Treatment"
              items={inTreatmentPatients}
              status="in_treatment"
              onAction={handleQueueAction}
              showBackButton={true}
              showPatientId={true}
            />
            <QueueSection
              title="Completed"
              items={completedPatients}
              status="completed"
              onAction={handleQueueAction}
              showBackButton={true}
              showPatientId={true}
            />
          </div>
        )}
      </div>

      {showTreatmentModal && selectedQueueItemForTreatment && (
        <TreatmentModal
          open={showTreatmentModal}
          onClose={() => {
            setShowTreatmentModal(false);
            setSelectedQueueItemForTreatment(null);
            setSelectedPatientData(null);
          }}
          onSubmit={handleTreatmentSubmit}
          queueItem={selectedQueueItemForTreatment}
          doctors={presentDoctors}
          patientData={selectedPatientData}
          patientHistory={{
            queueHistory: [],
            paymentHistory: [],
            bills: []
          }}
          patientInfo={{
            pendingBalance: selectedPatientData?.pendingBalance || 0
          }}
        />
      )}
    </div>
  );
}