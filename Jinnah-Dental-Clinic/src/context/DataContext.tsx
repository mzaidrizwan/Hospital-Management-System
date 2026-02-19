'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { getFromLocal, saveToLocal, openDB, getAllStores, saveMultipleToLocal, deleteFromLocal, clearStore } from '@/services/indexedDbUtils';
import { processSyncQueue, smartSync, smartDelete } from '@/services/syncService';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InventoryFormModal } from '@/components/modals/InventoryFormModal';
import { validateLicenseKey, validateLicense } from '@/services/licenseService';
import { calculateRemainingDays } from '@/hooks/useLicenseStatus';
import { parseISO } from 'date-fns';
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
import { getSalaryStatus } from '@/hooks/useSalaryLogic';

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
    transactions: any[];
    purchases: any[];
    roles: any[];
    loading: boolean;
    isOnline: boolean;
    licenseStatus: 'valid' | 'expired' | 'missing' | 'checking';
    licenseDaysLeft: number;
    licenseKey: string | null;
    licenseExpiryDate: string | null;
    isShutdown: boolean;
    updateLocal: (collectionName: string, data: any) => Promise<any>;
    deleteLocal: (collectionName: string, id: string) => Promise<boolean>;
    addItem: (collectionName: string, item: any) => Promise<any>;
    refreshCollection: (collectionName: string) => Promise<void>;
    exportToCSV: (data: any[], filename: string) => void;
    exportSalesHistoryToCSV: (salesData: any[]) => void;
    generateStaffReport: () => any[];
    importFromCSV: (file: File, collectionName: string) => Promise<void>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
    setInventory: React.Dispatch<React.SetStateAction<any[]>>;
    setSales: React.Dispatch<React.SetStateAction<any[]>>;
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
    setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
    setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
    setTreatments: React.Dispatch<React.SetStateAction<Treatment[]>>;
    setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
    setSalaryPayments: React.Dispatch<React.SetStateAction<SalaryPayment[]>>;
    setPurchases: React.Dispatch<React.SetStateAction<any[]>>;
    setRoles: React.Dispatch<React.SetStateAction<any[]>>;
    updateAttendance: (record: Attendance) => Promise<Attendance>;
    updatePatientStatus: (patientId: string, status: string, additionalData?: Partial<Patient>) => Promise<Patient>;
    handleMovePatient: (patientId: string, action: 'start' | 'complete' | 'back', currentStatus: string) => Promise<Patient>;
    // NEW: Optimistic update function for queue
    updateQueueItemOptimistic: (itemId: string, updates: Partial<QueueItem>) => Promise<QueueItem>;
    exportToJSON: (collectionName: string) => void;
    importFromJSON: (file: File, collectionName: string) => Promise<void>;
    fetchFullCloudBackup: () => Promise<any>;
    restoreLocalFromCloud: () => Promise<void>;
    fetchDataFromFirebase: () => Promise<any>;
    manualCloudRestore: () => Promise<void>;
    activateLicense: (inputKey: string) => Promise<boolean>;
    clearDataStore: (collectionName: string) => Promise<void>;
    autoSyncEnabled: boolean;
    setAutoSyncEnabled: (enabled: boolean) => void;
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
    'users',
    'transactions',
    'purchases',
    'roles'
];

