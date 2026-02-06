import { useCallback } from 'react';
import { useData } from '@/context/DataContext';
import { format } from 'date-fns';

export function useAvailableStaff() {
    const { staff, attendance } = useData();

    const getAvailableDoctors = useCallback((dateInput: Date | string) => {
        // Normalize date to YYYY-MM-DD string (Local Time) to match data storage
        let dateStr = '';

        if (dateInput instanceof Date) {
            dateStr = format(dateInput, 'yyyy-MM-dd');
        } else {
            // Assume string is already YYYY-MM-DD or parse it
            // If it's ISO string with time, we might need to be careful, but simplified:
            if (dateInput.includes('T')) {
                dateStr = format(new Date(dateInput), 'yyyy-MM-dd');
            } else {
                dateStr = dateInput;
            }
        }

        return staff.filter(member => {
            // 1. Filter by role (Doctor or Dentist)
            const role = member.role?.toLowerCase() || '';
            if (role !== 'doctor' && role !== 'dentist') {
                return false;
            }

            // 2. Cross-reference with attendance
            // Find attendance record for this staff on this date
            const record = attendance.find(a => a.staffId === member.id && a.date === dateStr);

            // 3. Return only if 'present'
            return record?.status === 'present';
        });
    }, [staff, attendance]);

    return {
        getAvailableDoctors
    };
}
