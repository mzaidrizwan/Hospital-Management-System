
import { Bill, Expense, SalaryPayment } from '@/types';
import { DateRange } from 'react-day-picker';

// Local interface for Sale since it's not in global types yet
export interface Sale {
    id: string;
    amount: number;
    totalPrice: number;
    buyingPrice?: number;
    sellingPrice?: number;
    total?: number;
    price?: number;
    date: string;
    createdAt: any;
    productName?: string;
    itemName?: string;
    category?: string;
    quantity?: number;
    customerName?: string;
    paymentStatus: string;
    paymentMethod?: string;
}

export const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;

    try {
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
        }

        if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        if (dateValue instanceof Date) {
            return dateValue;
        }

        return null;
    } catch (error) {
        console.error('Error parsing date:', error);
        return null;
    }
};

export const formatCurrency = (amount: number) => {
    if (isNaN(amount)) return 'PKR 0';

    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

export const calculateFinancialStats = (
    bills: Bill[],
    sales: Sale[],
    expenses: Expense[],
    salaryPayments: SalaryPayment[],
    dateRange: DateRange
) => {
    if (!dateRange.from || !dateRange.to) {
        return {
            totalRevenue: 0,
            totalExpenses: 0,
            netProfit: 0,
            treatmentRevenue: 0,
            salesRevenue: 0,
            salesProfit: 0,
            totalSalaries: 0,
            overheadExpenses: 0,
            filteredBills: [],
            filteredSales: [],
            filteredExpenses: [],
            filteredSalaries: [],
            combinedRevenue: []
        };
    }

    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);

    const isInRange = (date: any) => {
        const d = parseDate(date);
        return d && d >= from && d <= to;
    };

    // 1. Filter Data (Using inclusive logic for revenue - collector's view)
    // We count bills that have money paid in them during this period
    const filteredBills = bills.filter(b => isInRange(b.createdDate || b.date || b.createdAt));
    const filteredSales = (sales || []).filter(s => isInRange(s.date || s.createdAt));
    const filteredExpenses = (expenses || []).filter(e => e.status === 'paid' && isInRange(e.date));
    const filteredSalaries = (salaryPayments || []).filter(s => isInRange(s.date));

    // 2. Combine all revenue sources for detailed tracking
    const combinedRevenue = [
        ...filteredBills.map(bill => ({
            ...bill,
            amount: bill.amountPaid || 0,
            type: 'bill',
            color: '#3b82f6'
        })),
        ...filteredSales.map(sale => {
            const amount = Number(sale.total || sale.amount || sale.totalPrice || 0);
            const buying = Number(sale.buyingPrice || 0);
            const selling = Number(sale.sellingPrice || sale.price || sale.amount || 0);
            const qty = Number(sale.quantity || 1);
            return {
                ...sale,
                amount: amount,
                itemProfit: (selling - buying) * qty,
                type: 'sale',
                color: '#10b981'
            };
        })
    ];

    // 3. Totals
    const treatmentRevenue = filteredBills.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
    const salesRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.total || s.amount || s.totalPrice || 0)), 0);

    const salesProfit = filteredSales.reduce((sum, s) => {
        const buying = Number(s.buyingPrice || 0);
        const selling = Number(s.sellingPrice || s.price || s.amount || 0);
        const qty = Number(s.quantity || 1);
        return sum + (selling - buying) * qty;
    }, 0);

    const overheadExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalSalaries = filteredSalaries.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const totalExpenses = overheadExpenses + totalSalaries;

    const totalRevenue = treatmentRevenue + salesRevenue;
    const netProfit = treatmentRevenue + salesProfit - totalExpenses;

    return {
        totalRevenue,
        totalExpenses,
        netProfit,
        treatmentRevenue,
        salesRevenue,
        salesProfit,
        totalSalaries,
        overheadExpenses,
        filteredBills,
        filteredSales,
        filteredExpenses,
        filteredSalaries,
        combinedRevenue
    };
};
