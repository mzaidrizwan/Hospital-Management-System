
import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { format } from 'date-fns';
import { Staff } from '@/types';

export function useAvailableDoctors() {
    const { staff, attendance } = useData();

    const presentDoctors = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // Define doctor-related keywords for role matching
        const doctorKeywords = ['doctor', 'dentist', 'surgeon', 'orthodontist', 'endodontist', 'specialist'];

        return staff.filter(member => {
            // 1. Check if role matches a "Doctor" category
            const role = member.role?.toLowerCase() || '';
            const isDoctor = doctorKeywords.some(keyword => role.includes(keyword));

            if (!isDoctor) {
                return false;
            }

            // 2. Cross-reference with attendance for today
            const record = attendance.find(a => a.staffId === member.id && a.date === todayStr);

            // 3. Return only if 'present'
            return record?.status === 'present';
        });
    }, [staff, attendance]);

    return {
        presentDoctors,
        // Helper to check specific date if needed
        getDoctorsForDate: (date: Date | string) => {
            const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
            const doctorKeywords = ['doctor', 'dentist', 'surgeon', 'orthodontist', 'endodontist', 'specialist'];

            return staff.filter(member => {
                const role = member.role?.toLowerCase() || '';
                const isDoctor = doctorKeywords.some(keyword => role.includes(keyword));
                if (!isDoctor) return false;

                const record = attendance.find(a => a.staffId === member.id && a.date === dateStr);
                return record?.status === 'present';
            });
        }
    };
}
