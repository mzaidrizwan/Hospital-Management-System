import React, { useState } from 'react';
import { Settings, Shield, Database, Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const { treatments, expenses, staff, updateLocal, deleteLocal, exportToCSV, importFromCSV } = useData();
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);

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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure clinic and system settings</p>
      </div>

      <div className="grid gap-6">
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
                <p className="font-medium">Last Sync</p>
                <p className="text-sm text-muted-foreground">Just now</p>
              </div>
              <Button variant="outline">Sync Now</Button>
            </div>
          </CardContent>
        </Card>

        {/* Export/Import Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Export/Import Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Expenses */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Expenses</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(expenses, 'expenses_backup.csv')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              </div>

              {/* Export Staff */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">Staff</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(staff, 'staff_backup.csv')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              </div>
            </div>

            {/* Import Section */}
            <div className="mt-4 p-4 border rounded-lg">
              <h4 className="font-medium mb-3">Import Data</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Collection</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg mb-3"
                    id="adminImportCollectionSelector"
                  >
                    <option value="expenses">Expenses</option>
                    <option value="staff">Staff</option>
                    <option value="patients">Patients</option>
                    <option value="treatments">Treatments</option>
                  </select>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-3">Upload CSV file</p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const selector = document.getElementById('adminImportCollectionSelector') as HTMLSelectElement;
                        const collectionName = selector.value;

                        const toastId = toast.loading("Importing data...");
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
                    <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                      Choose File
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Master Treatment List */}
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
            <div className="rounded-md border">
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
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(treatment.fee)}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user && <AdminChangePassword userId={user.role} />}
          </CardContent>
        </Card>
      </div>
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
