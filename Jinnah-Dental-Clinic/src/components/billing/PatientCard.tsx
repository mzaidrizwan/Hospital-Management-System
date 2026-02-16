'use client';

import React from 'react';
import {
    Play,
    CheckSquare,
    ArrowLeft,
    Printer,
    Edit,
    Trash2,
    User,
    Phone,
    Clock,
    DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { QueueItem } from '@/types';
import { format } from 'date-fns';
import { useData } from '@/context/DataContext';

interface PatientCardProps {
    patient: QueueItem;
    onUpdateStatus: (id: string, newStatus: 'waiting' | 'in_treatment' | 'completed') => void;
    onEdit: (patient: QueueItem) => void;
    onDelete: (patient: QueueItem) => void;
    onPrint: (patient: QueueItem) => void;
}

export default function PatientCard({
    patient,
    onUpdateStatus,
    onEdit,
    onDelete,
    onPrint
}: PatientCardProps) {
    const { staff } = useData();

    // Normalize status to handle variations (e.g., "in-treatment" vs "in_treatment")
    const status = (patient.status || '').toLowerCase().replace(/[- ]/g, '_');

    // Help determine previous status for "Back" button
    const getPreviousStatus = (currentStatus: string): 'waiting' | 'in_treatment' | 'completed' => {
        const normalized = currentStatus.toLowerCase().replace(/-/g, '_');
        if (normalized === 'completed') return 'in_treatment';
        if (normalized === 'in_treatment') return 'waiting';
        return 'waiting'; // Default fallback
    };

    // Status-based styling
    const getStatusColor = () => {
        switch (status) {
            case 'waiting':
                return 'border-blue-200 bg-blue-50';
            case 'in_treatment':
                return 'border-yellow-200 bg-yellow-50';
            case 'completed':
                return 'border-green-200 bg-green-50';
            default:
                return 'border-gray-200 bg-gray-50';
        }
    };

    const getPaymentBadge = () => {
        const colors = {
            paid: 'bg-green-100 text-green-800 border-green-200',
            partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            pending: 'bg-red-100 text-red-800 border-red-200'
        };
        const paymentStatus = (patient.paymentStatus || 'pending') as keyof typeof colors;
        return colors[paymentStatus] || colors.pending;
    };

    // Render action buttons based on status
    const renderActionButtons = () => {
        const s = (patient.status || "").toLowerCase().trim().replace(/[- ]/g, "_");

        if (s === 'waiting') {
            return (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onUpdateStatus(patient.id, 'in_treatment')} className="gap-1 bg-blue-600">
                        <Play className="w-3 h-3" /> Start
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPrint(patient)} className="gap-1 text-blue-600 border-blue-200">
                        <Printer className="w-3 h-3" /> Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(patient)} className="gap-1">
                        <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(patient)} className="gap-1 text-red-600">
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            );
        }

        if (s === 'in_treatment') {
            return (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(patient.id, 'waiting')} className="gap-1">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPrint(patient)} className="gap-1 text-blue-600">
                        <Printer className="w-3 h-3" /> Print
                    </Button>
                    <Button size="sm" onClick={() => onUpdateStatus(patient.id, 'completed')} className="gap-1 bg-green-600">
                        <CheckSquare className="w-3 h-3" /> Complete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(patient)} className="gap-1">
                        <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(patient)} className="gap-1 text-red-600">
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            );
        }

        if (s === 'completed') {
            return (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onUpdateStatus(patient.id, 'in_treatment')} className="gap-1">
                        <ArrowLeft className="w-3 h-3" /> Back
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onPrint(patient)} className="gap-1 text-blue-600">
                        <Printer className="w-3 h-3" /> Print
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(patient)} className="gap-1 text-red-600">
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            );
        }

        return null;
    };

    return (
        <Card className={`group hover:shadow-lg transition-all border ${getStatusColor()}`}>
            <CardContent className="p-4">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{patient.patientName}</h3>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Phone className="w-3 h-3" />
                                {patient.patientPhone || 'No phone'}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-lg text-primary">#{patient.tokenNumber}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(patient.checkInTime), 'hh:mm a')}
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="space-y-2 mb-3 pb-3 border-b">
                    {patient.treatment && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Treatment:</span>
                            <span className="font-medium">{patient.treatment}</span>
                        </div>
                    )}
                    {patient.doctorId && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Doctor:</span>
                            <span className="font-medium">
                                {staff.find(s => s.id === patient.doctorId)?.name || patient.doctorId || 'Not Assigned'}
                            </span>
                        </div>
                    )}
                    {patient.fee && patient.fee > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Fee:</span>
                            <span className="font-bold text-green-600 flex items-center gap-1">
                                <span className="text-xs font-bold">Rs.</span>
                                {patient.fee.toFixed(2)}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Payment:</span>
                        <Badge variant="outline" className={`text-xs font-medium ${getPaymentBadge()}`}>
                            {patient.paymentStatus.toUpperCase()}
                        </Badge>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                    {renderActionButtons()}
                </div>

                {/* Notes Section (if exists) */}
                {patient.notes && (
                    <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <span className="font-medium">Notes: </span>
                            {patient.notes}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
