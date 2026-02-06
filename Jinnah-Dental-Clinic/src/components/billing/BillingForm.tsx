'use client';

import React, { useState } from 'react';
import { useAvailableDoctors } from '@/hooks/useAvailableDoctors';
import { Label } from '@/components/ui/label';
import { AlertTriangle, User } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

export default function BillingForm() {
    const { presentDoctors, isAnyDoctorPresent } = useAvailableDoctors();
    const [selectedDoctor, setSelectedDoctor] = useState<string>('');

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="doctor-select" className="flex items-center gap-2 font-semibold">
                        <User className="w-4 h-4 text-primary" />
                        Assign Doctor
                    </Label>
                    {!isAnyDoctorPresent && (
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            OFFLINE
                        </span>
                    )}
                </div>

                {/* Dynamic Doctor Selection */}
                {!isAnyDoctorPresent ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-sm animate-in fade-in slide-in-from-top-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>No doctors marked as &apos;Present&apos; today. Please check attendance.</span>
                    </div>
                ) : (
                    <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                        <SelectTrigger id="doctor-select" className="w-full">
                            <SelectValue placeholder="Select available doctor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {presentDoctors.map(doc => (
                                <SelectItem key={doc.id} value={doc.id}>
                                    {doc.name} - {doc.role || 'General'}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Additional Billing Fields could go here */}
            <p className="text-[10px] text-muted-foreground text-center">
                Only doctors marked &apos;Present&apos; in attendance are shown.
            </p>
        </div>
    );
}
