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
        isOnline
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
        if (confirm("WARNING: This will delete ALL local data (Patients, Staff, Expenses, Settings). Are you absolutely sure?")) {
            if (confirm("Double check: This action cannot be undone unless you have a backup. Proceed?")) {
                const stores = [
                    'patients', 'staff', 'expenses', 'clinicSettings',
                    'queue', 'appointments', 'inventory', 'sales',
                    'bills', 'treatments', 'roles', 'salaryPayments',
                    'attendance', 'transactions', 'purchases'
                ];

                for (const store of stores) {
                    await clearDataStore(store);
                }
                toast.success("Database cleared successfully");
            }
        }
    };

    const rows = [
        { label: 'Patient Details', store: 'patients' },
        { label: 'Staff', store: 'staff' },
        { label: 'Expenses', store: 'expenses' },
        { label: 'Inventory', store: 'inventory_full' },
        { label: 'Clinic Features', store: 'clinicSettings' },
    ];

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
                            <Button variant="default" className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Sync Now
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rows.map((row) => (
                            <div key={row.store} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors gap-4">
                                <span className="font-bold text-sm uppercase tracking-wide text-muted-foreground sm:w-1/3">
                                    {row.label}
                                </span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {user?.role === 'admin' && (
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