export function DataProvider({ children }: { children: ReactNode }) {
    const isOnline = useConnectionStatus();

    const [patients, setPatients] = useState<Patient[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);

    // Auto-sync control persisted in localStorage
    const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
        const stored = localStorage.getItem('autoSyncEnabled');
        return stored !== null ? JSON.parse(stored) : true;
    });

    const setAutoSyncEnabled = useCallback((enabled: boolean) => {
        setAutoSyncEnabledState(enabled);
        localStorage.setItem('autoSyncEnabled', JSON.stringify(enabled));
        if (!enabled) {
            toast.warning("Automatic cloud sync disabled.");
        } else {
            toast.success("Automatic cloud sync enabled.");
        }
    }, []);
    const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);
    const [sales, setSales] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [clinicSettings, setClinicSettings] = useState<any>({});
    const [transactions, setTransactions] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [licenseStatus, setLicenseStatus] = useState<'valid' | 'expired' | 'missing' | 'checking'>('checking');
    const [licenseDaysLeft, setLicenseDaysLeft] = useState(0);
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [licenseExpiryDate, setLicenseExpiryDate] = useState<string | null>(null);
    const [isShutdown, setIsShutdown] = useState(() => {
        const stored = localStorage.getItem('force_shutdown');
        const initialValue = stored === 'true';
        // console.log('🔍 DataContext - Initial isShutdown:', initialValue, 'localStorage:', stored);
        return initialValue;
    });

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
        transactions: setTransactions,
        purchases: setPurchases,
        roles: setRoles,
    }), []);

    useEffect(() => {
        stateSettersRef.current = stateSetterMap;
    }, [stateSetterMap]);

    const checkSubscription = useCallback((settings: any) => {
        return calculateRemainingDays(settings?.licenseExpiry);
    }, []);

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
                    const settings = Array.isArray(data) ? data[0] : data;
                    if (settings) {
                        setter(settings);
                        // Legacy shutdown check - disabled in favor of 'power' collection
                        // if (settings.shutdown !== undefined) setIsShutdown(!!settings.shutdown);
                    }
                } else if (collectionName === 'staff') {
                    // Filter out invalid staff members with empty or missing names
                    const validStaff = Array.isArray(data)
                        ? data.filter((s: any) => s && s.name && s.name.trim() !== '')
                        : [];
                    setter(validStaff);
                } else if (collectionName === 'treatments') {
                    // Filter out ghost treatments with NaN fees
                    const validTreatments = Array.isArray(data)
                        ? data.filter((t: any) => t && t.name && !isNaN(Number(t.fee)))
                        : [];
                    setter(validTreatments);
                } else {
                    setter(Array.isArray(data) ? data : []);
                }
            });

            try {
                const settingsData = await getFromLocal('clinicSettings', 'clinic-settings');
                const clinicId = settingsData?.id || 'clinic-settings';

                let licenseData = await getFromLocal('settings', 'clinic_license');

                // Try to fetch latest license from Firebase if online
                if (isOnline) {
                    try {
                        const licenseDoc = await getDoc(doc(db, 'settings', 'license'));
                        if (licenseDoc.exists()) {
                            const firebaseLicense = licenseDoc.data();
                            if (firebaseLicense.expiryDate) {
                                licenseData = { ...licenseData, ...firebaseLicense };
                                // Save back to local for offline use
                                await saveToLocal('settings', { id: 'clinic_license', ...firebaseLicense });
                            }
                        }
                    } catch (fbError) {
                        console.warn('Could not fetch license from Firebase, using local:', fbError);
                    }
                }

                // NO FREE TRIAL - License is required from the start
                if (licenseData && (licenseData.key || licenseData.expiryDate)) {
                    setLicenseKey(licenseData.key || null);
                    setLicenseExpiryDate(licenseData.expiryDate);

                    const days = checkSubscription({ licenseExpiry: licenseData.expiryDate });
                    setLicenseDaysLeft(Math.max(0, days));
                    setLicenseStatus(days > 0 ? 'valid' : 'expired');
                } else {
                    // No license found - App should be disabled
                    console.warn('⚠️ No license key found. Application is locked.');
                    setLicenseKey(null);
                    setLicenseExpiryDate(null);
                    setLicenseDaysLeft(0);
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
                // BUG FIX: Only sync if autoSyncEnabled is TRUE
                if (isOnline && autoSyncEnabled) {
                    if (data._deleted) {
                        console.log(`[Background Sync] Deleting ${collectionName} from Firebase:`, data.id);
                        await smartDelete(collectionName, data.id);
                        console.log(`[Background Sync] Successfully deleted ${collectionName}:`, data.id);
                    } else {
                        console.log(`[Background Sync] Syncing ${collectionName} to Firebase:`, data.id);
                        await smartSync(collectionName, data);
                        console.log(`[Background Sync] Successfully synced ${collectionName}:`, data.id);
                    }
                } else if (!autoSyncEnabled) {
                    console.log(`[Background Sync] Skipping ${collectionName} - Auto-Sync is DISABLED`);
                    // We still want to mark it as needing sync so it goes up when enabled
                    if (data._deleted) {
                        // For deletions, we add a DELETE task to syncQueue manually
                        await saveToLocal('syncQueue', {
                            id: `${collectionName}_${data.id}`,
                            type: 'DELETE',
                            collectionName,
                            docId: data.id,
                            timestamp: Date.now()
                        });
                    } else {
                        // For updates, we mark the item itself and add a PATCH task
                        const enrichedData = {
                            ...data,
                            needsSync: true,
                            lastUpdated: Date.now(),
                            updatedAt: new Date().toISOString()
                        };
                        await saveToLocal(collectionName, enrichedData);
                        await saveToLocal('syncQueue', {
                            id: `${collectionName}_${data.id}`,
                            type: 'PATCH',
                            collectionName,
                            docId: data.id,
                            timestamp: Date.now()
                        });
                    }
                }
            } catch (syncError) {
                console.error(`[Background Sync] Failed for ${collectionName}:`, syncError);
                // Don't show alert for background sync failures
            }
        }, 0);
    }, [isOnline, autoSyncEnabled]);

    /**
     * Update local data (State + IndexedDB) - FIRE AND FORGET version
     */
    const updateLocal = useCallback(async (collectionName: string, data: any): Promise<any> => {
        try {
            // Pre-processing & Validation
            let enrichedData = {
                ...data,
                id: data.id || (collectionName === 'clinicSettings' ? 'clinic-settings' : `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}`),
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastUpdated: Date.now()
            };

            // Staff specific defaults and validation
            if (collectionName === 'staff') {
                if (!data.name || data.name.trim() === '') throw new Error('Staff name is required');
                enrichedData = {
                    ...enrichedData,
                    salaryType: enrichedData.salaryType || enrichedData.salaryDuration || 'monthly',
                    totalEarned: Number(enrichedData.totalEarned) || 0
                };
            }

            // Inventory specific sanitization
            if (collectionName === 'inventory') {
                enrichedData = {
                    ...enrichedData,
                    buyingPrice: Number(enrichedData.buyingPrice) || 0,
                    sellingPrice: Number(enrichedData.sellingPrice) || 0,
                    quantity: Number(enrichedData.quantity) || 0
                };
            }

            // 1. Update App State (Immediate UI feedback)
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                if (collectionName === 'clinicSettings') {
                    setter(enrichedData);
                } else {
                    setter((prev: any[]) => [...(prev || []).filter(i => i.id !== enrichedData.id), enrichedData]);
                }
            }

            // 2. Save to IndexedDB (Local persistence)
            await saveToLocal(collectionName, enrichedData);

            // 3. Push to Firebase in background (Cloud sync)
            backgroundFirebaseSync(collectionName, enrichedData);

            return enrichedData;
        } catch (error) {
            console.error(`[updateLocal] Error in ${collectionName}:`, error);
            throw error;
        }
    }, [stateSetterMap]);

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

        // 3. STEP 1: Update React state IMMEDIATELY (Fast)
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

        // 4. STEP 2: Save to IndexedDB (Wait for local persistence)
        try {
            await saveToLocal('queue', updatedItem);
            console.log(`[updateQueueItemOptimistic] Saved to IndexedDB successfully: ${itemId}`);
            toast.success("Done", { duration: 1000, id: "sync-status" });
        } catch (dbError) {
            console.error(`[updateQueueItemOptimistic] IndexedDB persistence failed:`, dbError);
            if (typeof window !== 'undefined') {
                toast.error(`Local save failed for queue item. Data is in memory but not on disk.`);
            }
        }

        // 5. STEP 3: Trigger Firebase sync in background (Non-blocking)
        backgroundFirebaseSync('queue', updatedItem);

        // 6. Return the updated item immediately after disk write (Fast)
        return updatedItem;
    }, [queue, backgroundFirebaseSync]);

    /**
     * updateAttendance - Specialized function for staff attendance
     * Ensures presentDoctors refresh immediately across Admin & Operator
     */
    const updateAttendance = useCallback(async (record: Attendance): Promise<Attendance> => {
        console.log(`[updateAttendance] Marking status: ${record.status} for ${record.staffId} on ${record.date}`);

        try {
            // 1. STEP 1: Update IndexedDB (Awaited for local persistence)
            await saveToLocal('attendance', record);

            // 2. STEP 2: Update React State (Triggers useAvailableDoctors refresh)
            setAttendance(prev => {
                const index = prev.findIndex(a => a.id === record.id || (a.staffId === record.staffId && a.date === record.date));
                if (index !== -1) {
                    const next = [...prev];
                    next[index] = record;
                    return next;
                }
                return [record, ...prev];
            });

            // 3. STEP 3: Background Sync (Fire and Forget)
            backgroundFirebaseSync('attendance', record);

            return record;
        } catch (error) {
            console.error('[updateAttendance] Failed:', error);
            throw error;
        }
    }, [backgroundFirebaseSync]);

    /**
     * updatePatientStatus - Specialized function for patient status updates
     * Ensures immediate UI refresh and proper timestamp management for finance tracking
     */
    const updatePatientStatus = useCallback(async (
        patientId: string,
        status: string,
        additionalData?: Partial<Patient>
    ): Promise<Patient> => {
        const normalizedStatus = status.toLowerCase().trim().replace(/[\s-]/g, '_');
        console.log(`[updatePatientStatus] Updating patient ${patientId} to status: ${normalizedStatus}`);

        try {
            // 1. Find current patient
            const currentPatient = patients.find(p => p.id === patientId);
            if (!currentPatient) {
                throw new Error(`Patient ${patientId} not found`);
            }

            // 2. Create updated patient object
            const updatedPatient: Patient = {
                ...currentPatient,
                ...additionalData,
                status: normalizedStatus as any,
                updatedAt: new Date().toISOString(), // Always refresh timestamp
                lastUpdated: Date.now()
            };

            // Special handling for 'completed' status - ensure timestamp for finance calculations
            if (status === 'completed') {
                updatedPatient.lastVisit = new Date().toISOString();
                updatedPatient.totalVisits = (currentPatient.totalVisits || 0) + 1;
            }

            // 3. STEP 1: Update React State (Immediate UI feedback)
            setPatients(prev => {
                const index = prev.findIndex(p => p.id === patientId);
                if (index !== -1) {
                    const next = [...prev];
                    next[index] = updatedPatient;
                    return next;
                }
                return prev;
            });

            // 4. STEP 2: Save to IndexedDB (Awaited for local persistence)
            await saveToLocal('patients', updatedPatient);
            console.log(`[updatePatientStatus] Saved to IndexedDB: ${patientId}`);

            // 5. STEP 3: Background Firebase Sync (Fire and Forget)
            backgroundFirebaseSync('patients', updatedPatient);

            return updatedPatient;
        } catch (error) {
            console.error('[updatePatientStatus] Failed:', error);
            throw error;
        }
    }, [patients, backgroundFirebaseSync]);

    /**
     * handleMovePatient - Specialized function for patient workflow transitions
     * Handles Start, Complete, and Back actions with proper status management
     */
    const handleMovePatient = useCallback(async (
        patientId: string,
        action: 'start' | 'complete' | 'back',
        currentStatus: string
    ): Promise<Patient> => {
        const normalizedCurrentStatus = currentStatus.toLowerCase().trim().replace(/[\s-]/g, '_');
        console.log(`[handleMovePatient] Action: ${action}, Current Status: ${normalizedCurrentStatus}, Patient: ${patientId}`);

        try {
            // 1. Find current patient
            const currentPatient = patients.find(p => p.id === patientId);
            if (!currentPatient) {
                throw new Error(`Patient ${patientId} not found`);
            }

            // 2. Determine new status based on action
            let newStatus: string;
            switch (action) {
                case 'start':
                    newStatus = 'in_treatment';
                    break;
                case 'complete':
                    newStatus = 'completed';
                    break;
                case 'back':
                    // Back logic: completed -> in_treatment, in_treatment -> waiting
                    if (normalizedCurrentStatus === 'completed') {
                        newStatus = 'in_treatment';
                    } else if (normalizedCurrentStatus === 'in_treatment') {
                        newStatus = 'waiting';
                    } else {
                        newStatus = normalizedCurrentStatus; // No change if already waiting
                    }
                    break;
                default:
                    throw new Error(`Invalid action: ${action}`);
            }

            console.log(`[handleMovePatient] Transitioning from ${currentStatus} to ${newStatus}`);

            // 3. Create updated patient object
            const updatedPatient: Patient = {
                ...currentPatient,
                status: newStatus as any,
                updatedAt: new Date().toISOString(),
                lastUpdated: Date.now()
            };

            // 4. Special handling for 'completed' status
            if (newStatus === 'completed') {
                updatedPatient.lastVisit = new Date().toISOString();
                updatedPatient.totalVisits = (currentPatient.totalVisits || 0) + 1;
            }

            // 5. STEP 1: Update React State (Immediate UI feedback - triggers re-render)
            setPatients(prev => {
                const index = prev.findIndex(p => p.id === patientId);
                if (index !== -1) {
                    const next = [...prev];
                    next[index] = updatedPatient;
                    console.log(`[handleMovePatient] State updated - card will move to ${newStatus} column`);
                    return next;
                }
                return prev;
            });

            // 6. STEP 2: Save to IndexedDB (Awaited for local persistence)
            await saveToLocal('patients', updatedPatient);
            console.log(`[handleMovePatient] Saved to IndexedDB (ClinicDB): ${patientId}`);
            toast.success("Done", { duration: 1000, id: "sync-status" });

            // 7. STEP 3: Background Firebase Sync (Fire and Forget)
            backgroundFirebaseSync('patients', updatedPatient);

            return updatedPatient;
        } catch (error) {
            console.error('[handleMovePatient] Failed:', error);
            throw error;
        }
    }, [patients, backgroundFirebaseSync]);

    /**
     * Delete local data (State + IndexedDB) - FIRE AND FORGET version
     */
    const deleteLocal = useCallback(async (collectionName: string, id: string): Promise<boolean> => {
        try {
            console.log(`[deleteLocal] Starting for ${collectionName}:`, id);

            // 1. STEP 1: Update React State immediately (Fast)
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                setter((prev: any[]) => prev.filter((item: any) => (item.id || item.role) !== id));
            }

            // 2. STEP 2: Delete from IndexedDB (Wait for local persistence)
            try {
                await deleteFromLocal(collectionName, id);
                console.log(`[deleteLocal] Deleted from IndexedDB: ${id}`);
            } catch (dbError) {
                console.error(`[deleteLocal] IndexedDB delete failed:`, dbError);
                if (typeof window !== 'undefined') {
                    toast.error(`Local deletion failed for ${collectionName}.`);
                }
            }

            // 3. STEP 3: Background sync for deletion (Non-blocking)
            backgroundFirebaseSync(collectionName, { id, _deleted: true });

            return true;

        } catch (error) {
            console.error(`Error deleting from ${collectionName}:`, error);
            throw error;
        }
    }, [stateSetterMap, backgroundFirebaseSync]);

    /**
     * Add item - FIRE AND FORGET version (main fix for sticky toast)
     */
    const addItem = useCallback(async (collectionName: string, item: any): Promise<any> => {
        try {
            // Ensure ID exists early
            const id = item.id || `${collectionName.slice(0, 3).toUpperCase()}-${Date.now()}`;
            const newItem = { ...item, id };

            // STRICT VALIDATION: Block ghost expenses
            if (collectionName === 'expenses') {
                if (!newItem.title || newItem.title.trim() === "" || isNaN(Number(newItem.amount))) {
                    console.warn("Blocked ghost expense creation:", newItem);
                    return;
                }
            }

            // --- THE STRICT PATTERN via updateLocal ---
            const result = await updateLocal(collectionName, newItem);

            // AUTO-EXPENSE LOGIC: Trigger an expense record for inventory purchases
            if (collectionName === 'inventory') {
                const buyingPrice = Number(result.buyingPrice || 0);
                const quantity = Number(result.quantity || 0);
                const totalExpense = buyingPrice * quantity;

                if (totalExpense > 0) {
                    console.log(`[addItem] Auto-triggering records for inventory purchase: ${totalExpense}`);

                    // 1. Create specialized purchase record
                    const purchaseRecord = {
                        id: `pur-${Date.now()}`,
                        itemId: result.id,
                        name: result.name,
                        quantity: quantity,
                        buyingPrice: buyingPrice,
                        totalCost: totalExpense,
                        date: new Date().toISOString()
                    };
                    await updateLocal('purchases', purchaseRecord);

                    // 2. Create the general expense
                    await addItem('expenses', {
                        title: `Stock Purchase: ${result.name}`,
                        amount: totalExpense,
                        category: "inventory",
                        date: new Date().toISOString(),
                        description: `Automatically created from inventory addition: ${result.name}`,
                        inventoryItemId: result.id,
                        units: quantity,
                        unitPrice: buyingPrice,
                        status: 'paid',
                        paymentMethod: 'cash'
                    });
                }
            }

            return result;
        } catch (error) {
            console.error("Error adding item:", error);
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

    const exportSalesHistoryToCSV = useCallback((salesData: any[]) => {
        if (!salesData || salesData.length === 0) {
            toast.error('No sales data to export');
            return;
        }

        const mappedData = salesData.map(sale => ({
            "Date": sale.date ? new Date(sale.date).toLocaleDateString() : 'N/A',
            "Item Name": sale.itemName || 'N/A',
            "Quantity": sale.quantity || 0,
            "Unit Price": sale.price || 0,
            "Total Sale": sale.total || 0,
            "Operator": sale.soldBy || 'N/A'
        }));

        exportToCSV(mappedData, `Sales_History_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    }, [exportToCSV]);

    const generateStaffReport = useCallback(() => {
        return staff.map(member => {
            const memberAttendance = attendance.filter(a => a.staffId === member.id);
            const present = memberAttendance.filter(a => a.status === 'present').length;
            const absent = memberAttendance.filter(a => a.status === 'absent').length;
            const leave = memberAttendance.filter(a => a.status === 'leave').length;

            const memberTransactions = transactions.filter(t => t.staffId === member.id && t.type === 'Salary');
            const totalPaid = memberTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const { status: salaryStatus } = getSalaryStatus(member);

            return {
                "Staff Name": member.name,
                "Role": member.role,
                "Status": member.status,
                "Salary Method": member.salaryType || member.salaryDuration || 'monthly',
                "Base Salary": member.salary || 0,
                "Present Days": present,
                "Absent Days": absent,
                "Leave Days": leave,
                "Total Salary Paid": totalPaid,
                "Payment Status": salaryStatus,
                "Last Paid Date": member.lastPaidDate ? new Date(member.lastPaidDate).toLocaleDateString() : 'Never'
            };
        });
    }, [staff, attendance, transactions]);

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
                                obj.id = `${collectionName.slice(0, 3)}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                            }

                            promises.push(addItem(collectionName, obj));
                        }
                    }

                    await Promise.all(promises);
                    // Point 4: call refreshData() equivalent
                    await initializeData();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsText(file);
        });
    }, [addItem, initializeData]);

    const exportToJSON = useCallback((collectionName: string) => {
        if (collectionName === 'inventory_full') {
            const fullInventory = {
                stock: inventory,
                sales: sales,
                purchases: purchases
            };
            const blob = new Blob([JSON.stringify(fullInventory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Full_Inventory_Backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            return;
        }

        if (collectionName === 'clinic_features_combined') {
            const fullConfig = {
                settings: clinicSettings,
                treatments: treatments,
                roles: roles
            };
            const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Clinic_Features_Backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            return;
        }

        let data = null;
        switch (collectionName) {
            case 'patients': data = patients; break;
            case 'queue': data = queue; break;
            case 'appointments': data = appointments; break;
            case 'staff': data = staff; break;
            case 'salaryPayments': data = salaryPayments; break;
            case 'attendance': data = attendance; break;
            case 'inventory': data = inventory; break;
            case 'sales': data = sales; break;
            case 'expenses': data = expenses; break;
            case 'bills': data = bills; break;
            case 'treatments': data = treatments; break;
            case 'clinicSettings': data = clinicSettings; break;
            case 'transactions': data = transactions; break;
            case 'purchases': data = purchases; break;
            case 'roles': data = roles; break;
            case 'completed_queue':
                data = queue.filter(item => item.status === 'completed');
                break;
            default: return;
        }

        if (data === null || data === undefined || (Array.isArray(data) && data.length === 0 && collectionName !== 'clinicSettings')) {
            // We allow clinicSettings to be an empty object, but for arrays, we skip if truly empty to avoid confusing user with 0-byte files
            // actually, let's just allow it all to be consistent.
        }

        if (data === null || data === undefined) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${collectionName}_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }, [patients, queue, appointments, staff, salaryPayments, attendance, inventory, sales, expenses, bills, treatments, clinicSettings, transactions, purchases, roles]);

    const importFromJSON = useCallback((file: File, collectionName: string) => {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);

                    if (collectionName === 'inventory_full') {
                        if (data.stock) {
                            setInventory(data.stock);
                            for (const item of data.stock) await updateLocal('inventory', item);
                        }
                        if (data.sales) {
                            setSales(data.sales);
                            for (const item of data.sales) await updateLocal('sales', item);
                        }
                        if (data.purchases) {
                            setPurchases(data.purchases);
                            for (const item of data.purchases) await updateLocal('purchases', item);
                        }
                        if (typeof window !== 'undefined') {
                            toast.success("Full Inventory (Stock, Sales, Purchases) Restored");
                        }
                        resolve();
                        return;
                    }

                    if (collectionName === 'clinic_features_combined') {
                        if (data.settings) {
                            setClinicSettings(data.settings);
                            await updateLocal('clinicSettings', data.settings);
                        }
                        if (data.treatments) {
                            setTreatments(data.treatments);
                            for (const item of data.treatments) await updateLocal('treatments', item);
                        }
                        if (data.roles) {
                            setRoles(data.roles);
                            for (const item of data.roles) await updateLocal('roles', item);
                        }
                        if (typeof window !== 'undefined') {
                            toast.success("Clinic Features (Settings, Treatments, Roles) Restored");
                        }
                        resolve();
                        return;
                    }

                    if (collectionName === 'completed_queue') {
                        const items = Array.isArray(data) ? data : [data];
                        for (const item of items) {
                            // Map back to 'queue' collection
                            await updateLocal('queue', item);
                        }
                        if (typeof window !== 'undefined') {
                            toast.success("Completed Patients restored to Bill tab");
                        }
                        resolve();
                        return;
                    }

                    const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
                    if (setter) {
                        setter(data);
                        const items = Array.isArray(data) ? data : [data];
                        for (const item of items) {
                            await updateLocal(collectionName, item);
                        }
                        if (typeof window !== 'undefined') {
                            toast.success(`${collectionName} restored from JSON`);
                        }
                        resolve();
                    } else {
                        reject(new Error(`No setter found for collection: ${collectionName}`));
                    }
                } catch (err) {
                    console.error("Import JSON Error:", err);
                    if (typeof window !== 'undefined') {
                        toast.error("Invalid JSON file");
                    }
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsText(file);
        });
    }, [stateSetterMap, updateLocal, setInventory, setSales, setPurchases]);

    const clearDataStore = useCallback(async (collectionName: string) => {
        try {
            // Set sync lock to prevent listeners from re-fetching while we wipe
            isSyncingRef.current = true;

            // 1. Clear Local IndexedDB
            await clearStore(collectionName);

            // 2. Update React State
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                if (collectionName === 'clinicSettings') setter({});
                else setter([]);
            }

            // Note: We no longer delete from cloud as per user request.
            // Data remains safe in Firebase.

            // Release lock after a short delay
            setTimeout(() => {
                isSyncingRef.current = false;
            }, 500);

        } catch (e) {
            console.error(`Error clearing ${collectionName}:`, e);
            isSyncingRef.current = false;
            throw e;
        }
    }, [stateSetterMap]);

    const fetchFullCloudBackup = useCallback(async () => {
        try {
            const backupData: any = {};

            await Promise.all(COLLECTIONS.map(async (colName) => {
                const snapshot = await getDocs(collection(db, colName));
                backupData[colName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }));

            console.log("Cloud backup fetched", backupData);
            return backupData;
        } catch (error) {
            console.error("Error fetching full cloud backup:", error);
            toast.error("Failed to fetch cloud backup");
            throw error;
        }
    }, []);

    const fetchDataFromFirebase = useCallback(async () => {
        try {
            const data: any = {};

            await Promise.all(COLLECTIONS.map(async (colName) => {
                const snapshot = await getDocs(collection(db, colName));
                data[colName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }));

            return data;
        } catch (error) {
            console.error("Error fetching data from Firebase:", error);
            throw error;
        }
    }, []);

    const manualCloudRestore = useCallback(async () => {
        if (!window.confirm("This will DELETE all local data and replace it with the latest Cloud data. Are you sure?")) return;

        try {
            setLoading(true);
            const dataMap = await fetchDataFromFirebase();

            const collectionsToRestore = Object.keys(dataMap);

            for (const colName of collectionsToRestore) {
                let data = dataMap[colName];

                // Point 3: Password protection for admin/operator
                if (colName === 'users') {
                    const localUsers = await getFromLocal('users');
                    const localUsersMap = new Map<string, any>(localUsers.map((u: any) => [u.id, u]));
                    data = data.map((remoteUser: any) => {
                        const localUser = localUsersMap.get(remoteUser.id);
                        if (localUser && (remoteUser.id === 'admin' || remoteUser.id === 'operator')) {
                            // Only update password if it's different and not null in cloud
                            if (!remoteUser.password && localUser.password) {
                                remoteUser.password = localUser.password;
                            }
                        }
                        return remoteUser;
                    });
                }

                // Clear local store
                await clearStore(colName);

                // Save new data
                if (data && data.length > 0) {
                    await saveMultipleToLocal(colName, data);
                }

                // Update React State
                const setter = stateSetterMap[colName as keyof typeof stateSetterMap];
                if (setter) {
                    setter(data || []);
                }
            }

            toast.success("Cloud Restore Complete!");
            // Point 4: call refreshData() equivalent
            await initializeData();
        } catch (error) {
            console.error("Manual cloud restore failed:", error);
            toast.error("Cloud Restore Failed");
        } finally {
            setLoading(false);
        }
    }, [fetchDataFromFirebase, stateSetterMap, initializeData]);

    const restoreLocalFromCloud = useCallback(async () => {
        if (!window.confirm("WARNING: This will delete all local data and replace it with Cloud data. Continue?")) return;

        try {
            setLoading(true);
            const cloudData = await fetchFullCloudBackup();

            const collectionNames = Object.keys(cloudData);

            for (const colName of collectionNames) {
                let data = cloudData[colName];

                // Point 3: Password protection
                if (colName === 'users') {
                    const localUsers = await getFromLocal('users');
                    const localUsersMap = new Map<string, any>(localUsers.map((u: any) => [u.id, u]));
                    data = data.map((remoteUser: any) => {
                        const localUser = localUsersMap.get(remoteUser.id);
                        if (localUser && (remoteUser.id === 'admin' || remoteUser.id === 'operator')) {
                            if (!remoteUser.password && localUser.password) {
                                remoteUser.password = localUser.password;
                            }
                        }
                        return remoteUser;
                    });
                }

                await clearStore(colName);

                if (data && data.length > 0) {
                    await saveMultipleToLocal(colName, data);
                }

                const setter = stateSetterMap[colName as keyof typeof stateSetterMap];
                if (setter) {
                    setter(data || []);
                }
            }

            toast.success("Local data restored from cloud successfully");
            await initializeData();
        } catch (error) {
            console.error("Error restoring from cloud:", error);
            toast.error("Failed to restore data from cloud");
        } finally {
            setLoading(false);
        }
    }, [fetchFullCloudBackup, stateSetterMap, initializeData]);

    const activateLicense = useCallback(async (inputKey: string) => {
        try {
            const clinicName = clinicSettings?.name || 'Jinnah Dental Clinic';
            const isValid = await validateLicense(inputKey, clinicName);
            if (!isValid) {
                toast.error("Invalid License Key");
                return false;
            }

            const currentExpiryISO = licenseExpiryDate || clinicSettings?.licenseExpiry || new Date().toISOString();
            const currentExpiry = new Date(currentExpiryISO);
            const newExpiry = new Date(currentExpiry.getTime() + (30 * 24 * 60 * 60 * 1000));
            const newExpiryISO = newExpiry.toISOString();

            // 1. Update React State
            setLicenseKey(inputKey);
            setLicenseExpiryDate(newExpiryISO);

            const days = Math.ceil((newExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            setLicenseDaysLeft(Math.max(0, days));
            setLicenseStatus(days > 0 ? 'valid' : 'expired');

            // 2. Update clinicSettings (Local + Firebase via updateLocal)
            const updatedSettings = {
                ...(clinicSettings || {}),
                id: (clinicSettings?.id) || 'clinic-settings',
                licenseExpiry: newExpiryISO,
                licenseKey: inputKey,
                updatedAt: new Date().toISOString()
            };

            await updateLocal('clinicSettings', updatedSettings);

            // 3. Update dedicated license doc if needed
            const licenseDocData = {
                id: 'clinic_license',
                key: inputKey,
                expiryDate: newExpiryISO,
                updatedAt: new Date().toISOString()
            };

            await saveToLocal('settings', licenseDocData);

            if (isOnline) {
                try {
                    await setDoc(doc(db, 'settings', 'license'), {
                        key: inputKey,
                        expiryDate: newExpiryISO,
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                } catch (e) {
                    console.warn("Could not sync dedicated license doc:", e);
                }
            }

            toast.success(`License Extended! New expiry: ${newExpiry.toLocaleDateString()}`);
            return true;
        } catch (error) {
            console.error("License activation failed:", error);
            toast.error("Failed to activate license");
            return false;
        }
    }, [licenseExpiryDate, clinicSettings, updateLocal, isOnline]);

    const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
        // Reduced strict lock to prevent missing sync updates
        if (isSyncingRef.current) {
            // If we are currently saving a batch, we might want to wait instead of returning
            // but for now, low-latency return is okay if we use setTimeout
        }

        try {
            // FIX: Handle empty remote data (collection cleared in cloud)
            const localData = (await getFromLocal(collectionName) || []) as any[];

            if (remoteData.length === 0) {
                if (localData.length > 0) {
                    console.log(`[Sync] Collection ${collectionName} is empty in cloud. Syncing local...`);
                    // Check if local items are pending sync
                    const pendingSync = localData.some(i => i.needsSync);
                    if (!pendingSync) {
                        await clearStore(collectionName);
                        const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
                        if (setter) setter([]);
                    }
                }
                return;
            }

            if (collectionName === 'clinicSettings') {
                const remoteSettings = remoteData[0];
                const localSettings = Array.isArray(localData) ? localData[0] : localData;

                if (JSON.stringify(remoteSettings) === JSON.stringify(localSettings)) return;

                // Always update shutdown state if clinicSettings changed
                setIsShutdown(!!remoteSettings.shutdown);

                const remoteTimestamp = remoteSettings.lastUpdated || remoteSettings.updatedAt || 0;
                const localTimestamp = localSettings?.lastUpdated || localSettings?.updatedAt || 0;

                if (!localSettings || remoteTimestamp > localTimestamp) {
                    isSyncingRef.current = true;
                    await saveToLocal(collectionName, remoteSettings);

                    // Update React State
                    setClinicSettings(remoteSettings);

                    // Recalculate Subscription (Point 4)
                    const days = checkSubscription(remoteSettings);
                    setLicenseDaysLeft(days);
                    setLicenseStatus(days > 0 ? 'valid' : 'expired');

                    if (remoteSettings.licenseKey) setLicenseKey(remoteSettings.licenseKey);
                    if (remoteSettings.licenseExpiry) setLicenseExpiryDate(remoteSettings.licenseExpiry);

                    setTimeout(() => { isSyncingRef.current = false; }, 100);
                }
                return;
            }

            const localMap = new Map(localData.map(item => [item.id, item]));
            let hasChanged = false;
            const updatesToSave: any[] = [];

            // Track remote IDs to detect deletions
            const remoteIds = new Set(remoteData.map(d => d.id));

            for (const remoteItem of remoteData) {
                const localItem = localMap.get(remoteItem.id);

                if (!localItem) {
                    updatesToSave.push(remoteItem);
                    hasChanged = true;
                    continue;
                }

                // Point 3: Specific rule for users password
                if (collectionName === 'users' && (remoteItem.id === 'admin' || remoteItem.id === 'operator')) {
                    if (!remoteItem.password && localItem.password) {
                        remoteItem.password = localItem.password;
                    }
                }

                if (JSON.stringify(remoteItem) !== JSON.stringify(localItem)) {
                    const remoteTimestamp = remoteItem.lastUpdated || remoteItem.updatedAt || 0;
                    const localTimestamp = localItem.lastUpdated || localItem.updatedAt || 0;

                    const isLocalPendingSync = localItem.needsSync || localItem.syncPending;
                    // If remote is newer OR if we don't have a sync pending and it's different
                    if ((remoteTimestamp > localTimestamp || !isLocalPendingSync)) {
                        updatesToSave.push(remoteItem);
                        hasChanged = true;
                    }
                }
            }

            // Handle Deletions: If item in local but not in remote and not pending sync
            for (const localItem of localData) {
                if (!remoteIds.has(localItem.id) && !localItem.needsSync) {
                    console.log(`[Sync] Item ${localItem.id} not found in cloud, deleting locally.`);
                    await deleteFromLocal(collectionName, localItem.id);
                    hasChanged = true;
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
                setTimeout(() => { isSyncingRef.current = false; }, 200);
            } else if (updatesToSave.length > 0) {
                setTimeout(() => { isSyncingRef.current = false; }, 200);
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
        if (isOnline && initialLoadComplete && autoSyncEnabled) {
            console.log("🔄 Auto-Sync Enabled: Processing Sync Queue...");
            processSyncQueue().catch(err => console.error('Sync queue error:', err));
        }
    }, [isOnline, initialLoadComplete, autoSyncEnabled]);

    // Separate useEffect for CRITICAL Shutdown Listener (Always active if online)
    useEffect(() => {
        // console.log("🔍 Power Listener Effect - isOnline:", isOnline);
        if (!isOnline) return;

        // console.log("⚡ Setting up Critical Power Listener...");
        let powerUnsub: (() => void) | undefined;

        try {
            const powerDocRef = doc(db, 'power', '1');
            // console.log("⚡ Power document reference created:", powerDocRef.path);

            powerUnsub = onSnapshot(powerDocRef, (docSnap) => {
                // console.log("⚡ Power snapshot received. Exists:", docSnap.exists());

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // console.log("⚡ Power/Shutdown signal received:", data);
                    // console.log("⚡ Shutdown value:", data.shutDown, "Type:", typeof data.shutDown);

                    if (data.shutDown === true) {
                        // console.log("⚡ SHUTDOWN TRIGGERED - Setting isShutdown to TRUE");
                        setIsShutdown(true);
                        // localStorage.setItem('force_shutdown', 'true');
                        // console.log("⚡ localStorage updated to 'true'");
                    } else if (data.shutDown === false) {
                        // console.log("⚡ SHUTDOWN CLEARED - Setting isShutdown to FALSE");
                        setIsShutdown(false);
                        // localStorage.setItem('force_shutdown', 'false');
                        // console.log("⚡ localStorage updated to 'false'");
                    } else {
                        // console.log("⚡ Shutdown value is neither true nor false:", data.shutDown);
                    }
                } else {
                    // console.log("⚡ Power document 'power/1' does not exist.");
                }
            }, (err) => {
                // console.error("❌ Error listening to power settings:", err);
            });

            // console.log("⚡ Power listener successfully attached");
        } catch (error) {
            console.error("❌ Error setting up power listener:", error);
        }

        return () => {
            if (powerUnsub) {
                console.log("⚡ Cleaning up Power Listener");
                powerUnsub();
            }
        };
    }, [isOnline]);

    useEffect(() => {
        // Stop listeners if offline, not initialized, OR if user disabled auto-sync
        if (!isOnline || !initialLoadComplete || !autoSyncEnabled) {
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

        // 1. Setup standard collection listeners
        COLLECTIONS.forEach(collectionName => {
            try {
                const q = query(collection(db, collectionName));
                const unsubscribe = onSnapshot(q,
                    (snapshot) => {
                        // FIX: Don't return if empty, we need to sync empty collections too
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
    }, [isOnline, initialLoadComplete, autoSyncEnabled]);

    return (
        <DataContext.Provider value={{
            patients, queue, appointments, staff, salaryPayments, attendance,
            inventory, sales, expenses, bills, treatments, clinicSettings,
            transactions, purchases, roles, loading, isOnline,
            licenseStatus, licenseDaysLeft,
            licenseKey, licenseExpiryDate, isShutdown,
            updateLocal, deleteLocal, addItem, refreshCollection,
            exportToCSV, exportSalesHistoryToCSV, generateStaffReport, importFromCSV,
            setPatients, setQueue, setAppointments, setStaff, setInventory,
            setSales, setExpenses, setBills, setTreatments, setAttendance, setSalaryPayments,
            setTransactions, setPurchases, setRoles,
            updateAttendance,
            updatePatientStatus,
            handleMovePatient,
            updateQueueItemOptimistic,
            fetchFullCloudBackup,
            restoreLocalFromCloud,
            fetchDataFromFirebase,
            manualCloudRestore,
            activateLicense,
            exportToJSON,
            importFromJSON,
            clearDataStore,
            autoSyncEnabled,
            setAutoSyncEnabled
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