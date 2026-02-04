'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Filter,
    Download,
    DollarSign,
    Tag,
    Calendar,
    User,
    Building,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ExpenseFormModal from '@/components/modals/ExpenseFormModal';

// Auth Context
import { useAuth } from '@/context/AuthContext';

// Data Context
import { useData } from '@/context/DataContext';

// Types
export type ExpenseCategory =
    | 'rent'
    | 'salary'
    | 'supplies'
    | 'utilities'
    | 'equipment'
    | 'medication'
    | 'maintenance'
    | 'inventory'
    | 'marketing'
    | 'insurance'
    | 'professional_fees'
    | 'travel'
    | 'office_supplies'
    | 'software'
    | 'other';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online' | 'wallet';

export interface Expense {
    id: string;
    title: string;
    amount: number;
    category: ExpenseCategory;
    paymentMethod: PaymentMethod;
    date: string;
    description: string;
    vendor?: string;
    receiptNumber?: string;
    status: 'paid' | 'pending' | 'cancelled';
    createdAt: string;
    updatedAt: string;
    paidBy?: string;
    attachment?: string;
}

// Category Labels
const categoryLabels: Record<ExpenseCategory, { label: string; color: string }> = {
    rent: { label: 'Rent', color: 'bg-purple-100 text-purple-800' },
    salary: { label: 'Salary', color: 'bg-blue-100 text-blue-800' },
    supplies: { label: 'Supplies', color: 'bg-green-100 text-green-800' },
    utilities: { label: 'Utilities', color: 'bg-yellow-100 text-yellow-800' },
    equipment: { label: 'Equipment', color: 'bg-indigo-100 text-indigo-800' },
    medication: { label: 'Medication', color: 'bg-pink-100 text-pink-800' },
    maintenance: { label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
    inventory: { label: 'Inventory', color: 'bg-cyan-100 text-cyan-800' },
    marketing: { label: 'Marketing', color: 'bg-red-100 text-red-800' },
    insurance: { label: 'Insurance', color: 'bg-blue-100 text-blue-800' },
    professional_fees: { label: 'Prof. Fees', color: 'bg-emerald-100 text-emerald-800' },
    travel: { label: 'Travel', color: 'bg-sky-100 text-sky-800' },
    office_supplies: { label: 'Office', color: 'bg-slate-100 text-slate-800' },
    software: { label: 'Software', color: 'bg-violet-100 text-violet-800' },
    other: { label: 'Other', color: 'bg-gray-100 text-gray-800' }
};

// Payment Method Labels
const paymentMethodLabels: Record<PaymentMethod, string> = {
    cash: 'Cash',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    cheque: 'Cheque',
    online: 'Online',
    wallet: 'Wallet'
};

// Status Labels
const statusLabels: Record<Expense['status'], { label: string; color: string }> = {
    paid: { label: 'Paid', color: 'bg-green-100 text-green-800 border-green-200' },
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' }
};

// Format currency function
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0
    }).format(amount).replace('PKR', 'Rs');
};

// Format date function
const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

