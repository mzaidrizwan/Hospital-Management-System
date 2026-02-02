'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { getFromLocal, saveToLocal, openDB, getAllStores, saveMultipleToLocal } from '@/services/indexedDbUtils';
import { processSyncQueue } from '@/services/syncService';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import {
    Patient,
    QueueItem,
    Appointment,
    Staff,
    SalaryPayment,
    Attendance,
    InventoryItem,
    Expense,
    Bill,
    Treatment
} from '@/types';
import { toast } from 'sonner';

interface DataContextType {
    patients: Patient[];
    queue: QueueItem[];
    appointments: Appointment[];
    staff: Staff[];
    salaryPayments: SalaryPayment[];
    attendance: Attendance[];
    inventory: any[];
    sales: any[];
    expenses: Expense[];
    bills: Bill[];
    treatments: Treatment[];
    clinicSettings: any;
    loading: boolean;
    isOnline: boolean;
    updateLocal: (collectionName: string, data: any) => Promise<void>;
    refreshCollection: (collectionName: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// All collections that should be managed by DataContext
const COLLECTIONS = [
    'patients',
    'queue',
    'appointments',
    'staff',
    'salaryPayments',
    'attendance',
    'inventory',
    'sales',
    'expenses',
    'bills',
    'treatments',
    'clinicSettings',
    'users'
];

// Map collection names to their state setters
const createStateMap = (setters: any) => ({
    patients: setters.setPatients,
    queue: setters.setQueue,
    appointments: setters.setAppointments,
    staff: setters.setStaff,
    salaryPayments: setters.setSalaryPayments,
    attendance: setters.setAttendance,
    inventory: setters.setInventory,
    sales: setters.setSales,
    expenses: setters.setExpenses,
    bills: setters.setBills,
    treatments: setters.setTreatments,
    clinicSettings: setters.setClinicSettings
});

export function DataProvider({ children }: { children: ReactNode }) {
    const isOnline = useConnectionStatus();

    // State for all collections
    const [patients, setPatients] = useState<Patient[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [clinicSettings, setClinicSettings] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [listenersInitialized, setListenersInitialized] = useState(false);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // Initialize database and load all data from IndexedDB
    const initializeData = async () => {
        try {
            await openDB();

            // Load ALL collections from IndexedDB in parallel
            const results = await Promise.all(COLLECTIONS.map(async (collectionName) => {
                const data = await getFromLocal(collectionName);
                return { collectionName, data };
            }));

            // Update React state with data from IndexedDB
            results.forEach(({ collectionName, data }) => {
                if (data === null || data === undefined) return;

                const setter = (stateMap as any)[collectionName];
                if (!setter) return;

                if (collectionName === 'clinicSettings') {
                    if (Array.isArray(data) && data.length > 0) setter(data[0]);
                    else if (!Array.isArray(data)) setter(data);
                } else {
                    setter(Array.isArray(data) ? data : []);
                }
            });

            setInitialLoadComplete(true);
            setLoading(false);
        } catch (error) {
            console.error('Error initializing data:', error);
            setInitialLoadComplete(true);
            setLoading(false);
        }
    };

    const stateMap = useMemo(() => ({
        patients: setPatients,
        queue: setQueue,
        appointments: setAppointments,
        staff: setStaff,
        salaryPayments: setSalaryPayments,
        attendance: setAttendance,
        inventory: setInventory,
        sales: setSales,
        expenses: setExpenses,
        bills: setBills,
        treatments: setTreatments,
        clinicSettings: setClinicSettings,
        users: () => { } // Placeholder for users if needed
    }), []);

    /**
     * Update local data (State + IndexedDB)
     */
    const updateLocal = useCallback(async (collectionName: string, data: any) => {
        // 1. Save to IndexedDB immediately
        await saveToLocal(collectionName, data);

        // 2. Update React State for immediate feedback
        const setter = (stateMap as any)[collectionName];
        if (setter) {
            if (collectionName === 'clinicSettings') {
                setter(data);
            } else {
                setter((prev: any[]) => {
                    const index = prev.findIndex((item: any) => item.id === data.id);
                    if (index !== -1) {
                        const next = [...prev];
                        next[index] = data;
                        return next;
                    } else {
                        return [data, ...prev];
                    }
                });
            }
        }
    }, [stateMap]);

    /**
     * Refresh a collection from IndexedDB
     */
    const refreshCollection = useCallback(async (collectionName: string) => {
        const data = await getFromLocal(collectionName);
        const setter = (stateMap as any)[collectionName];
        if (setter) {
            if (collectionName === 'clinicSettings') {
                setter(Array.isArray(data) ? data[0] : data);
            } else {
                setter(Array.isArray(data) ? data : []);
            }
        }
    }, [stateMap]);

    /**
     * Handle Firebase snapshot updates
     */
    const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
        try {
            if (remoteData.length === 0) return;

            // Get current local data for comparison
            const localData = (await getFromLocal(collectionName) || []) as any[];

            // For clinicSettings (single object)
            if (collectionName === 'clinicSettings') {
                const remoteSettings = remoteData[0];
                const localSettings = Array.isArray(localData) ? localData[0] : localData;

                if (JSON.stringify(remoteSettings) === JSON.stringify(localSettings)) return;

                const remoteTimestamp = remoteSettings.lastUpdated || remoteSettings.updatedAt || 0;
                const localTimestamp = localSettings?.lastUpdated || localSettings?.updatedAt || 0;

                if (!localSettings || remoteTimestamp > localTimestamp) {
                    await saveToLocal(collectionName, remoteSettings);
                    setClinicSettings(remoteSettings);
                }
                return;
            }

            // For array collections
            const localMap = new Map(localData.map(item => [item.id, item]));
            let hasChanged = false;
            const updatesToSave: any[] = [];

            for (const remoteItem of remoteData) {
                const localItem = localMap.get(remoteItem.id);

                if (!localItem) {
                    updatesToSave.push(remoteItem);
                    hasChanged = true;
                    continue;
                }

                if (JSON.stringify(remoteItem) !== JSON.stringify(localItem)) {
                    const remoteTimestamp = remoteItem.lastUpdated || remoteItem.updatedAt || 0;
                    const localTimestamp = localItem.lastUpdated || localItem.updatedAt || 0;

                    const isLocalPendingSync = localItem.needsSync || localItem.syncPending;
                    if (remoteTimestamp > localTimestamp && !isLocalPendingSync) {
                        updatesToSave.push(remoteItem);
                        hasChanged = true;
                    }
                }
            }

            if (updatesToSave.length > 0) {
                await saveMultipleToLocal(collectionName, updatesToSave);
            }

            if (hasChanged) {
                const freshLocalData = await getFromLocal(collectionName);
                const setter = (stateMap as any)[collectionName];
                if (setter) {
                    setter(prev => {
                        const nextData = Array.isArray(freshLocalData) ? freshLocalData : [];
                        if (JSON.stringify(prev) === JSON.stringify(nextData)) return prev;
                        return nextData;
                    });
                }
            }
        } catch (error) {
            console.error(`Error handling Firebase update for ${collectionName}:`, error);
        }
    }, [isOnline, initialLoadComplete]); // Dependencies are stable enough

    // Set up Firebase listeners
    const setupFirebaseListeners = useCallback(() => {
        if (!isOnline || !initialLoadComplete || listenersInitialized) return () => { };

        const unsubscribeFunctions: (() => void)[] = [];

        COLLECTIONS.forEach(collectionName => {
            try {
                const q = query(collection(db, collectionName));
                const unsubscribe = onSnapshot(q,
                    (snapshot) => {
                        const remoteData = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        handleFirebaseUpdate(collectionName, remoteData);
                    },
                    (error) => console.warn(`Firebase listener error for ${collectionName}:`, error)
                );
                unsubscribeFunctions.push(unsubscribe);
            } catch (error) {
                console.error(`Error setting up listener for ${collectionName}:`, error);
            }
        });

        setListenersInitialized(true);
        return () => {
            unsubscribeFunctions.forEach(unsub => unsub());
            setListenersInitialized(false);
        };
    }, [isOnline, initialLoadComplete, handleFirebaseUpdate, listenersInitialized]);

    // Load local data once on mount
    useEffect(() => {
        initializeData();
    }, []);

    // Process sync queue when online
    useEffect(() => {
        if (isOnline && initialLoadComplete) {
            processSyncQueue().catch(err => console.error('Sync queue error:', err));
        }
    }, [isOnline, initialLoadComplete]);

    // Manage listeners based on connectivity
    useEffect(() => {
        const cleanup = setupFirebaseListeners();
        return () => {
            if (cleanup) cleanup();
        };
    }, []); // Run once on mount to fix infinite re-render loop

    return (
        <DataContext.Provider value={{
            patients, queue, appointments, staff, salaryPayments, attendance,
            inventory, sales, expenses, bills, treatments, clinicSettings,
            loading, isOnline, updateLocal, refreshCollection
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) throw new Error('useData must be used within a DataProvider');
    return context;
}
