import { format, parseISO, isToday as isTodayFns, startOfDay, endOfDay, isValid } from 'date-fns';

/**
 * Robust date parser that handles:
 * 1. ISO strings (2026-04-14T12:00:00Z)
 * 2. Date strings (2026-04-14)
 * 3. Firebase Timestamps (objects with .toDate())
 * 4. JS Date objects
 * 5. Millisecond timestamps (numbers)
 */
export const parseAnyDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;

    try {
        // Handle Firebase Timestamps
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
        }

        // Handle Date objects
        if (dateValue instanceof Date) {
            return isValid(dateValue) ? dateValue : null;
        }

        // Handle numbers (timestamps)
        if (typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            return isValid(parsed) ? parsed : null;
        }

        // Handle strings
        if (typeof dateValue === 'string') {
            // Check if it's a simple YYYY-MM-DD string
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                // Parse as local date to avoid UTC shift
                const [year, month, day] = dateValue.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return isValid(localDate) ? localDate : null;
            }

            const parsed = parseISO(dateValue);
            if (isValid(parsed)) return parsed;

            const fallback = new Date(dateValue);
            return isValid(fallback) ? fallback : null;
        }

        return null;
    } catch (error) {
        console.error('Error parsing date:', error);
        return null;
    }
};

/**
 * Returns current date in YYYY-MM-DD format (local time)
 * This is the preferred storage format for "date-only" fields
 */
export const getLocalDateString = (date: any = new Date()): string => {
    const d = parseAnyDate(date) || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns current time in HH:mm:ss format (local time)
 */
export const getLocalTimeString = (date: any = new Date()): string => {
    const d = parseAnyDate(date) || new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

/**
 * Centralized formatter for UI display
 */
export const formatDisplayDate = (date: any, formatStr: string = 'MMM dd, yyyy hh:mm a'): string => {
    const d = parseAnyDate(date);
    if (!d) return 'N/A';
    return format(d, formatStr);
};

/**
 * Checks if a date is today in local time
 */
export const isDateToday = (date: any): boolean => {
    const d = parseAnyDate(date);
    if (!d) return false;
    return isTodayFns(d);
};

/**
 * Flexible check if a date is within a range (inclusive)
 */
export const isDateInDateRange = (dateValue: any, from: Date | null | undefined, to: Date | null | undefined): boolean => {
    const d = parseAnyDate(dateValue);
    if (!d || !from || !to) return false;

    // Normalize boundaries to start and end of day
    const start = startOfDay(from);
    const end = endOfDay(to);

    return d >= start && d <= end;
};

/**
 * Returns today's start and end for filtering
 */
export const getDayRange = (date: Date = new Date()) => {
    return {
        start: startOfDay(date),
        end: endOfDay(date)
    };
};