export default function ExpensesPage() {
    const { user } = useAuth();
    const {
        expenses,
        updateLocal,
        deleteLocal,
        loading,
        isOnline,
        refreshCollection
    } = useData();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
    const [selectedStatus, setSelectedStatus] = useState<Expense['status'] | 'all'>('all');
    const itemsPerPage = 8;
    const isLoading = loading;

    // Filter expenses
    const filteredExpenses = expenses.filter(expense => {
        // Safety net: Filter out ghost/corrupt entries
        if (!expense || !expense.title || isNaN(Number(expense.amount))) return false;

        const matchesSearch = (expense.title || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
            (expense.description || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
            (expense.vendor || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
            (expense.receiptNumber || "").toLowerCase().includes((searchTerm || "").toLowerCase());

        const matchesCategory = selectedCategory === 'all' || expense.category === selectedCategory;
        const matchesStatus = selectedStatus === 'all' || expense.status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentExpenses = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

    // Statistics
    const totalExpenses = (expenses || []).reduce((sum, expense) => sum + (Number(expense?.amount) || 0), 0);
    const paidExpenses = (expenses || [])
        .filter(expense => expense?.status === 'paid')
        .reduce((sum, expense) => sum + (Number(expense?.amount) || 0), 0);
    const pendingExpenses = (expenses || [])
        .filter(expense => expense?.status === 'pending')
        .reduce((sum, expense) => sum + (Number(expense?.amount) || 0), 0);

    // Handle search
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleAddExpense = () => {
        if (user?.role !== 'operator' && user?.role !== 'admin') {
            toast.error('Unauthorized access');
            return;
        }
        setSelectedExpense(null);
        setIsEditing(false);
        setShowExpenseForm(true);
    };

    const handleEditExpense = (expense: Expense, e: React.MouseEvent) => {
        e.stopPropagation();
        if (user?.role !== 'operator' && user?.role !== 'admin') {
            toast.error('Unauthorized access');
            return;
        }
        setSelectedExpense(expense);
        setIsEditing(true);
        setShowExpenseForm(true);
    };

    const handleDeleteExpense = async (expense: Expense, e: React.MouseEvent) => {
        e.stopPropagation();
        if (user?.role !== 'operator' && user?.role !== 'admin') {
            toast.error('Unauthorized access');
            return;
        }
        if (confirm(`Are you sure you want to delete expense "${expense.title}"?`)) {
            try {
                await deleteLocal('expenses', expense.id);
                toast.success(`Expense "${expense.title}" deleted successfully`);
            } catch (error) {
                console.error('Error deleting expense:', error);
                toast.error('Failed to delete expense');
            }
        }
    };

    // Handle save expense - uses DataContext's updateLocal
    const handleSaveExpense = async (expenseData: any) => {
        try {
            let updatedExpense: Expense;

            if (isEditing && selectedExpense) {
                // Update existing expense
                updatedExpense = {
                    ...selectedExpense,
                    ...expenseData,
                    amount: parseFloat(expenseData.amount) || 0,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Add new expense
                updatedExpense = {
                    ...expenseData,
                    id: expenseData.id || `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    amount: parseFloat(expenseData.amount) || 0,
                    status: 'pending', // Default status
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            // Use Context's updateLocal (which includes smartSync)
            await updateLocal('expenses', updatedExpense);

            toast.success(isEditing ? 'Expense updated successfully' : `Expense "${expenseData.title}" added successfully`);
            setShowExpenseForm(false);
        } catch (error) {
            console.error('Error saving expense:', error);
            toast.error('Failed to save expense');
        }
    };

    const handleStatusChange = async (expense: Expense, newStatus: Expense['status']) => {
        if (user?.role !== 'operator' && user?.role !== 'admin') {
            toast.error('Unauthorized access');
            return;
        }
        try {
            const updatedExpense = {
                ...expense,
                status: newStatus,
                updatedAt: new Date().toISOString()
            };

            await updateLocal('expenses', updatedExpense);
            toast.success(`Status updated to ${newStatus}`);
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    // Manual refresh function (replaces manual sync)
    const handleRefresh = async () => {
        try {
            await refreshCollection('expenses');
            toast.success('Expenses refreshed from local database');
        } catch (error) {
            console.error('Error refreshing expenses:', error);
            toast.error('Failed to refresh expenses');
        }
    };

    // Export to CSV
    const handleExportCSV = () => {
        try {
            const headers = ['ID', 'Title', 'Amount', 'Category', 'Status', 'Date', 'Vendor', 'Payment Method', 'Description'];
            const csvData = expenses.map(expense => [
                expense.id,
                expense.title,
                expense.amount,
                (categoryLabels[expense.category] || categoryLabels.other).label,
                (statusLabels[expense.status] || statusLabels.pending).label,
                formatDate(expense.date),
                expense.vendor || 'N/A',
                paymentMethodLabels[expense.paymentMethod],
                expense.description
            ]);

            const csvContent = [
                headers.join(','),
                ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast.success('Expenses exported to CSV successfully');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            toast.error('Failed to export CSV');
        }
    };

    // Calculate category totals
    const categoryTotals = (expenses || []).reduce((acc, expense) => {
        const cat = expense?.category;
        if (!cat) return acc;
        if (!acc[cat]) {
            acc[cat] = 0;
        }
        acc[cat] += (Number(expense?.amount) || 0);
        return acc;
    }, {} as Record<ExpenseCategory, number>);

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Expenses Management</h1>
                        <p className="text-muted-foreground">Loading expenses data...</p>
                    </div>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Expenses Management</h1>
                    <p className="text-muted-foreground">Track and manage clinic expenses</p>

                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleExportCSV}
                        className="gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download Report
                    </Button>
                    <Button
                        onClick={handleAddExpense}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                        <Plus className="w-4 h-4" />
                        Add Expense
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalExpenses)}</div>
                            <div className="text-sm text-blue-600 font-medium">Total Expenses</div>
                        </div>
                        <DollarSign className="w-8 h-8 text-blue-600" />
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-green-700">{formatCurrency(paidExpenses)}</div>
                            <div className="text-sm text-green-600 font-medium">Paid Expenses</div>
                        </div>
                        <Building className="w-8 h-8 text-green-600" />
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-yellow-700">{formatCurrency(pendingExpenses)}</div>
                            <div className="text-sm text-yellow-600 font-medium">Pending Expenses</div>
                        </div>
                        <AlertCircle className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>
            </div>

            {/* Category Summary */}
            {expenses.length > 0 && (
                <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-medium mb-3">Expenses by Category</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(categoryTotals).map(([category, amount]) => (
                            <div key={category} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <Badge className={(categoryLabels[category as ExpenseCategory] || categoryLabels.other).color}>
                                        {(categoryLabels[category as ExpenseCategory] || categoryLabels.other).label}
                                    </Badge>
                                    <span className="font-bold">{formatCurrency(amount)}</span>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                    {totalExpenses > 0 ? `${((amount / totalExpenses) * 100).toFixed(1)}% of total` : '0% of total'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search expenses by title, description, vendor..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setSearchTerm('');
                            setSelectedCategory('all');
                            setSelectedStatus('all');
                            setCurrentPage(1);
                        }}
                    >
                        Clear Filters
                    </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value as ExpenseCategory | 'all');
                                setCurrentPage(1);
                            }}
                            className="px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="all">All Categories</option>
                            {Object.entries(categoryLabels).map(([value, { label }]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <select
                            value={selectedStatus}
                            onChange={(e) => {
                                setSelectedStatus(e.target.value as Expense['status'] | 'all');
                                setCurrentPage(1);
                            }}
                            className="px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="all">All Status</option>
                            {Object.entries(statusLabels).map(([value, { label }]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-3 font-medium">Title</th>
                                <th className="text-left p-3 font-medium">Amount</th>
                                <th className="text-left p-3 font-medium">Category</th>
                                <th className="text-left p-3 font-medium">Date</th>
                                <th className="text-left p-3 font-medium">Status</th>
                                <th className="text-left p-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                                        {expenses.length === 0 ? 'No expenses found. Add your first expense!' : 'No expenses match your search criteria.'}
                                    </td>
                                </tr>
                            ) : (
                                currentExpenses.map((expense) => (
                                    <tr
                                        key={expense.id}
                                        className="border-b hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="p-3">
                                            <div className="font-medium">{expense.title}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {expense.description}
                                            </div>
                                            {expense.vendor && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    <User className="inline w-3 h-3 mr-1" />
                                                    {expense.vendor}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold">{formatCurrency(expense.amount)}</div>
                                            <div className="text-xs text-gray-500">
                                                {paymentMethodLabels[expense.paymentMethod] || expense.paymentMethod || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <Badge className={(categoryLabels[expense.category] || categoryLabels.other).color}>
                                                {(categoryLabels[expense.category] || categoryLabels.other).label}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-gray-500" />
                                                <span>{formatDate(expense.date)}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className={(statusLabels[expense.status] || statusLabels.pending).color}
                                                >
                                                    {(statusLabels[expense.status] || statusLabels.pending).label}
                                                </Badge>
                                                {expense.status === 'pending' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleStatusChange(expense, 'paid')}
                                                        className="h-6 text-xs"
                                                    >
                                                        Mark Paid
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => handleEditExpense(expense, e)}
                                                    className="h-8 w-8 p-0"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => handleDeleteExpense(expense, e)}
                                                    className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredExpenses.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-t gap-3">
                        <div className="text-sm text-muted-foreground">
                            Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredExpenses.length)} of {filteredExpenses.length}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="flex items-center px-3 text-sm">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Expense Form Modal */}
            {showExpenseForm && (
                <ExpenseFormModal
                    open={showExpenseForm}
                    onClose={() => setShowExpenseForm(false)}
                    onSubmit={handleSaveExpense}
                    expense={selectedExpense}
                    isEditing={isEditing}
                />
            )}
        </div>
    );
}
