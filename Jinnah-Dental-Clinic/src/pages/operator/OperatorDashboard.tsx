'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, Clock, CheckCircle2, Activity,
  Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import QueueSection from '@/components/dashboard/QueueSection';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { Button } from '@/components/ui/button';
import { QueueItem, Patient } from '@/types';
import { toast } from 'sonner';
import {
  getAllQueueItems,
  getTodayTokenCount
} from '@/services/queueService';
import { getAllPatients } from '@/services/patientService';

// Firebase
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query
} from 'firebase/firestore';

// IndexedDB Utilities
import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';

// Firebase sync helpers for inventory
const syncToFirebase = (collectionName: string, item: any) => {
  setDoc(doc(db, collectionName, item.id), item).catch(console.error); // Background sync
};

const loadFromFirebase = async (collectionName: string): Promise<any[]> => {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.error("Firebase load failed:", err);
    return [];
  }
};

export default function OperatorDashboard() {
  const [queueData, setQueueData] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [todayTokenCount, setTodayTokenCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false); // For sync button
  const [lowStockItems, setLowStockItems] = useState([]); // For inventory low stock

  // Firebase se data fetch karna
  useEffect(() => {
    fetchQueueData();
    fetchPatientsData();
    fetchTodayTokenCount();
    fetchInventoryData(); // New: Fetch inventory for low stock
  }, []);

  const fetchQueueData = async () => {
    try {
      setLoadingQueue(true);
      const data = await getAllQueueItems();
      setQueueData(data);
    } catch (error) {
      console.error('Error fetching queue data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchPatientsData = async () => {
    try {
      setLoadingPatients(true);
      const data = await getAllPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to load patients');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchTodayTokenCount = async () => {
    try {
      const count = await getTodayTokenCount();
      setTodayTokenCount(count);
    } catch (error) {
      console.error('Error fetching today token count:', error);
    }
  };

  // New: Fetch inventory for low stock (local first, sync if empty)
  const fetchInventoryData = async () => {
    let localInventory = await getFromLocal('inventory') as any[];
    if (localInventory.length === 0) {
      const remoteInventory = await loadFromFirebase('inventory');
      if (remoteInventory.length > 0) {
        localInventory = remoteInventory;
        for (const item of remoteInventory) await saveToLocal('inventory', item);
      }
    }

    const lowStock = localInventory.filter(item => item.quantity < item.min);
    setLowStockItems(lowStock);
  };

  // Manual Sync (for all data, including inventory)
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sync queue, patients, etc. (assume services handle Firebase)
      await fetchQueueData();
      await fetchPatientsData();
      await fetchTodayTokenCount();

      // Sync inventory
      const remoteInventory = await loadFromFirebase('inventory');
      for (const item of remoteInventory) await saveToLocal('inventory', item);
      const lowStock = remoteInventory.filter(item => item.quantity < item.min);
      setLowStockItems(lowStock);

      toast.success('Data synced from Firebase!');
    } catch (err) {
      toast.error('Sync failed. Check your internet connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const waitingPatients = queueData.filter(p => p.status === 'waiting');
  const inTreatmentPatients = queueData.filter(p => p.status === 'in_treatment');
  const completedPatients = queueData.filter(p => p.status === 'completed');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Operator Dashboard</h1>
            {loadingQueue && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
          <p className="text-muted-foreground">View queue and inventory overview</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSync}
            variant="outline"
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
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

        {loadingQueue ? (
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
              onAction={() => { }} // Read-only for operator
            />
            <QueueSection
              title="In Treatment"
              items={inTreatmentPatients}
              status="in_treatment"
              onAction={() => { }}
            />
            <QueueSection
              title="Completed"
              items={completedPatients}
              status="completed"
              onAction={() => { }}
            />
          </div>
        )}
      </div>
    </div>
  );
}