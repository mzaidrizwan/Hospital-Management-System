import React from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SyncIndicator() {
    const isOnline = useConnectionStatus();

    return (
        <div className="flex items-center gap-2">
            {isOnline ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 py-1 px-3">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Online</span>
                </Badge>
            ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 gap-1.5 py-1 px-3 animate-pulse">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">You are Offline</span>
                </Badge>
            )}
        </div>
    );
}
