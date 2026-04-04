// src/services/offlineSync.ts
import { dbManager } from '@/lib/indexedDB';

interface SyncQueueItem {
  id: string;
  collection: string;
  action: 'delete' | 'update' | 'create';
  data: any;
  timestamp: number;
  retryCount: number;
}

export const addToSyncQueue = async (
  collection: string,
  action: 'delete' | 'update' | 'create',
  data: any
) => {
  const syncItem: SyncQueueItem = {
    id: `${collection}_${data.id || Date.now()}_${Date.now()}`,
    collection,
    action,
    data,
    timestamp: Date.now(),
    retryCount: 0
  };
  
  await dbManager.saveToLocal('syncQueue', syncItem);
  console.log(`[OfflineSync] Added to queue: ${collection} - ${action}`);
};

export const processSyncQueue = async () => {
  const syncQueue = await dbManager.getFromLocal('syncQueue') || [];
  
  for (const item of syncQueue) {
    try {
      const { db } = await import('@/lib/firebase');
      const { deleteDoc, doc, setDoc } = await import('firebase/firestore');
      
      if (item.action === 'delete') {
        await deleteDoc(doc(db, item.collection, item.data.id));
      } else {
        await setDoc(doc(db, item.collection, item.data.id), item.data, { merge: true });
      }
      
      // Remove from queue after successful sync
      await dbManager.deleteFromLocal('syncQueue', item.id);
      console.log(`[OfflineSync] Synced: ${item.collection} - ${item.action}`);
      
    } catch (error) {
      console.error(`[OfflineSync] Failed to sync: ${item.id}`, error);
      
      // Increment retry count
      item.retryCount++;
      if (item.retryCount < 5) {
        await dbManager.saveToLocal('syncQueue', item);
      } else {
        // Max retries reached, remove from queue
        await dbManager.deleteFromLocal('syncQueue', item.id);
        console.error(`[OfflineSync] Max retries reached for: ${item.id}`);
      }
    }
  }
};

// Listen for online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Online detected, processing queue...');
    processSyncQueue();
  });
}