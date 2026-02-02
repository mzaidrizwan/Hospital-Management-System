'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { getFromLocal, saveToLocal, openDB, getAllStores, saveMultipleToLocal, deleteFromLocal } from '@/services/indexedDbUtils';
import { processSyncQueue, smartSync } from '@/services/syncService';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InventoryFormModal } from '@/components/modals/InventoryFormModal';
import { validateLicenseKey } from '@/services/licenseService';
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
    licenseStatus: 'valid' | 'expired' | 'missing' | 'checking';
    licenseDaysLeft: number;
    updateLocal: (collectionName: string, data: any) => Promise<void>;
    deleteLocal: (collectionName: string, id: string) => Promise<void>;
    refreshCollection: (collectionName: string) => Promise<void>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
    setInventory: React.Dispatch<React.SetStateAction<any[]>>;
    setSales: React.Dispatch<React.SetStateAction<any[]>>;
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
    setTreatments: React.Dispatch<React.SetStateAction<Treatment[]>>;
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
    'treatments', // Added treatments to collections
    'clinicSettings',
    'users'
];

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
    const [treatments, setTreatments] = useState<Treatment[]>([]); // Added treatments state
    const [clinicSettings, setClinicSettings] = useState<any>(null);
    const [licenseStatus, setLicenseStatus] = useState<'valid' | 'expired' | 'missing' | 'checking'>('checking');
    const [licenseDaysLeft, setLicenseDaysLeft] = useState(0);

    const [loading, setLoading] = useState(true);
    const [listenersInitialized, setListenersInitialized] = useState(false);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // Refs to track if data has actually changed
    const dataChangedRef = useRef<Record<string, boolean>>({});
    const initialLoadDone = useRef(false);
    const isSyncingRef = useRef(false); // FIX: Add syncing ref to prevent infinite loops
    const stateSettersRef = useRef<any>({}); // FIX: Ref for all state setters
    const listenersRef = useRef<(() => void)[]>([]); // FIX: Ref to hold listener unsubscribe functions

    // Initialize state setters ref once
    useEffect(() => {
        stateSettersRef.current = {
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
        };
    }, []); // Empty dependency - run once

    // Initialize database and load all data from IndexedDB
    const initializeData = async () => {
        if (initialLoadDone.current) return;

        try {
            await openDB();

            // Load ALL collections from IndexedDB in parallel
            const results = await Promise.all(COLLECTIONS.map(async (collectionName) => {
                try {
                    const data = await getFromLocal(collectionName);
                    return { collectionName, data };
                } catch (error) {
                    console.error(`Error loading ${collectionName} from IndexedDB:`, error);
                    return { collectionName, data: null };
                }
            }));

            // Update React state with data from IndexedDB
            results.forEach(({ collectionName, data }) => {
                if (data === null || data === undefined) return;

                const setter = stateSettersRef.current[collectionName];
                if (!setter) return;

                if (collectionName === 'clinicSettings') {
                    if (Array.isArray(data) && data.length > 0) {
                        setter(data[0]); // Take first item for settings
                    } else if (!Array.isArray(data) && data) {
                        setter(data); // Already an object
                    }
                } else {
                    setter(Array.isArray(data) ? data : []);
                }
            });

            // --------------------------------------------------------
            // License Validation Check
            // --------------------------------------------------------
            try {
                const licenseData = await getFromLocal('settings', 'clinic_license');
                const settingsData = await getFromLocal('clinicSettings', 'clinic-settings');
                const clinicId = settingsData?.id || 'clinic-settings';

                if (licenseData && licenseData.key) {
                    const isValid = await validateLicenseKey(licenseData.key, clinicId);

                    if (isValid) {
                        const expiry = new Date(licenseData.expiryDate);
                        const now = new Date();
                        const diffTime = expiry.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        setLicenseDaysLeft(diffDays);
                        setLicenseStatus(diffDays > 0 ? 'valid' : 'expired');
                    } else {
                        setLicenseStatus('expired');
                    }
                } else {
                    setLicenseStatus('missing');
                }
            } catch (e) {
                console.error('Error checking license:', e);
                setLicenseStatus('missing');
            }

            setInitialLoadComplete(true);
            setLoading(false);
            initialLoadDone.current = true;
        } catch (error) {
            console.error('Error initializing data:', error);
            setInitialLoadComplete(true);
            setLoading(false);
            initialLoadDone.current = true;
        }
    };

    // Helper to update state only if changed
    const updateStateIfChanged = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, newData: any) => {
        setter((prev: any) => {
            if (JSON.stringify(prev) === JSON.stringify(newData)) {
                return prev;
            }
            return newData;
        });
    }, []);

    /**
     * Handle Firebase snapshot updates - COMPLETELY ISOLATED
     */
    const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
        // FIX: Prevent infinite loop by checking syncing ref
        if (isSyncingRef.current) return;
        
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
                    // Set syncing flag
                    isSyncingRef.current = true;
                    await saveToLocal(collectionName, remoteSettings);
                    // Update state safely
                    updateStateIfChanged(setClinicSettings, remoteSettings);
                    // Clear syncing flag after delay
                    setTimeout(() => { isSyncingRef.current = false; }, 100);
                }
                return;
            }

            // For array collections (including treatments)
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
                // Set syncing flag
                isSyncingRef.current = true;
                await saveMultipleToLocal(collectionName, updatesToSave);
            }

            // Only update state if data actually changed
            if (hasChanged) {
                const freshLocalData = await getFromLocal(collectionName);
                const setter = stateSettersRef.current[collectionName];
                if (setter) {
                    updateStateIfChanged(setter, Array.isArray(freshLocalData) ? freshLocalData : []);
                    dataChangedRef.current[collectionName] = true;
                }
                // Clear syncing flag
                setTimeout(() => { isSyncingRef.current = false; }, 100);
            } else if (updatesToSave.length > 0) {
                // If we saved but didn't update state, still clear the flag
                setTimeout(() => { isSyncingRef.current = false; }, 100);
            }
        } catch (error) {
            console.error(`Error handling Firebase update for ${collectionName}:`, error);
            // Ensure syncing flag is cleared on error
            isSyncingRef.current = false;
        }
    }, [updateStateIfChanged]); // Only depends on updateStateIfChanged which is stable

    /**
     * Update local data (State + IndexedDB)
     */
    const updateLocal = useCallback(async (collectionName: string, data: any) => {
        // FIX: Check if already syncing to prevent loops
        if (isSyncingRef.current) return;

        // 1. Save to IndexedDB immediately
        isSyncingRef.current = true;
        await saveToLocal(collectionName, data);

        // 2. Update React State for immediate feedback
        const setter = stateSettersRef.current[collectionName];
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

        // 3. Clear syncing flag
        setTimeout(() => { isSyncingRef.current = false; }, 100);

        // 4. Trigger Background Sync (Non-blocking)
        smartSync(collectionName, data).catch(err => {
            console.error(`Background sync failed for ${collectionName}:`, err);
        });
    }, []); // No dependencies - uses ref

    /**
     * Delete local data (State + IndexedDB)
     */
    const deleteLocal = useCallback(async (collectionName: string, id: string) => {
        // FIX: Check if already syncing to prevent loops
        if (isSyncingRef.current) return;

        // 1. Delete from IndexedDB immediately
        isSyncingRef.current = true;
        await deleteFromLocal(collectionName, id);

        // 2. Update React State for immediate feedback
        const setter = stateSettersRef.current[collectionName];
        if (setter) {
            setter((prev: any[]) => prev.filter((item: any) => (item.id || item.role) !== id));
        }

        // 3. Clear syncing flag
        setTimeout(() => { isSyncingRef.current = false; }, 100);
    }, []); // No dependencies - uses ref

    /**
     * Refresh a collection from IndexedDB
     */
    const refreshCollection = useCallback(async (collectionName: string) => {
        // FIX: Check if already syncing to prevent loops
        if (isSyncingRef.current) return;

        isSyncingRef.current = true;
        const data = await getFromLocal(collectionName);
        const setter = stateSettersRef.current[collectionName];
        if (setter) {
            if (collectionName === 'clinicSettings') {
                setter(Array.isArray(data) ? data[0] : data);
            } else {
                setter(Array.isArray(data) ? data : []);
            }
        }
        setTimeout(() => { isSyncingRef.current = false; }, 100);
    }, []); // No dependencies - uses ref

    // FIXED: Create a stable reference to handleFirebaseUpdate for listeners
    const handleFirebaseUpdateRef = useRef(handleFirebaseUpdate);
    handleFirebaseUpdateRef.current = handleFirebaseUpdate;

    // Load local data once on mount
    useEffect(() => {
        initializeData();
    }, []); // Empty dependency array - run once on mount

    // Process sync queue when online
    useEffect(() => {
        if (isOnline && initialLoadComplete) {
            processSyncQueue().catch(err => console.error('Sync queue error:', err));
        }
    }, [isOnline, initialLoadComplete]);

    // FIXED: SINGLE Firebase listener setup - NO DUPLICATES
    useEffect(() => {
        // Only setup listeners if online and initial load complete
        if (!isOnline || !initialLoadComplete || listenersInitialized) {
            return;
        }

        console.log('Setting up Firebase listeners...');
        
        // Clear any existing listeners first
        if (listenersRef.current.length > 0) {
            listenersRef.current.forEach(unsub => unsub && unsub());
            listenersRef.current = [];
        }

        const unsubscribeFunctions: (() => void)[] = [];

        COLLECTIONS.forEach(collectionName => {
            try {
                const q = query(collection(db, collectionName));
                const unsubscribe = onSnapshot(q,
                    (snapshot) => {
                        if (snapshot.empty) return;

                        const remoteData = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        
                        // Use the ref instead of the function directly
                        handleFirebaseUpdateRef.current(collectionName, remoteData);
                    },
                    (error) => console.warn(`Firebase listener error for ${collectionName}:`, error)
                );
                unsubscribeFunctions.push(unsubscribe);
            } catch (error) {
                console.error(`Error setting up listener for ${collectionName}:`, error);
            }
        });

        // Store unsubscribe functions in ref
        listenersRef.current = unsubscribeFunctions;
        setListenersInitialized(true);

        // Cleanup function
        return () => {
            // Only cleanup if we're the ones who set it up
            if (listenersRef.current.length > 0) {
                console.log('Cleaning up Firebase listeners...');
                listenersRef.current.forEach(unsub => unsub && unsub());
                listenersRef.current = [];
            }
            setListenersInitialized(false);
        };
    }, [isOnline, initialLoadComplete]); // FIXED: Removed listenersInitialized from dependencies!

    return (
        <DataContext.Provider value={{
            patients, queue, appointments, staff, salaryPayments, attendance,
            inventory, sales, expenses, bills, treatments, clinicSettings,
            loading, isOnline, updateLocal, deleteLocal, refreshCollection,
            licenseStatus, licenseDaysLeft,
            setPatients, setQueue, setAppointments, setStaff, setInventory,
            setSales, setExpenses, setBills, setTreatments
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