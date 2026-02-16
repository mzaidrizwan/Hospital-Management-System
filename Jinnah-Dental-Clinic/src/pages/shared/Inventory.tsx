'use client';

import React, { useState, useMemo } from 'react';
import {
    Plus,
    Search,
    Package,
    History,
    ShoppingCart,
    LayoutGrid,
    Info,
    PackagePlus,
    Receipt,
    Loader2,
    TrendingDown,
    Edit,
    Trash2,
    CheckCircle,
    AlertTriangle,
    X,
    Download
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { InventoryFormModal } from '@/components/modals/InventoryFormModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { toast } from 'sonner';
import { smartSync, smartDelete } from '@/services/syncService';
import { deleteFromLocal } from '@/services/indexedDbUtils';

const categories = ['Materials', 'Supplies', 'Anesthetics', 'Instruments', 'Equipment', 'Medications'];

export default function SharedInventory() {
    const {
        inventory: contextInventory,
        sales: contextSales,
        purchases,
        loading: dataLoading,
        setInventory,
        setSales,
        setPurchases,
        updateLocal,
        exportToCSV
    } = useData();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [activeView, setActiveView] = useState('stock');

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
    const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);

    // Sale specific states
    const [saleQuantity, setSaleQuantity] = useState(1);
    const [saleNotes, setSaleNotes] = useState('');
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    // Filtered logic
    const filteredInventory = useMemo(() => {
        return (contextInventory || []).filter(item => {
            if (!item) return false;
            const matchesSearch = (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [contextInventory, searchTerm, setSelectedCategory]);

    const sortedSales = useMemo(() => {
        return [...(contextSales || [])]
            .filter(s => s && s.itemName && !isNaN(Number(s.total)))
            .sort((a, b) =>
                new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
            );
    }, [contextSales]);

    const sortedPurchases = useMemo(() => {
        return [...(purchases || [])]
            .filter(p => p && (p.name || p.title) && !isNaN(Number(p.totalCost || p.amount)))
            .sort((a, b) =>
                new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
            );
    }, [purchases]);

    const lowStockItems = useMemo(() => {
        return (contextInventory || []).filter(item => item && Number(item.quantity || 0) < Number(item.min || 0));
    }, [contextInventory]);

    const formatCurrency = (amount: number) => {
        return 'Rs. ' + new Intl.NumberFormat('en-PK', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Inventory Handlers
    const handleEditItem = (item: any) => {
        setEditingItem(item);
        setIsEditDialogOpen(true);
    };

    const handleDeleteItem = async (id: string) => {
        if (!window.confirm('Delete this item from record?')) return;
        try {
            await deleteFromLocal('inventory', id);
            setInventory(prev => prev.filter(i => i.id !== id));
            smartDelete('inventory', id);
            toast.success("Item removed");
        } catch (err) {
            toast.error("Failed to delete");
        }
    };

    // Sale Handlers
    const handleSellItem = (item: any) => {
        setSelectedItemForSale(item);
        setSaleQuantity(1);
        setSaleNotes('');
        setIsSellDialogOpen(true);
    };

    const handleConfirmSale = async () => {
        if (!selectedItemForSale) return;

        const qty = parseInt(saleQuantity.toString()) || 1;
        if (qty <= 0 || qty > selectedItemForSale.quantity) {
            toast.error("Invalid quantity");
            return;
        }

        setIsProcessingSale(true);
        const saleRecord = {
            id: `sale-${Date.now()}`,
            itemId: selectedItemForSale.id,
            itemName: selectedItemForSale.name,
            sku: selectedItemForSale.sku,
            quantity: qty,
            buyingPrice: selectedItemForSale.buyingPrice || 0,
            sellingPrice: selectedItemForSale.sellingPrice || selectedItemForSale.price || 0,
            price: selectedItemForSale.sellingPrice || selectedItemForSale.price || 0,
            total: (selectedItemForSale.sellingPrice || selectedItemForSale.price || 0) * qty,
            date: new Date().toISOString(),
            notes: saleNotes,
            soldBy: isAdmin ? "Admin" : "Operator"
        };

        const updatedItem = {
            ...selectedItemForSale,
            quantity: selectedItemForSale.quantity - qty
        };

        try {
            setIsSellDialogOpen(false);

            await Promise.all([
                updateLocal('inventory', updatedItem),
                updateLocal('sales', saleRecord)
            ]);

            toast.success("Sale registered");
        } catch (err) {
            console.error('Sale operation failed:', err);
            toast.error("Sale failed");
        } finally {
            setIsProcessingSale(false);
            setSelectedItemForSale(null);
        }
    };

    // Purchase Handlers
    const handleDeletePurchase = async (id: string) => {
        if (!window.confirm('Void this purchase record? (This will not affect stock)')) return;
        try {
            await deleteFromLocal('purchases', id);
            setPurchases(prev => prev.filter(p => p.id !== id));
            smartDelete('purchases', id);
            toast.success("Purchase record voided");
        } catch (err) {
            toast.error("Failed to delete record");
        }
    };

    const handleExportSales = () => {
        const data = sortedSales.map(s => ({
            Date: format(new Date(s.date), 'yyyy-MM-dd HH:mm'),
            Item: s.itemName,
            Qty: s.quantity,
            Total: s.total,
            SoldBy: s.soldBy
        }));
        exportToCSV(data, 'Sales_Report.csv');
    };

    if (dataLoading) return <LoadingSpinner message="Accessing records..." />;

    return (
        <div className="space-y-6 p-4 md:p-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Package className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-bold">Inventory Hub</h1>
                    </div>
                    <p className="text-muted-foreground font-medium text-sm">Centralized stock, sales and procurement management</p>
                    {lowStockItems.length > 0 && (
                        <Badge variant="destructive" className="mt-2 animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {lowStockItems.length} items low on stock
                        </Badge>
                    )}
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 font-bold shadow-lg shadow-primary/20 h-11 px-6">
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
                        Sales History
                    </TabsTrigger>
                    <TabsTrigger value="purchases" className="gap-2 rounded-lg px-6">
                        <ShoppingCart className="w-4 h-4" />
                        Purchasing Records
                    </TabsTrigger>
                </TabsList>

                {/* Stock Status */}
                <TabsContent value="stock" className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search items by name or SKU..."
                                className="pl-10 h-12 bg-white shadow-sm border-gray-100"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-full sm:w-[200px] h-12 bg-white">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Categories</SelectItem>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Item Details</TableHead>
                                        <TableHead className="text-center font-bold">Category</TableHead>
                                        <TableHead className="text-center font-bold">Stock</TableHead>
                                        {isAdmin && <TableHead className="text-right font-bold text-amber-600">Buy Rate</TableHead>}
                                        <TableHead className="text-right font-bold text-primary">Sell Rate</TableHead>
                                        <TableHead className="text-right font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInventory.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-muted/10 transition-colors group">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{item.name}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="bg-secondary/30">{item.category}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={item.quantity < (item.min || 1) ? "destructive" : "secondary"}>
                                                    {item.quantity} units
                                                </Badge>
                                            </TableCell>
                                            {isAdmin && (
                                                <TableCell className="text-right font-medium text-amber-700">
                                                    {formatCurrency(item.buyingPrice || 0)}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right font-bold text-primary">
                                                {formatCurrency(item.sellingPrice || item.price || 0)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                                    <Button
                                                        variant="ghost" size="sm"
                                                        className="text-primary h-8"
                                                        onClick={() => handleSellItem(item)}
                                                        disabled={item.quantity <= 0}
                                                    >
                                                        <Receipt className="w-4 h-4 mr-1" /> Sell
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleEditItem(item)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sales History */}
                <TabsContent value="sales" className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                        <h2 className="text-lg font-bold">Usage History</h2>
                        <Button variant="outline" size="sm" onClick={handleExportSales}>
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                    </div>
                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Timestamp</TableHead>
                                        <TableHead className="font-bold">Item</TableHead>
                                        <TableHead className="text-center font-bold">Qty</TableHead>
                                        <TableHead className="text-right font-bold">Total</TableHead>
                                        {isAdmin && <TableHead className="text-right font-bold text-emerald-600">Profit</TableHead>}
                                        <TableHead className="text-right font-bold">By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSales.length === 0 ? (
                                        <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-10 opacity-30">No usage recorded</TableCell></TableRow>
                                    ) : (
                                        sortedSales.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="text-xs text-muted-foreground">{format(new Date(s.date), 'MMM dd, HH:mm')}</TableCell>
                                                <TableCell className="font-bold">{s.itemName}</TableCell>
                                                <TableCell className="text-center">{s.quantity}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(s.total)}</TableCell>
                                                {isAdmin && (
                                                    <TableCell className="text-right font-bold text-emerald-600">
                                                        {formatCurrency((s.sellingPrice - s.buyingPrice) * s.quantity)}
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-right text-xs uppercase font-bold text-muted-foreground">{s.soldBy}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Purchasing Records */}
                <TabsContent value="purchases" className="space-y-6">
                    <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Purchasing History</h2>
                            <p className="text-xs text-muted-foreground font-medium">Detailed procurement log of clinic supplies</p>
                        </div>
                    </div>

                    <Card className="border-none shadow-md overflow-hidden bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-bold">Date of Purchase</TableHead>
                                        <TableHead className="font-bold">Item Name</TableHead>
                                        <TableHead className="text-center font-bold">Qty Purchased</TableHead>
                                        <TableHead className="text-right font-bold">Unit Cost</TableHead>
                                        <TableHead className="text-right font-bold">Total Expense</TableHead>
                                        <TableHead className="text-right font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedPurchases.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 opacity-20">No purchase history found</TableCell></TableRow>
                                    ) : (
                                        sortedPurchases.map((p: any) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="text-xs text-muted-foreground">{format(new Date(p.date), 'MMM dd, yyyy • HH:mm')}</TableCell>
                                                <TableCell className="font-bold text-gray-900">{p.name || 'Stock Purchase'}</TableCell>
                                                <TableCell className="text-center font-black">{p.quantity}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{formatCurrency(p.buyingPrice)}</TableCell>
                                                <TableCell className="text-right font-black text-primary">{formatCurrency(p.totalCost || (p.quantity * p.buyingPrice))}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {/* Edit Purchase would go here */ }}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePurchase(p.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
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

            {/* Modals */}
            <InventoryFormModal open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
            <InventoryFormModal open={isEditDialogOpen} onOpenChange={(o) => { setIsEditDialogOpen(o); if (!o) setEditingItem(null); }} editingItem={editingItem} />

            <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Register Item Usage</DialogTitle>
                    </DialogHeader>
                    {selectedItemForSale && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted p-4 rounded-xl flex justify-between items-center">
                                <span className="text-sm font-bold uppercase">Stock: {selectedItemForSale.quantity}</span>
                                <span className="text-sm font-bold uppercase">Rate: {formatCurrency(selectedItemForSale.sellingPrice || selectedItemForSale.price)}</span>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Quantity to Use/Sell</Label>
                                <Input type="number" value={saleQuantity} onChange={(e) => setSaleQuantity(parseInt(e.target.value) || 1)} min="1" max={selectedItemForSale.quantity} className="h-12 text-lg font-black text-center" />
                            </div>
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-baseline">
                                <span className="text-xs font-bold uppercase">Total Value:</span>
                                <span className="text-2xl font-black text-primary">{formatCurrency((selectedItemForSale.sellingPrice || selectedItemForSale.price || 0) * saleQuantity)}</span>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsSellDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleConfirmSale} disabled={isProcessingSale} className="font-bold shadow-md shadow-primary/20">
                                    {isProcessingSale ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />} Confirm
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
