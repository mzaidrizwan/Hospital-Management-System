'use client';

import React, { useState, useMemo } from 'react';
import {
    Search,
    Package,
    History,
    ShoppingCart,
    LayoutGrid,
    Info,
    PackagePlus,
    Receipt,
    Loader2
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { InventoryFormModal } from '@/components/modals/InventoryFormModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { smartSync } from '@/services/syncService';

export default function OperatorInventory() {
    const {
        inventory: contextInventory,
        sales: contextSales,
        expenses,
        loading: dataLoading,
        setInventory,
        setSales,
        updateLocal
    } = useData();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState('stock');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Sale states
    const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
    const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);
    const [saleQuantity, setSaleQuantity] = useState(1);
    const [saleNotes, setSaleNotes] = useState('');
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    const filteredInventory = useMemo(() => {
        return (contextInventory || []).filter(item =>
            (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );
    }, [contextInventory, searchTerm]);

    const sortedSales = useMemo(() => {
        return [...(contextSales || [])].sort((a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
    }, [contextSales]);

    const inventoryPurchases = useMemo(() => {
        return (expenses || [])
            .filter(exp => exp.category === 'inventory')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const handleSellItem = (item: any) => {
        setSelectedItemForSale(item);
        setSaleQuantity(1);
        setSaleNotes('');
        setIsSellDialogOpen(true);
    };

    const handleConfirmSale = async () => {
        if (!selectedItemForSale) return;

        if (isLicenseExpired) {
            toast.error("License Expired. Please renew to process sales.");
            return;
        }

        const quantityToSell = parseInt(saleQuantity.toString()) || 1;
        const currentItem = { ...selectedItemForSale };

        if (quantityToSell <= 0 || quantityToSell > currentItem.quantity) {
            toast.error(quantityToSell <= 0 ? "Please enter a valid quantity." : `Only ${currentItem.quantity} units available.`);
            return;
        }

        setIsProcessingSale(true);
        const itemName = currentItem.name;

        const saleRecord = {
            id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            itemId: currentItem.id,
            itemName: itemName,
            sku: currentItem.sku,
            quantity: quantityToSell,
            buyingPrice: currentItem.buyingPrice || 0,
            sellingPrice: currentItem.sellingPrice || currentItem.price || 0,
            price: currentItem.sellingPrice || currentItem.price || 0,
            total: (currentItem.sellingPrice || currentItem.price || 0) * quantityToSell,
            date: new Date().toISOString(),
            notes: saleNotes,
            soldBy: isAdmin ? "Admin" : "Operator"
        };

        const updatedItem = {
            ...currentItem,
            quantity: currentItem.quantity - quantityToSell
        };

        try {
            // Optimistic Update
            setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
            setSales(prev => [saleRecord, ...(prev || [])]);
            setIsSellDialogOpen(false);

            // Persistence & Sync
            await Promise.all([
                updateLocal('inventory', updatedItem),
                updateLocal('sales', saleRecord),
                smartSync('sales', saleRecord),
                smartSync('inventory', updatedItem)
            ]);

            toast.success(`${quantityToSell} unit(s) of ${itemName} sold!`);
        } catch (error) {
            console.error('Sale failed:', error);
            toast.error("Failed to process sale.");
        } finally {
            setIsProcessingSale(false);
            setSelectedItemForSale(null);
        }
    };

    const { licenseDaysLeft } = useData();
    const isLicenseExpired = licenseDaysLeft <= 0;

    if (dataLoading) return <LoadingSpinner message="Loading inventory..." />;

    return (
        <div className="space-y-6 p-4 md:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Package className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
                    </div>
                    <p className="text-muted-foreground font-medium">Manage stock and track usage</p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} disabled={isLicenseExpired} className="gap-2 font-bold shadow-lg shadow-primary/20 h-11 px-6">
                    <PackagePlus className="w-5 h-5" />
                    Add New Stock
                </Button>
            </div>

            <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
                <TabsList className="bg-muted/50 p-1 rounded-xl">
                    <TabsTrigger value="stock" className="gap-2 rounded-lg px-6">
                        <LayoutGrid className="w-4 h-4" />
                        Stock Status
                    </TabsTrigger>
                    <TabsTrigger value="sales" className="gap-2 rounded-lg px-6">
                        <History className="w-4 h-4" />
                        Recent Usage
                    </TabsTrigger>
                    <TabsTrigger value="purchases" className="gap-2 rounded-lg px-6">
                        <ShoppingCart className="w-4 h-4" />
                        Purchasing Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stock" className="space-y-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search items by name or SKU..."
                            className="pl-10 h-12 bg-white shadow-sm border-gray-100"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Item Details</TableHead>
                                        <TableHead className="text-center font-bold">Stock</TableHead>
                                        <TableHead className="text-center font-bold">Category</TableHead>
                                        <TableHead className="text-right font-bold">Rate</TableHead>
                                        <TableHead className="text-right font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventory.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/10 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{item.name}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.quantity < item.min ? "destructive" : "secondary"}>
                                                    {item.quantity} units
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline">{item.category}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-primary">
                                                {formatCurrency(item.sellingPrice || item.price || 0)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-primary hover:text-primary hover:bg-primary/10 font-bold gap-1.5"
                                                    onClick={() => handleSellItem(item)}
                                                    disabled={item.quantity <= 0 || isLicenseExpired}
                                                >
                                                    <Receipt className="w-4 h-4" />
                                                    Sell
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sales" className="space-y-6">
                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Date</TableHead>
                                        <TableHead className="font-bold">Item</TableHead>
                                        <TableHead className="text-center font-bold">Qty</TableHead>
                                        <TableHead className="text-right font-bold text-primary">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSales.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 opacity-30">No usage records found</TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedSales.map((sale) => (
                                            <TableRow key={sale.id}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(new Date(sale.date), 'MMM dd, hh:mm a')}
                                                </TableCell>
                                                <TableCell className="font-bold">{sale.itemName}</TableCell>
                                                <TableCell className="text-center font-medium">{sale.quantity}</TableCell>
                                                <TableCell className="text-right font-bold text-primary">{formatCurrency(sale.total)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="purchases" className="space-y-6">
                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Date</TableHead>
                                        <TableHead className="font-bold">Item</TableHead>
                                        <TableHead className="text-center font-bold">Quantity</TableHead>
                                        <TableHead className="text-right font-bold">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inventoryPurchases.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 opacity-30">No purchase history found</TableCell>
                                        </TableRow>
                                    ) : (
                                        inventoryPurchases.map((p: any) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {format(new Date(p.date), 'MMM dd, yyyy')}
                                                </TableCell>
                                                <TableCell className="font-bold">{p.title.replace('Stock Purchase: ', '')}</TableCell>
                                                <TableCell className="text-center font-black">{p.units || '--'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Success</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <InventoryFormModal
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />

            {/* Register Sale Dialog */}
            <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Register Sale</DialogTitle>
                        <DialogDescription className="font-medium text-muted-foreground">Update stock and record revenue for {selectedItemForSale?.name}</DialogDescription>
                    </DialogHeader>

                    {selectedItemForSale && (
                        <div className="space-y-5 py-4">
                            <div className="bg-muted/30 p-4 rounded-xl space-y-3 border border-muted-foreground/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Available Units:</span>
                                    <Badge variant={selectedItemForSale.quantity < selectedItemForSale.min ? "destructive" : "secondary"} className="font-black">
                                        {selectedItemForSale.quantity}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Unit Price:</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(selectedItemForSale.sellingPrice || selectedItemForSale.price)}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="sale-quantity" className="text-xs font-bold uppercase text-muted-foreground">Quantity to Sell *</Label>
                                <Input
                                    id="sale-quantity"
                                    type="number"
                                    value={saleQuantity}
                                    onChange={(e) => setSaleQuantity(parseInt(e.target.value) || 1)}
                                    min="1"
                                    max={selectedItemForSale.quantity}
                                    className="h-12 text-lg font-black text-center"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="sale-notes" className="text-xs font-bold uppercase text-muted-foreground">Sale Notes</Label>
                                <Input
                                    id="sale-notes"
                                    value={saleNotes}
                                    onChange={(e) => setSaleNotes(e.target.value)}
                                    placeholder="Optional notes for this sale"
                                    className="h-10"
                                />
                            </div>

                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold uppercase text-primary/70">Total Receivable:</span>
                                    <span className="text-2xl font-black text-primary">
                                        {formatCurrency((selectedItemForSale.sellingPrice || selectedItemForSale.price || 0) * saleQuantity)}
                                    </span>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button variant="ghost" onClick={() => setIsSellDialogOpen(false)} className="font-bold">Cancel</Button>
                                <Button
                                    onClick={handleConfirmSale}
                                    className="font-bold px-8 shadow-md"
                                    disabled={isProcessingSale || saleQuantity <= 0 || saleQuantity > selectedItemForSale.quantity || isLicenseExpired}
                                >
                                    {isProcessingSale ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Confirm Sale'
                                    )}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex gap-3 text-sm text-primary/80">
                <Info className="w-5 h-5 shrink-0" />
                <p>
                    Inventory changes are synced in real-time. Selling or adding stock here will automatically record transactions for clinical oversight.
                </p>
            </div>
        </div>
    );
}
