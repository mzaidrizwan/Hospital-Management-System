'use client';

import React, { useState, useMemo } from 'react';
import {
    Search,
    User,
    Phone,
    Calendar,
    DollarSign,
    FileText,
    Eye,
    Edit,
    Trash2,
    UserPlus,
    Download,
    Filter,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useData } from '@/context/DataContext';
import { Patient, QueueItem } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PatientDetails() {
    const { patients, queue, deleteLocal, exportToCSV, addItem } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // Display ALL patients from the store - NO FILTERS
    const displayedPatients = useMemo(() => {
        let result = patients;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = patients.filter(p =>
                p.name?.toLowerCase().includes(term) ||
                p.phone?.toLowerCase().includes(term) ||
                p.patientNumber?.toLowerCase().includes(term)
            );
        }
        // FORCE SORT: Newest Created at the top
        return [...result].sort((a, b) => {
            const dateA = new Date(b.createdAt || b.id || 0).getTime();
            const dateB = new Date(a.createdAt || a.id || 0).getTime();
            return dateA - dateB;
        });
    }, [patients, searchTerm]);

    const handleSendToWaiting = (patient: Patient) => {
        const newQueueItem = {
            ...patient,
            id: `q-${Date.now()}`,
            patientId: patient.id,
            status: 'waiting',
            paymentStatus: 'pending',
            createdAt: new Date().toISOString()
        };
        addItem('queue', newQueueItem);
        toast.success(`${patient.name} sent to Waiting section`, { duration: 2000 });
    };

    const handleDeletePatient = async (patient: Patient) => {
        if (!window.confirm(`Are you sure you want to delete ${patient.name}?`)) return;

        try {
            await deleteLocal('patients', patient.id);
            toast.success(`${patient.name} has been removed`);
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error('Failed to delete patient');
        }
    };

    const handleExportPatients = () => {
        const exportData = patients.map(p => ({
            'Patient Number': p.patientNumber,
            'Name': p.name,
            'Phone': p.phone,
            'Age': p.age || 'N/A',
            'Gender': p.gender || 'N/A',
            'Total Visits': p.totalVisits || 0,
            'Total Paid': p.totalPaid || 0,
            'Pending Balance': p.pendingBalance || 0,
            'Last Visit': p.lastVisit ? format(new Date(p.lastVisit), 'yyyy-MM-dd') : 'Never',
            'Registration Date': p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd') : 'N/A'
        }));

        exportToCSV(exportData, `All_Patients_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        toast.success('Patient data exported successfully');
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    return (
        <div className="space-y-6 p-4 md:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <User className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                            All Patients
                        </h1>
                    </div>
                    <p className="text-muted-foreground font-medium">
                        Complete patient directory - {patients.length} total records
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleExportPatients}
                        className="gap-2 border-gray-200 hover:bg-gray-50 h-11 px-6 font-bold rounded-xl"
                    >
                        <Download className="w-5 h-5" />
                        Export All
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-blue-50/50 border border-blue-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-blue-600 uppercase tracking-widest">
                                    Total Patients
                                </p>
                                <h3 className="text-3xl font-black text-blue-900">{patients.length}</h3>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                                <User className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-green-50/50 border border-green-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-green-600 uppercase tracking-widest">
                                    Total Revenue
                                </p>
                                <h3 className="text-3xl font-black text-green-900">
                                    {formatCurrency(patients.reduce((sum, p) => sum + (p.totalPaid || 0), 0))}
                                </h3>
                            </div>
                            <div className="p-3 bg-green-100 rounded-xl text-green-600">
                                <DollarSign className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-amber-50/50 border border-amber-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">
                                    Pending Balance
                                </p>
                                <h3 className="text-3xl font-black text-amber-900">
                                    {formatCurrency(patients.reduce((sum, p) => sum + (p.pendingBalance || 0), 0))}
                                </h3>
                            </div>
                            <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                                <FileText className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-purple-50/50 border border-purple-100">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-purple-600 uppercase tracking-widest">
                                    Total Visits
                                </p>
                                <h3 className="text-3xl font-black text-purple-900">
                                    {patients.reduce((sum, p) => sum + (p.totalVisits || 0), 0)}
                                </h3>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name, phone, or patient number..."
                    className="pl-10 h-11 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Patient List */}
            {displayedPatients.length === 0 ? (
                <Card className="border-2 border-dashed border-muted/50 py-20">
                    <CardContent className="flex flex-col items-center">
                        <User className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-bold text-muted-foreground">
                            {searchTerm ? 'No patients found' : 'No patients registered yet'}
                        </h3>
                        {searchTerm && (
                            <Button variant="link" onClick={() => setSearchTerm('')}>
                                Clear search
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedPatients.map((patient) => (
                        <Card
                            key={patient.id}
                            className="group hover:shadow-xl transition-all border-none shadow-md overflow-hidden bg-white"
                        >
                            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-purple-500" />
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                            <User className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 tracking-tight">
                                                {patient.name}
                                            </h3>
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">
                                                #{patient.patientNumber}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4 pb-4 border-b">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone className="w-4 h-4" />
                                        {patient.phone || 'No phone'}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Calendar className="w-4 h-4" />
                                        Last Visit: {patient.lastVisit ? format(new Date(patient.lastVisit), 'MMM dd, yyyy') : 'Never'}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                            Total Paid
                                        </p>
                                        <p className="text-sm font-bold text-green-600">
                                            {formatCurrency(patient.totalPaid || 0)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                            Pending
                                        </p>
                                        <p className={`text-sm font-bold ${(patient.pendingBalance || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                            {formatCurrency(patient.pendingBalance || 0)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1 border-green-200 text-green-600 hover:bg-green-50"
                                        onClick={() => handleSendToWaiting(patient)}
                                    >
                                        <UserPlus className="w-3 h-3" />
                                        Send to Waiting
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1 hover:bg-blue-50 text-blue-600"
                                        onClick={() => setSelectedPatient(patient)}
                                    >
                                        <Eye className="w-3 h-3" />
                                        View
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 text-red-600 hover:bg-red-50"
                                        onClick={() => handleDeletePatient(patient)}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
