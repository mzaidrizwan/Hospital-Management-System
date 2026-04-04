// components/SyncStatus.tsx
import { useState, useEffect } from 'react';
import { dbManager } from '@/lib/indexedDB';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';

export const SyncStatus = () => {
  const [pendingSync, setPendingSync] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const checkPendingSync = async () => {
      const queue = await dbManager.getFromLocal('syncQueue') || [];
      setPendingSync(queue.length);
    };
    
    checkPendingSync();
    
    const interval = setInterval(checkPendingSync, 5000);
    
    const handleOnline = () => {
      setIsOnline(true);
      checkPendingSync();
    };
    
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded">
        <CloudOff className="w-3 h-3" />
        <span>Offline</span>
      </div>
    );
  }
  
  if (pendingSync > 0) {
    return (
      <div className="flex items-center gap-1 text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Syncing ({pendingSync})...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-1 rounded">
      <Cloud className="w-3 h-3" />
      <span>Synced</span>
    </div>
  );
};