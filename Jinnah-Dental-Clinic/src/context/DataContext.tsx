'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { getFromLocal, saveToLocal } from '@/services/indexedDbUtils';
import { processSyncQueue } from '@/services/syncService';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Patient, QueueItem } from '@/types';
import { toast } from 'sonner';

interface DataContextType {
    patients: Patient[];
    queue: QueueItem[];
    loading: boolean;
    isOnline: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const isOnline = useConnectionStatus();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync queue when coming back online
    useEffect(() => {
        if (isOnline) {
            processSyncQueue();
        }
    }, [isOnline]);

    // Helper to sync remote data to local if newer
    const syncIfNewer = async (storeName: string, remoteData: any[], setState: (data: any[]) => void) => {
        try {
            const localData = await getFromLocal(storeName) as any[];
            const localMap = new Map(localData.map(item => [item.id, item]));

            let updated = false;
            const mergedData = [...localData];
            const updatesToSave: any[] = [];

            for (const remoteItem of remoteData) {
                const localItem = localMap.get(remoteItem.id);

                // Update if local doesn't exist OR remote is newer
                const remoteTimestamp = remoteItem.lastUpdated || 0;
                const localTimestamp = localItem?.lastUpdated || 0;

                // IMPORTANT: If local is marked as 'needsSync', don't overwrite it with a 'older' cloud version
                if (localItem?.needsSync && remoteTimestamp <= localTimestamp) {
                    continue;
                }

                if (!localItem || remoteTimestamp > localTimestamp) {
                    updatesToSave.push(remoteItem);

                    if (!localItem) {
                        mergedData.push(remoteItem);
                    } else {
                        const index = mergedData.findIndex(item => item.id === remoteItem.id);
                        mergedData[index] = remoteItem;
                    }
                    updated = true;
                }
            }

            // Save all updates in parallel
            if (updatesToSave.length > 0) {
                await Promise.all(updatesToSave.map(item => saveToLocal(storeName, item)));
            }

            if (updated || localData.length !== mergedData.length) {
                setState(mergedData);
            }
        } catch (err) {
            console.error(`Error syncing ${storeName}:`, err);
        }
    };

    useEffect(() => {
        // 1. Initial load from IndexedDB (App loads instantly without cloud)
        const loadLocal = async () => {
            try {
                const [localPatients, localQueue] = await Promise.all([
                    getFromLocal('patients'),
                    getFromLocal('queue')
                ]);
                setPatients(localPatients || []);
                setQueue(localQueue || []);
                setLoading(false);
            } catch (err) {
                console.error('Error loading local data:', err);
                setLoading(false);
            }
        };
        loadLocal();

        // 2. Set up Firebase Listeners (Only active if online)
        const patientsQuery = query(collection(db, 'patients'));
        const queueQuery = query(collection(db, 'queue'));

        const unsubPatients = onSnapshot(patientsQuery, (snapshot) => {
            const remotePatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            syncIfNewer('patients', remotePatients, setPatients);
        }, (err) => {
            console.error('Patients listener error:', err);
        });

        const unsubQueue = onSnapshot(queueQuery, (snapshot) => {
            const remoteQueue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            syncIfNewer('queue', remoteQueue, setQueue);
        }, (err) => {
            console.error('Queue listener error:', err);
        });

        return () => {
            unsubPatients();
            unsubQueue();
        };
    }, []);

    return (
        <DataContext.Provider value={{ patients, queue, loading, isOnline }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
