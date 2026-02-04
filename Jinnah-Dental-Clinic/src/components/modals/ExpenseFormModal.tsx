'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Types
type ExpenseCategory =
  | 'rent' | 'salary' | 'supplies' | 'utilities' | 'equipment'
  | 'medication' | 'maintenance' | 'inventory' | 'marketing'
  | 'insurance' | 'professional_fees' | 'travel' | 'office_supplies'
  | 'software' | 'other';
type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'online';

interface Expense {
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

// IndexedDB Utilities
import { saveToLocal, openDB } from '@/services/indexedDbUtils';

// Category options
const categoryOptions: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'medication', label: 'Medication' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'other', label: 'Other' }
];

// Payment method options
const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' }
];

// Status options
const statusOptions = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' }
];

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (expenseData: any) => void;
  expense?: Expense | null;
  isEditing?: boolean;
}

export default function ExpenseFormModal({
  open,
  onClose,
  onSubmit,
  expense,
  isEditing = false
}: ExpenseFormModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'rent' as ExpenseCategory,
    paymentMethod: 'cash' as PaymentMethod,
    date: new Date().toISOString().split('T')[0],
    description: '',
    vendor: '',
    receiptNumber: '',
    status: 'pending' as 'paid' | 'pending' | 'cancelled',
    paidBy: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database on component mount
  useEffect(() => {
    const init = async () => {
      try {
        await openDB();
        setDbInitialized(true);
      } catch (error) {
        console.error('Database initialization failed:', error);
        toast.error('Failed to initialize local database.');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (expense) {
      setFormData({
        title: expense.title || '',
        amount: expense.amount?.toString() || '',
        category: expense.category || 'rent',
        paymentMethod: expense.paymentMethod || 'cash',
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        description: expense.description || '',
        vendor: expense.vendor || '',
        receiptNumber: expense.receiptNumber || '',
        status: expense.status || 'pending',
        paidBy: expense.paidBy || ''
      });
    } else {
      // Reset form for new expense
      setFormData({
        title: '',
        amount: '',
        category: 'rent',
        paymentMethod: 'cash',
        date: new Date().toISOString().split('T')[0],
        description: '',
        vendor: '',
        receiptNumber: '',
        status: 'pending',
        paidBy: ''
      });
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dbInitialized) {
      toast.error('Database not ready. Please wait...');
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate
      if (!formData.title.trim()) {
        toast.error('Title is required');
        setIsSubmitting(false);
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error('Valid amount is required');
        setIsSubmitting(false);
        return;
      }

      if (!formData.date) {
        toast.error('Date is required');
        setIsSubmitting(false);
        return;
      }

      // Prepare expense data
      const expenseData: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Generate ID
      if (isEditing && expense) {
        expenseData.id = expense.id;
      } else {
        expenseData.id = `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      console.log('Saving expense:', expenseData);

      // Try to save to IndexedDB
      try {
        await saveToLocal('expenses', expenseData);
        console.log('Expense saved successfully to IndexedDB');
        toast.success('Expense saved successfully');

        // Call parent's onSubmit
        onSubmit(expenseData);

        // Close modal
        onClose();

      } catch (saveError) {
        console.error('Failed to save to IndexedDB:', saveError);
        toast.error('Failed to save expense: ' + saveError.message);
      }

    } catch (error) {
      console.error('Error in form submission:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Quick database reset function for emergency
  const handleResetDatabase = async () => {
    if (confirm('This will delete all local data and create fresh database. Continue?')) {
      setIsSubmitting(true);
      try {
        const deleteRequest = indexedDB.deleteDatabase('ClinicDB');
        deleteRequest.onsuccess = () => {
          window.location.reload();
        };
      } catch (error) {
        toast.error('Failed to reset database');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit Expense' : 'Add New Expense'}
            {!dbInitialized && (
              <span className="text-xs text-red-600 ml-2">(Database Initializing...)</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDatabase}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              title="Reset Database"
            >
              Reset DB
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Monthly Rent, Supplies Purchase"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Amount and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount (USD) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                min="0.01"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
                disabled={isSubmitting}
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {paymentMethodOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date and Receipt Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                name="receiptNumber"
                value={formData.receiptNumber}
                onChange={handleChange}
                placeholder="OPT-001"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Vendor and Paid By */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendor">Vendor/Supplier</Label>
              <Input
                id="vendor"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="Company name"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="paidBy">Paid By</Label>
              <Input
                id="paidBy"
                name="paidBy"
                value={formData.paidBy}
                onChange={handleChange}
                placeholder="Person who made payment"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Details about this expense..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700"
              disabled={isSubmitting || !dbInitialized}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEditing ? 'Updating...' : 'Adding...'}
                </div>
              ) : !dbInitialized ? (
                'Database Not Ready'
              ) : isEditing ? (
                'Update Expense'
              ) : (
                'Add Expense'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}