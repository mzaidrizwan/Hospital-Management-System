'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, setDoc, doc } from 'firebase/firestore';
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
    updateLocal: (collectionName: string, data: any) => Promise<any>;
    deleteLocal: (collectionName: string, id: string) => Promise<boolean>;
    addItem: (collectionName: string, item: any) => Promise<any>;
    refreshCollection: (collectionName: string) => Promise<void>;
    exportToCSV: (data: any[], filename: string) => void;
    importFromCSV: (file: File, collectionName: string) => Promise<void>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
    setInventory: React.Dispatch<React.SetStateAction<any[]>>;
    setSales: React.Dispatch<React.SetStateAction<any[]>>;
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
    setTreatments: React.Dispatch<React.SetStateAction<Treatment[]>>;
    // NEW: Optimistic update function for queue
    updateQueueItemOptimistic: (itemId: string, updates: Partial<QueueItem>) => Promise<QueueItem>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

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

export function DataProvider({ children }: { children: ReactNode }) {
    const isOnline = useConnectionStatus();

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
    const [licenseStatus, setLicenseStatus] = useState<'valid' | 'expired' | 'missing' | 'checking'>('checking');
    const [licenseDaysLeft, setLicenseDaysLeft] = useState(0);

    const [loading, setLoading] = useState(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    const dataChangedRef = useRef<Record<string, boolean>>({});
    const initialLoadDone = useRef(false);
    const isSyncingRef = useRef(false);
    const stateSettersRef = useRef<any>({});
    const listenersRef = useRef<(() => void)[]>([]);

    const stateSetterMap = useMemo(() => ({
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
    }), []);

    useEffect(() => {
        stateSettersRef.current = stateSetterMap;
    }, [stateSetterMap]);

    const initializeData = async () => {
        if (initialLoadDone.current) return;

        try {
            await openDB();

            const results = await Promise.all(COLLECTIONS.map(async (collectionName) => {
                try {
                    const data = await getFromLocal(collectionName);
                    return { collectionName, data };
                } catch (error) {
                    console.error(`Error loading ${collectionName} from IndexedDB:`, error);
                    return { collectionName, data: null };
                }
            }));

            results.forEach(({ collectionName, data }) => {
                if (data === null || data === undefined) return;

                const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
                if (!setter) return;

                if (collectionName === 'clinicSettings') {
                    if (Array.isArray(data) && data.length > 0) {
                        setter(data[0]);
                    } else if (!Array.isArray(data) && data) {
                        setter(data);
                    }
                } else {
                    setter(Array.isArray(data) ? data : []);
                }
            });

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

    /**
     * Non-blocking Firebase sync that runs in background
     */
    const backgroundFirebaseSync = useCallback((collectionName: string, data: any) => {
        // Run Firebase sync in background - DO NOT AWAIT
        setTimeout(async () => {
            try {
                if (isOnline) {
                    console.log(`[Background Sync] Syncing ${collectionName} to Firebase:`, data.id);
                    await smartSync(collectionName, data);
                    console.log(`[Background Sync] Successfully synced ${collectionName}:`, data.id);
                }
            } catch (syncError) {
                console.error(`[Background Sync] Failed for ${collectionName}:`, syncError);
                // Don't show alert for background sync failures
            }
        }, 0);
    }, [isOnline]);

    /**
     * Update local data (State + IndexedDB) - FIRE AND FORGET version
     */
    const updateLocal = useCallback(async (collectionName: string, data: any): Promise<any> => {
        try {
            // 1. Add timestamps and sync markers
            const enrichedData = {
                ...data,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                needsSync: true,
                lastUpdated: Date.now()
            };

            console.log(`[updateLocal] Saving to ${collectionName}:`, enrichedData.id);

            // 2. CRITICAL: Update React State immediately for instant UI feedback
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                if (collectionName === 'clinicSettings') {
                    setter(enrichedData);
                } else {
                    setter((prev: any[]) => {
                        const index = prev.findIndex((item: any) => item.id === enrichedData.id);
                        if (index !== -1) {
                            const next = [...prev];
                            next[index] = enrichedData;
                            return next;
                        } else {
                            return [enrichedData, ...prev];
                        }
                    });
                }
                console.log(`[updateLocal] Updated React state for ${collectionName}`);
            }

            // 3. Save to IndexedDB in background (fire and forget)
            // Use setTimeout to not block the main thread
            setTimeout(async () => {
                try {
                    await saveToLocal(collectionName, enrichedData);
                    console.log(`[updateLocal] Saved to IndexedDB:`, enrichedData.id);
                    
                    // 4. Trigger Background Firebase Sync (NON-BLOCKING)
                    backgroundFirebaseSync(collectionName, enrichedData);
                } catch (dbError) {
                    console.error(`[updateLocal] IndexedDB error for ${collectionName}:`, dbError);
                    // Show browser alert for database failures
                    if (typeof window !== 'undefined') {
                        window.alert(`Database Error: Failed to save to ${collectionName}. Please check console.`);
                    }
                }
            }, 0);

            // 5. Return the saved data immediately (don't wait for IndexedDB/Firebase)
            return enrichedData;

        } catch (error) {
            console.error(`[updateLocal] FATAL ERROR in updateLocal for ${collectionName}:`, error);
            
            // Show browser alert for database failures
            if (typeof window !== 'undefined') {
                window.alert(`Database Error: Failed to save to ${collectionName}. Please check console for details.`);
            }
            
            throw error;
        }
    }, [stateSetterMap, backgroundFirebaseSync]);

    /**
     * NEW: Optimistic update for queue items - FIRE AND FORGET version
     */
    const updateQueueItemOptimistic = useCallback(async (itemId: string, updates: Partial<QueueItem>): Promise<QueueItem> => {
        console.log(`[updateQueueItemOptimistic] Starting optimistic update for item: ${itemId}`, updates);
        
        // 1. Find the current item in state
        const currentItem = queue.find(item => item.id === itemId);
        if (!currentItem) {
            throw new Error(`Queue item ${itemId} not found`);
        }

        // 2. Create the updated item with timestamps
        const updatedItem: QueueItem = {
            ...currentItem,
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdated: Date.now(),
            needsSync: true
        };

        // 3. OPTIMISTIC UPDATE: Update React state IMMEDIATELY (SYNCHRONOUS)
        console.log(`[updateQueueItemOptimistic] Updating React state optimistically`);
        setQueue(prevQueue => {
            const index = prevQueue.findIndex(item => item.id === itemId);
            if (index !== -1) {
                const newQueue = [...prevQueue];
                newQueue[index] = updatedItem;
                return newQueue;
            }
            return prevQueue;
        });

        // 4. Save to IndexedDB in background (fire and forget)
        setTimeout(async () => {
            try {
                await saveToLocal('queue', updatedItem);
                console.log(`[updateQueueItemOptimistic] Saved to IndexedDB: ${itemId}`);
                // 5. Trigger Firebase sync in background (NON-BLOCKING)
                backgroundFirebaseSync('queue', updatedItem);
            } catch (error) {
                console.error(`[updateQueueItemOptimistic] Failed to save to IndexedDB:`, error);
            }
        }, 0);

        // 6. Return the updated item immediately (CRITICAL FOR TOAST DISMISSAL)
        console.log(`[updateQueueItemOptimistic] Returning updated item immediately`);
        return updatedItem;
    }, [queue, backgroundFirebaseSync]);

    /**
     * Delete local data (State + IndexedDB) - FIRE AND FORGET version
     */
    const deleteLocal = useCallback(async (collectionName: string, id: string): Promise<boolean> => {
        try {
            // 1. Update React State immediately
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                setter((prev: any[]) => prev.filter((item: any) => (item.id || item.role) !== id));
            }

            // 2. Delete from IndexedDB in background (fire and forget)
            setTimeout(async () => {
                try {
                    await deleteFromLocal(collectionName, id);
                    console.log(`[deleteLocal] Deleted from IndexedDB: ${id}`);
                    
                    // 3. Background sync for deletion
                    backgroundFirebaseSync(collectionName, { id, _deleted: true });
                } catch (error) {
                    console.error(`[deleteLocal] Failed to delete from IndexedDB:`, error);
                }
            }, 0);

            return true;

        } catch (error) {
            console.error(`Error deleting from ${collectionName}:`, error);
            if (typeof window !== 'undefined') {
                window.alert(`Database Error: Failed to delete from ${collectionName}. Please check console.`);
            }
            throw error;
        }
    }, [stateSetterMap, backgroundFirebaseSync]);

    /**
     * Add item - FIRE AND FORGET version (main fix for sticky toast)
     */
    const addItem = useCallback(async (collectionName: string, item: any): Promise<any> => {
        try {
            console.log(`[addItem] Starting for ${collectionName}:`, item.id || 'new-item');
            
            // Ensure item has ID
            const itemWithId = {
                ...item,
                id: item.id || `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            };

            // Call updateLocal (which is now fire and forget)
            const result = await updateLocal(collectionName, itemWithId);
            
            console.log(`[addItem] Completed successfully for ${collectionName}:`, result.id);
            return result;
            
        } catch (error) {
            console.error(`[addItem] CRITICAL ERROR for ${collectionName}:`, error);
            console.error(`[addItem] Error details:`, {
                collectionName,
                item,
                errorMessage: error.message,
                errorStack: error.stack
            });
            
            // Show browser alert for database failures
            if (typeof window !== 'undefined') {
                window.alert(`Database Error: Failed to add item to ${collectionName}. Please check console.`);
            }
            
            throw error;
        }
    }, [updateLocal]);

    const refreshCollection = useCallback(async (collectionName: string) => {
        try {
            const data = await getFromLocal(collectionName);
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                if (collectionName === 'clinicSettings') {
                    setter(Array.isArray(data) ? data[0] : data);
                } else {
                    setter(Array.isArray(data) ? data : []);
                }
            }
        } catch (error) {
            console.error(`Error refreshing ${collectionName}:`, error);
        }
    }, [stateSetterMap]);

    const exportToCSV = useCallback((data: any[], filename: string) => {
        if (!data || data.length === 0) {
            toast.error('No data to export');
            return;
        }

        try {
            const headers = Object.keys(data[0]).join(",");
            const rows = data.map(obj => Object.values(obj).map(v =>
                typeof v === 'string' && v.includes(',') ? `"${v}"` : v
            ).join(","));

            const csvContent = [headers, ...rows].join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Export to CSV failed:", error);
            toast.error("Failed to export CSV");
        }
    }, []);

    const importFromCSV = useCallback(async (file: File, collectionName: string) => {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const text = e.target?.result as string;
                    if (!text) return;

                    const lines = text.split('\n').filter(line => line.trim() !== '');
                    if (lines.length < 2) return;

                    const headers = lines[0].split(',').map(h => h.trim());

                    const promises = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

                        if (values.length === headers.length) {
                            const obj: any = {};
                            headers.forEach((header, index) => {
                                let val: any = values[index];
                                if (!isNaN(Number(val)) && val !== '') {
                                    val = Number(val);
                                }
                                obj[header] = val;
                            });

                            if (!obj.id) {
                                obj.id = `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                            }

                            promises.push(addItem(collectionName, obj));
                        }
                    }

                    await Promise.all(promises);
                    resolve();
                } catch (error) {
                    console.error("Import from CSV failed:", error);
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsText(file);
        });
    }, [addItem]);

    const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
        if (isSyncingRef.current) return;

        try {
            if (remoteData.length === 0) return;

            const localData = (await getFromLocal(collectionName) || []) as any[];

            if (collectionName === 'clinicSettings') {
                const remoteSettings = remoteData[0];
                const localSettings = Array.isArray(localData) ? localData[0] : localData;

                if (JSON.stringify(remoteSettings) === JSON.stringify(localSettings)) return;

                const remoteTimestamp = remoteSettings.lastUpdated || remoteSettings.updatedAt || 0;
                const localTimestamp = localSettings?.lastUpdated || localSettings?.updatedAt || 0;

                if (!localSettings || remoteTimestamp > localTimestamp) {
                    isSyncingRef.current = true;
                    await saveToLocal(collectionName, remoteSettings);
                    setClinicSettings(remoteSettings);
                    setTimeout(() => { isSyncingRef.current = false; }, 100);
                }
                return;
            }

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
                isSyncingRef.current = true;
                await saveMultipleToLocal(collectionName, updatesToSave);
            }

            if (hasChanged) {
                const freshLocalData = await getFromLocal(collectionName);
                const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
                if (setter) {
                    setter(Array.isArray(freshLocalData) ? freshLocalData : []);
                    dataChangedRef.current[collectionName] = true;
                }
                setTimeout(() => { isSyncingRef.current = false; }, 100);
            } else if (updatesToSave.length > 0) {
                setTimeout(() => { isSyncingRef.current = false; }, 100);
            }
        } catch (error) {
            console.error(`Error handling Firebase update for ${collectionName}:`, error);
            isSyncingRef.current = false;
        }
    }, [stateSetterMap]);

    const handleFirebaseUpdateRef = useRef(handleFirebaseUpdate);
    handleFirebaseUpdateRef.current = handleFirebaseUpdate;

    useEffect(() => {
        initializeData();
    }, []);

    useEffect(() => {
        if (isOnline && initialLoadComplete) {
            processSyncQueue().catch(err => console.error('Sync queue error:', err));
        }
    }, [isOnline, initialLoadComplete]);

    useEffect(() => {
        if (!isOnline || !initialLoadComplete) {
            if (listenersRef.current.length > 0) {
                listenersRef.current.forEach(unsub => unsub && unsub());
                listenersRef.current = [];
            }
            return;
        }

        if (listenersRef.current.length > 0) {
            return;
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

                        handleFirebaseUpdateRef.current(collectionName, remoteData);
                    },
                    (error) => console.warn(`Firebase listener error for ${collectionName}:`, error)
                );
                unsubscribeFunctions.push(unsubscribe);
            } catch (error) {
                console.error(`Error setting up listener for ${collectionName}:`, error);
            }
        });

        listenersRef.current = unsubscribeFunctions;

        return () => {
            if (listenersRef.current.length > 0) {
                listenersRef.current.forEach(unsub => unsub && unsub());
                listenersRef.current = [];
            }
        };
    }, [isOnline, initialLoadComplete]);

    return (
        <DataContext.Provider value={{
            patients, queue, appointments, staff, salaryPayments, attendance,
            inventory, sales, expenses, bills, treatments, clinicSettings,
            loading, isOnline,
            licenseStatus, licenseDaysLeft,
            updateLocal, deleteLocal, addItem, refreshCollection,
            exportToCSV, importFromCSV,
            setPatients, setQueue, setAppointments, setStaff, setInventory,
            setSales, setExpenses, setBills, setTreatments,
            // NEW: Expose optimistic update function
            updateQueueItemOptimistic
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