import React, { useState } from 'react';
import { Settings, Shield, Database, Plus, Edit, Trash2, Download, Upload, CloudDownload, Key, ShieldCheck, ShieldAlert, Lock, Calendar, Info, RefreshCw, Briefcase, UserPlus } from 'lucide-react';
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
import DataSyncSection from '@/components/settings/DataSyncSection';
import LicenseSection from '@/components/settings/LicenseSection';
import TreatmentFormModal from '@/components/modals/TreatmentFormModal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Treatment } from '@/types';

export default function AdminSettings() {
  const { user } = useAuth();
  const { treatments, expenses, staff, roles, updateLocal, deleteLocal, exportToCSV, importFromCSV, restoreLocalFromCloud, manualCloudRestore, licenseStatus, licenseDaysLeft, licenseKey, licenseExpiryDate } = useData();
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [newRoleTitle, setNewRoleTitle] = useState('');

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
      // Check for duplicates
      if (!editingTreatment) {
        const exists = treatments.some(t => t.name.toLowerCase() === data.name.toLowerCase());
        if (exists) {
          toast.error("This treatment already exists.");
          return;
        }
      }

      const treatmentData: Treatment = {
        id: editingTreatment ? editingTreatment.id : Date.now().toString(),
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

  const handleAddRole = async () => {
    if (!newRoleTitle.trim()) {
      toast.error("Role title cannot be empty");
      return;
    }

    // Check duplicate
    if (roles && roles.some((r: any) => r && r.title && r.title.toLowerCase() === newRoleTitle.trim().toLowerCase())) {
      toast.error("Role already exists");
      return;
    }

    try {
      const newRole = {
        id: `role-${Date.now()}`,
        title: newRoleTitle.trim(),
        createdAt: new Date().toISOString()
      };
      await updateLocal('roles', newRole);
      setNewRoleTitle('');
      toast.success("Role added successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add role");
    }
  };

  const handleDeleteRole = async (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        await deleteLocal('roles', id);
        toast.success("Role deleted");
      } catch (error) {
        toast.error("Failed to delete role");
      }
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
          <TabsTrigger value="clinic-features" className="data-[state=active]:bg-white data-[state=active]:shadow-sm border py-2 capitalize font-bold">
            <Briefcase className="w-4 h-4 mr-2" />
            Clinic Features
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
        <TabsContent value="clinic-features" className="space-y-6">
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


          {/* Staff Roles Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Staff Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>New Role Title</Label>
                    <Input
                      placeholder="e.g. Senior Doctor, Receptionist"
                      value={newRoleTitle}
                      onChange={(e) => setNewRoleTitle(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddRole} className="gap-1">
                    <Plus className="w-4 h-4" /> Add Role
                  </Button>
                </div>

                <div className="rounded-md border overflow-hidden mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role Title</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles && roles.length > 0 ? (
                        roles.map((role: any) => (
                          <TableRow key={role.id}>
                            <TableCell className="font-medium">{role.title}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRole(role.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                            No custom roles defined.
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
          <DataSyncSection />
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
          <LicenseSection />
        </TabsContent>
      </Tabs >

      <LicenseModal open={showLicenseModal} onOpenChange={setShowLicenseModal} />

      <TreatmentFormModal
        open={isTreatmentModalOpen}
        onClose={() => setIsTreatmentModalOpen(false)}
        onSubmit={handleSaveTreatment}
        treatment={editingTreatment}
        isEditing={!!editingTreatment}
      />
    </div >
  );
}
