'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, setDoc, doc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
// import { getFromLocal, saveToLocal, openDB, getAllStores, saveMultipleToLocal, deleteFromLocal, clearStore, STORE_CONFIGS } from '@/services/expireindexedDbUtils_OLDs';
import { dbManager, STORE_CONFIGS, getKeyPath } from '@/lib/indexedDB';
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
    Treatment,
    PatientTransaction
} from '@/types';
import { toast } from 'sonner';
import { getSalaryStatus } from '@/hooks/useSalaryLogic';
import { migrateAttendanceRecords } from '@/scripts/migrateAttendance';

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
    patientTransactions: PatientTransaction[];
    loading: boolean;
    isOnline: boolean;
    licenseStatus: 'valid' | 'expired' | 'missing' | 'checking';
    licenseDaysLeft: number;
    licenseKey: string | null;
    licenseExpiryDate: string | null;
    isShutdown: boolean;
    updateLocal: (collectionName: string, data: any) => Promise<any>;
    deleteLocal: (collectionName: string, id: string, options?: { deleteSalesHistory?: boolean }) => Promise<boolean>;
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
    setPatientTransactions: React.Dispatch<React.SetStateAction<PatientTransaction[]>>;
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

    updateAttendanceWithTime: (attendance: Attendance) => Promise<void>;
    getAttendanceWithTimeRange: (staffId: string, startDate: string, endDate: string) => Promise<Attendance[]>;
    checkDuplicateAttendance: (staffId: string, timestamp: string) => Promise<boolean>;
    deleteStaffWithAllRecords: (staffMember: Staff) => Promise<boolean>;
    deletePatientWithAllRecords: (patient: Patient) => Promise<boolean>;
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
    'roles',
    'patientTransactions' 
];

