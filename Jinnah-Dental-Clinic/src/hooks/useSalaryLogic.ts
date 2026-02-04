import { Staff } from "@/types";
import {
    isSameDay,
    isSameMonth,
    differenceInDays,
    parseISO,
    startOfToday
} from "date-fns";

/**
 * Calculates the salary status and the amount due for a staff member based on their salary type.
 * 
 * Logic:
 * - Daily: Pending if not paid today.
 * - Weekly: Pending if last paid more than 7 days ago.
 * - Monthly: Pending if not paid in the current month.
 */
export const getSalaryStatus = (staff: Staff) => {
    if (!staff || !staff.lastPaidDate) {
        return { status: "Pending" as const, amountDue: staff.salary || 0 };
    }

    const today = startOfToday();
    const lastPaid = parseISO(staff.lastPaidDate);
    const salaryType = staff.salaryType || staff.salaryDuration || "monthly";
    const salaryAmount = staff.salary || 0;

    let status: "Paid" | "Pending" = "Paid";
    let amountDue = 0;

    switch (salaryType) {
        case "daily":
            if (!isSameDay(lastPaid, today)) {
                status = "Pending";
                const days = Math.max(0, differenceInDays(today, lastPaid));
                amountDue = days * salaryAmount;
            }
            break;

        case "weekly":
            const daysSinceWeekly = differenceInDays(today, lastPaid);
            if (daysSinceWeekly >= 7) {
                status = "Pending";
                const weeks = Math.floor(daysSinceWeekly / 7);
                amountDue = weeks * salaryAmount;
            }
            break;

        case "monthly":
            if (!isSameMonth(lastPaid, today)) {
                status = "Pending";
                // Calculate month difference
                const months = (today.getFullYear() - lastPaid.getFullYear()) * 12 + (today.getMonth() - lastPaid.getMonth());
                amountDue = Math.max(0, months) * salaryAmount;
            }
            break;
    }

    return { status, amountDue };
};

export const useSalaryLogic = () => {
    return { getSalaryStatus };
};
