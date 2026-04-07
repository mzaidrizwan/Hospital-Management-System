'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';


import {
  Expense,
  ExpenseCategory,
  PaymentMethod
} from '@/types';

// Local Expense interface removed in favor of @/types/index.ts

// IndexedDB Utilities
// import { saveToLocal, openDB } from '@/services/expireindexedDbUtils_OLDs';
import { dbManager, STORE_CONFIGS, getKeyPath } from '@/lib/indexedDB';

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
  { value: 'online', label: 'Online' },
  { value: 'wallet', label: 'Wallet' }
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
    paidBy: '',
    // Hidden fields for cascading updates
    staffId: '',
    inventoryItemId: '',
    units: '',
    unitPrice: '',
    fullPaymentDateTime: '',
    paymentDate: '',
    paymentTime: '',
    expenseId: '' // Linked ID if needed
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database on component mount
  useEffect(() => {
    const init = async () => {
      try {
        // await openDB();
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
        date: expense.date ? (expense.date.includes('T') ? expense.date.split('T')[0] : expense.date) : new Date().toISOString().split('T')[0],
        description: expense.description || '',
        vendor: expense.vendor || '',
        receiptNumber: expense.receiptNumber || '',
        status: expense.status || 'pending',
        paidBy: expense.paidBy || '',
        // Preserve extra fields
        staffId: (expense as any).staffId || '',
        inventoryItemId: (expense as any).inventoryItemId || '',
        units: (expense as any).units?.toString() || '',
        unitPrice: (expense as any).unitPrice?.toString() || '',
        fullPaymentDateTime: (expense as any).fullPaymentDateTime || '',
        paymentDate: (expense as any).paymentDate || '',
        paymentTime: (expense as any).paymentTime || '',
        expenseId: (expense as any).expenseId || ''
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
        paidBy: '',
        staffId: '',
        inventoryItemId: '',
        units: '',
        unitPrice: '',
        fullPaymentDateTime: '',
        paymentDate: '',
        paymentTime: '',
        expenseId: ''
      });
    }
  }, [expense]);

  // Recalculate amount when units or unitPrice changes (for inventory category)
  useEffect(() => {
    if (formData.category === 'inventory') {
      const units = parseFloat(formData.units || '0');
      const unitPrice = parseFloat(formData.unitPrice || '0');
      if (units >= 0 && unitPrice >= 0) {
        const calculatedAmount = (units * unitPrice).toString();
        if (calculatedAmount !== formData.amount) {
          setFormData(prev => ({ ...prev, amount: calculatedAmount }));
        }
      }
    }
  }, [formData.units, formData.unitPrice, formData.category]);

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
        await dbManager.putItem('expenses', expenseData);
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
    // if (confirm('This will delete all local data and create fresh database. Continue?')) {
    //   setIsSubmitting(true);
    //   try {
    //     const deleteRequest = indexedDB.deleteDatabase('ClinicDB');
    //     deleteRequest.onsuccess = () => {
    //       window.location.reload();
    //     };
    //   } catch (error) {
    //     toast.error('Failed to reset database');
    //   } finally {
    //     setIsSubmitting(false);
    //   }
    // }
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
            {/* <button
              onClick={handleResetDatabase}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              title="Reset Database"
            >
              
            </button> */}
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
              <Label htmlFor="amount">Amount (Rs.) *</Label>
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

          {/* Conditional Inventory/Salary Fields */}
          {(formData.category === 'inventory' || formData.category === 'salary') && (
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">
                {formData.category === 'inventory' ? 'Inventory Details' : 'Salary Details'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {formData.category === 'inventory' && (
                  <>
                    <div>
                      <Label htmlFor="units">Units Purchased</Label>
                       <Input
                          id="units"
                          name="units"
                          type="number"
                          value={formData.units}
                          onChange={handleChange}
                          placeholder="Qty"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <Label htmlFor="unitPrice">Unit Price (Rs.)</Label>
                        <Input
                          id="unitPrice"
                          name="unitPrice"
                          type="number"
                          value={formData.unitPrice}
                          onChange={handleChange}
                          placeholder="Price per unit"
                          disabled={isSubmitting}
                        />
                      </div>
                  </>
                )}
                {formData.category === 'salary' && (
                  <div>
                    <Label htmlFor="staffId">Staff ID (Link)</Label>
                    <Input
                      id="staffId"
                      name="staffId"
                      value={formData.staffId}
                      onChange={handleChange}
                      placeholder="Staff identifier"
                      disabled={isSubmitting}
                      readOnly={isEditing} // Prevent changing link after creation for safety
                    />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-blue-600 italic">
                Editing these values will automatically update corresponding {formData.category} records.
              </p>
            </div>
          )}

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