export function DataProvider({ children }: { children: ReactNode }) {
    const isOnline = useConnectionStatus();
    const [patientTransactions, setPatientTransactions] = useState<PatientTransaction[]>([]);


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
        patientTransactions: setPatientTransactions,
    }), []);

    useEffect(() => {
        stateSettersRef.current = stateSetterMap;
    }, [stateSetterMap]);

    const checkSubscription = useCallback((settings: any) => {
        return calculateRemainingDays(settings?.licenseExpiry);
    }, []);

    // const initializeData = async () => {
    //     if (initialLoadDone.current) return;

    //     try {
    //         const results = await Promise.all(COLLECTIONS.map(async (collectionName) => {
    //             try {
    //                 const data = await dbManager.getFromLocal(collectionName);
    //                 return { collectionName, data };
    //             } catch (error) {
    //                 console.error(`Error loading ${collectionName} from IndexedDB:`, error);
    //                 return { collectionName, data: null };
    //             }
    //         }));

    //         results.forEach(({ collectionName, data }) => {
    //             if (data === null || data === undefined) return;

    //             const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
    //             if (!setter) return;

    //             if (collectionName === 'clinicSettings') {
    //                 const settings = Array.isArray(data) ? data[0] : data;
    //                 if (settings) {
    //                     setter(settings);
    //                     // Legacy shutdown check - disabled in favor of 'power' collection
    //                     // if (settings.shutdown !== undefined) setIsShutdown(!!settings.shutdown);
    //                 }
    //             } else if (collectionName === 'staff') {
    //                 // Filter out invalid staff members with empty or missing names
    //                 const validStaff = Array.isArray(data)
    //                     ? data.filter((s: any) => s && s.name && s.name.trim() !== '')
    //                     : [];
    //                 setter(validStaff);
    //             } else if (collectionName === 'treatments') {
    //                 // Filter out ghost treatments with NaN fees
    //                 const validTreatments = Array.isArray(data)
    //                     ? data.filter((t: any) => t && t.name && !isNaN(Number(t.fee)))
    //                     : [];
    //                 setter(validTreatments);
    //             } else {
    //                 setter(Array.isArray(data) ? data : []);
    //             }
    //         });

    //         try {
    //             const settingsData = await dbManager.getFromLocal('clinicSettings', 'clinic-settings');
    //             const clinicId = settingsData?.id || 'clinic-settings';

    //             let licenseData = await dbManager.getFromLocal('settings', 'clinic_license');

    //             // Try to fetch latest license from Firebase if online
    //             if (isOnline) {
    //                 try {
    //                     const licenseDoc = await getDoc(doc(db, 'settings', 'license'));
    //                     if (licenseDoc.exists()) {
    //                         const firebaseLicense = licenseDoc.data();
    //                         if (firebaseLicense.expiryDate) {
    //                             licenseData = { ...licenseData, ...firebaseLicense };
    //                             // Save back to local for offline use
    //                             await dbManager.saveToLocal('settings', { id: 'clinic_license', ...firebaseLicense });
    //                         }
    //                     }
    //                 } catch (fbError) {
    //                     console.warn('Could not fetch license from Firebase, using local:', fbError);
    //                 }
    //             }

    //             // NO FREE TRIAL - License is required from the start
    //             if (licenseData && (licenseData.key || licenseData.expiryDate)) {
    //                 setLicenseKey(licenseData.key || null);
    //                 setLicenseExpiryDate(licenseData.expiryDate);

    //                 const days = checkSubscription({ licenseExpiry: licenseData.expiryDate });
    //                 setLicenseDaysLeft(Math.max(0, days));
    //                 setLicenseStatus(days > 0 ? 'valid' : 'expired');
    //             } else {
    //                 // No license found - App should be disabled
    //                 console.warn('⚠️ No license key found. Application is locked.');
    //                 setLicenseKey(null);
    //                 setLicenseExpiryDate(null);
    //                 setLicenseDaysLeft(0);
    //                 setLicenseStatus('missing');
    //             }
    //         } catch (e) {
    //             console.error('Error checking license:', e);
    //             setLicenseStatus('missing');
    //         }

    //         setTimeout(() => {
    //             migrateAttendanceRecords().catch(console.error);
    //         }, 1000);

    //         setInitialLoadComplete(true);
    //         setLoading(false);
    //         initialLoadDone.current = true;

    //     } catch (error) {
    //         console.error('Error initializing data:', error);
    //         setInitialLoadComplete(true);
    //         setLoading(false);
    //         initialLoadDone.current = true;
    //     }
    // };

    const initializeData = async () => {
        if (initialLoadDone.current) return;

        try {
            // Get deleted patients from localStorage
            const deletedPatients = JSON.parse(localStorage.getItem('deleted_patients') || '[]');
            console.log(`[initializeData] Deleted patients list:`, deletedPatients);

            const results = await Promise.all(COLLECTIONS.map(async (collectionName) => {
                try {
                    let data = await dbManager.getFromLocal(collectionName);

                    // ✅ FILTER OUT DELETED PATIENTS on initial load
                    if (collectionName === 'patients' && Array.isArray(data) && deletedPatients.length > 0) {
                        const originalCount = data.length;
                        data = data.filter((p: any) => !deletedPatients.includes(p.id));
                        if (originalCount !== data.length) {
                            console.log(`[initializeData] Filtered out ${originalCount - data.length} deleted patients from ${collectionName}`);
                        }
                    }

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
                const settingsData = await dbManager.getFromLocal('clinicSettings', 'clinic-settings');
                const clinicId = settingsData?.id || 'clinic-settings';

                let licenseData = await dbManager.getFromLocal('settings', 'clinic_license');

                // Try to fetch latest license from Firebase if online
                if (isOnline) {
                    try {
                        const licenseDoc = await getDoc(doc(db, 'settings', 'license'));
                        if (licenseDoc.exists()) {
                            const firebaseLicense = licenseDoc.data();
                            if (firebaseLicense.expiryDate) {
                                licenseData = { ...licenseData, ...firebaseLicense };
                                // Save back to local for offline use
                                await dbManager.saveToLocal('settings', { id: 'clinic_license', ...firebaseLicense });
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

            setTimeout(() => {
                migrateAttendanceRecords().catch(console.error);
            }, 1000);

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
                        console.log(`[Background Sync] Deleting ${collectionName} from Cloud:`, data.id);
                        await smartDelete(collectionName, data.id);
                        console.log(`[Background Sync] Successfully deleted ${collectionName}:`, data.id);
                    } else {
                        console.log(`[Background Sync] Syncing ${collectionName} to Cloud:`, data.id);
                        await smartSync(collectionName, data);
                        console.log(`[Background Sync] Successfully synced ${collectionName}:`, data.id);
                    }
                } else if (!autoSyncEnabled) {
                    console.log(`[Background Sync] Skipping ${collectionName} - Auto-Sync is DISABLED`);
                    // We still want to mark it as needing sync so it goes up when enabled
                    if (data._deleted) {
                        // For deletions, we add a DELETE task to syncQueue manually
                        await dbManager.saveToLocal('syncQueue', {
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
                        await dbManager.saveToLocal(collectionName, enrichedData);
                        await dbManager.saveToLocal('syncQueue', {
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
                lastUpdated: Date.now(),
                needsSync: true // CRITICAL: Mark as dirty immediately to prevent cloud overwrite
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
                const oldItem = (inventory || []).find(i => i.id === enrichedData.id);
                // Preserve stockLayers explicitly if not correctly merged
                let updatedLayers = Array.isArray(enrichedData.stockLayers) 
                    ? [...enrichedData.stockLayers] 
                    : (oldItem && Array.isArray(oldItem.stockLayers) ? [...oldItem.stockLayers] : []);
                
                if (oldItem) {
                    const oldSellPrice = Number(oldItem.sellingPrice) || 0;
                    const newSellPrice = Number(enrichedData.sellingPrice) || 0;
                    const oldBuyPrice = Number(oldItem.buyingPrice) || 0;
                    const newBuyPrice = Number(enrichedData.buyingPrice) || 0;

                    // If price changed manually, push the newly specified price down to all active stock layers
                    // so that future sales correctly use this new price.
                    if (!enrichedData._skipPriceCascade && (oldSellPrice !== newSellPrice || oldBuyPrice !== newBuyPrice) && updatedLayers.length > 0) {
                        console.log(`[updateLocal] Inventory price adjusted globally. Updating active stock layers. (Sell: ${oldSellPrice}->${newSellPrice})`);
                        updatedLayers = updatedLayers.map(layer => {
                            if (layer.quantity > 0) {
                                return {
                                    ...layer,
                                    sellingPrice: oldSellPrice !== newSellPrice ? newSellPrice : layer.sellingPrice,
                                    buyingPrice: oldBuyPrice !== newBuyPrice ? newBuyPrice : layer.buyingPrice
                                };
                            }
                            return layer;
                        });
                    }
                }
                
                // Clean up the flag
                if ('_skipPriceCascade' in enrichedData) {
                    delete enrichedData._skipPriceCascade;
                }

                enrichedData = {
                    ...enrichedData,
                    buyingPrice: Number(enrichedData.buyingPrice) || 0,
                    sellingPrice: Number(enrichedData.sellingPrice) || 0,
                    quantity: Number(enrichedData.quantity) || 0,
                    stockLayers: updatedLayers
                };
            }

            // SPECIAL CASCADE FOR EXPENSE UPDATES
            if (collectionName === 'expenses' && enrichedData.id) {
                const oldExpense = (expenses || []).find(e => e.id === enrichedData.id);
                if (oldExpense) {
                    if (enrichedData.category === 'salary') {
                        const oldAmount = Number(oldExpense.amount) || 0;
                        const newAmount = Number(enrichedData.amount) || 0;
                        const diff = newAmount - oldAmount;

                        if (diff !== 0) {
                            console.log(`[updateLocal] Salary amount changed by ${diff}. Cascading...`);
                            const staffId = enrichedData.staffId || (oldExpense as any).staffId;
                            if (staffId) {
                                const staffItem = (staff || []).find(s => s.id === staffId);
                                if (staffItem) {
                                    const updatedStaff = {
                                        ...staffItem,
                                        totalPaid: Math.max(0, (staffItem.totalPaid || 0) + diff),
                                        totalEarned: Math.max(0, (staffItem.totalEarned || 0) + diff),
                                        pendingSalary: Math.max(0, (staffItem.pendingSalary || 0) - diff),
                                        updatedAt: new Date().toISOString()
                                    };
                                    await dbManager.saveToLocal('staff', updatedStaff);
                                    setStaff(prev => prev.map(s => s.id === updatedStaff.id ? updatedStaff : s));
                                    backgroundFirebaseSync('staff', updatedStaff);
                                }
                            }
                            // Update related transaction
                            const relatedTxn = (transactions || []).find(t => t.expenseId === enrichedData.id);
                            if (relatedTxn) {
                                const updatedTxn = { ...relatedTxn, amount: newAmount, updatedAt: new Date().toISOString() };
                                await dbManager.saveToLocal('transactions', updatedTxn);
                                setTransactions(prev => prev.map(t => t.id === updatedTxn.id ? updatedTxn : t));
                                backgroundFirebaseSync('transactions', updatedTxn);
                            }
                            // Update related salary payment
                            const relatedPay = (salaryPayments || []).find(p => (p as any).expenseId === enrichedData.id);
                            if (relatedPay) {
                                const updatedPay = { ...relatedPay, amount: newAmount, updatedAt: new Date().toISOString() };
                                await dbManager.saveToLocal('salaryPayments', updatedPay);
                                setSalaryPayments(prev => prev.map(p => p.id === updatedPay.id ? updatedPay : p));
                                backgroundFirebaseSync('salaryPayments', updatedPay);
                            }
                        }
                    } else if (enrichedData.category === 'inventory') {
                        const oldUnits = Number((oldExpense as any).units) || 0;
                        const newUnits = Number(enrichedData.units) || 0;
                        const unitDiff = newUnits - oldUnits;

                        if (unitDiff !== 0) {
                            console.log(`[updateLocal] Inventory units changed by ${unitDiff}. Cascading...`);
                            const invItemId = enrichedData.inventoryItemId || (oldExpense as any).inventoryItemId;
                            if (invItemId) {
                                const invItem = (inventory || []).find(i => i.id === invItemId);
                                if (invItem) {
                                    const updatedInv = {
                                        ...invItem,
                                        quantity: Math.max(0, (invItem.quantity || 0) + unitDiff),
                                        updatedAt: new Date().toISOString()
                                    };
                                    await dbManager.saveToLocal('inventory', updatedInv);
                                    setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                                    backgroundFirebaseSync('inventory', updatedInv);
                                }
                            }
                            
                            // Update related purchase record using purchaseId link
                            const purchaseId = enrichedData.purchaseId || (oldExpense as any).purchaseId;
                            const relatedPurchase = (purchases || []).find(p => 
                                (purchaseId && p.id === purchaseId) || 
                                p.id === enrichedData.id || 
                                ((p as any).itemId === invItemId && Number(p.totalCost) === Number(oldExpense.amount))
                            );

                            if (relatedPurchase) {
                                const updatedPurchase = { 
                                    ...relatedPurchase, 
                                    quantity: newUnits, 
                                    totalCost: Number(enrichedData.amount),
                                    buyingPrice: Number(enrichedData.amount) / (newUnits || 1),
                                    updatedAt: new Date().toISOString() 
                                };
                                await dbManager.saveToLocal('purchases', updatedPurchase);
                                setPurchases(prev => prev.map(p => p.id === updatedPurchase.id ? updatedPurchase : p));
                                backgroundFirebaseSync('purchases', updatedPurchase);
                            }
                        }
                    }
                }
            }

            // NEW: SPECIAL CASCADE FOR PURCHASE UPDATES
            if (collectionName === 'purchases' && enrichedData.id) {
                const oldPurchase = (purchases || []).find(p => p.id === enrichedData.id);
                if (oldPurchase) {
                    const oldUnits = Number(oldPurchase.quantity) || 0;
                    const newUnits = Number(enrichedData.quantity) || 0;
                    const unitDiff = newUnits - oldUnits;
                    
                    const oldBuyPrice = Number(oldPurchase.buyingPrice) || 0;
                    const newBuyPrice = Number(enrichedData.buyingPrice) || 0;
                    const priceChanged = oldBuyPrice !== newBuyPrice;

                    const invItemId = enrichedData.itemId || oldPurchase.itemId;

                    if (unitDiff !== 0 || priceChanged) {
                        console.log(`[updateLocal] Purchase adjusted. Diff: ${unitDiff}, PriceChanged: ${priceChanged}. Cascading...`);
                        
                        if (invItemId) {
                            const invItem = (inventory || []).find(i => i.id === invItemId);
                            if (invItem) {
                                let updatedInv = { ...invItem };
                                
                                // Update Layers (FIFO)
                                let updatedLayers = Array.isArray(invItem.stockLayers) ? [...invItem.stockLayers] : [];
                                const layerIndex = updatedLayers.findIndex((l: any) => l.purchaseId === enrichedData.id);
                                
                                if (layerIndex !== -1) {
                                    updatedLayers[layerIndex] = {
                                        ...updatedLayers[layerIndex],
                                        quantity: Math.max(0, (Number(updatedLayers[layerIndex].quantity) || 0) + unitDiff),
                                        buyingPrice: newBuyPrice
                                    };
                                } else {
                                     // Fallback for older items without explicit layers
                                     updatedInv.buyingPrice = newBuyPrice;
                                }

                                const activeLayer = updatedLayers.find((l: any) => l.quantity > 0) || updatedLayers[updatedLayers.length - 1];

                                updatedInv.stockLayers = updatedLayers;
                                updatedInv.quantity = Math.max(0, (Number(invItem.quantity) || 0) + unitDiff);
                                updatedInv.buyingPrice = activeLayer?.buyingPrice || newBuyPrice;
                                updatedInv.sellingPrice = activeLayer?.sellingPrice || invItem.sellingPrice;
                                
                                if (priceChanged) {
                                    
                                    // Cascade price change to Sales History (Profit calculation)
                                    const relatedSales = (sales || []).filter(s => s.itemId === invItemId);
                                    if (relatedSales.length > 0) {
                                        console.log(`[updateLocal] Updating ${relatedSales.length} sales records with new buying price...`);
                                        for (const sale of relatedSales) {
                                            const updatedSale = {
                                                ...sale,
                                                buyingPrice: newBuyPrice,
                                                updatedAt: new Date().toISOString()
                                            };
                                            await dbManager.saveToLocal('sales', updatedSale);
                                            backgroundFirebaseSync('sales', updatedSale);
                                        }
                                        // Update state once
                                        setSales(prev => prev.map(s => s.itemId === invItemId ? { ...s, buyingPrice: newBuyPrice } : s));
                                    }
                                }

                                updatedInv.updatedAt = new Date().toISOString();
                                await dbManager.saveToLocal('inventory', updatedInv);
                                setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                                backgroundFirebaseSync('inventory', updatedInv);
                            }
                        }

                        // Update related Expense
                        const relatedExpense = (expenses || []).find(e => 
                            e.id === enrichedData.id || 
                            (e.inventoryItemId === invItemId && Number(e.amount) === Number(oldPurchase.totalCost))
                        );
                        if (relatedExpense) {
                            const updatedExpense = {
                                ...relatedExpense,
                                amount: Number(enrichedData.totalCost),
                                units: newUnits,
                                unitPrice: newBuyPrice,
                                updatedAt: new Date().toISOString()
                            };
                            await dbManager.saveToLocal('expenses', updatedExpense);
                            setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
                            backgroundFirebaseSync('expenses', updatedExpense);

                            // Update related transaction
                            const relatedTxn = (transactions || []).find(t => t.expenseId === relatedExpense.id);
                            if (relatedTxn) {
                                const updatedTxn = { 
                                    ...relatedTxn, 
                                    amount: Number(enrichedData.totalCost), 
                                    updatedAt: new Date().toISOString() 
                                };
                                await dbManager.saveToLocal('transactions', updatedTxn);
                                setTransactions(prev => prev.map(t => t.id === updatedTxn.id ? updatedTxn : t));
                                backgroundFirebaseSync('transactions', updatedTxn);
                            }
                        }
                    }
                }
            }

            // NEW: SPECIAL CASCADE FOR SALE UPDATES
            if (collectionName === 'sales' && enrichedData.id) {
                const oldSale = (sales || []).find(s => s.id === enrichedData.id);
                if (oldSale) {
                    const oldUnits = Number(oldSale.quantity) || 0;
                    const newUnits = Number(enrichedData.quantity) || 0;
                    const unitDiff = newUnits - oldUnits;

                    if (unitDiff !== 0) {
                        console.log(`[updateLocal] Sale adjusted. UnitDiff: ${unitDiff}. Correcting inventory stock...`);
                        
                        const invItemId = enrichedData.itemId || oldSale.itemId;
                        if (invItemId) {
                            const invItem = (inventory || []).find(i => i.id === invItemId);
                            if (invItem) {
                                // If unitDiff is positive (sold more), subtract from stock. 
                                // If negative (sold less), add back to stock.
                                const updatedInv = {
                                    ...invItem,
                                    quantity: Math.max(0, (invItem.quantity || 0) - unitDiff),
                                    updatedAt: new Date().toISOString()
                                };
                                await dbManager.saveToLocal('inventory', updatedInv);
                                setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                                backgroundFirebaseSync('inventory', updatedInv);
                            }
                        }
                    }
                }
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
            await dbManager.saveToLocal(collectionName, enrichedData);

            // 3. Push to Firebase in background (Cloud sync)
            backgroundFirebaseSync(collectionName, enrichedData);

            return enrichedData;
        } catch (error) {
            console.error(`[updateLocal] Error in ${collectionName}:`, error);
            throw error;
        }
    }, [stateSetterMap, backgroundFirebaseSync, expenses, staff, transactions, salaryPayments, inventory, purchases]);

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
            await dbManager.saveToLocal('queue', updatedItem);
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
            await dbManager.saveToLocal('attendance', record);

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
            await dbManager.saveToLocal('patients', updatedPatient);
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
            await dbManager.saveToLocal('patients', updatedPatient);
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
    const deleteLocal = useCallback(async (collectionName: string, id: string, options?: { deleteSalesHistory?: boolean }): Promise<boolean> => {
        try {
            console.log(`[deleteLocal] Starting for ${collectionName}:`, id);

            // SPECIAL CASCADE FOR EXPENSES (Salary & Inventory)
            if (collectionName === 'expenses') {
                const expenseToDelete = (expenses || []).find(e => e.id === id);
                if (expenseToDelete && expenseToDelete.category === 'salary') {
                    console.log(`[deleteLocal] Cascading for Salary Expense:`, id);
                    
                    // 1. Revert Staff totals
                    const relatedTxn = (transactions || []).find(t => 
                        t.expenseId === id || 
                        (t.type === 'Salary' && t.staffId === (expenseToDelete as any).staffId && Number(t.amount) === Number(expenseToDelete.amount))
                    );
                    
                    if (relatedTxn && relatedTxn.staffId) {
                        const amount = Number(expenseToDelete.amount) || 0;
                        const staffItem = (staff || []).find(s => s.id === relatedTxn.staffId);
                        
                        if (staffItem) {
                            const updatedStaff = {
                                ...staffItem,
                                totalPaid: Math.max(0, (staffItem.totalPaid || 0) - amount),
                                totalEarned: Math.max(0, (staffItem.totalEarned || 0) - amount),
                                pendingSalary: (staffItem.pendingSalary || 0) + amount,
                                updatedAt: new Date().toISOString()
                            };
                            // We use background sync and local update but skip the recursive deleteLocal call for safety
                            await dbManager.saveToLocal('staff', updatedStaff);
                            setStaff(prev => prev.map(s => s.id === updatedStaff.id ? updatedStaff : s));
                            backgroundFirebaseSync('staff', updatedStaff);
                            console.log(`[deleteLocal] Reverted staff totals for ${staffItem.name}`);
                        }
                        
                        // 2. Delete related transaction (Non-recursive manually)
                        await dbManager.deleteFromLocal('transactions', relatedTxn.id);
                        setTransactions(prev => prev.filter(t => t.id !== relatedTxn.id));
                        backgroundFirebaseSync('transactions', { id: relatedTxn.id, _deleted: true });
                    }
                    
                    // 3. Delete related salary payment
                    const relatedPay = (salaryPayments || []).find(p => 
                        (p as any).expenseId === id || 
                        (p.staffId === (relatedTxn?.staffId || (expenseToDelete as any).staffId) && Number(p.amount) === Number(expenseToDelete.amount))
                    );
                    
                    if (relatedPay) {
                        await dbManager.deleteFromLocal('salaryPayments', relatedPay.id);
                        setSalaryPayments(prev => prev.filter(p => p.id !== relatedPay.id));
                        backgroundFirebaseSync('salaryPayments', { id: relatedPay.id, _deleted: true });
                    }
                } else if (expenseToDelete && expenseToDelete.category === 'inventory') {
                    console.log(`[deleteLocal] Cascading for Inventory Expense:`, id);
                    
                    const invItemId = (expenseToDelete as any).inventoryItemId;
                    const purchaseId = (expenseToDelete as any).purchaseId;

                    // 1. Revert Inventory quantity
                    if (invItemId) {
                        const invItem = (inventory || []).find(i => i.id === invItemId);
                        if (invItem) {
                            const units = Number((expenseToDelete as any).units) || 0;
                            const newQuantity = Math.max(0, (invItem.quantity || 0) - units);
                            
                            // Check if this was the ONLY purchase for this item. 
                            // If so, delete the item entirely ("as if it was never there")
                            
                            // IDENTIFY THE RELATED PURCHASE FIRST TO AVOID FALSE "OTHER" MATCHES
                            const relatedPurchase = (purchases || []).find(p => 
                                (purchaseId && p.id === purchaseId) || 
                                p.id === id || 
                                ((p as any).itemId === invItemId && Number(p.totalCost) === Number(expenseToDelete.amount))
                            );

                            const otherPurchases = (purchases || []).filter(p => 
                                p.itemId === invItemId && 
                                (!relatedPurchase || p.id !== relatedPurchase.id)
                            );

                            const forceDelete = options?.deleteSalesHistory === true;

                            if (forceDelete || (otherPurchases.length === 0 && newQuantity === 0)) {
                                console.log(`[deleteLocal] Deleting entire inventory item and sales history as requested or this was its only purchase.`);
                                
                                // A. Delete the item
                                await dbManager.deleteFromLocal('inventory', invItemId);
                                setInventory(prev => prev.filter(i => i.id !== invItemId));
                                backgroundFirebaseSync('inventory', { id: invItemId, _deleted: true });

                                // B. Delete ALL sales history for this item
                                if (options?.deleteSalesHistory !== false) {
                                    const itemSales = (sales || []).filter(s => s.itemId === invItemId);
                                    if (itemSales.length > 0) {
                                        console.log(`[deleteLocal] Wiping ${itemSales.length} sales records for item ${invItemId}`);
                                        for (const sale of itemSales) {
                                            await dbManager.deleteFromLocal('sales', sale.id);
                                            backgroundFirebaseSync('sales', { id: sale.id, _deleted: true });
                                        }
                                        setSales(prev => prev.filter(s => s.itemId !== invItemId));
                                    }
                                } else {
                                    console.log(`[deleteLocal] Skipped wiping sales history based on user preference.`);
                                }
                            } else {
                                // Just update quantity
                                const updatedInv = {
                                    ...invItem,
                                    quantity: newQuantity,
                                    updatedAt: new Date().toISOString()
                                };
                                await dbManager.saveToLocal('inventory', updatedInv);
                                setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                                backgroundFirebaseSync('inventory', updatedInv);
                            }
                        }
                    }
                    
                    // 2. Delete related purchase record
                    const relatedPurchase = (purchases || []).find(p => 
                        (purchaseId && p.id === purchaseId) || 
                        p.id === id || 
                        ((p as any).itemId === invItemId && Number(p.totalCost) === Number(expenseToDelete.amount))
                    );

                    if (relatedPurchase) {
                        await dbManager.deleteFromLocal('purchases', relatedPurchase.id);
                        setPurchases(prev => prev.filter(p => p.id !== relatedPurchase.id));
                        backgroundFirebaseSync('purchases', { id: relatedPurchase.id, _deleted: true });
                    }
                }
            }

            // NEW: SPECIAL CASCADE FOR PURCHASE DELETIONS
            if (collectionName === 'purchases') {
                const purchaseToDelete = (purchases || []).find(p => p.id === id);
                if (purchaseToDelete) {
                    console.log(`[deleteLocal] Cascading for Purchase Record:`, id);
                    const invItemId = purchaseToDelete.itemId;
                    const units = Number(purchaseToDelete.quantity) || 0;

                    // 1. Revert Inventory quantity or fully delete item
                    if (invItemId) {
                        const invItem = (inventory || []).find(i => i.id === invItemId);
                        if (invItem) {
                            const newQuantity = Math.max(0, (invItem.quantity || 0) - units);
                            
                            // Check if this was the ONLY purchase for this item. 
                            // If so, delete the item and its sales entirely ("as if it was never there")
                            const otherPurchases = (purchases || []).filter(p => p.itemId === invItemId && p.id !== id);
                            
                            const forceDelete = options?.deleteSalesHistory === true;

                            if (forceDelete || otherPurchases.length === 0) {
                                console.log(`[deleteLocal] Deleting entire inventory item and sales history as requested or this was its only purchase.`);
                                
                                // A. Delete the item
                                await dbManager.deleteFromLocal('inventory', invItemId);
                                setInventory(prev => prev.filter(i => i.id !== invItemId));
                                backgroundFirebaseSync('inventory', { id: invItemId, _deleted: true });

                                // B. Delete ALL sales history for this item
                                if (options?.deleteSalesHistory !== false) {
                                    const itemSales = (sales || []).filter(s => s.itemId === invItemId);
                                    if (itemSales.length > 0) {
                                        console.log(`[deleteLocal] Wiping ${itemSales.length} sales records for item ${invItemId}`);
                                        for (const sale of itemSales) {
                                            await dbManager.deleteFromLocal('sales', sale.id);
                                            backgroundFirebaseSync('sales', { id: sale.id, _deleted: true });
                                        }
                                        setSales(prev => prev.filter(s => s.itemId !== invItemId));
                                    }
                                } else {
                                    console.log(`[deleteLocal] Skipped wiping sales history based on user preference.`);
                                }
                            } else {
                                // Just update quantity
                                const updatedInv = {
                                    ...invItem,
                                    quantity: newQuantity,
                                    updatedAt: new Date().toISOString()
                                };
                                await dbManager.saveToLocal('inventory', updatedInv);
                                setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                                backgroundFirebaseSync('inventory', updatedInv);
                            }
                        }
                    }

                    // 2. Delete related Expense
                    const relatedExpense = (expenses || []).find(e => 
                        e.id === id || 
                        (e.purchaseId === id) ||
                        (e.inventoryItemId === invItemId && Number(e.amount) === Number(purchaseToDelete.totalCost))
                    );
                    if (relatedExpense) {
                        await dbManager.deleteFromLocal('expenses', relatedExpense.id);
                        setExpenses(prev => prev.filter(e => e.id !== relatedExpense.id));
                        backgroundFirebaseSync('expenses', { id: relatedExpense.id, _deleted: true });
                        
                        // Also delete related transaction if exists
                        const relatedTxn = (transactions || []).find(t => t.expenseId === relatedExpense.id);
                        if (relatedTxn) {
                            await dbManager.deleteFromLocal('transactions', relatedTxn.id);
                            setTransactions(prev => prev.filter(t => t.id !== relatedTxn.id));
                            backgroundFirebaseSync('transactions', { id: relatedTxn.id, _deleted: true });
                        }
                    }
                }
            }

            // NEW: SPECIAL CASCADE FOR SALE DELETIONS
            if (collectionName === 'sales') {
                const saleToDelete = (sales || []).find(s => s.id === id);
                if (saleToDelete) {
                    console.log(`[deleteLocal] Cascading for Voided Sale:`, id);
                    const invItemId = saleToDelete.itemId;
                    const units = Number(saleToDelete.quantity) || 0;

                    // 1. Revert Inventory quantity (add back to stock)
                    if (invItemId) {
                        const invItem = (inventory || []).find(i => i.id === invItemId);
                        if (invItem) {
                            const updatedInv = {
                                ...invItem,
                                quantity: (invItem.quantity || 0) + units,
                                updatedAt: new Date().toISOString()
                            };
                            await dbManager.saveToLocal('inventory', updatedInv);
                            setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                            backgroundFirebaseSync('inventory', updatedInv);
                        }
                    }
                }
            }

            // ✅ STEP 0: Track deletion globally to prevent "undead" records via sync
            const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_ids') || '[]');
            if (!recentlyDeleted.includes(id)) {
                recentlyDeleted.push(id);
                // Keep the list manageable (last 500 deletions)
                if (recentlyDeleted.length > 500) recentlyDeleted.shift();
                localStorage.setItem('recently_deleted_ids', JSON.stringify(recentlyDeleted));
            }

            // 1. STEP 1: Update React State immediately (Fast)
            const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
            if (setter) {
                setter((prev: any[]) => prev.filter((item: any) => (item.id || item.role) !== id));
            }

            // 2. STEP 2: Delete from IndexedDB (Wait for local persistence)
            try {
                await dbManager.deleteFromLocal(collectionName, id);
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
    }, [stateSetterMap, backgroundFirebaseSync, expenses, transactions, staff, salaryPayments, inventory, purchases, sales]);

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

            // NEW: Check if item already exists to prevent duplicate auto-expenses on edits
            const isNewItem = collectionName === 'inventory' 
                ? !(inventory || []).some(i => i.id === newItem.id)
                : true;

            // --- THE STRICT PATTERN via updateLocal ---
            const result = await updateLocal(collectionName, newItem);

            // NEW: AUTO-TRIGGER FOR INVENTORY RESTOCKING VIA EXPENSES
            if (collectionName === 'expenses' && newItem.category === 'inventory' && newItem.inventoryItemId) {
                console.log(`[addItem] Auto-triggering inventory update for re-stock expense of: ${newItem.title}`);
                const invItemId = newItem.inventoryItemId;
                const unitsToAdd = Number(newItem.units) || 0;
                const buyPrice = Number(newItem.unitPrice) || 0;
                const sellPrice = Number(newItem.sellingPrice || newItem.unitPrice * 1.2); // Fallback margin

                const invItem = (inventory || []).find(i => i.id === invItemId);
                if (invItem && unitsToAdd > 0) {
                    // 1. Ensure Purchase Record link exists
                    let purchaseId = newItem.purchaseId;
                    if (!purchaseId) {
                        const purchaseRecord = {
                            id: `pur-${Date.now()}`,
                            itemId: invItem.id,
                            name: invItem.name,
                            quantity: unitsToAdd,
                            buyingPrice: buyPrice,
                            totalCost: unitsToAdd * buyPrice,
                            date: newItem.date || new Date().toISOString()
                        };
                        await updateLocal('purchases', purchaseRecord);
                        purchaseId = purchaseRecord.id;
                        result.purchaseId = purchaseId;
                        await dbManager.saveToLocal('expenses', result);
                    }
                    // Create New Stock Layer (Batch)
                    const newLayer = {
                        id: `layer-${Date.now()}`,
                        purchaseId: purchaseId, // LINK!
                        quantity: unitsToAdd,
                        buyingPrice: buyPrice,
                        sellingPrice: sellPrice,
                        date: newItem.date || new Date().toISOString()
                    };

                    const currentLayers = Array.isArray(invItem.stockLayers) ? invItem.stockLayers : [];
                    
                    // If old system had quantity but no layers, create a legacy layer
                    if (currentLayers.length === 0 && (Number(invItem.quantity) || 0) > 0) {
                        currentLayers.push({
                            id: 'legacy-layer',
                            quantity: Number(invItem.quantity) || 0,
                            buyingPrice: Number(invItem.buyingPrice) || 0,
                            sellingPrice: Number(invItem.sellingPrice || invItem.price) || 0,
                            date: invItem.createdAt || new Date().toISOString()
                        });
                    }

                    const updatedLayers = [...currentLayers, newLayer];
                    
                    // The main Display Prices for the Inventory object should always reflect 
                    // the layer currently being sold (the oldest one with quantity > 0)
                    const activeLayer = updatedLayers.find(l => l.quantity > 0) || newLayer;

                    // Update Inventory
                    const updatedInv = {
                        ...invItem,
                        quantity: (Number(invItem.quantity) || 0) + unitsToAdd,
                        stockLayers: updatedLayers,
                        // Active Display Prices (for Stock Table & Initial Sale value)
                        buyingPrice: activeLayer.buyingPrice,
                        sellingPrice: activeLayer.sellingPrice,
                        updatedAt: new Date().toISOString()
                    };
                    
                    await dbManager.saveToLocal('inventory', updatedInv);
                    setInventory(prev => prev.map(i => i.id === updatedInv.id ? updatedInv : i));
                    backgroundFirebaseSync('inventory', updatedInv);
                }
            }

            // AUTO-CREATE EXPENSE + PURCHASE when a brand-new inventory item is added with quantity > 0
            if (collectionName === 'inventory' && isNewItem) {
                const qty = Number(newItem.quantity) || 0;
                const buyPrice = Number(newItem.buyingPrice) || 0;

                if (qty > 0) {
                    console.log(`[addItem] New inventory item added with qty=${qty}. Auto-creating expense + purchase records.`);

                    const purchaseId = `pur-${Date.now()}`;
                    const expenseId = `exp-${Date.now() + 1}`;
                    const now = result.createdAt || new Date().toISOString();

                    // 1. Create purchase record
                    const purchaseRecord = {
                        id: purchaseId,
                        itemId: result.id,
                        name: result.name,
                        quantity: qty,
                        buyingPrice: buyPrice,
                        totalCost: qty * buyPrice,
                        date: now
                    };
                    await updateLocal('purchases', purchaseRecord);

                    // 2. Create expense record
                    const expenseRecord = {
                        id: expenseId,
                        title: `Stock Purchase: ${result.name}`,
                        amount: qty * buyPrice,
                        category: 'inventory',
                        date: now,
                        description: `Initial stock entry for: ${result.name}`,
                        inventoryItemId: result.id,
                        purchaseId: purchaseId,
                        units: qty,
                        unitPrice: buyPrice,
                        sellingPrice: Number(result.sellingPrice) || 0,
                        status: 'paid'
                    };
                    await updateLocal('expenses', expenseRecord);

                    // 3. Attach the initial stock layer to the inventory item
                    const initialLayer = {
                        id: `layer-${Date.now()}`,
                        purchaseId: purchaseId,
                        quantity: qty,
                        buyingPrice: buyPrice,
                        sellingPrice: Number(result.sellingPrice) || 0,
                        date: now
                    };
                    const updatedInvWithLayer = {
                        ...result,
                        stockLayers: [initialLayer],
                        _skipPriceCascade: true
                    };
                    await dbManager.saveToLocal('inventory', updatedInvWithLayer);
                    setInventory(prev => prev.map(i => i.id === updatedInvWithLayer.id ? updatedInvWithLayer : i));
                    backgroundFirebaseSync('inventory', updatedInvWithLayer);

                    console.log(`[addItem] Created purchase ${purchaseId} and expense ${expenseId} for new item ${result.name}.`);
                }
            }

            return result;
        } catch (error) {
            console.error("Error adding item:", error);
            throw error;
        }
    }, [updateLocal, inventory, backgroundFirebaseSync]);

    const refreshCollection = useCallback(async (collectionName: string) => {
        try {
            const data = await dbManager.getFromLocal(collectionName);
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
        try {
            console.log(`[exportToJSON] Requested export for: ${collectionName}`);

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

            if (collectionName === 'complete_db_backup') {
                toast.loading("Preparing full system backup...", { id: 'backup-status' });

                // Use a small timeout to let the toast show up
                setTimeout(() => {
                    try {
                        const fullBackup: any = {
                            meta: {
                                type: 'complete_backup',
                                version: '1.0',
                                timestamp: new Date().toISOString(),
                                exportedBy: 'settings_backup'
                            },
                            data: {}
                        };

                        fullBackup.data = {
                            patients,
                            queue,
                            appointments,
                            staff,
                            salaryPayments,
                            attendance,
                            inventory,
                            sales,
                            expenses,
                            bills,
                            treatments,
                            // Filter out empty/invalid clinicSettings objects (those missing an id)
                            clinicSettings: (Array.isArray(clinicSettings) ? clinicSettings : [clinicSettings]).filter(
                                (s: any) => s && s.id
                            ),
                            transactions,
                            purchases,
                            roles,
                            users: [] // Users skipped for security
                        };

                        const jsonString = JSON.stringify(fullBackup, null, 2);
                        const blob = new Blob([jsonString], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `COMPLETE_CLINIC_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
                        link.click();

                        toast.success("Full system backup downloaded!", { id: 'backup-status' });
                    } catch (err) {
                        console.error("Error creating full backup:", err);
                        toast.error("Failed to create backup file", { id: 'backup-status' });
                    }
                }, 100);
                return;
            }

            let data = null;
            switch (collectionName) {
                case 'patients': data = patients; break;
                case 'queue': data = queue; break;
                case 'appointments': data = appointments; break;
                case 'staff_combined':
                    data = {
                        staff,
                        roles,
                        attendance,
                        salaryPayments,
                        transactions: transactions.filter(t => t.type === 'Salary')
                    };
                    break;
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
                case 'completed_queue': {
                    const completedItems = queue.filter(item => item.status === 'completed');
                    const completedItemIds = new Set(completedItems.map(i => i.id));
                    const patientIds = new Set(completedItems.map(i => i.patientId));

                    const associatedBills = bills.filter(b => b.queueItemId && completedItemIds.has(b.queueItemId));
                    const linkedPatients = patients.filter(p => patientIds.has(p.id));

                    data = {
                        queue: completedItems,
                        bills: associatedBills,
                        patients: linkedPatients
                    };
                    break;
                }
                default:
                    console.warn(`Unknown collection name for export: ${collectionName}`);
                    return;
            }

            if (data === null || data === undefined) return;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${collectionName}_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
        } catch (error) {
            console.error("Export failure:", error);
            toast.error("Export failed");
        }
    }, [patients, queue, appointments, staff, salaryPayments, attendance, inventory, sales, expenses, bills, treatments, clinicSettings, transactions, purchases, roles, toast]);

    const importFromJSON = useCallback((file: File, collectionName: string) => {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target?.result as string);

                    if (collectionName === 'complete_db_backup') {
                        // Validate format
                        if (!data.meta || data.meta.type !== 'complete_backup' || !data.data) {
                            if (typeof window !== 'undefined') toast.error("Invalid Complete Backup File");
                            reject(new Error("Invalid backup format"));
                            return;
                        }

                        if (!window.confirm("WARNING: COMPLETE RESTORE\n\nThis will DELETE ALL current local data and replace it with the backup content.\n\nAre you sure you want to proceed?")) {
                            resolve(); // User cancelled
                            return;
                        }

                        // Disable auto-sync during restore
                        const previousAutoSync = autoSyncEnabled;
                        if (previousAutoSync) setAutoSyncEnabled(false);

                        try {
                            // Clear everything first
                            for (const col of COLLECTIONS) {
                                if (col === 'users') continue;
                                await dbManager.clearStore(col);
                            }

                            // Restore each collection
                            const backupData = data.data;
                            const storesToRestore = Object.keys(backupData);

                            let restoreCount = 0;
                            const errors: string[] = [];

                            for (const store of storesToRestore) {
                                try {
                                    const isKnownCollection = COLLECTIONS.includes(store);
                                    let keyPath = getKeyPath(store);        // ← Updated
                                    const hasConfig = !!STORE_CONFIGS[store];

                                    if (isKnownCollection || hasConfig) {
                                        const items = backupData[store];

                                        if (Array.isArray(items) && items.length > 0) {
                                            const validItems = items.filter(item =>
                                                item && item[keyPath] !== undefined && Object.keys(item).length > 0
                                            );

                                            if (validItems.length > 0) {
                                                const syncableItems = validItems.map(item => ({
                                                    ...item,
                                                    needsSync: true,
                                                    lastUpdated: item.lastUpdated || Date.now()
                                                }));

                                                await dbManager.putMultiple(store, syncableItems);   // ← Better name

                                                if (previousAutoSync) {
                                                    for (const item of syncableItems) {
                                                        const docId = item[keyPath];
                                                        await dbManager.putItem('syncQueue', {
                                                            id: `${store}_${docId}`,
                                                            type: 'PATCH',
                                                            collectionName: store,
                                                            docId,
                                                            timestamp: Date.now()
                                                        });
                                                    }
                                                }
                                                restoreCount += validItems.length;
                                            }
                                        }
                                        else if (store === 'clinicSettings' && items && !Array.isArray(items)) {
                                            if (items[keyPath]) {
                                                const syncableItem = {
                                                    ...items,
                                                    needsSync: true,
                                                    lastUpdated: items.lastUpdated || Date.now()
                                                };
                                                await dbManager.putItem(store, syncableItem);

                                                if (previousAutoSync) {
                                                    await dbManager.putItem('syncQueue', {
                                                        id: `${store}_${items[keyPath]}`,
                                                        type: 'PATCH',
                                                        collectionName: store,
                                                        docId: items[keyPath],
                                                        timestamp: Date.now()
                                                    });
                                                }
                                                restoreCount++;
                                            }
                                        }
                                    }
                                } catch (innerErr: any) {
                                    console.error(`Failed to restore store: ${store}`, innerErr);
                                    errors.push(`${store}: ${innerErr.message || 'Unknown error'}`);
                                }
                            }

                            if (typeof window !== 'undefined') {
                                if (errors.length > 0) {
                                    // Show the first error message to help debug
                                    toast.warning(`Restore completed with ${errors.length} errors. (${restoreCount} items restored). First error: ${errors[0]}`);
                                    console.error("Restore Errors:", errors);
                                } else {
                                    toast.success(`Complete Restore Successful! (${restoreCount} items)`);
                                }
                            }

                            // Reload data
                            await initializeData();

                            if (previousAutoSync) {
                                setAutoSyncEnabled(true);
                                // Immediately push all restored items to Firebase via the sync queue
                                toast.loading("Syncing restored data to cloud...", { id: 'restore-sync' });
                                try {
                                    await processSyncQueue();
                                    toast.success("Cloud updated with restored data!", { id: 'restore-sync' });
                                } catch (syncErr) {
                                    console.warn("[Restore] Cloud sync after restore failed:", syncErr);
                                    toast.warning("Restored locally. Cloud sync will happen on next connection.", { id: 'restore-sync' });
                                }
                            } else {
                                toast.info("Data restored locally. Enable Auto-Sync to push to cloud.");
                            }

                            // Force reload to ensure all states catch up perfectly
                            setTimeout(() => window.location.reload(), 3000);

                            resolve();
                        } catch (err) {
                            console.error("Complete restore failed fatally:", err);
                            toast.error("Restore failed fatally. Data may be inconsistent.");
                            reject(err);
                        }
                        return;
                    }

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

                    if (collectionName === 'staff_combined') {
                        if (data && typeof data === 'object' && !Array.isArray(data)) {
                            if (Array.isArray(data.staff)) {
                                for (const s of data.staff) await updateLocal('staff', s);
                            }
                            if (Array.isArray(data.roles)) {
                                for (const r of data.roles) await updateLocal('roles', r);
                            }
                            if (Array.isArray(data.attendance)) {
                                for (const a of data.attendance) await updateLocal('attendance', a);
                            }
                            if (Array.isArray(data.salaryPayments)) {
                                for (const sp of data.salaryPayments) await updateLocal('salaryPayments', sp);
                            }
                            if (Array.isArray(data.transactions)) {
                                for (const t of data.transactions) await updateLocal('transactions', t);
                            }
                        } else if (Array.isArray(data)) {
                            // Backwards compatibility
                            for (const s of data) await updateLocal('staff', s);
                        }
                        if (typeof window !== 'undefined') {
                            toast.success("Staff details, attendance, and salary history restored");
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
                        // Handle new object format { queue: [], bills: [], patients: [] }
                        if (data && typeof data === 'object' && !Array.isArray(data)) {
                            if (Array.isArray(data.queue)) {
                                for (const item of data.queue) await updateLocal('queue', item);
                            }
                            if (Array.isArray(data.bills)) {
                                for (const bill of data.bills) await updateLocal('bills', bill);
                            }
                            if (Array.isArray(data.patients)) {
                                for (const patient of data.patients) await updateLocal('patients', patient);
                            }
                        } else if (Array.isArray(data)) {
                            // Backward compatibility for old simple array format
                            for (const item of data) await updateLocal('queue', item);
                        }

                        if (typeof window !== 'undefined') {
                            toast.success("Completed Patients, Bills and Patient records restored");
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
    }, [stateSetterMap, updateLocal, setInventory, setSales, setPurchases, setClinicSettings, setTreatments, setRoles]);

    const clearDataStore = useCallback(async (collectionName: string) => {
        try {
            // Set sync lock to prevent listeners from re-fetching while we wipe
            isSyncingRef.current = true;

            // 1. Clear Local IndexedDB
            await dbManager.clearStore(collectionName);

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
                    const localUsers = await dbManager.getFromLocal('users');
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
                await dbManager.clearStore(colName);

                // Save new data
                if (data && data.length > 0) {
                    await dbManager.saveMultipleToLocal(colName, data);
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
                    const localUsers = await dbManager.getFromLocal('users');
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

                await dbManager.clearStore(colName);

                if (data && data.length > 0) {
                    await dbManager.saveMultipleToLocal(colName, data);
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

            await dbManager.saveToLocal('settings', licenseDocData);

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

    // const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
    //     // Reduced strict lock to prevent missing sync updates
    //     if (isSyncingRef.current) {
    //         // If we are currently saving a batch, we might want to wait instead of returning
    //         // but for now, low-latency return is okay if we use setTimeout
    //     }

    //     try {
    //         // FIX: Handle empty remote data (collection cleared in cloud)
    //         // const localData = (await dbManager.getFromLocal(collectionName) || []) as any[];
    //         const localData = (await dbManager.getFromLocal(collectionName) || []) as any[];
    //         // Track deleted patients from localStorage
    //         const deletedPatients = JSON.parse(localStorage.getItem('deleted_patients') || '[]');

    //         // ✅ FILTER OUT DELETED PATIENTS from remote data
    //         let filteredRemoteData = remoteData;
    //         if (collectionName === 'patients' && deletedPatients.length > 0) {
    //             filteredRemoteData = remoteData.filter(p => !deletedPatients.includes(p.id));
    //             console.log(`[handleFirebaseUpdate] Filtered out ${remoteData.length - filteredRemoteData.length} deleted patients`);
    //         }

    //         if (remoteData.length === 0) {
    //             if (localData.length > 0) {
    //                 // Cloud is empty but we have local data — push everything up.
    //                 // This listener only fires when online, so no stale isOnline check needed.
    //                 console.log(`[Sync] Cloud empty for ${collectionName}. Pushing ${localData.length} local items to cloud...`);
    //                 let pushed = 0;
    //                 for (const item of localData) {
    //                     try {
    //                         const keyPath = STORE_CONFIGS[collectionName]?.keyPath || 'id';
    //                         const docId = item[keyPath];
    //                         if (!docId) continue;
    //                         const sanitized: any = { ...item, needsSync: false, lastUpdated: item.lastUpdated || Date.now() };
    //                         // Remove undefined values (Firestore rejects them)
    //                         Object.keys(sanitized).forEach(k => sanitized[k] === undefined && delete sanitized[k]);
    //                         await setDoc(doc(db, collectionName, String(docId)), sanitized);
    //                         await dbManager.saveToLocal(collectionName, sanitized);
    //                         pushed++;
    //                     } catch (pushErr) {
    //                         console.error(`[Sync] Failed to push ${collectionName} item to cloud:`, pushErr);
    //                     }
    //                 }
    //                 console.log(`[Sync] ✅ Pushed ${pushed}/${localData.length} items of ${collectionName} to cloud.`);
    //             }
    //             return;
    //         }

    //         if (collectionName === 'clinicSettings') {
    //             const remoteSettings = remoteData[0];
    //             const localSettings = Array.isArray(localData) ? localData[0] : localData;

    //             if (JSON.stringify(remoteSettings) === JSON.stringify(localSettings)) return;

    //             // Always update shutdown state if clinicSettings changed
    //             setIsShutdown(!!remoteSettings.shutdown);

    //             const remoteTimestamp = remoteSettings.lastUpdated || remoteSettings.updatedAt || 0;
    //             const localTimestamp = localSettings?.lastUpdated || localSettings?.updatedAt || 0;

    //             if (!localSettings || remoteTimestamp > localTimestamp) {
    //                 isSyncingRef.current = true;
    //                 await dbManager.saveToLocal(collectionName, remoteSettings);

    //                 // Update React State
    //                 setClinicSettings(remoteSettings);

    //                 // Recalculate Subscription (Point 4)
    //                 const days = checkSubscription(remoteSettings);
    //                 setLicenseDaysLeft(days);
    //                 setLicenseStatus(days > 0 ? 'valid' : 'expired');

    //                 if (remoteSettings.licenseKey) setLicenseKey(remoteSettings.licenseKey);
    //                 if (remoteSettings.licenseExpiry) setLicenseExpiryDate(remoteSettings.licenseExpiry);

    //                 setTimeout(() => { isSyncingRef.current = false; }, 100);
    //             }
    //             return;
    //         }

    //         const localMap = new Map(localData.map(item => [item.id, item]));
    //         let hasChanged = false;
    //         const updatesToSave: any[] = [];

    //         // Track remote IDs to detect deletions
    //         const remoteIds = new Set(remoteData.map(d => d.id));

    //         for (const remoteItem of remoteData) {
    //             const localItem = localMap.get(remoteItem.id);

    //             if (!localItem) {
    //                 updatesToSave.push(remoteItem);
    //                 hasChanged = true;
    //                 continue;
    //             }

    //             // Point 3: Specific rule for users password
    //             if (collectionName === 'users' && (remoteItem.id === 'admin' || remoteItem.id === 'operator')) {
    //                 if (!remoteItem.password && localItem.password) {
    //                     remoteItem.password = localItem.password;
    //                 }
    //             }

    //             if (JSON.stringify(remoteItem) !== JSON.stringify(localItem)) {
    //                 const remoteTimestamp = remoteItem.lastUpdated || remoteItem.updatedAt || 0;
    //                 const localTimestamp = localItem.lastUpdated || localItem.updatedAt || 0;

    //                 const isLocalPendingSync = localItem.needsSync || localItem.syncPending;
    //                 // If remote is newer OR if we don't have a sync pending and it's different
    //                 if ((remoteTimestamp > localTimestamp || !isLocalPendingSync)) {
    //                     updatesToSave.push(remoteItem);
    //                     hasChanged = true;
    //                 }
    //             }
    //         }

    //         // Handle Deletions: If item in local but not in remote and not pending sync
    //         for (const localItem of localData) {
    //             if (!remoteIds.has(localItem.id) && !localItem.needsSync) {
    //                 console.log(`[Sync] Item ${localItem.id} not found in cloud, deleting locally.`);
    //                 await dbManager.deleteFromLocal(collectionName, localItem.id);
    //                 hasChanged = true;
    //             }
    //         }

    //         if (updatesToSave.length > 0) {
    //             isSyncingRef.current = true;
    //             await dbManager.saveMultipleToLocal(collectionName, updatesToSave);
    //         }

    //         if (hasChanged) {
    //             const freshLocalData = await dbManager.getFromLocal(collectionName);
    //             const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
    //             if (setter) {
    //                 setter(Array.isArray(freshLocalData) ? freshLocalData : []);
    //                 dataChangedRef.current[collectionName] = true;
    //             }
    //             setTimeout(() => { isSyncingRef.current = false; }, 200);
    //         } else if (updatesToSave.length > 0) {
    //             setTimeout(() => { isSyncingRef.current = false; }, 200);
    //         }
    //     } catch (error) {
    //         console.error(`Error handling Firebase update for ${collectionName}:`, error);
    //         isSyncingRef.current = false;
    //     }
    // }, [stateSetterMap]);

    const handleFirebaseUpdate = useCallback(async (collectionName: string, remoteData: any[]) => {
        // Reduced strict lock to prevent missing sync updates
        if (isSyncingRef.current) {
            // If we are currently saving a batch, we might want to wait instead of returning
            // but for now, low-latency return is okay if we use setTimeout
        }

        try {
            // Get deleted patients from localStorage
            const deletedPatients = JSON.parse(localStorage.getItem('deleted_patients') || '[]');

            // ✅ NEW: GLOBAL DELETION FILTER
            const recentlyDeleted = JSON.parse(localStorage.getItem('recently_deleted_ids') || '[]');
            
            let filteredRemoteData = remoteData;
            
            // Filter by BOTH specific patient list and generic list
            filteredRemoteData = remoteData.filter(d => 
                !recentlyDeleted.includes(d.id) && 
                !(collectionName === 'patients' && deletedPatients.includes(d.id))
            );

            if (remoteData.length !== filteredRemoteData.length) {
                console.log(`[handleFirebaseUpdate] Filtered out ${remoteData.length - filteredRemoteData.length} records from ${collectionName} (recently deleted).`);
            }

            // FIX: Handle empty remote data (collection cleared in cloud)
            const localData = (await dbManager.getFromLocal(collectionName) || []) as any[];

            if (filteredRemoteData.length === 0) {
                if (localData.length > 0) {
                    // Cloud is empty but we have local data — push everything up.
                    console.log(`[Sync] Cloud empty for ${collectionName}. Pushing ${localData.length} local items to cloud...`);
                    let pushed = 0;
                    for (const item of localData) {
                        try {
                            const keyPath = STORE_CONFIGS[collectionName]?.keyPath || 'id';
                            const docId = item[keyPath];
                            if (!docId) continue;
                            const sanitized: any = { ...item, needsSync: false, lastUpdated: item.lastUpdated || Date.now() };
                            // Remove undefined values (Firestore rejects them)
                            Object.keys(sanitized).forEach(k => sanitized[k] === undefined && delete sanitized[k]);
                            await setDoc(doc(db, collectionName, String(docId)), sanitized);
                            await dbManager.saveToLocal(collectionName, sanitized);
                            pushed++;
                        } catch (pushErr) {
                            console.error(`[Sync] Failed to push ${collectionName} item to cloud:`, pushErr);
                        }
                    }
                    console.log(`[Sync] ✅ Pushed ${pushed}/${localData.length} items of ${collectionName} to cloud.`);
                }
                return;
            }

            if (collectionName === 'clinicSettings') {
                const remoteSettings = filteredRemoteData[0];
                const localSettings = Array.isArray(localData) ? localData[0] : localData;

                if (JSON.stringify(remoteSettings) === JSON.stringify(localSettings)) return;

                // Always update shutdown state if clinicSettings changed
                setIsShutdown(!!remoteSettings.shutdown);

                const remoteTimestamp = remoteSettings.lastUpdated || remoteSettings.updatedAt || 0;
                const localTimestamp = localSettings?.lastUpdated || localSettings?.updatedAt || 0;

                if (!localSettings || remoteTimestamp > localTimestamp) {
                    isSyncingRef.current = true;
                    await dbManager.saveToLocal(collectionName, remoteSettings);

                    // Update React State
                    setClinicSettings(remoteSettings);

                    // Recalculate Subscription
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

            // Helper to get a reliable numeric timestamp from an item
            const getNumericTimestamp = (item: any): number => {
                if (item.lastUpdated && typeof item.lastUpdated === 'number') {
                    return item.lastUpdated;
                }
                if (item.updatedAt) {
                    try {
                        return new Date(item.updatedAt).getTime();
                    } catch (e) {
                        return 0;
                    }
                }
                return 0;
            };

            // Track remote IDs to detect deletions
            const remoteIds = new Set(filteredRemoteData.map(d => d.id));

            for (const remoteItem of filteredRemoteData) {
                const localItem = localMap.get(remoteItem.id);

                if (!localItem) {
                    updatesToSave.push(remoteItem);
                    hasChanged = true;
                    continue;
                }

                // Specific rule for users password preservation
                if (collectionName === 'users' && (remoteItem.id === 'admin' || remoteItem.id === 'operator')) {
                    // Always prefer the local password if it exists, unless remote is explicitly newer
                    const remoteTimestamp = getNumericTimestamp(remoteItem);
                    const localTimestamp = getNumericTimestamp(localItem);
                    
                    if (localItem.password && (localTimestamp >= remoteTimestamp || !remoteItem.password)) {
                        remoteItem.password = localItem.password;
                    }
                }

                if (JSON.stringify(remoteItem) !== JSON.stringify(localItem)) {
                    const remoteTimestamp = getNumericTimestamp(remoteItem);
                    const localTimestamp = getNumericTimestamp(localItem);

                    const isLocalPendingSync = localItem.needsSync || localItem.syncPending;
                    
                    // CRITICAL FIX: Only overwrite if remote is strictly NEWER than local
                    // OR if they have the same timestamp but local is clean while remote is different
                    // This prevents stale Firebase snapshots from reverting local status updates.
                    const isRemoteNewer = remoteTimestamp > localTimestamp;
                    const isRemoteSameButLocalClean = remoteTimestamp === localTimestamp && !isLocalPendingSync;

                    if (isRemoteNewer || isRemoteSameButLocalClean) {
                        updatesToSave.push(remoteItem);
                        hasChanged = true;
                    } else if (isLocalPendingSync && remoteTimestamp === localTimestamp) {
                        // If both have same timestamp but local is dirty, we might want to keep local
                        // but if they are exactly the same data except needsSync, we can mark local as clean
                        const remoteNoSync = { ...remoteItem, needsSync: false, lastUpdated: remoteTimestamp };
                        const localNoSync = { ...localItem, needsSync: false, lastUpdated: localTimestamp };
                        
                        if (JSON.stringify(remoteNoSync) === JSON.stringify(localNoSync)) {
                            // Data matches, just clear the sync flag locally
                            updatesToSave.push({ ...localItem, needsSync: false });
                            hasChanged = true;
                        }
                    }
                }
            }

            // Handle Deletions: If item in local but not in remote and not pending sync
            for (const localItem of localData) {
                // Safeguard: Never delete admin or operator users locally even if missing in cloud
                if (collectionName === 'users' && (localItem.id === 'admin' || localItem.id === 'operator')) {
                    continue;
                }

                if (!remoteIds.has(localItem.id) && !localItem.needsSync) {
                    console.log(`[Sync] Item ${localItem.id} not found in cloud, deleting locally.`);
                    await dbManager.deleteFromLocal(collectionName, localItem.id);
                    hasChanged = true;
                }
            }

            if (updatesToSave.length > 0) {
                isSyncingRef.current = true;
                await dbManager.saveMultipleToLocal(collectionName, updatesToSave);
            }

            if (hasChanged) {
                const freshLocalData = await dbManager.getFromLocal(collectionName);
                const setter = stateSetterMap[collectionName as keyof typeof stateSetterMap];
                if (setter) {
                    // ✅ Apply deleted filter again before setting state
                    let finalData = Array.isArray(freshLocalData) ? freshLocalData : [];
                    if (collectionName === 'patients' && deletedPatients.length > 0) {
                        finalData = finalData.filter((p: any) => !deletedPatients.includes(p.id));
                    }
                    setter(finalData);
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

    const verifyDataIntegrity = useCallback(async () => {
        console.log('[verifyDataIntegrity] Starting data integrity check...');

        const issues = [];

        try {
            // Check for attendance records with missing staff
            const allAttendance = await dbManager.getFromLocal('attendance');
            const allStaff = await dbManager.getFromLocal('staff');
            const staffIds = new Set(allStaff.map(s => s.id));

            const orphanedAttendance = (allAttendance || []).filter(a => !staffIds.has(a.staffId));
            if (orphanedAttendance.length > 0) {
                issues.push(`${orphanedAttendance.length} orphaned attendance records found`);
                console.log('[verifyDataIntegrity] Orphaned attendance:', orphanedAttendance);
            }

            // Check for salary payments with missing staff
            const allPayments = await dbManager.getFromLocal('salaryPayments');
            const orphanedPayments = (allPayments || []).filter(p => !staffIds.has(p.staffId));
            if (orphanedPayments.length > 0) {
                issues.push(`${orphanedPayments.length} orphaned payment records found`);
            }

            // Check for transactions with missing staff
            const allTransactions = await dbManager.getFromLocal('transactions');
            const orphanedTransactions = (allTransactions || []).filter(t => t.staffId && !staffIds.has(t.staffId));
            if (orphanedTransactions.length > 0) {
                issues.push(`${orphanedTransactions.length} orphaned transaction records found`);
            }

            if (issues.length > 0) {
                console.warn('[verifyDataIntegrity] Issues found:', issues);
                return { valid: false, issues };
            } else {
                console.log('[verifyDataIntegrity] All data is consistent');
                return { valid: true, issues: [] };
            }

        } catch (error) {
            console.error('[verifyDataIntegrity] Error:', error);
            return { valid: false, issues: ['Failed to verify data integrity'] };
        }
    }, []);

    const handleFirebaseUpdateRef = useRef(handleFirebaseUpdate);
    handleFirebaseUpdateRef.current = handleFirebaseUpdate;

    // Add this function in DataContext.tsx (around line 550-600, before updateAttendanceWithTime)

    const addToSyncQueue = useCallback(async (collectionName: string, data: any, operation: 'create' | 'update' | 'delete' | 'upsert') => {
        try {
            const syncItem = {
                id: `${collectionName}_${data.id}_${Date.now()}`,
                collectionName,
                docId: data.id,
                data,
                operation: operation === 'upsert' ? 'update' : operation,
                timestamp: Date.now(),
                retryCount: 0
            };

            await dbManager.saveToLocal('syncQueue', syncItem);

            // If online and autoSync is enabled, process immediately
            if (isOnline && autoSyncEnabled) {
                setTimeout(() => processSyncQueue(), 0);
            }
        } catch (error) {
            console.error('Failed to add to sync queue:', error);
        }
    }, [isOnline, autoSyncEnabled]);

    const updateAttendanceWithTime = useCallback(async (attendance: Attendance): Promise<void> => {
        try {
            // Validate required fields
            if (!attendance.staffId) {
                throw new Error('Staff ID is required');
            }

            if (!attendance.date) {
                throw new Error('Date is required');
            }

            // Ensure time is in correct format
            let time = attendance.time;
            let timestamp = attendance.timestamp;

            // If time is not provided but date is, create default time
            if (!time && attendance.date) {
                const now = new Date();
                time = now.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }

            // Create timestamp if not provided
            if (!timestamp && attendance.date && time) {
                timestamp = `${attendance.date}T${time}`;
            }

            // Check for duplicate attendance at same timestamp
            const isDuplicate = await checkDuplicateAttendance(attendance.staffId, timestamp!);
            if (isDuplicate && !attendance.id) {
                toast.warning('Attendance already recorded for this time');
                return;
            }

            const attendanceWithTime: Attendance = {
                ...attendance,
                time,
                timestamp,
                updatedAt: new Date().toISOString(),
                synced: false
            };

            if (!attendanceWithTime.createdAt) {
                attendanceWithTime.createdAt = new Date().toISOString();
            }

            // Ensure ID exists
            if (!attendanceWithTime.id) {
                attendanceWithTime.id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }

            // 1. Update local state immediately (Optimistic UI)
            setAttendance(prev => {
                const exists = prev.some(a => a.id === attendanceWithTime.id);
                if (exists) {
                    return prev.map(a => a.id === attendanceWithTime.id ? attendanceWithTime : a);
                } else {
                    return [...prev, attendanceWithTime];
                }
            });

            // 2. Save to IndexedDB (Local persistence)
            await dbManager.saveToLocal('attendance', attendanceWithTime);

            // 3. Add to sync queue for Firebase background sync
            await addToSyncQueue('attendance', attendanceWithTime, 'upsert');

            // 4. Show success message
            toast.success(`Attendance recorded for ${attendanceWithTime.date} at ${attendanceWithTime.time}`);

        } catch (error) {
            console.error('Failed to update attendance:', error);
            toast.error('Failed to record attendance');
            throw error;
        }
    }, [addToSyncQueue]);

    const getAttendanceWithTimeRange = useCallback(async (staffId: string, startDate: string, endDate: string): Promise<Attendance[]> => {
        try {
            const allAttendance = await dbManager.getFromLocal('attendance');
            if (!allAttendance || !Array.isArray(allAttendance)) return [];

            return allAttendance.filter((att: Attendance) =>
                att.staffId === staffId &&
                att.date >= startDate &&
                att.date <= endDate
            );
        } catch (error) {
            console.error('Failed to get attendance by time range:', error);
            return [];
        }
    }, []);

    const checkDuplicateAttendance = useCallback(async (staffId: string, timestamp: string): Promise<boolean> => {
        try {
            const allAttendance = await dbManager.getFromLocal('attendance');
            if (!allAttendance || !Array.isArray(allAttendance)) return false;

            return allAttendance.some((att: Attendance) =>
                att.staffId === staffId && att.timestamp === timestamp
            );
        } catch (error) {
            console.error('Failed to check duplicate attendance:', error);
            return false;
        }
    }, []);

    const deleteAttendance = useCallback(async (attendanceId: string): Promise<void> => {
        try {
            // 1. Find the attendance record
            const attendanceToDelete = attendance.find(a => a.id === attendanceId);
            if (!attendanceToDelete) {
                throw new Error('Attendance record not found');
            }

            // 2. Delete from IndexedDB and Firebase
            await deleteLocal('attendance', attendanceId);

            // 3. Update local state
            setAttendance(prev => prev.filter(a => a.id !== attendanceId));

            // 4. Show success message
            toast.success(`Attendance record for ${attendanceToDelete.date} deleted successfully`);

            // 5. No need to recalculate staff stats as attendance doesn't affect salary calculations directly
            // Salary is calculated based on attendance when paying salary

        } catch (error) {
            console.error('Failed to delete attendance:', error);
            toast.error('Failed to delete attendance record');
            throw error;
        }
    }, [attendance, deleteLocal]);

    const deleteStaffWithAllRecords = useCallback(async (staffMember: Staff): Promise<boolean> => {
        console.log(`[deleteStaffWithAllRecords] Deleting staff: ${staffMember.name} (${staffMember.id})`);

        try {
            // 1. Get all related records
            const staffAttendance = attendance.filter(a => a.staffId === staffMember.id);
            const staffPayments = salaryPayments.filter(p => p.staffId === staffMember.id);
            const staffTransactions = transactions.filter(t => t.staffId === staffMember.id && t.type === 'Salary');

            console.log(`[deleteStaffWithAllRecords] Found: ${staffAttendance.length} attendance, ${staffPayments.length} payments, ${staffTransactions.length} transactions`);

            // 2. Delete all attendance records
            for (const att of staffAttendance) {
                await deleteLocal('attendance', att.id);
                console.log(`[deleteStaffWithAllRecords] Deleted attendance: ${att.id} (${att.date})`);
            }

            // 3. Delete all salary payments and linked expenses
            for (const payment of staffPayments) {
                // Delete the salary payment record
                await deleteLocal('salaryPayments', payment.id);

                // Find and delete linked expense
                const linkedExpense = expenses.find(e => e.id === payment.id || e.title?.includes(staffMember.name));
                if (linkedExpense) {
                    await deleteLocal('expenses', linkedExpense.id);
                    console.log(`[deleteStaffWithAllRecords] Deleted linked expense: ${linkedExpense.id}`);
                }

                console.log(`[deleteStaffWithAllRecords] Deleted payment: ${payment.id}`);
            }

            // 4. Delete all transactions
            for (const txn of staffTransactions) {
                await deleteLocal('transactions', txn.id);
                console.log(`[deleteStaffWithAllRecords] Deleted transaction: ${txn.id}`);
            }

            // 5. Finally, delete the staff member
            await deleteLocal('staff', staffMember.id);
            console.log(`[deleteStaffWithAllRecords] Deleted staff: ${staffMember.id}`);

            // 6. Update local state to remove all related records
            setAttendance(prev => prev.filter(a => a.staffId !== staffMember.id));
            setSalaryPayments(prev => prev.filter(p => p.staffId !== staffMember.id));
            setTransactions(prev => prev.filter(t => t.staffId !== staffMember.id));

            // 7. Update expenses to remove any lingering linked expenses
            const updatedExpenses = expenses.filter(e => !e.title?.includes(staffMember.name) && e.id !== staffMember.id);
            setExpenses(updatedExpenses);

            toast.success(`${staffMember.name} and all associated records deleted successfully`);

            return true;

        } catch (error) {
            console.error('[deleteStaffWithAllRecords] Error:', error);
            toast.error(`Failed to completely delete ${staffMember.name}. Please check console for details.`);
            return false;
        }
    }, [attendance, salaryPayments, transactions, expenses, deleteLocal]);

    const cleanupOrphanedExpenses = useCallback(async () => {
        try {
            const allExpenses = await dbManager.getFromLocal('expenses');
            const allStaff = await dbManager.getFromLocal('staff');
            const staffIds = new Set(allStaff.map(s => s.id));

            // Find expenses that reference staff but staff doesn't exist
            const orphanedExpenses = (allExpenses || []).filter(expense => {
                // Check if expense is a salary expense
                if (expense.category === 'salary' && expense.staffId) {
                    return !staffIds.has(expense.staffId);
                }
                return false;
            });

            if (orphanedExpenses.length > 0) {
                console.log(`[cleanupOrphanedExpenses] Found ${orphanedExpenses.length} orphaned expenses`);
                for (const expense of orphanedExpenses) {
                    await deleteLocal('expenses', expense.id);
                    console.log(`[cleanupOrphanedExpenses] Deleted orphaned expense: ${expense.id}`);
                }
            }
        } catch (error) {
            console.error('[cleanupOrphanedExpenses] Error:', error);
        }
    }, [deleteLocal]);

    // const deletePatientWithAllRecords = useCallback(async (patient: Patient): Promise<boolean> => {
    //     console.log(`[deletePatientWithAllRecords] Deleting patient: ${patient.name} (${patient.id})`);
    //     console.log(`[deletePatientWithAllRecords] Patient Number: ${patient.patientNumber}`);

    //     try {
    //         // 1. Get all related records - Match by ALL possible fields
    //         const patientQueueItems = queue.filter(q =>
    //             q.patientId === patient.id ||
    //             q.patientNumber === patient.patientNumber ||
    //             q.patientName === patient.name
    //         );

    //         const patientBills = bills.filter(b =>
    //             b.patientId === patient.id ||
    //             b.patientNumber === patient.patientNumber
    //         );

    //         const patientTransactions = transactions.filter(t =>
    //             t.patientId === patient.id ||
    //             t.patientNumber === patient.patientNumber ||
    //             t.patientName === patient.name
    //         );

    //         console.log(`[deletePatientWithAllRecords] Found: 
    //         - ${patientQueueItems.length} queue items
    //         - ${patientBills.length} bills
    //         - ${patientTransactions.length} transactions`);

    //         // 2. Delete all queue items (including treatments)
    //         for (const item of patientQueueItems) {
    //             await deleteLocal('queue', item.id);
    //             console.log(`[deletePatientWithAllRecords] Deleted queue item: ${item.id}`);
    //         }

    //         // 3. Delete all bills
    //         for (const bill of patientBills) {
    //             await deleteLocal('bills', bill.id);
    //             console.log(`[deletePatientWithAllRecords] Deleted bill: ${bill.id}`);
    //         }

    //         // 4. Delete all transactions (including pre-receive payments)
    //         for (const txn of patientTransactions) {
    //             await deleteLocal('transactions', txn.id);
    //             console.log(`[deletePatientWithAllRecords] Deleted transaction: ${txn.id}`);
    //         }

    //         // 5. Finally, delete the patient
    //         await deleteLocal('patients', patient.id);
    //         console.log(`[deletePatientWithAllRecords] Deleted patient: ${patient.id}`);

    //         // 6. Update local state to remove all related records
    //         setQueue(prev => prev.filter(q =>
    //             q.patientId !== patient.id &&
    //             q.patientNumber !== patient.patientNumber &&
    //             q.patientName !== patient.name
    //         ));

    //         setBills(prev => prev.filter(b =>
    //             b.patientId !== patient.id &&
    //             b.patientNumber !== patient.patientNumber
    //         ));

    //         setTransactions(prev => prev.filter(t =>
    //             t.patientId !== patient.id &&
    //             t.patientNumber !== patient.patientNumber &&
    //             t.patientName !== patient.name
    //         ));

    //         toast.success(`${patient.name} and all associated records deleted successfully`);

    //         return true;

    //     } catch (error) {
    //         console.error('[deletePatientWithAllRecords] Error:', error);
    //         toast.error(`Failed to completely delete ${patient.name}. Please check console for details.`);
    //         return false;
    //     }
    // }, [queue, bills, transactions, deleteLocal]);

    // const deletePatientWithAllRecords = useCallback(async (patient: Patient): Promise<boolean> => {
    //     console.log(`[deletePatientWithAllRecords] Deleting patient: ${patient.name} (${patient.id})`);

    //     try {
    //         // 1. Get all related records
    //         const patientQueueItems = queue.filter(q =>
    //             q.patientId === patient.id ||
    //             q.patientNumber === patient.patientNumber ||
    //             q.patientName === patient.name
    //         );

    //         const patientBills = bills.filter(b =>
    //             b.patientId === patient.id ||
    //             b.patientNumber === patient.patientNumber
    //         );

    //         const patientTransactions = transactions.filter(t =>
    //             t.patientId === patient.id ||
    //             t.patientNumber === patient.patientNumber ||
    //             t.patientName === patient.name
    //         );

    //         console.log(`Found: ${patientQueueItems.length} queue, ${patientBills.length} bills, ${patientTransactions.length} transactions`);

    //         // 2. Delete all queue items
    //         for (const item of patientQueueItems) {
    //             await deleteLocal('queue', item.id);
    //         }

    //         // 3. Delete all bills
    //         for (const bill of patientBills) {
    //             await deleteLocal('bills', bill.id);
    //         }

    //         // 4. Delete all transactions
    //         for (const txn of patientTransactions) {
    //             await deleteLocal('transactions', txn.id);
    //         }

    //         // 5. Delete the patient
    //         await deleteLocal('patients', patient.id);

    //         // 6. ✅ ADD THIS - Update patients state immediately
    //         setPatients(prev => prev.filter(p => p.id !== patient.id));

    //         // 7. Update other states
    //         setQueue(prev => prev.filter(q =>
    //             q.patientId !== patient.id &&
    //             q.patientNumber !== patient.patientNumber &&
    //             q.patientName !== patient.name
    //         ));

    //         setBills(prev => prev.filter(b =>
    //             b.patientId !== patient.id &&
    //             b.patientNumber !== patient.patientNumber
    //         ));

    //         setTransactions(prev => prev.filter(t =>
    //             t.patientId !== patient.id &&
    //             t.patientNumber !== patient.patientNumber &&
    //             t.patientName !== patient.name
    //         ));

    //         toast.success(`${patient.name} and all associated records deleted successfully`);
    //         return true;

    //     } catch (error) {
    //         console.error('[deletePatientWithAllRecords] Error:', error);
    //         toast.error(`Failed to delete ${patient.name}`);
    //         return false;
    //     }
    // }, [queue, bills, transactions, deleteLocal, setPatients]); // ✅ Add setPatients to dependencies


    const deletePatientWithAllRecords = useCallback(async (patient: Patient): Promise<boolean> => {
    console.log(`[deletePatientWithAllRecords] ========== START ==========`);
    console.log(`[deletePatientWithAllRecords] Deleting patient: ${patient.name}`);
    console.log(`[deletePatientWithAllRecords] Patient ID: ${patient.id}`);
    console.log(`[deletePatientWithAllRecords] Patient Number: ${patient.patientNumber}`);

    try {
        // ============================================
        // STEP 1: Get ALL data from current state
        // ============================================
        console.log(`[deletePatientWithAllRecords] Fetching all related records...`);
        
        // Queue items - Match by multiple fields
        const patientQueueItems = queue.filter(q => {
            const matchById = q.patientId === patient.id;
            const matchByNumber = q.patientNumber === patient.patientNumber;
            const matchByName = q.patientName === patient.name;
            const matched = matchById || matchByNumber || matchByName;
            if (matched) {
                console.log(`[deletePatientWithAllRecords] Found queue item:`, { id: q.id, patientId: q.patientId, patientNumber: q.patientNumber, patientName: q.patientName });
            }
            return matched;
        });

        // Bills - Match by patient ID or patient number
        const patientBills = bills.filter(b => {
            const matchById = b.patientId === patient.id;
            const matchByNumber = b.patientNumber === patient.patientNumber;
            const matched = matchById || matchByNumber;
            if (matched) {
                console.log(`[deletePatientWithAllRecords] Found bill:`, { id: b.id, patientId: b.patientId, patientNumber: b.patientNumber });
            }
            return matched;
        });

        // Transactions - Match by patient ID, patient number, or patient name
        const patientTransactions = transactions.filter(t => {
            const matchById = t.patientId === patient.id;
            const matchByNumber = t.patientNumber === patient.patientNumber;
            const matchByName = t.patientName === patient.name;
            const matched = matchById || matchByNumber || matchByName;
            if (matched) {
                console.log(`[deletePatientWithAllRecords] Found transaction:`, { id: t.id, type: t.type, amount: t.amount });
            }
            return matched;
        });

        // Appointments
        const patientAppointments = appointments.filter(a => a.patientId === patient.id);

        // Patient Transactions (Financial History)
        const patientFinancialHistory = patientTransactions.filter(t => 
            t.patientId === patient.id || 
            t.patientNumber === patient.patientNumber
        );

        console.log(`[deletePatientWithAllRecords] SUMMARY:`);
        console.log(`  - Queue items: ${patientQueueItems.length}`);
        console.log(`  - Bills: ${patientBills.length}`);
        console.log(`  - Transactions: ${patientTransactions.length}`);
        console.log(`  - Appointments: ${patientAppointments.length}`);
        console.log(`  - Financial Txns: ${patientFinancialHistory.length}`);

        // ============================================
        // STEP 2: Delete all queue items
        // ============================================
        for (const item of patientQueueItems) {
            try {
                await deleteLocal('queue', item.id);
                console.log(`✅ Deleted queue: ${item.id} (${item.patientName})`);
            } catch (err) {
                console.error(`❌ Failed to delete queue ${item.id}:`, err);
            }
        }

        // ============================================
        // STEP 3: Delete all bills
        // ============================================
        for (const bill of patientBills) {
            try {
                await deleteLocal('bills', bill.id);
                console.log(`✅ Deleted bill: ${bill.id}`);
            } catch (err) {
                console.error(`❌ Failed to delete bill ${bill.id}:`, err);
            }
        }

        // ============================================
        // STEP 4: Delete all transactions
        // ============================================
        for (const txn of patientTransactions) {
            try {
                await deleteLocal('transactions', txn.id);
                console.log(`✅ Deleted transaction: ${txn.id}`);
            } catch (err) {
                console.error(`❌ Failed transaction ${txn.id}:`, err);
            }
        }

        // ============================================
        // STEP 4.1: Delete all appointments
        // ============================================
        for (const appt of patientAppointments) {
            try {
                await deleteLocal('appointments', appt.id);
                console.log(`✅ Deleted appointment: ${appt.id}`);
            } catch (err) {
                console.error(`❌ Failed appointment ${appt.id}:`, err);
            }
        }

        // ============================================
        // STEP 4.2: Delete financial history
        // ============================================
        for (const ptxn of patientFinancialHistory) {
            try {
                await deleteLocal('patientTransactions', ptxn.id);
                console.log(`✅ Deleted ptxn: ${ptxn.id}`);
            } catch (err) {
                console.error(`❌ Failed ptxn ${ptxn.id}:`, err);
            }
        }

        // ============================================
        // STEP 5: Delete the patient
        // ============================================
        await deleteLocal('patients', patient.id);
        console.log(`✅ Deleted patient: ${patient.id}`);

        // ============================================
        // STEP 6: Mark as deleted to prevent re-fetch
        // ============================================
        const deletedPatients = JSON.parse(localStorage.getItem('deleted_patients') || '[]');
        if (!deletedPatients.includes(patient.id)) {
            deletedPatients.push(patient.id);
            localStorage.setItem('deleted_patients', JSON.stringify(deletedPatients));
            console.log(`📝 Added ${patient.id} to deleted_patients list`);
        }

        // ============================================
        // STEP 7: Update all React states to ensure UI is clean
        // ============================================
        setPatients(prev => {
            const filtered = prev.filter(p => p.id !== patient.id);
            console.log(`🔄 Patients state: ${prev.length} -> ${filtered.length}`);
            return filtered;
        });

        setQueue(prev => {
            const filtered = prev.filter(q =>
                q.patientId !== patient.id &&
                q.patientNumber?.toString() !== patient.patientNumber?.toString() &&
                q.patientName?.toLowerCase().trim() !== patient.name?.toLowerCase().trim()
            );
            console.log(`🔄 Queue state: ${prev.length} -> ${filtered.length}`);
            return filtered;
        });

        setBills(prev => {
            const filtered = prev.filter(b =>
                b.patientId !== patient.id &&
                b.patientNumber?.toString() !== patient.patientNumber?.toString()
            );
            console.log(`🔄 Bills state: ${prev.length} -> ${filtered.length}`);
            return filtered;
        });

        setTransactions(prev => {
            const filtered = prev.filter(t =>
                t.patientId !== patient.id &&
                t.patientNumber?.toString() !== patient.patientNumber?.toString() &&
                t.patientName?.toLowerCase().trim() !== patient.name?.toLowerCase().trim()
            );
            console.log(`🔄 Transactions state: ${prev.length} -> ${filtered.length}`);
            return filtered;
        });

        setAppointments(prev => {
            const filtered = prev.filter(a => 
                a.patientId !== patient.id
            );
            console.log(`🔄 Appointments state: ${prev.length} -> ${filtered.length}`);
            return filtered;
        });

        setPatientTransactions(prev => {
            const filtered = (prev || []).filter(t => 
                t.patientId !== patient.id && 
                t.patientNumber?.toString() !== patient.patientNumber?.toString()
            );
            console.log(`🔄 Patient Transactions state: ${(prev || []).length} -> ${filtered.length}`);
            return filtered;
        });

        console.log(`[deletePatientWithAllRecords] ========== COMPLETE ==========`);
        toast.success(`${patient.name} and all related records deleted successfully`);
        return true;

    } catch (error) {
        console.error('[deletePatientWithAllRecords] FATAL ERROR:', error);
        toast.error(`Failed to delete ${patient.name}. Please try again.`);
        return false;
    }

}, [queue, bills, transactions, appointments, patientTransactions, deleteLocal, setPatients, setQueue, setBills, setTransactions, setAppointments, setPatientTransactions]);

    const debugPatientRecords = useCallback((patient: Patient) => {
    console.log(`[DEBUG] Checking records for patient: ${patient.name} (${patient.id})`);
    
    const patientQueueItems = queue.filter(q =>
        q.patientId === patient.id ||
        q.patientNumber === patient.patientNumber ||
        q.patientName === patient.name
    );
    
    const patientBills = bills.filter(b =>
        b.patientId === patient.id ||
        b.patientNumber === patient.patientNumber
    );
    
    const patientTransactions = transactions.filter(t =>
        t.patientId === patient.id ||
        t.patientNumber === patient.patientNumber ||
        t.patientName === patient.name
    );
    
    console.log(`[DEBUG] Queue items:`, patientQueueItems.map(q => ({ id: q.id, patientId: q.patientId, patientNumber: q.patientNumber })));
    console.log(`[DEBUG] Bills:`, patientBills.map(b => ({ id: b.id, patientId: b.patientId, patientNumber: b.patientNumber })));
    console.log(`[DEBUG] Transactions:`, patientTransactions.map(t => ({ id: t.id, type: t.type, amount: t.amount })));
    
    return { patientQueueItems, patientBills, patientTransactions };
}, [queue, bills, transactions]);

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

    useEffect(() => {
        // Process sync queue when online
        const handleOnline = async () => {
            console.log('[DataContext] Online, processing sync queue...');
            const { processSyncQueue } = await import('@/services/offlineSync');
            await processSyncQueue();
        };

        window.addEventListener('online', handleOnline);

        // Initial sync if online
        if (navigator.onLine) {
            handleOnline();
        }

        // Periodic sync every 5 minutes
        const interval = setInterval(() => {
            if (navigator.onLine) {
                import('@/services/offlineSync').then(({ processSyncQueue }) => {
                    processSyncQueue();
                });
            }
        }, 5 * 60 * 1000);

        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, []);

    return (
        <DataContext.Provider value={{
            patients, queue, appointments, staff, salaryPayments, attendance,
            inventory, sales, expenses, bills, treatments, clinicSettings,
            transactions, purchases, roles, loading, isOnline,
            patientTransactions,
            licenseStatus, licenseDaysLeft,
            licenseKey, licenseExpiryDate, isShutdown,
            updateLocal, deleteLocal, addItem, refreshCollection,
            exportToCSV, exportSalesHistoryToCSV, generateStaffReport, importFromCSV,
            setPatients, setQueue, setAppointments, setStaff, setInventory,
            setSales, setExpenses, setBills, setTreatments, setAttendance, setSalaryPayments,
            setTransactions, setPurchases, setRoles,
            setPatientTransactions,
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
            setAutoSyncEnabled,

            updateAttendanceWithTime,
            getAttendanceWithTimeRange,
            checkDuplicateAttendance,
            deleteStaffWithAllRecords,
            deletePatientWithAllRecords
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