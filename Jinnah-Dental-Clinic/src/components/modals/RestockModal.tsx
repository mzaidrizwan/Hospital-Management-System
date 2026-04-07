'use client';

import React, { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    ShoppingCart, 
    DollarSign, 
    Hash, 
    Calendar, 
    Wallet,
    Info,
    Tag
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';

interface RestockModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: any;
    onRestock: (buyData: any) => Promise<void>;
}

export function RestockModal({ isOpen, onClose, item, onRestock }: RestockModalProps) {
    const [quantity, setQuantity] = useState<number>(1);
    const [unitPrice, setUnitPrice] = useState<number>(item?.buyingPrice || 0);
    const [sellingPrice, setSellingPrice] = useState<number>(item?.sellingPrice || item?.price || 0);
    const [paymentMethod, setPaymentMethod] = useState<string>('cash');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (item) {
            setUnitPrice(item.buyingPrice || 0);
            setSellingPrice(item.sellingPrice || item.price || 0);
        }
    }, [item]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }
        if (unitPrice <= 0) {
            toast.error("Please enter a valid unit price");
            return;
        }

        setIsSubmitting(true);
        try {
            await onRestock({
                quantity,
                unitPrice,
                sellingPrice,
                totalCost: quantity * unitPrice,
                paymentMethod,
                date: new Date(date).toISOString()
            });
            toast.success(`Successfully restocked ${item.name}`);
            onClose();
        } catch (error) {
            console.error("Restock error:", error);
            toast.error("Failed to process restock record");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    const totalCost = quantity * unitPrice;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="bg-amber-600 text-white p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">Restock Inventory</DialogTitle>
                                <DialogDescription className="text-amber-100 text-xs">
                                    Adding new stock for <span className="font-bold text-white underline">{item.name}</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-5 bg-white">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                            <Info className="w-5 h-5 text-amber-600 shrink-0" />
                            <div className="text-xs text-amber-800 leading-relaxed">
                                This will automatically create an <span className="font-bold">Expense record</span>, update the 
                                <span className="font-bold"> Purchasing History</span>, and increment your current <span className="font-bold">Stock Count</span>.
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> Quantity
                                </Label>
                                <Input 
                                    type="number" 
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(Number(e.target.value))}
                                    className="h-11 font-bold text-lg"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Buy Price
                                </Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    value={unitPrice}
                                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                                    className="h-11 font-bold text-lg"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <Tag className="w-3 h-3 text-primary" /> New Sell Price
                                </Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    value={sellingPrice}
                                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                                    className="h-11 font-bold text-lg text-primary border-primary/20"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                                    <Wallet className="w-3 h-3" /> Payment Method
                                </Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger className="h-11 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="card">Card</SelectItem>
                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        <SelectItem value="online">Online</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Procurement Date
                            </Label>
                            <Input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="h-11 font-bold"
                                required
                            />
                        </div>

                        <div className="pt-2">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <span className="text-sm font-bold text-gray-500">Total Procurement Cost</span>
                                <span className="text-xl font-black text-amber-600">Rs. {totalCost.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="bg-gray-50 p-4 border-t">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="bg-amber-600 hover:bg-amber-700 text-white px-8 font-bold"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Processing..." : "Confirm Purchase"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
