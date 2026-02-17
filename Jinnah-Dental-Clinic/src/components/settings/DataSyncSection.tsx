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

    const handleImportClick = (collectionName: string) => {
        const input = document.getElementById(`import-${collectionName}`) as HTMLInputElement;
        if (input) input.click();
    };

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

    const rows = [
        { label: 'Patient Details', store: 'patients' },
        { label: 'Staff', store: 'staff' },
        { label: 'Expenses', store: 'expenses' },
        { label: 'Inventory', store: 'inventory_full' },
        { label: 'Clinic Features', store: 'clinic_features_combined' },
    ];

    const handleCreateAllBackups = () => {
        rows.forEach((row, index) => {
            // Increased timeout to 800ms for browser reliability when downloading multiple files
            setTimeout(() => {
                exportToJSON(row.store);
            }, index * 800);
        });
        toast.info("Creating multiple backup files...");
    };

    const handleImportAllClick = () => {
        const input = document.getElementById('import-all-backups') as HTMLInputElement;
        if (input) input.click();
    };

    const handleImportAllChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        toast.loading("Importing all files...", { id: 'import-all' });

        let importedCount = 0;
        let errors = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const name = file.name.toLowerCase();

            let collection = '';
            if (name.includes('patients_backup')) collection = 'patients';
            else if (name.includes('staff_backup')) collection = 'staff';
            else if (name.includes('expenses_backup')) collection = 'expenses';
            else if (name.includes('full_inventory_backup')) collection = 'inventory_full';
            else if (name.includes('clinic_features_backup')) collection = 'clinic_features_combined';
            else if (name.includes('clinicsettings_backup')) collection = 'clinicSettings';

            if (collection) {
                try {
                    await importFromJSON(file, collection);
                    importedCount++;
                } catch (err) {
                    console.error(`Failed to import ${file.name}:`, err);
                    errors++;
                }
            } else {
                console.warn(`Could not determine collection for file: ${file.name}`);
            }
        }

        if (errors > 0) {
            toast.error(`Imported ${importedCount} files. ${errors} failed.`, { id: 'import-all' });
        } else if (importedCount > 0) {
            toast.success(`Successfully imported ${importedCount} backup files!`, { id: 'import-all' });
        } else {
            toast.error("No valid backup files found in selection.", { id: 'import-all' });
        }

        e.target.value = ''; // Reset
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Backup & Restore
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

                    {/* Unified Backup/Restore Buttons */}
                    <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-muted/30 rounded-lg mb-6 gap-4">
                        <div>
                            <p className="font-medium text-blue-800">Unified Actions</p>
                            <p className="text-xs text-muted-foreground">Manage all category data at once</p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <Button
                                variant="default"
                                onClick={handleCreateAllBackups}
                                className="flex-1 md:flex-none gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Download className="w-4 h-4" />
                                Create All Backup Files
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleImportAllClick}
                                className="flex-1 md:flex-none gap-2 bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Upload className="w-4 h-4" />
                                Import All Backup Files
                            </Button>
                            <input
                                type="file"
                                id="import-all-backups"
                                className="hidden"
                                accept=".json"
                                multiple
                                onChange={handleImportAllChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rows.map((row) => (
                            <div key={row.store} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors gap-4">
                                <span className="font-bold text-sm uppercase tracking-wide text-muted-foreground sm:w-1/3">
                                    {row.label}
                                </span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {(user?.role === 'admin' || user?.role === 'operator') && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportToJSON(row.store)}
                                            className="flex-1 sm:flex-none gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-100"
                                        >
                                            <Download className="w-4 h-4" />
                                            Create Backup
                                        </Button>
                                    )}

                                    <input
                                        type="file"
                                        id={`import-${row.store}`}
                                        className="hidden"
                                        accept=".json"
                                        onChange={(e) => handleFileChange(e, row.store)}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleImportClick(row.store)}
                                        className="flex-1 sm:flex-none gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-100"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Import File
                                    </Button>
                                </div>
                            </div>
                        ))}
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