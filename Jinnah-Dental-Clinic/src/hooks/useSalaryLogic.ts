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

    // Force pending if no salary has ever been paid (e.g. joining day)
    if (staff.totalPaid === 0) {
        return { status: "Pending" as const, amountDue: staff.salary || 0 };
    }

    const today = startOfToday();
    const lastPaid = parseISO(staff.lastPaidDate);
    const salaryType = staff.salaryType || staff.salaryDuration || "monthly";
    const salaryAmount = staff.salary || 0;

    let cyclesDue = 0;

    switch (salaryType) {
        case "daily":
            if (!isSameDay(lastPaid, today)) {
                cyclesDue = Math.max(0, differenceInDays(today, lastPaid));
            }
            break;

        case "weekly":
            const daysSinceWeekly = differenceInDays(today, lastPaid);
            if (daysSinceWeekly >= 7) {
                cyclesDue = Math.floor(daysSinceWeekly / 7);
            }
            break;

        case "monthly":
            if (!isSameMonth(lastPaid, today)) {
                const months = (today.getFullYear() - lastPaid.getFullYear()) * 12 + (today.getMonth() - lastPaid.getMonth());
                cyclesDue = Math.max(0, months);
            }
            break;
    }

    // Clamp persisted pendingSalary to 0 in case it was stored as negative due to a historical bug
    const persistedPending = Math.max(0, staff.pendingSalary || 0);
    const amountDue = Math.max(0, (cyclesDue * salaryAmount) + persistedPending);
    const status: "Paid" | "Pending" = amountDue > 0 ? "Pending" : "Paid";

    return { status, amountDue };
};

export const useSalaryLogic = () => {
    return { getSalaryStatus };
};
