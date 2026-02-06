'use client';

import React from 'react';
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
import { cn } from '@/lib/utils';

interface DoctorSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    label?: string;
    showAllFallback?: boolean;
}

export default function DoctorSelect({
    value,
    onValueChange,
    className,
    label = "Assign Doctor",
    showAllFallback = true
}: DoctorSelectProps) {
    const { presentDoctors, allDoctors, isAnyDoctorPresent } = useAvailableDoctors();

    const doctorsList = isAnyDoctorPresent ? presentDoctors : (showAllFallback ? allDoctors : []);

    return (
        <div className={cn("space-y-2", className)}>
            <Label className="flex items-center gap-2 font-medium">
                <User className="w-4 h-4 text-primary" />
                {label}
            </Label>

            {!isAnyDoctorPresent && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 text-amber-800 rounded border border-amber-200 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>No doctors marked &apos;Present&apos; today.</span>
                </div>
            )}

            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger className="w-full">
                    <SelectValue>
                        {value && doctorsList.length > 0
                            ? (doctorsList.find(d => String(d.id) === String(value))?.name || "Select doctor...")
                            : "Select doctor..."}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {doctorsList.map(doc => (
                        <SelectItem key={doc.id} value={doc.id}>
                            {doc.name} - {doc.role || 'General'}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
