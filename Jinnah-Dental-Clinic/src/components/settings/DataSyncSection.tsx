import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, AlertTriangle, CloudDownload, RefreshCw, Database, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function DataSyncSection() {
    const {
        exportToJSON,
        importFromJSON,
        clearDataStore,
        manualCloudRestore,
        isOnline,
        autoSyncEnabled,
        setAutoSyncEnabled
    } = useData();
    const { user } = useAuth();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, collectionName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            await importFromJSON(file, collectionName);
        } catch (error) {
            console.error(error);
        }
        e.target.value = ''; // Reset
    };

    const handleClearDatabase = async () => {
        if (confirm("WARNING: This will delete ALL local data (Patients, Staff, Expenses, Settings). Are you sure?")) {
            if (confirm("Cloud data will remain safe in Firebase, but automatic fetching will be DISABLED. Proceed?")) {
                try {
                    toast.loading("Clearing local database and disabling auto-sync...", { id: 'wipe-data' });

                    // 1. Disable Auto-Sync FIRST to prevent listeners from re-fetching
                    setAutoSyncEnabled(false);

                    const stores = [
                        'patients', 'staff', 'expenses', 'clinicSettings',
                        'queue', 'appointments', 'inventory', 'sales',
                        'bills', 'treatments', 'roles', 'salaryPayments',
                        'attendance', 'transactions', 'purchases'
                    ];

                    for (const store of stores) {
                        await clearDataStore(store);
                    }

                    toast.success("Local data cleared and Auto-Sync disabled.", { id: 'wipe-data' });

                    // Optional: reload to ensure clean state
                    setTimeout(() => window.location.reload(), 1500);
                } catch (error) {
                    console.error("Wipe failed:", error);
                    toast.error("Failed to clear local data.", { id: 'wipe-data' });
                }
            }
        }
    };

    const toggleAutoSync = () => {
        setAutoSyncEnabled(!autoSyncEnabled);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Backup &amp; Restore
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Cloud Sync Status */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-6">
                        <div>
                            <p className="font-medium">Cloud Connectivity</p>
                            <p className="text-sm text-muted-foreground">
                                {isOnline ? 'Connected to Cloud' : 'Offline Mode'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={manualCloudRestore} className="gap-2">
                                <CloudDownload className="w-4 h-4" />
                                Restore Cloud
                            </Button>
                            <Button
                                variant={autoSyncEnabled ? "outline" : "default"}
                                onClick={toggleAutoSync}
                                className="gap-2"
                            >
                                <RefreshCw className={autoSyncEnabled ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                                {autoSyncEnabled ? 'Auto-Sync Active' : 'Enable Auto-Sync'}
                            </Button>
                        </div>
                    </div>

                    {/* Full System Backup / Restore */}
                    <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-muted/30 rounded-lg gap-4">
                        <div>
                            <p className="font-medium text-blue-800">Full System Backup</p>
                            <p className="text-xs text-muted-foreground">Export or restore all data as a single file</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <Button
                                variant="default"
                                onClick={() => exportToJSON('complete_db_backup')}
                                className="flex-1 md:flex-none gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                <Download className="w-4 h-4" />
                                Download Backup
                            </Button>

                            <input
                                type="file"
                                id="import-complete-backup"
                                className="hidden"
                                accept=".json"
                                onChange={(e) => handleFileChange(e, 'complete_db_backup')}
                            />
                            <Button
                                variant="default"
                                onClick={() => (document.getElementById('import-complete-backup') as HTMLInputElement)?.click()}
                                className="flex-1 md:flex-none gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Upload className="w-4 h-4" />
                                Restore Backup
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-red-100 bg-red-50/10">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-red-600 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                DANGER ZONE
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                                Irreversible action. Clears all local data.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleClearDatabase}
                            className="font-bold gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            DELETE ALL DATA
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}