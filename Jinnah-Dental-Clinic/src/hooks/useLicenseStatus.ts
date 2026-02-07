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
        return 0; // Default to 0 days if no license
    }

    try {
        const expiry = parseISO(expiryDate);
        const now = new Date();

        // Exact time difference in milliseconds
        const diffInMs = expiry.getTime() - now.getTime();

        // If it's already in the past, return 0
        if (diffInMs <= 0) {
            return 0;
        }

        // Return number of days remaining (rounding up)
        // This ensures that even if 1 hour is left, it shows "1 day left"
        // rather than "0 days / Expired"
        const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
        return Math.max(0, diffInDays);
    } catch (error) {
        console.error('Error calculating remaining days:', error);
        return 0;
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

        // Critical status if expired or less than 5 days left
        if (diffInDays <= 0) {
            status = 'expired';
        } else if (diffInDays <= 5) {
            status = 'warning';
        }

        return {
            status,
            daysLeft: diffInDays,
            isCritical: diffInDays <= 2, // Highlight red if 2 days or less
        };
    }, [licenseExpiryDate]);
}
