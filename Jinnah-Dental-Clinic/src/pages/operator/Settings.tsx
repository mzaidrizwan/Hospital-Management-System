'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  Download,
  Upload,
  Lock,
  User,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Search,
  Database,
  Settings as SettingsIcon,
  FileText,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Treatment } from '@/types';
import TreatmentFormModal from '@/components/modals/TreatmentFormModal';
import Papa from 'papaparse';
import { useAuth } from '@/context/AuthContext';

// Firebase
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query
} from 'firebase/firestore';

// IndexedDB Utilities
import { saveToLocal, getFromLocal, deleteFromLocal } from '@/services/indexedDbUtils';

// Firebase sync helpers
const syncToFirebase = (collectionName: string, item: any) => {
  setDoc(doc(db, collectionName, item.id || item.role), item).catch(console.error);
};

const loadFromFirebase = async (collectionName: string): Promise<any[]> => {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (err) {
    console.error("Firebase load failed:", err);
    return [];
  }
};

// Format currency function
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export default function OperatorSettings() {
  const { changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('security');
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const [isEditingTreatment, setIsEditingTreatment] = useState(false);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Password Change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(false);

  // User info from localStorage
  const [userInfo, setUserInfo] = useState<{ role: string; name: string } | null>(null);

  // Clinic Settings
  const [clinicData, setClinicData] = useState({
    id: 'clinic-settings',
    clinicName: '',
    address: '',
    phone: '',
    email: '',
    taxRate: '',
    currency: 'USD',
    businessHours: ''
  });

  // Backup Selection
  const [backupSelection, setBackupSelection] = useState({
    patients: true,
    appointments: true,
    bills: true,
    inventory: true,
    staff: true,
    treatments: true,
    expenses: true,
  });

  // Load user info from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      const parsed = JSON.parse(stored);
      setUserInfo({ role: parsed.role, name: parsed.name });
    }
  }, []);

  // Auto sync if online
  useEffect(() => {
    if (navigator.onLine) {
      handleSync();
    } else {
      toast.warning('Offline mode: Using local data');
    }
  }, []);

  // Load data on mount: Local first
  useEffect(() => {
    async function loadLocalData() {
      let localTreatments = await getFromLocal('treatments') as Treatment[];
      setTreatments(localTreatments);

      let localClinic = await getFromLocal('clinicSettings', 'clinic-settings');
      if (localClinic) {
        setClinicData(localClinic);
      }

      let localBackups = await getFromLocal('backups') as any[];
      setBackupHistory(localBackups);
    }
    loadLocalData().catch(console.error);
  }, []);

  // Manual Sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const remoteTreatments = await loadFromFirebase('treatments') as Treatment[];
      setTreatments(remoteTreatments);
      for (const item of remoteTreatments) await saveToLocal('treatments', item);

      const remoteClinicSnap = await getDocs(query(collection(db, 'clinicSettings')));
      let remoteClinic = clinicData;
      if (!remoteClinicSnap.empty) {
        remoteClinic = remoteClinicSnap.docs[0].data();
      }
      setClinicData(remoteClinic);
      await saveToLocal('clinicSettings', remoteClinic);

      const remoteBackups = await loadFromFirebase('backups');
      setBackupHistory(remoteBackups);
      for (const item of remoteBackups) await saveToLocal('backups', item);

      toast.success('Settings synced from Firebase!');
    } catch (err) {
      toast.error('Sync failed. Check connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Validate current password in real-time
  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.password === passwordData.currentPassword) {
      setIsCurrentPasswordValid(true);
    } else {
      setIsCurrentPasswordValid(false);
    }
  }, [passwordData.currentPassword]);

  // Handle change password
  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.role) {
      toast.error('No active user session');
      return;
    }

    const success = await changePassword(
      currentUser.role,
      passwordData.currentPassword,
      passwordData.newPassword
    );

    if (success) {
      toast.success('Password changed successfully');

      localStorage.setItem('currentUser', JSON.stringify({
        ...currentUser,
        password: passwordData.newPassword
      }));

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsCurrentPasswordValid(false);
    } else {
      toast.error('Current password is incorrect or error occurred');
    }
  };

  // Handle save clinic settings
  const handleSaveClinicSettings = async () => {
    await saveToLocal('clinicSettings', clinicData);
    syncToFirebase('clinicSettings', clinicData);
    toast.success('Clinic settings saved');
  };

  // Toggle all backup items
  const toggleAllBackup = (checked: boolean) => {
    setBackupSelection({
      patients: checked,
      appointments: checked,
      bills: checked,
      inventory: checked,
      staff: checked,
      treatments: checked,
      expenses: checked,
    });
  };

  // Handle backup
  const handleBackup = async () => {
    const selectedItems = Object.entries(backupSelection)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    if (selectedItems.length === 0) {
      toast.error('Select at least one item to backup');
      return;
    }

    const newBackup = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: selectedItems.length === Object.keys(backupSelection).length ? 'full' : 'partial',
      size: `${Math.floor(Math.random() * 50 + 10)} MB`,
      status: 'success',
      items: selectedItems
    };

    setBackupHistory(prev => [newBackup, ...prev]);

    // Local save
    await saveToLocal('backups', newBackup);

    // Background sync
    syncToFirebase('backups', newBackup);

    // Download JSON and CSV
    downloadBackup(newBackup, 'json');
    downloadBackup(newBackup, 'csv');

    toast.success('Backup created successfully');
  };

  // Handle download backup (JSON or CSV)
  const downloadBackup = (backup: any, format: 'json' | 'csv') => {
    let dataStr;
    if (format === 'json') {
      const backupData = {
        timestamp: backup.date,
        items: backup.items,
        treatments: treatments
      };
      dataStr = JSON.stringify(backupData, null, 2);
    } else {
      const csvData = Papa.unparse(treatments);
      dataStr = csvData;
    }

    const type = format === 'json' ? 'application/json' : 'text/csv';
    const dataBlob = new Blob([dataStr], { type });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clinic_backup_${format}_${new Date(backup.date).toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle download individual data
  const handleDownloadData = async (type: string) => {
    let data: any = {};

    switch (type) {
      case 'patients':
        data = { patients: [] };
        break;
      case 'doctors':
        data = { doctors: [] };
        break;
      case 'treatments':
        data = { treatments };
        break;
      case 'bills':
        data = { bills: [] };
        break;
      case 'staff':
        data = { staff: [] };
        break;
      default:
        data = { message: 'Data export' };
    }

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported`);
  };

  // Handle restore backup
  const handleRestoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(e.target?.result as string);
          if (data.treatments) {
            setTreatments(data.treatments);
            for (const t of data.treatments) {
              await saveToLocal('treatments', t);
              syncToFirebase('treatments', t);
            }
          }
          toast.success('Backup restored successfully');
        } else if (file.name.endsWith('.csv')) {
          Papa.parse(e.target?.result as string, {
            header: true,
            complete: (results: any) => {
              setTreatments(results.data);
              results.data.forEach(async (t: any) => {
                await saveToLocal('treatments', t);
                syncToFirebase('treatments', t);
              });
              toast.success('CSV restored successfully');
            }
          });
        } else {
          toast.error('Unsupported file format');
        }
      } catch (error) {
        toast.error('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

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
      setTreatments(prev => prev.filter(t => t.id !== treatment.id));

      await deleteItem('treatments', treatment.id);

      deleteDoc(doc(db, 'treatments', treatment.id)).catch(console.error);

      toast.success(`Treatment "${treatment.name}" deleted`);
    }
  };

  const handleSaveTreatment = async (treatmentData: any) => {
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
      setTreatments(prev => prev.map(t => t.id === selectedTreatment.id ? updatedTreatment : t));
    } else {
      updatedTreatment = {
        id: `t${Date.now()}`,
        name: treatmentData.name,
        fee: parseFloat(treatmentData.fee),
        category: treatmentData.category,
        duration: parseInt(treatmentData.duration),
        description: treatmentData.description
      };
      setTreatments(prev => [...prev, updatedTreatment]);
    }

    await saveToLocal('treatments', updatedTreatment);

    setShowTreatmentForm(false);

    syncToFirebase('treatments', updatedTreatment);

    toast.success(`Treatment "${treatmentData.name}" saved`);
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
          <Button
            onClick={handleSync}
            variant="outline"
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Settings
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleBackup}
          >
            <Database className="w-4 h-4" />
            Create Backup
          </Button>
        </div>
      </div>

      {/* Tabs - Only 4 tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="clinic">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Clinic
          </TabsTrigger>
          <TabsTrigger value="treatments">
            <FileText className="w-4 h-4 mr-2" />
            Treatments
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="w-4 h-4 mr-2" />
            Backup
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
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    disabled={!isCurrentPasswordValid}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={!isCurrentPasswordValid}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {!isCurrentPasswordValid && passwordData.currentPassword && (
                  <p className="text-xs text-destructive mt-1">Enter correct current password first</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    disabled={!isCurrentPasswordValid}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={!isCurrentPasswordValid}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={!isCurrentPasswordValid || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Clinic Tab */}
        <TabsContent value="clinic" className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium mb-4">Clinic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Clinic Name</label>
                <Input
                  value={clinicData.clinicName}
                  onChange={(e) => setClinicData({ ...clinicData, clinicName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <Input
                  value={clinicData.address}
                  onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <Input
                    value={clinicData.phone}
                    onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input
                    type="email"
                    value={clinicData.email}
                    onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tax Rate (%)</label>
                  <Input
                    type="number"
                    value={clinicData.taxRate}
                    onChange={(e) => setClinicData({ ...clinicData, taxRate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select
                    value={clinicData.currency}
                    onChange={(e) => setClinicData({ ...clinicData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="PKR">PKR (₨)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Business Hours</label>
                  <Input
                    value={clinicData.businessHours}
                    onChange={(e) => setClinicData({ ...clinicData, businessHours: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={handleSaveClinicSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Clinic Settings
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Treatments Tab */}
        <TabsContent value="treatments" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Manage Treatments</h3>
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
        </TabsContent>

        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Backup Settings */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium mb-4">Backup Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Object.values(backupSelection).every(v => v)}
                        onChange={(e) => toggleAllBackup(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="font-medium">Select All</span>
                    </label>
                  </div>

                  {Object.entries(backupSelection).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setBackupSelection({ ...backupSelection, [key]: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadData(key)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Restore Backup */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium mb-4">Restore Backup</h3>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Upload backup file (.json or .csv format)</p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".json,.csv"
                        onChange={handleRestoreBackup}
                        className="hidden"
                      />
                      <Button variant="outline" asChild>
                        <span>Choose File</span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Backup History */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium mb-4">Backup History</h3>
                <div className="space-y-3">
                  {backupHistory.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{new Date(backup.date).toLocaleDateString()}</div>
                        <div className="text-sm text-gray-500">
                          {backup.type} • {backup.size}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {backup.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => handleDownloadData('patients')}
                  >
                    <Download className="w-4 h-4" />
                    Export Patients
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => handleDownloadData('doctors')}
                  >
                    <Download className="w-4 h-4" />
                    Export Doctors
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => handleDownloadData('treatments')}
                  >
                    <Download className="w-4 h-4" />
                    Export Treatments
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => handleBackup()}
                  >
                    <Database className="w-4 h-4" />
                    Create Full Backup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Treatment Form Modal */}
      {showTreatmentForm && (
        <TreatmentFormModal
          open={showTreatmentForm}
          onClose={() => setShowTreatmentForm(false)}
          onSubmit={handleSaveTreatment}
          treatment={selectedTreatment}
          isEditing={isEditingTreatment}
        />
      )}
    </div>
  );
}