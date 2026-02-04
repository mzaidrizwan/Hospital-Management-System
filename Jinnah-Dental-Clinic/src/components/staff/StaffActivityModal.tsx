'use client';

import React, { useState } from 'react';
import {
    X,
    Trash2,
    Edit2,
    Download,
    Calendar,
    DollarSign,
    Clock,
    CheckCircle2,
    AlertCircle,
    Save,
    Undo2
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
import { Staff, Transaction, Expense, Attendance } from '@/types';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { smartSync, smartDelete } from '@/services/syncService';

interface StaffActivityModalProps {
    open: boolean;
    onClose: () => void;
    staff: Staff | null;
}

export default function StaffActivityModal({ open, onClose, staff }: StaffActivityModalProps) {
    const {
        transactions,
        expenses,
        attendance: allAttendance,
        updateLocal,
        deleteLocal
    } = useData();
    const { user } = useAuth();

    const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
    const [editFormData, setEditFormData] = useState({
        amount: 0,
        date: ''
    });

    if (!staff) return null;

    const isAdmin = user?.role === 'admin';
    const staffTransactions = (transactions || [])
        .filter(t => t.staffId === staff.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const staffAttendance = (allAttendance || [])
        .filter(a => a.staffId === staff.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleEditClick = (txn: Transaction) => {
        setEditingTxn(txn);
        setEditFormData({
            amount: txn.amount,
            date: txn.date.split('T')[0]
        });
    };

    const handleSaveEdit = async () => {
        if (!editingTxn) return;

        try {
            const timestamp = new Date(editFormData.date).toISOString();

            const updatedTxn: Transaction = {
                ...editingTxn,
                amount: Number(editFormData.amount),
                date: timestamp,
                updatedAt: new Date().toISOString()
            };

            // 1. Update Transaction
            await updateLocal('transactions', updatedTxn);

            // 2. Sync with Expenses if linked
            if (updatedTxn.expenseId) {
                const linkedExpense = expenses.find(e => e.id === updatedTxn.expenseId);
                if (linkedExpense) {
                    const updatedExpense: Expense = {
                        ...linkedExpense,
                        amount: updatedTxn.amount,
                        date: timestamp,
                        updatedAt: new Date().toISOString()
                    };
                    await updateLocal('expenses', updatedExpense);
                }
            }

            toast.success("Payment record updated");
            setEditingTxn(null);
        } catch (error) {
            console.error("Failed to edit transaction:", error);
            toast.error("Failed to save changes");
        }
    };

    const handleDeleteTxn = async (txn: Transaction) => {
        if (!confirm("Are you sure you want to void this payment record? This will not undo the actual cash transfer but will remove it from logs and expenses.")) return;

        try {
            await deleteLocal('transactions', txn.id);
            if (txn.expenseId) {
                await deleteLocal('expenses', txn.expenseId);
            }
            toast.success("Payment record voided");
        } catch (error) {
            console.error("Failed to delete transaction:", error);
            toast.error("Failed to delete record");
        }
    };

    const handleUpdateAttendance = async (att: Attendance, newStatus: string) => {
        try {
            const updatedAtt = {
                ...att,
                status: newStatus as any,
                updatedAt: new Date().toISOString()
            };
            await updateLocal('attendance', updatedAtt);
            toast.success(`Attendance updated to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update attendance:", error);
            toast.error("Failed to update status");
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

    return (
        <>
            <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white rounded-2xl shadow-2xl">
                    <DialogHeader className="p-6 bg-gradient-to-r from-primary to-blue-600 text-white rounded-t-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight">{staff.name}</DialogTitle>
                                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Payment History & Activity Log</p>
                            </div>
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden bg-gray-50/30">
                        <Tabs defaultValue="payments" className="h-full flex flex-col">
                            <div className="px-6 py-4 bg-white border-b">
                                <TabsList className="grid w-full grid-cols-2 max-w-sm rounded-xl p-1 bg-gray-100">
                                    <TabsTrigger value="payments" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Payments</TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="payments" className="flex-1 overflow-y-auto p-6 m-0">
                                {staffTransactions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <AlertCircle className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="font-bold text-gray-900">No activity yet</h3>
                                        <p className="text-muted-foreground text-sm max-w-[200px] mt-1">Payments recorded for this staff member will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm border-gray-100">
                                        <Table>
                                            <TableHeader className="bg-gray-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 py-4">Date</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Total Amount</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Type</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {staffTransactions.map((txn) => (
                                                    <TableRow key={txn.id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <TableCell className="font-medium text-gray-600">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                {new Date(txn.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-black text-gray-900">{formatCurrency(txn.amount)}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-bold text-[10px] uppercase border-blue-100 bg-blue-50/50 text-blue-600">
                                                                {txn.type}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {isAdmin && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                                            onClick={() => handleEditClick(txn)}
                                                                        >
                                                                            <Edit2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 text-destructive/70 hover:bg-destructive/10 rounded-lg"
                                                                            onClick={() => handleDeleteTxn(txn)}
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="attendance" className="flex-1 overflow-y-auto p-6 m-0">
                                {staffAttendance.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <Calendar className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="font-bold text-gray-900">No attendance records</h3>
                                        <p className="text-muted-foreground text-sm max-w-[200px] mt-1">Attendance history for this staff member will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm border-gray-100">
                                        <Table>
                                            <TableHeader className="bg-gray-50/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 py-4">Date</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Status</TableHead>
                                                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Adjust Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {staffAttendance.map((att) => (
                                                    <TableRow key={att.id} className="hover:bg-blue-50/30 transition-colors group">
                                                        <TableCell className="font-medium text-gray-600">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                {new Date(att.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn("font-bold text-[10px] uppercase", getStatusColor(att.status))}>
                                                                {att.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {isAdmin && (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-[10px] font-black uppercase tracking-tighter hover:bg-green-50 text-green-700"
                                                                        onClick={() => handleUpdateAttendance(att, 'present')}
                                                                        disabled={att.status === 'present'}
                                                                    >
                                                                        P
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-[10px] font-black uppercase tracking-tighter hover:bg-red-50 text-red-700"
                                                                        onClick={() => handleUpdateAttendance(att, 'absent')}
                                                                        disabled={att.status === 'absent'}
                                                                    >
                                                                        A
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="text-[10px] font-black uppercase tracking-tighter hover:bg-yellow-50 text-yellow-700"
                                                                        onClick={() => handleUpdateAttendance(att, 'leave')}
                                                                        disabled={att.status === 'leave'}
                                                                    >
                                                                        L
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <DialogFooter className="p-4 border-t bg-gray-50/50 rounded-b-2xl">
                        <Button variant="outline" onClick={onClose} className="font-bold rounded-xl border-gray-200">
                            Close History
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Payment Sub-Modal */}
            <Dialog open={!!editingTxn} onOpenChange={(val) => !val && setEditingTxn(null)}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-gray-50/50">
                        <DialogTitle className="font-black text-gray-900 flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Edit2 className="w-4 h-4" />
                            </div>
                            Adjust Payment
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
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-gray-50/80 border-t flex gap-2">
                        <Button variant="ghost" className="font-bold rounded-xl flex-1" onClick={() => setEditingTxn(null)}>
                            Cancel
                        </Button>
                        <Button className="font-black rounded-xl bg-primary hover:bg-primary/90 flex-1 gap-2 shadow-lg" onClick={handleSaveEdit}>
                            <Save className="w-4 h-4" /> Save Adjustments
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
