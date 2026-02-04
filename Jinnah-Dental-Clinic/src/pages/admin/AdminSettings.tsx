import React, { useState } from 'react';
import { Settings, Shield, Database, Plus, Edit, Trash2, Download, Upload, CloudDownload, Key, ShieldCheck, ShieldAlert, Lock, Calendar, Info, RefreshCw } from 'lucide-react';
import { LicenseModal } from '@/components/modals/LicenseModal';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import AdminChangePassword from '@/components/settings/AdminChangePassword';
import TreatmentFormModal from '@/components/modals/TreatmentFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Treatment } from '@/types';

export default function AdminSettings() {
  const { user } = useAuth();
  const { treatments, expenses, staff, updateLocal, deleteLocal, exportToCSV, importFromCSV, restoreLocalFromCloud, manualCloudRestore, licenseStatus, licenseDaysLeft, licenseKey, licenseExpiryDate } = useData();
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  const handleAddTreatment = () => {
    setEditingTreatment(null);
    setIsTreatmentModalOpen(true);
  };

  const handleEditTreatment = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setIsTreatmentModalOpen(true);
  };

  const handleDeleteTreatment = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete treatment "${name}"?`)) {
      try {
        await deleteLocal('treatments', id);
        toast.success(`Treatment "${name}" deleted`);
      } catch (error) {
        console.error('Failed to delete treatment:', error);
        toast.error('Failed to delete treatment');
      }
    }
  };

  const handleSaveTreatment = async (data: any) => {
    try {
      const treatmentData: Treatment = {
        id: editingTreatment ? editingTreatment.id : `t${Date.now()}`,
        name: data.name,
        fee: parseFloat(data.fee),
        duration: parseInt(data.duration),
        category: data.category,
        description: data.description,
        createdAt: editingTreatment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateLocal('treatments', treatmentData);
      toast.success(editingTreatment ? 'Treatment updated' : 'Treatment added');
      setIsTreatmentModalOpen(false);
    } catch (error) {
      console.error('Failed to save treatment:', error);
      toast.error('Failed to save treatment');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground">Configure clinic and system settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="general" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="treatments" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Plus className="w-4 h-4 mr-2" />
            Treatments
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Database className="w-4 h-4 mr-2" />
            Data & Sync
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="license" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Key className="w-4 h-4 mr-2" />
            License
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive alerts for appointments and stock</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Token Generation</Label>
                  <p className="text-sm text-muted-foreground">Automatically generate tokens for walk-ins</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatments Tab */}
        <TabsContent value="treatments" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Master Treatment List
              </CardTitle>
              <Button onClick={handleAddTreatment} size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Add Treatment
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Treatment Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {treatments && treatments.length > 0 ? (
                        treatments.map((treatment) => (
                          <TableRow key={treatment.id}>
                            <TableCell className="font-medium">{treatment.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{treatment.category || 'General'}</Badge>
                            </TableCell>
                            <TableCell>
                              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(treatment.fee)}
                            </TableCell>
                            <TableCell>{treatment.duration} mins</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditTreatment(treatment)}
                                >
                                  <Edit className="w-4 h-4 text-blue-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTreatment(treatment.id, treatment.name)}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            No treatments found. Add your first treatment.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data & Sync Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data & Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Cloud Connectivity</p>
                  <p className="text-sm text-muted-foreground">Keep your local data backed up to the cloud</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={manualCloudRestore} className="gap-2">
                    <CloudDownload className="w-4 h-4" />
                    Restore from Cloud
                  </Button>
                  <Button variant="default" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Export/Import Data (CSV)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                  <span className="font-medium">Expenses</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(expenses, 'expenses_backup.csv')}
                    className="gap-2 font-bold"
                  >
                    <Download className="w-4 h-4" /> Export
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                  <span className="font-medium">Staff</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(staff, 'staff_backup.csv')}
                    className="gap-2 font-bold"
                  >
                    <Download className="w-4 h-4" /> Export
                  </Button>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-primary/5 border-primary/10">
                <h4 className="font-bold mb-4 text-primary uppercase text-xs tracking-widest">Bulk Import Tool</h4>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs mb-2 block font-bold">Select Destination Collection</Label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                      id="adminImportCollectionSelector"
                    >
                      <option value="expenses">Expenses</option>
                      <option value="staff">Staff</option>
                      <option value="patients">Patients</option>
                      <option value="treatments">Treatments</option>
                    </select>
                  </div>

                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-white">
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-3">Drop your CSV file here or click to browse</p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const selector = document.getElementById('adminImportCollectionSelector') as HTMLSelectElement;
                          const collectionName = selector.value;

                          const toastId = toast.loading("Importing records...");
                          importFromCSV(file, collectionName)
                            .then(() => toast.success("Import successful", { id: toastId }))
                            .catch((err) => {
                              console.error(err);
                              toast.error("Import failed", { id: toastId });
                            });

                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                      <span className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-md inline-block">
                        Upload Backup File
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user && <AdminChangePassword userId={user.role} />}
            </CardContent>
          </Card>
        </TabsContent>

        {/* License Tab */}
        <TabsContent value="license" className="space-y-6">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                License Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-muted/40 rounded-2xl border flex items-center gap-4 transition-all hover:shadow-md">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm",
                    licenseStatus === 'valid' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {licenseStatus === 'valid' ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                    <p className="text-xl font-bold leading-none capitalize">
                      {licenseStatus === 'valid' ? 'Active' : 'Attention Needed'}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-muted/40 rounded-2xl border flex items-center gap-4 transition-all hover:shadow-md">
                  <div className="p-3 rounded-2xl shadow-sm bg-blue-100 text-blue-600">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">App Intelligence</p>
                    <p className="text-xl font-bold leading-none">v1.4.0 Elite</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <Label className="text-xs font-black uppercase tracking-widest text-primary">Expiration Benchmark</Label>
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      <Calendar className="w-5 h-5 text-primary/60" />
                      <span className="text-lg font-bold">
                        {licenseExpiryDate
                          ? new Date(licenseExpiryDate).toLocaleDateString()
                          : 'Initializing...'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-inner border w-full md:w-auto text-center">
                    <p className="text-4xl font-black text-primary leading-none mb-1">{licenseDaysLeft}</p>
                    <p className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Days Remaining</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Universal Key</Label>
                  <div className="relative group">
                    <Input
                      value={licenseKey || 'NO_KEY_REGISTERED'}
                      readOnly
                      className="h-12 bg-muted/30 font-mono text-base pr-12 border-2 border-dashed group-hover:border-primary/40 transition-all rounded-xl"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors">
                      <Lock className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-muted-foreground max-w-sm text-center sm:text-left">
                    Renewing your Licence will extend your current subscription seamlessly.
                  </p>
                  <Button
                    onClick={() => setShowLicenseModal(true)}
                    variant="default"
                    className="h-12 px-8 rounded-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
                    disabled={user?.role !== 'admin'}
                    title={user?.role !== 'admin' ? "Only administrators can renew the license" : ""}
                  >
                    <RefreshCw className="w-5 h-5" />
                    Renew License Key
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LicenseModal open={showLicenseModal} onOpenChange={setShowLicenseModal} />

      <TreatmentFormModal
        open={isTreatmentModalOpen}
        onClose={() => setIsTreatmentModalOpen(false)}
        onSubmit={handleSaveTreatment}
        treatment={editingTreatment}
        isEditing={!!editingTreatment}
      />
    </div>
  );
}
