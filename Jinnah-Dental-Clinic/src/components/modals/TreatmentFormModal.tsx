'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Treatment } from '@/types';
import { useData } from '@/context/DataContext'; // 1. Use DataContext
import { toast } from 'sonner';

interface TreatmentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void; // Optional now as modal handles save
  treatment?: Treatment | null;
  isEditing?: boolean;
}

export default function TreatmentFormModal({
  open,
  onClose,
  onSubmit,
  treatment,
  isEditing = false
}: TreatmentFormModalProps) {
  const { updateLocal } = useData(); // 2. Get updateLocal
  const [formData, setFormData] = useState({
    name: '',
    fee: '',
    actions: '', // Mapped to description/actions
    duration: '30', // Default
    category: 'General' // Default
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (treatment && isEditing) {
      setFormData({
        name: treatment.name || '',
        fee: treatment.fee?.toString() || '',
        actions: treatment.description || '', // Mapping description to Actions
        duration: treatment.duration?.toString() || '30',
        category: treatment.category || 'General'
      });
    } else {
      setFormData({
        name: '',
        fee: '',
        actions: '',
        duration: '30',
        category: 'General'
      });
    }
  }, [treatment, isEditing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading('Saving treatment...');

    try {
      // 1. Construct Data
      const treatmentId = treatment?.id || `t${Date.now()}`;
      const feeVal = parseFloat(formData.fee) || 0;

      const newTreatment: Treatment = {
        id: treatmentId,
        name: formData.name,
        fee: feeVal,
        description: formData.actions, // Saving Actions as description
        category: formData.category,
        duration: parseInt(formData.duration) || 30,
        createdAt: treatment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 2. Save to Local (IndexedDB + State update)
      await updateLocal('treatments', newTreatment);

      // 3. Notify User
      toast.success(isEditing ? 'Treatment updated' : 'Treatment added', { id: toastId });

      // 4. Close Modal Instantly
      onClose();

      // 5. Call parent callback if provided (for any extra side effects)
      if (onSubmit) {
        // We pass the data, but parent might re-save. 
        // Ideally parent should just refresh/ignore if modal handles it.
        onSubmit(newTreatment);
      }

    } catch (error) {
      console.error('Error saving treatment:', error);
      toast.error('Failed to save treatment', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit Treatment' : 'Add New Treatment'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Treatment Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Scaling & Polishing"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee">Fee ($)</Label>
            <Input
              id="fee"
              type="number"
              min="0"
              step="0.01"
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              placeholder="0.00"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="actions">Actions / Description</Label>
            <Textarea
              id="actions"
              value={formData.actions}
              onChange={(e) => setFormData({ ...formData, actions: e.target.value })}
              placeholder="Enter treatment details or actions..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : (isEditing ? 'Update' : 'Save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
