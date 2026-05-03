'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    X,
    Trash2,
    Edit2,
    Calendar,
    DollarSign,
    Clock,
    Save,
    UserCheck,
    UserX,
    CalendarOff,
    RefreshCw,
    Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Staff, Transaction, Expense, Attendance } from '@/types';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { parseAnyDate, formatDisplayDate } from '@/utils/dateUtils';
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';

interface StaffActivityModalProps {
    open: boolean;
    onClose: () => void;
    staff: Staff | null;
}

export default function StaffActivityModal({ open, onClose, staff }: StaffActivityModalProps) {
    // ========== ALL HOOKS MUST BE CALLED FIRST (BEFORE ANY CONDITIONAL RETURN) ==========
    const {
        transactions,
        expenses,
        attendance: allAttendance,
        updateLocal,
        deleteLocal,
        staff: staffList,
        setStaff,
        salaryPayments,
        setSalaryPayments
    } = useData();
    const { user } = useAuth();

    const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
    const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
    const [editFormData, setEditFormData] = useState({
        amount: 0,
        date: '',
        time: '',
        status: 'present' as 'present' | 'absent' | 'leave',
        notes: ''
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{
        type: 'payment' | 'attendance';
        data: any;
        message: string;
    } | null>(null);

    const isAdmin = user?.role === 'admin';

    // ========== ALL useMemo HOOKS ==========
    const staffTransactions = useMemo(() => {
        if (!staff) return [];
        return (transactions || [])
            .filter(t => t.staffId === staff.id && t.type === 'Salary')
            .sort((a, b) => {
                const dateA = parseAnyDate(a.date)?.getTime() || 0;
                const dateB = parseAnyDate(b.date)?.getTime() || 0;
                return dateB - dateA;
            });
    }, [transactions, staff?.id]);

    const staffAttendance = useMemo(() => {
        if (!staff) return [];
        return (allAttendance || [])
            .filter(a => a.staffId === staff.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map(att => ({
                ...att,
                time: (att as any).time || '--:--:--',
                timestamp: (att as any).timestamp || ''
            }));
    }, [allAttendance, staff?.id]);

    const groupedAttendance = useMemo(() => {
        const grouped = new Map<string, Attendance>();
        staffAttendance.forEach(att => {
            const existing = grouped.get(att.date);
            if (!existing || new Date(att.updatedAt || '').getTime() > new Date(existing.updatedAt || '').getTime()) {
                grouped.set(att.date, att);
            }
        });
        return Array.from(grouped.values()).sort((a, b) => {
            const dateA = parseAnyDate(a.date)?.getTime() || 0;
            const dateB = parseAnyDate(b.date)?.getTime() || 0;
            return dateB - dateA;
        });
    }, [staffAttendance]);

    const totalPaid = useMemo(() => {
        return staffTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    }, [staffTransactions]);

    // ========== ALL useEffect HOOKS (MUST BE BEFORE CONDITIONAL RETURN) ==========
    useEffect(() => {
        if (open && staff) {
            const stillExists = staffList.some(s => s.id === staff.id);
            if (!stillExists) {
                toast.warning("This staff member has been deleted");
                onClose();
            }
        }
    }, [open, staff, staffList, onClose]);

    // ========== NOW WE CAN HAVE CONDITIONAL RETURN ==========
    if (!staff) return null;

    // ========== Handlers (These can be after conditional return) ==========
    const handleEditPayment = (txn: Transaction) => {
        setEditingTxn(txn);
        setEditFormData({
            amount: txn.amount,
            date: txn.date.split('T')[0],
            time: (txn as any).paymentTime || '00:00:00',
            status: 'present',
            notes: txn.notes || ''
        });
    };

    const handleSaveEditPayment = async () => {
        if (!editingTxn) return;
        setIsUpdating(true);

        try {
            const paymentDate = editFormData.date;
            const paymentTime = editFormData.time || new Date().toLocaleTimeString('en-US', { hour12: false });
            const fullDateTime = `${paymentDate}T${paymentTime}`;
            const timestamp = new Date(fullDateTime).toISOString();

            const amountDifference = Number(editFormData.amount) - editingTxn.amount;

            const updatedTxn: Transaction = {
                ...editingTxn,
                amount: Number(editFormData.amount),
                date: timestamp,
                paymentDate: paymentDate,
                paymentTime: paymentTime,
                fullPaymentDateTime: fullDateTime,
                updatedAt: new Date().toISOString()
            };
            await updateLocal('transactions', updatedTxn);

            // 2. Cascade update to Expense record
            let expenseId = updatedTxn.expenseId;
            if (!expenseId) {
                // Fallback: try to find the expense by staffId, amount, and approximate date
                const linkedExp = (expenses || []).find(e => 
                    e.category === 'salary' && 
                    e.staffId === staff.id && 
                    Math.abs(Number(e.amount) - editingTxn.amount) < 1 &&
                    Math.abs(new Date(e.date).getTime() - new Date(editingTxn.date).getTime()) < 3600000 // 1 hour window
                );
                if (linkedExp) expenseId = linkedExp.id;
            }

            if (expenseId) {
                const linkedExpense = expenses.find(e => e.id === expenseId);
                if (linkedExpense) {
                    const updatedExpense: Expense = {
                        ...linkedExpense,
                        amount: updatedTxn.amount,
                        date: timestamp,
                        paymentDate: paymentDate,
                        paymentTime: paymentTime,
                        fullPaymentDateTime: fullDateTime,
                        updatedAt: new Date().toISOString()
                    };
                    // updateLocal('expenses') will handle cascading to salaryPayments and staff in DataContext
                    await updateLocal('expenses', updatedExpense);
                }
            } else {
                // If no expense record found, still try to update salaryPayments directly
                const linkedPay = (salaryPayments || []).find(p => 
                    p.staffId === staff.id && 
                    Math.abs(Number(p.amount) - editingTxn.amount) < 1 &&
                    Math.abs(new Date(p.date).getTime() - new Date(editingTxn.date).getTime()) < 3600000
                );
                if (linkedPay) {
                    const updatedPay = {
                        ...linkedPay,
                        amount: updatedTxn.amount,
                        date: timestamp,
                        paymentDate,
                        paymentTime,
                        fullPaymentDateTime: fullDateTime,
                        updatedAt: new Date().toISOString()
                    };
                    await updateLocal('salaryPayments', updatedPay);
                }

                // And manually update staff totals as a fallback
                const currentStaff = staffList.find(s => s.id === staff.id);
                if (currentStaff) {
                    const updatedStaff = {
                        ...currentStaff,
                        totalPaid: (currentStaff.totalPaid || 0) + amountDifference,
                        totalEarned: (currentStaff.totalEarned || 0) + amountDifference,
                        pendingSalary: Math.max(0, (currentStaff.pendingSalary || 0) - amountDifference),
                        lastPaidDate: fullDateTime,
                        updatedAt: new Date().toISOString()
                    };
                    await updateLocal('staff', updatedStaff);
                    setStaff(prev => prev.map(s => s.id === staff.id ? updatedStaff : s));
                }
            }

            toast.success("Payment record updated successfully");
            setEditingTxn(null);
        } catch (error) {
            console.error("Failed to edit transaction:", error);
            toast.error("Failed to save changes");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeletePayment = (txn: Transaction) => {
        setItemToDelete({
            type: 'payment',
            data: txn,
            message: `Are you sure you want to delete this payment record of ${formatCurrency(txn.amount)} dated ${formatDisplayDate(txn.date, 'dd MMM, yyyy')}? This will permanently remove it and revert the staff member's pending salary.`
        });
        setShowDeleteConfirm(true);
    };

    const executeDeletePayment = async (txn: Transaction) => {
        setIsUpdating(true);

        try {
            // Find linked expense even if expenseId is missing from txn
            let expenseId = txn.expenseId;
            if (!expenseId) {
                const linkedExp = (expenses || []).find(e => 
                    e.category === 'salary' && 
                    e.staffId === staff.id && 
                    Math.abs(Number(e.amount) - txn.amount) < 1 &&
                    Math.abs(new Date(e.date).getTime() - new Date(txn.date).getTime()) < 3600000
                );
                if (linkedExp) expenseId = linkedExp.id;
            }

            if (expenseId) {
                // deleteLocal('expenses') in DataContext handles cascading to transactions, staff, and salaryPayments
                await deleteLocal('expenses', expenseId);
            } else {
                // Fallback for isolated transaction records
                await deleteLocal('transactions', txn.id);
                
                // Manual revert of staff totals since no expense cascade will trigger
                const currentStaff = staffList.find(s => s.id === staff.id);
                if (currentStaff) {
                    const updatedStaff = {
                        ...currentStaff,
                        totalPaid: Math.max(0, (currentStaff.totalPaid || 0) - txn.amount),
                        totalEarned: Math.max(0, (currentStaff.totalEarned || 0) - txn.amount),
                        pendingSalary: (currentStaff.pendingSalary || 0) + txn.amount,
                        updatedAt: new Date().toISOString()
                    };
                    await updateLocal('staff', updatedStaff);
                    setStaff(prev => prev.map(s => s.id === staff.id ? updatedStaff : s));
                }

                // Also try to find and delete linked salaryPayment record
                const linkedPay = (salaryPayments || []).find(p => 
                    p.staffId === staff.id && 
                    Math.abs(Number(p.amount) - txn.amount) < 1 &&
                    Math.abs(new Date(p.date).getTime() - new Date(txn.date).getTime()) < 3600000
                );
                if (linkedPay) {
                    await deleteLocal('salaryPayments', linkedPay.id);
                }
            }

            toast.success("Payment record deleted successfully");
        } catch (error) {
            console.error("Failed to delete transaction:", error);
            toast.error("Failed to delete record");
        } finally {
            setIsUpdating(false);
            setShowDeleteConfirm(false);
            setItemToDelete(null);
        }
    };

    const handleEditAttendance = (att: Attendance) => {
        setEditingAttendance(att);
        setEditFormData({
            amount: 0,
            date: att.date,
            time: (att as any).time || new Date().toLocaleTimeString('en-US', { hour12: false }),
            status: att.status,
            notes: att.notes || ''
        });
    };

    const handleSaveEditAttendance = async () => {
        if (!editingAttendance) return;
        setIsUpdating(true);

        try {
            const attendanceDate = editFormData.date;
            const attendanceTime = editFormData.time;
            const fullTimestamp = `${attendanceDate}T${attendanceTime}`;

            const updatedAttendance: Attendance = {
                ...editingAttendance,
                status: editFormData.status,
                notes: editFormData.notes,
                time: attendanceTime,
                timestamp: fullTimestamp,
                updatedAt: new Date().toISOString()
            };

            await updateLocal('attendance', updatedAttendance);
            toast.success(`Attendance updated to ${editFormData.status}`);
            setEditingAttendance(null);
        } catch (error) {
            console.error("Failed to update attendance:", error);
            toast.error("Failed to update attendance");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateAttendanceStatus = async (att: Attendance, newStatus: string) => {
        setIsUpdating(true);

        try {
            const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });
            const fullTimestamp = `${att.date}T${currentTime}`;

            const updatedAtt = {
                ...att,
                status: newStatus as any,
                time: (att as any).time || currentTime,
                timestamp: (att as any).timestamp || fullTimestamp,
                updatedAt: new Date().toISOString()
            };
            await updateLocal('attendance', updatedAtt);
            toast.success(`Attendance updated to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update attendance:", error);
            toast.error("Failed to update status");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteAttendance = (att: Attendance) => {
        setItemToDelete({
            type: 'attendance',
            data: att,
            message: `Are you sure you want to delete the attendance record for ${formatDisplayDate(att.date, 'dd MMM, yyyy')}? This action cannot be undone.`
        });
        setShowDeleteConfirm(true);
    };

    const executeDeleteAttendance = async (att: Attendance) => {
        setIsUpdating(true);

        try {
            await deleteLocal('attendance', att.id);
            toast.success(`Attendance record for ${att.date} deleted successfully`);
        } catch (error) {
            console.error("Failed to delete attendance:", error);
            toast.error("Failed to delete attendance record");
        } finally {
            setIsUpdating(false);
            setShowDeleteConfirm(false);
            setItemToDelete(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;

        if (itemToDelete.type === 'payment') {
            await executeDeletePayment(itemToDelete.data);
        } else if (itemToDelete.type === 'attendance') {
            await executeDeleteAttendance(itemToDelete.data);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'present': return 'bg-green-100 text-green-700 border-green-200';
            case 'absent': return 'bg-red-100 text-red-700 border-red-200';
            case 'leave': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'present': return <UserCheck className="w-3.5 h-3.5" />;
            case 'absent': return <UserX className="w-3.5 h-3.5" />;
            case 'leave': return <CalendarOff className="w-3.5 h-3.5" />;
            default: return <Clock className="w-3.5 h-3.5" />;
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white rounded-2xl shadow-2xl">
                    <DialogHeader className="p-6 bg-gradient-to-r from-primary to-blue-600 text-white rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight">{staff.name}</DialogTitle>
                                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Payment History & Activity Log</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 rounded-xl px-3 py-1.5">
                                    <p className="text-xs font-bold text-blue-100">Total Paid</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(totalPaid)}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                    <Wallet className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden bg-gray-50/30">
                        <Tabs defaultValue="payments" className="h-full flex flex-col">
                            <div className="px-6 py-4 bg-white border-b">
                                <TabsList className="grid w-full grid-cols-2 max-w-sm rounded-xl p-1 bg-gray-100">
                                    <TabsTrigger value="payments" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Payments ({staffTransactions.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Attendance ({groupedAttendance.length})
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Payments Tab */}
                            <TabsContent value="payments" className="flex-1 m-0 p-0 overflow-hidden">
                                <ScrollArea className="h-[500px] w-full p-6">
                                {staffTransactions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <DollarSign className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="font-bold text-gray-900">No payments recorded</h3>
                                        <p className="text-muted-foreground text-sm max-w-[200px] mt-1">Salary payments for this staff member will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm border-gray-100 mb-8">
                                        <Table>
                                            <TableHeader className="bg-gray-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 py-4">Date & Time</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Amount</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Method</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {staffTransactions.map((txn) => (
                                                    <TableRow key={txn.id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <TableCell className="font-medium text-gray-600">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                    {formatDisplayDate(txn.date, 'dd MMM, yyyy')}
                                                                </div>
                                                                {(txn as any).paymentTime && (
                                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                                        <Clock className="w-3 h-3" />
                                                                        {(txn as any).paymentTime}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-black text-gray-900">{formatCurrency(txn.amount)}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-bold text-[10px] uppercase border-blue-100 bg-blue-50/50 text-blue-600">
                                                                {(txn as any).method || 'Cash'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                                    onClick={() => handleEditPayment(txn)}
                                                                    disabled={isUpdating}
                                                                    title="Edit Payment"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg"
                                                                    onClick={() => handleDeletePayment(txn)}
                                                                    disabled={isUpdating}
                                                                    title="Delete Payment"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                </ScrollArea>
                            </TabsContent>

                            {/* Attendance Tab */}
                            <TabsContent value="attendance" className="flex-1 m-0 p-0 overflow-hidden">
                                <ScrollArea className="h-[500px] w-full p-6">
                                {groupedAttendance.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <Calendar className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="font-bold text-gray-900">No attendance records</h3>
                                        <p className="text-muted-foreground text-sm max-w-[200px] mt-1">Attendance history for this staff member will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm border-gray-100 mb-8">
                                        <Table>
                                            <TableHeader className="bg-gray-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 py-4">Date</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Time</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Status</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Notes</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {groupedAttendance.map((att) => (
                                                    <TableRow key={att.id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <TableCell className="font-medium text-gray-600">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                {formatDisplayDate(att.date, 'dd MMM, yyyy')}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2 text-sm font-mono">
                                                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                                {(att as any).time || '--:--:--'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn("font-bold text-[10px] uppercase flex items-center gap-1 w-fit", getStatusColor(att.status))}>
                                                                {getStatusIcon(att.status)}
                                                                {att.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="max-w-[200px]">
                                                            <p className="text-xs text-gray-500 truncate">{att.notes || '—'}</p>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                                    onClick={() => handleEditAttendance(att)}
                                                                    disabled={isUpdating}
                                                                    title="Edit Attendance"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg"
                                                                    onClick={() => handleDeleteAttendance(att)}
                                                                    disabled={isUpdating}
                                                                    title="Delete Attendance"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                                <div className="flex items-center gap-0.5 border-l pl-2 ml-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 rounded-lg"
                                                                        onClick={() => handleUpdateAttendanceStatus(att, 'present')}
                                                                        disabled={att.status === 'present' || isUpdating}
                                                                        title="Mark Present"
                                                                    >
                                                                        <UserCheck className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 rounded-lg"
                                                                        onClick={() => handleUpdateAttendanceStatus(att, 'absent')}
                                                                        disabled={att.status === 'absent' || isUpdating}
                                                                        title="Mark Absent"
                                                                    >
                                                                        <UserX className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                                                                        onClick={() => handleUpdateAttendanceStatus(att, 'leave')}
                                                                        disabled={att.status === 'leave' || isUpdating}
                                                                        title="Mark Leave"
                                                                    >
                                                                        <CalendarOff className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-4 border-t bg-gray-50/50 rounded-b-2xl">
                        <Button variant="outline" onClick={onClose} className="font-bold rounded-xl border-gray-200" disabled={isUpdating}>
                            Close History
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Payment Modal */}
            <Dialog open={!!editingTxn} onOpenChange={(val) => !val && setEditingTxn(null)}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-gray-50/50">
                        <DialogTitle className="font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Edit2 className="w-4 h-4" />
                            </div>
                            Edit Payment Record
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Amount (PKR)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="number"
                                    className="pl-9 h-11 font-black shadow-sm rounded-xl focus-visible:ring-primary"
                                    value={editFormData.amount}
                                    onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
                                    disabled={isUpdating}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Payment Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="date"
                                    className="pl-9 h-11 font-bold shadow-sm rounded-xl focus-visible:ring-primary"
                                    value={editFormData.date}
                                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                                    disabled={isUpdating}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Payment Time</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="time"
                                    step="1"
                                    className="pl-9 h-11 font-bold shadow-sm rounded-xl focus-visible:ring-primary"
                                    value={editFormData.time}
                                    onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                    disabled={isUpdating}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-gray-50/80 border-t flex gap-2">
                        <Button
                            variant="ghost"
                            className="font-bold rounded-xl flex-1"
                            onClick={() => setEditingTxn(null)}
                            disabled={isUpdating}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="font-black rounded-xl bg-primary hover:bg-primary/90 flex-1 gap-2 shadow-lg"
                            onClick={handleSaveEditPayment}
                            disabled={isUpdating}
                        >
                            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Attendance Modal */}
            <Dialog open={!!editingAttendance} onOpenChange={(val) => !val && setEditingAttendance(null)}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-gray-50/50">
                        <DialogTitle className="font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Edit2 className="w-4 h-4" />
                            </div>
                            Edit Attendance Record
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="date"
                                    className="pl-9 h-11 font-bold shadow-sm rounded-xl focus-visible:ring-primary"
                                    value={editFormData.date}
                                    disabled={true}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Date cannot be changed</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Time</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    type="time"
                                    step="1"
                                    className="pl-9 h-11 font-bold shadow-sm rounded-xl focus-visible:ring-primary"
                                    value={editFormData.time}
                                    onChange={(e) => setEditFormData({ ...editFormData, time: e.target.value })}
                                    disabled={isUpdating}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Status</label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={editFormData.status === 'present' ? 'default' : 'outline'}
                                    className={cn("flex-1 gap-2 font-bold", editFormData.status === 'present' && "bg-green-600 hover:bg-green-700")}
                                    onClick={() => setEditFormData({ ...editFormData, status: 'present' })}
                                    disabled={isUpdating}
                                >
                                    <UserCheck className="w-4 h-4" /> Present
                                </Button>
                                <Button
                                    type="button"
                                    variant={editFormData.status === 'absent' ? 'default' : 'outline'}
                                    className={cn("flex-1 gap-2 font-bold", editFormData.status === 'absent' && "bg-red-600 hover:bg-red-700")}
                                    onClick={() => setEditFormData({ ...editFormData, status: 'absent' })}
                                    disabled={isUpdating}
                                >
                                    <UserX className="w-4 h-4" /> Absent
                                </Button>
                                <Button
                                    type="button"
                                    variant={editFormData.status === 'leave' ? 'default' : 'outline'}
                                    className={cn("flex-1 gap-2 font-bold", editFormData.status === 'leave' && "bg-yellow-600 hover:bg-yellow-700")}
                                    onClick={() => setEditFormData({ ...editFormData, status: 'leave' })}
                                    disabled={isUpdating}
                                >
                                    <CalendarOff className="w-4 h-4" /> Leave
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase text-gray-400 tracking-widest">Notes</label>
                            <textarea
                                className="w-full p-3 border rounded-xl text-sm font-medium resize-none focus-visible:ring-primary focus-visible:outline-none"
                                rows={3}
                                value={editFormData.notes}
                                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                placeholder="Add notes about this attendance record..."
                                disabled={isUpdating}
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-gray-50/80 border-t flex gap-2">
                        <Button
                            variant="ghost"
                            className="font-bold rounded-xl flex-1"
                            onClick={() => setEditingAttendance(null)}
                            disabled={isUpdating}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="font-black rounded-xl bg-primary hover:bg-primary/90 flex-1 gap-2 shadow-lg"
                            onClick={handleSaveEditAttendance}
                            disabled={isUpdating}
                        >
                            {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeleteConfirmationModal
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Confirm Deletion"
                description={itemToDelete?.message || "Are you sure you want to delete this record?"}
                isDeleting={isUpdating}
            />
        </>
    );
}