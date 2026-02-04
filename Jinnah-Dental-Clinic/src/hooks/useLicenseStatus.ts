'use client';

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { differenceInDays, parseISO, isAfter, startOfDay } from 'date-fns';

export type LicenseStatusType = 'active' | 'warning' | 'expired';

export interface LicenseStatusResult {
    status: LicenseStatusType;
    daysLeft: number;
    isCritical: boolean;
}

/**
 * Calculate the number of days remaining until expiry.
 * If no expiryDate is provided, defaults to 30 days from now.
 */
export function calculateRemainingDays(expiryDate?: string | null): number {
    if (!expiryDate) {
        return 30; // Default to 30 days
    }

    try {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffInTime = expiry.getTime() - now.getTime();
        const diffInDays = Math.ceil(diffInTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffInDays);
    } catch (error) {
        console.error('Error calculating remaining days:', error);
        return 30;
    }
}

/**
 * Hook to calculate and return the real-time license status.
 * This can be used on Dashboards or in layouts to show alerts.
 */
export function useLicenseStatus(): LicenseStatusResult {
    const { licenseExpiryDate } = useData();

    return useMemo(() => {
        const diffInDays = calculateRemainingDays(licenseExpiryDate);
        let status: LicenseStatusType = 'active';

        if (diffInDays <= 0) {
            status = 'expired';
        } else if (diffInDays <= 3) {
            status = 'warning';
        }

        return {
            status,
            daysLeft: diffInDays,
            isCritical: diffInDays <= 1,
        };
    }, [licenseExpiryDate]);
}
