'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Lock,
  User,
  Plus,
  Edit,
  Trash2,
  Database,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Key,
  Info
} from 'lucide-react';
import { LicenseModal } from '@/components/modals/LicenseModal';
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Treatment, User as UserType } from '@/types';
import TreatmentFormModal from '@/components/modals/TreatmentFormModal';
import { useAuth } from '@/context/AuthContext';
import OperatorChangePassword from '@/components/settings/OperatorChangePassword';
import DataSyncSection from '@/components/settings/DataSyncSection';
import LicenseSection from '@/components/settings/LicenseSection';
import { useData } from '@/context/DataContext';

// Format currency function
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PKR'
  }).format(amount);
};

export default function OperatorSettings() {
  const { changePassword } = useAuth();
  const {
    patients,
    treatments: contextTreatments,
    updateLocal,
    deleteLocal,
    exportToCSV,
    importFromCSV,
    restoreLocalFromCloud,
    manualCloudRestore,
    licenseStatus,
    licenseDaysLeft,
    licenseKey,
    licenseExpiryDate,
    roles,
    exportToJSON,
    importFromJSON
  } = useData();

  const [activeTab, setActiveTab] = useState('security');

  // Use context data directly
  const treatments = contextTreatments || [];

  // Local state for UI forms/backups only
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const [isEditingTreatment, setIsEditingTreatment] = useState(false);

  const [userInfo, setUserInfo] = useState<UserType | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');





  // Load user info from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const parsed = JSON.parse(stored) as UserType;
      setUserInfo(parsed);
    }
  }, []);

  // No manual loadData useEffect needed for treatments/clinicSettings as useData handles it.
  useEffect(() => {
    // Synchronize current user info
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const parsed = JSON.parse(stored) as UserType;
      setUserInfo(parsed);
    }
  }, []);

  // Manual Sync (Optional now, as it happens automatically)
  const handleSync = async () => {
    toast.info('Synchronization is handled automatically in the background.');
  };






  // Note: CSV import is now handled inline in the Backup tab with importFromCSV from DataContext

  // Handle treatment CRUD
  const handleAddTreatment = () => {
    setSelectedTreatment(null);
    setIsEditingTreatment(false);
    setShowTreatmentForm(true);
  };

  const handleEditTreatment = (treatment: Treatment) => {
    setSelectedTreatment(treatment);
    setIsEditingTreatment(true);
    setShowTreatmentForm(true);
  };

  const handleDeleteTreatment = async (treatment: Treatment) => {
    if (confirm(`Delete treatment "${treatment.name}"?`)) {
      try {
        await deleteLocal('treatments', treatment.id);
        toast.success(`Treatment "${treatment.name}" deleted`);
      } catch (error) {
        console.error('Failed to delete treatment:', error);
        toast.error('Failed to delete treatment');
      }
    }
  };

  const handleSaveTreatment = async (treatmentData: any) => {
    // Check for duplicates
    if (!isEditingTreatment) {
      const exists = treatments.some(t => t.name.toLowerCase() === treatmentData.name.toLowerCase());
      if (exists) {
        toast.error("This treatment already exists.");
        return;
      }
    }

    let updatedTreatment: Treatment;
    if (isEditingTreatment && selectedTreatment) {
      updatedTreatment = {
        ...selectedTreatment,
        name: treatmentData.name,
        fee: parseFloat(treatmentData.fee),
        category: treatmentData.category,
        duration: parseInt(treatmentData.duration),
        description: treatmentData.description
      };
    } else {
      updatedTreatment = {
        id: Date.now().toString(),
        name: treatmentData.name,
        fee: parseFloat(treatmentData.fee),
        category: treatmentData.category,
        duration: parseInt(treatmentData.duration),
        description: treatmentData.description,
        isActive: true,
        createdAt: new Date().toISOString()
      };
    }

    try {
      await updateLocal('treatments', updatedTreatment);
      toast.success(`Treatment "${treatmentData.name}" saved`);
    } catch (error) {
      console.error('Failed to save treatment:', error);
      toast.error('Failed to save treatment');
    }

    setShowTreatmentForm(false);
  };

  const handleAddRole = async () => {
    if (!newRoleTitle.trim()) {
      toast.error("Role title cannot be empty");
      return;
    }

    // Check duplicate
    if (roles && roles.some((r: any) => r.title.toLowerCase() === newRoleTitle.trim().toLowerCase())) {
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
    <div className="space-y-6 p-4 md:p-6">
      {/* Header with Sync */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage clinic settings and configurations</p>
        </div>
        <div className="flex gap-2">
        </div>
      </div>

      {/* Tabs - Only 4 tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>

          <TabsTrigger value="clinic-features">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4"><Database className="w-4 h-4" /></span>
              <span>Clinic Features</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="w-4 h-4 mr-2" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="license">
            <Key className="w-4 h-4 mr-2" />
            License
          </TabsTrigger>
        </TabsList>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium mb-4">User Information</h3>
            {userInfo ? (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="w-6 h-6 text-primary" />
                  <div>
                    <p className="font-medium">{userInfo.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      Role: {userInfo.role}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No user session active</p>
            )}

            <h3 className="text-lg font-medium mb-4">Change Password</h3>
            {userInfo && <OperatorChangePassword userId={userInfo.role} />}
          </div>
        </TabsContent>



        {/* Treatments Tab */}
        <TabsContent value="clinic-features" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Clinic Features</h3>
            <Button onClick={handleAddTreatment} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Treatment
            </Button>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium">Treatment</th>
                    <th className="text-left p-3 font-medium">Fee</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((treatment) => (
                    <tr key={treatment.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{treatment.name}</td>
                      <td className="p-3">{formatCurrency(treatment.fee)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTreatment(treatment)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTreatment(treatment)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Roles Section */}
          <div className="bg-white rounded-lg border p-6 mt-6">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Staff Roles
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">New Role Title</p>
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
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Role Title</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles && roles.length > 0 ? (
                      roles.map((role: any) => (
                        <tr key={role.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{role.title}</td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRole(role.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="text-center py-4 text-muted-foreground">
                          No custom roles defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <div className="max-w-4xl mx-auto">
            <DataSyncSection />
          </div>
        </TabsContent>

        {/* License Tab */}
        <TabsContent value="license" className="space-y-6">
          <LicenseSection />
        </TabsContent>
      </Tabs>

      {/* License Modal */}
      <LicenseModal open={showLicenseModal} onOpenChange={setShowLicenseModal} />

      {/* Treatment Form Modal */}
      {
        showTreatmentForm && (
          <TreatmentFormModal
            open={showTreatmentForm}
            onClose={() => setShowTreatmentForm(false)}
            onSubmit={handleSaveTreatment}
            treatment={selectedTreatment}
            isEditing={isEditingTreatment}
          />
        )
      }
    </div >
  );
}