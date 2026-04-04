// src/hooks/useAttendanceSync.ts
import { useEffect, useState, useCallback } from 'react';
import { dbManager } from '@/lib/indexedDB';
import { Attendance } from '@/types';
import { toast } from 'sonner';
import { processSyncQueue } from '@/services/syncService';

export const useAttendanceSync = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    
    const syncAttendance = useCallback(async () => {
        if (isSyncing) return;
        
        setIsSyncing(true);
        
        try {
            const syncQueue = await dbManager.getFromLocal('syncQueue');
            const pendingAttendance = (syncQueue || []).filter(
                (item: any) => item.collectionName === 'attendance'
            );
            
            setPendingSyncCount(pendingAttendance.length);
            
            if (pendingAttendance.length > 0 && navigator.onLine) {
                await processSyncQueue();
            }
        } catch (error) {
            console.error('Failed to sync attendance:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);
    
    // Sync when online
    useEffect(() => {
        const handleOnline = () => {
            syncAttendance();
        };
        
        window.addEventListener('online', handleOnline);
        
        // Initial sync
        if (navigator.onLine) {
            syncAttendance();
        }
        
        // Sync every 5 minutes
        const interval = setInterval(() => {
            if (navigator.onLine) {
                syncAttendance();
            }
        }, 5 * 60 * 1000);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, [syncAttendance]);
    
    return {
        isSyncing,
        pendingSyncCount,
        syncAttendance
    };
};