'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WifiOff } from 'lucide-react';
import { saveToLocal } from '@/services/indexedDbUtils';
import { smartSync } from '@/services/syncService';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

interface InventoryFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingItem?: any;
}

const categories = ['Materials', 'Supplies', 'Anesthetics', 'Instruments', 'Equipment', 'Medications'];

export function InventoryFormModal({ open, onOpenChange, editingItem }: InventoryFormModalProps) {
    const { inventory, setInventory, isOnline, addItem, licenseDaysLeft } = useData();
    const [item, setItem] = useState<{
        id?: string;
        name: string;
        sku: string;
        quantity: number;
        min: number;
        category: string;
        buyingPrice: number;
        sellingPrice: number;
        price: number;
    }>({
        id: undefined,
        name: '',
        sku: '',
        quantity: 0,
        min: 0,
        category: 'Supplies',
        buyingPrice: 0,
        sellingPrice: 0,
        price: 0
    });

    useEffect(() => {
        if (editingItem) {
            setItem({
                ...editingItem,
                buyingPrice: editingItem.buyingPrice || 0,
                sellingPrice: editingItem.sellingPrice || editingItem.price || 0,
                price: editingItem.price || editingItem.sellingPrice || 0
            });
        } else {
            setItem({
                id: undefined,
                name: '',
                sku: '',
                quantity: 0,
                min: 0,
                category: 'Supplies',
                buyingPrice: 0,
                sellingPrice: 0,
                price: 0
            });
        }
    }, [editingItem, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!item.name || !item.sku) {
            toast.error("Name and SKU are required.");
            return;
        }

        // Check for duplicates
        const normalizedName = item.name.toLowerCase().trim();
        const normalizedSKU = item.sku.toLowerCase().trim();

        const duplicateName = inventory?.find((invItem: any) =>
            invItem.name?.toLowerCase().trim() === normalizedName &&
            (!editingItem || invItem.id !== editingItem.id)
        );

        if (duplicateName) {
            toast.error(`Duplicate Name: "${item.name}" already exists in inventory.`);
            return;
        }

        const duplicateSKU = inventory?.find((invItem: any) =>
            invItem.sku?.toLowerCase().trim() === normalizedSKU &&
            (!editingItem || invItem.id !== editingItem.id)
        );

        if (duplicateSKU) {
            toast.error(`Duplicate SKU: "${item.sku}" already exists in inventory.`);
            return;
        }

        if (licenseDaysLeft <= 0) {
            toast.error("License Expired. Please renew to add/edit items.");
            return;
        }

        const itemToSave = {
            ...item,
            id: item.id || `inv-${Date.now()}`,
            quantity: Number(item.quantity) || 0,
            min: Number(item.min) || 0,
            buyingPrice: Number(item.buyingPrice) || 0,
            sellingPrice: Number(item.sellingPrice) || 0,
            price: Number(item.sellingPrice) || 0,
            updatedAt: new Date().toISOString()
        };

        console.log("Saving Item:", itemToSave);

        try {
            await addItem('inventory', itemToSave);
            onOpenChange(false);
            toast.success(editingItem ? "Item updated successfully" : "Item added successfully");
        } catch (error) {
            console.error('Submit failed:', error);
            toast.error("Failed to save changes locally");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">
                        {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
                    </DialogTitle>
                    {!isOnline && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2">
                            <WifiOff className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Offline Mode: Syncing queued</span>
                        </div>
                    )}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="category" className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
                        <Select value={item.category} onValueChange={(value) => setItem(prev => ({ ...prev, category: value }))}>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">Item Name *</Label>
                        <Input
                            id="name"
                            value={item.name}
                            onChange={(e) => setItem(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ex: Alginate Powder"
                            className="h-10 font-medium"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="sku" className="text-xs font-bold uppercase text-muted-foreground">SKU / Code *</Label>
                        <Input
                            id="sku"
                            value={item.sku}
                            onChange={(e) => setItem(prev => ({ ...prev, sku: e.target.value }))}
                            placeholder="Ex: MAT-001"
                            className="h-10 font-mono"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="buyingPrice" className="text-xs font-bold uppercase text-muted-foreground">Buying Price (Per Unit)</Label>
                            <Input
                                id="buyingPrice"
                                type="number"
                                value={item.buyingPrice}
                                onChange={(e) => setItem(prev => ({ ...prev, buyingPrice: parseFloat(e.target.value) || 0 }))}
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="sellingPrice" className="text-xs font-bold uppercase text-muted-foreground">Selling Price (Per Unit)</Label>
                            <Input
                                id="sellingPrice"
                                type="number"
                                value={item.sellingPrice}
                                onChange={(e) => setItem(prev => ({ ...prev, sellingPrice: parseFloat(e.target.value) || 0 }))}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="quantity" className="text-xs font-bold uppercase text-muted-foreground">Stock Quantity</Label>
                            <Input
                                id="quantity"
                                type="number"
                                value={item.quantity}
                                onChange={(e) => setItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="min" className="text-xs font-bold uppercase text-muted-foreground">Low Stock Limit</Label>
                            <Input
                                id="min"
                                type="number"
                                value={item.min}
                                onChange={(e) => setItem(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
                        <Button type="submit" disabled={licenseDaysLeft <= 0} className="font-bold px-8 shadow-md">
                            {editingItem ? 'Save Changes' : 'Add Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
