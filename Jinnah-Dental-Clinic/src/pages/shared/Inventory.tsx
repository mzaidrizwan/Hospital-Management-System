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
    Download,
    Save
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
import { DeleteConfirmationModal } from '@/components/modals/DeleteConfirmationModal';
import { RestockModal } from '@/components/modals/RestockModal';
import { toast } from 'sonner';
import { smartSync, smartDelete } from '@/services/syncService';
// import { deleteFromLocal } from '@/services/expireindexedDbUtils_OLDs';
import { dbManager, STORE_CONFIGS, getKeyPath } from '@/lib/indexedDB';

const categories = ['Materials', 'Supplies', 'Anesthetics', 'Instruments', 'Equipment', 'Medications', 'Other'];

export default function SharedInventory() {
    const {
        inventory: contextInventory,
        sales: contextSales,
        purchases,
        expenses: contextExpenses,
        loading: dataLoading,
        setInventory,
        setSales,
        setPurchases,
        setExpenses,
        updateLocal,
        deleteLocal,
        exportToCSV,
        addItem
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
    const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
    const [restockItem, setRestockItem] = useState<any>(null);
    const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
    const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);

    // Purchase Edit states
    const [isEditPurchaseDialogOpen, setIsEditPurchaseDialogOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<any>(null);
    const [editPurchaseQuantity, setEditPurchaseQuantity] = useState(0);
    const [editPurchasePrice, setEditPurchasePrice] = useState(0);

    const [isEditSaleDialogOpen, setIsEditSaleDialogOpen] = useState(false);
    const [editingSale, setEditingSale] = useState<any>(null);
    const [editSaleQuantity, setEditSaleQuantity] = useState(1);
    const [isProcessingPurchaseEdit, setIsProcessingPurchaseEdit] = useState(false);

    // Sale specific states
    const [saleQuantity, setSaleQuantity] = useState(1);
    const [saleNotes, setSaleNotes] = useState('');
    const [isProcessingSale, setIsProcessingSale] = useState(false);

    // Delete Modal states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfig, setDeleteConfig] = useState<{
        id: string;
        title: string;
        description: React.ReactNode;
        type: 'item' | 'purchase' | 'sale' | 'archive';
    } | null>(null);

    // Date filtering states
    const [salesStartDate, setSalesStartDate] = useState('');
    const [salesEndDate, setSalesEndDate] = useState('');
    const [purchaseStartDate, setPurchaseStartDate] = useState('');
    const [purchaseEndDate, setPurchaseEndDate] = useState('');
    const [deleteSalesHistoryChecked, setDeleteSalesHistoryChecked] = useState(true);

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
        let filtered = [...(contextSales || [])].filter(s => s && s.itemName && !isNaN(Number(s.total)));
        
        if (salesStartDate) {
            const start = new Date(salesStartDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(s => new Date(s.date).getTime() >= start.getTime());
        }
        
        if (salesEndDate) {
            const end = new Date(salesEndDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => new Date(s.date).getTime() <= end.getTime());
        }

        return filtered.sort((a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
    }, [contextSales, salesStartDate, salesEndDate]);

    const sortedPurchases = useMemo(() => {
        // DERIVE FROM EXPENSES to ensure perfect synchronization between Inventory and Finance tabs
        // as requested by the user.
        const inventoryExpenses = (contextExpenses || []).filter(e => e.category === 'inventory');
        
        let filtered = [...inventoryExpenses];
        
        if (purchaseStartDate) {
            const start = new Date(purchaseStartDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(p => new Date(p.date || Date.now()).getTime() >= start.getTime());
        }
        
        if (purchaseEndDate) {
            const end = new Date(purchaseEndDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(p => new Date(p.date || Date.now()).getTime() <= end.getTime());
        }

        return filtered.sort((a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
    }, [contextExpenses, purchaseStartDate, purchaseEndDate]);

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

    const handleRestockItem = (item: any) => {
        setRestockItem(item);
        setIsRestockDialogOpen(true);
    };

    const handleProcessRestock = async (buyData: any) => {
        if (!restockItem) return;

        try {
            await addItem('expenses', {
                title: `Stock Purchase: ${restockItem.name}`,
                amount: buyData.totalCost,
                category: 'inventory',
                date: buyData.date,
                description: `Manual restock for item: ${restockItem.name}`,
                inventoryItemId: restockItem.id,
                units: buyData.quantity,
                unitPrice: buyData.unitPrice,
                sellingPrice: buyData.sellingPrice,
                paymentMethod: buyData.paymentMethod,
                status: 'paid'
            });
            setIsRestockDialogOpen(false);
            setRestockItem(null);
        } catch (err) {
            console.error('Restock failed:', err);
            throw err;
        }
    };

    const handleDeleteItem = (id: string) => {
        const item = contextInventory?.find(i => i && i.id === id);
        setDeleteConfig({
            id,
            type: 'item',
            title: "Delete Stock Item?",
            description: `Are you sure you want to remove "${item?.name || 'this item'}" from the inventory records? This action is permanent.`
        });
        setShowDeleteConfirm(true);
    };

    const handleArchiveItem = (id: string) => {
        const item = contextInventory?.find(i => i && i.id === id);
        setDeleteConfig({
            id,
            type: 'archive',
            title: "Remove from Stock List?",
            description: (
                <div className="space-y-2">
                    <p>Remove <span className="font-bold">"{item?.name || 'this item'}"</span> from the Stock Status list?</p>
                    <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg p-2 border">
                        ✅ Purchasing Records, Sales History, and Expenses for this item will <span className="font-bold">remain untouched</span>.
                    </p>
                </div>
            )
        });
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfig) return;
        setIsDeleting(true);

        try {
            if (deleteConfig.type === 'item') {
                await dbManager.deleteFromLocal('inventory', deleteConfig.id);
                setInventory(prev => prev.filter(i => i.id !== deleteConfig.id));
                smartDelete('inventory', deleteConfig.id);
                toast.success("Item removed");
            } else if (deleteConfig.type === 'archive') {
                // SAFE: only remove from inventory list, leave all linked records intact
                await dbManager.deleteFromLocal('inventory', deleteConfig.id);
                setInventory(prev => prev.filter(i => i.id !== deleteConfig.id));
                smartDelete('inventory', deleteConfig.id);
                toast.success("Item removed from stock list. All records preserved.");
            } else if (deleteConfig.type === 'sale') {
                await deleteLocal('sales', deleteConfig.id);
                toast.success("Sale record voided and stock adjusted");
            } else if (deleteConfig.type === 'purchase') {
                // If it's a purchase derived from expense, delete the expense
                await deleteLocal('expenses', deleteConfig.id, { deleteSalesHistory: deleteSalesHistoryChecked });
                toast.success("Purchase record and linked expense removed");
            } else {
                await deleteLocal('purchases', deleteConfig.id, { deleteSalesHistory: deleteSalesHistoryChecked });
                toast.success("Purchase record voided and stock adjusted");
            }
            setShowDeleteConfirm(false);
        } catch (err) {
            toast.error(`Failed to ${deleteConfig.type === 'item' ? 'delete' : 'void'} record`);
        } finally {
            setIsDeleting(false);
            setDeleteConfig(null);
        }
    };

    // Sale Handlers
    const handleSellItem = (item: any) => {
        setSelectedItemForSale(item);
        setSaleQuantity(1);
        setIsProcessingSale(false);
        setIsSellDialogOpen(true);
    };

    const handleEditSale = (sale: any) => {
        setEditingSale(sale);
        setEditSaleQuantity(sale.quantity);
        setIsEditSaleDialogOpen(true);
    };

    const handleConfirmEditSale = async () => {
        if (!editingSale) return;
        try {
            setIsProcessingSale(true);
            const updatedSale = {
                ...editingSale,
                quantity: editSaleQuantity,
                total: editSaleQuantity * (editingSale.price || editingSale.sellingPrice || 0),
                updatedAt: new Date().toISOString()
            };
            await updateLocal('sales', updatedSale);
            toast.success("Sale record updated and stock adjusted");
            setIsEditSaleDialogOpen(false);
        } catch (err) {
            toast.error("Failed to update record");
        } finally {
            setIsProcessingSale(false);
        }
    };

    const handleDeleteSale = (id: string) => {
        const sale = contextSales?.find(s => s && s.id === id);
        setDeleteConfig({
            id,
            type: 'sale',
            title: "Void Sale Record?",
            description: (
                <div className="space-y-2">
                    <p>Are you sure you want to void this usage record for <strong>{sale?.itemName || 'this item'}</strong>?</p>
                    <p className="text-sm bg-amber-50 text-amber-800 p-2 rounded border border-amber-200">
                        This will automatically return <strong>{sale?.quantity || 0} units</strong> back to the stock level and remove the transaction from financial records.
                    </p>
                </div>
            )
        });
        setShowDeleteConfirm(true);
    };

    const handleConfirmSale = async () => {
        if (!selectedItemForSale) return;

        const totalQtyToSell = parseInt(saleQuantity.toString()) || 1;
        if (totalQtyToSell <= 0 || totalQtyToSell > (selectedItemForSale.quantity || 0)) {
            toast.error("Invalid quantity");
            return;
        }

        setIsProcessingSale(true);

        try {
            // FIFO Logic: Use Stock Layers to calculate exact prices & costs
            const layers = Array.isArray(selectedItemForSale.stockLayers) 
                ? JSON.parse(JSON.stringify(selectedItemForSale.stockLayers)) 
                : [{
                    id: 'legacy-layer',
                    quantity: selectedItemForSale.quantity || 0,
                    buyingPrice: selectedItemForSale.buyingPrice || 0,
                    sellingPrice: selectedItemForSale.sellingPrice || selectedItemForSale.price || 0
                  }];

            let remainingToSell = totalQtyToSell;
            let calculatedTotalSaleAmount = 0;
            let calculatedTotalBuyingCost = 0;
            
            for (let i = 0; i < layers.length; i++) {
                if (remainingToSell <= 0) break;
                if (layers[i].quantity <= 0) continue;

                const consume = Math.min(layers[i].quantity, remainingToSell);
                calculatedTotalSaleAmount += (consume * (layers[i].sellingPrice || 0));
                calculatedTotalBuyingCost += (consume * (layers[i].buyingPrice || 0));
                
                layers[i].quantity -= consume;
                remainingToSell -= consume;
            }

            // Determine new principal display prices for the Inventory (from the NEXT active layer)
            const nextActiveLayer = layers.find((l: any) => l.quantity > 0) || layers[layers.length - 1];

            const saleRecord = {
                id: `sale-${Date.now()}`,
                itemId: selectedItemForSale.id,
                itemName: selectedItemForSale.name,
                sku: selectedItemForSale.sku,
                quantity: totalQtyToSell,
                // Calculated averages for this specific sale (for history display)
                buyingPrice: calculatedTotalBuyingCost / totalQtyToSell,
                sellingPrice: calculatedTotalSaleAmount / totalQtyToSell,
                price: calculatedTotalSaleAmount / totalQtyToSell,
                total: calculatedTotalSaleAmount,
                date: new Date().toISOString(),
                notes: saleNotes,
                soldBy: isAdmin ? "Admin" : "Operator"
            };

            const updatedItem = {
                ...selectedItemForSale,
                quantity: (selectedItemForSale.quantity || 0) - totalQtyToSell,
                stockLayers: layers,
                buyingPrice: nextActiveLayer?.buyingPrice || 0,
                sellingPrice: nextActiveLayer?.sellingPrice || 0,
                updatedAt: new Date().toISOString(),
                _skipPriceCascade: true
            };

            setIsSellDialogOpen(false);

            await Promise.all([
                updateLocal('inventory', updatedItem),
                addItem('sales', saleRecord)
            ]);

            toast.success(`Sold ${totalQtyToSell} units for Rs. ${calculatedTotalSaleAmount}`);
            setSaleNotes('');
            setSaleQuantity(1);
        } catch (err) {
            console.error('Sale failed:', err);
            toast.error("Failed to process transaction");
        } finally {
            setIsProcessingSale(false);
            setSelectedItemForSale(null);
        }
    };

    // Purchase Handlers
    const handleEditPurchase = (purchase: any) => {
        setEditingPurchase(purchase);
        setEditPurchaseQuantity(Number(purchase.units || purchase.quantity || 0));
        setEditPurchasePrice(Number(purchase.unitPrice || purchase.buyingPrice || 0));
        setIsEditPurchaseDialogOpen(true);
    };

    const handleConfirmPurchaseEdit = async () => {
        if (!editingPurchase) return;
        setIsProcessingPurchaseEdit(true);

        const updatedPurchase = {
            ...editingPurchase,
            quantity: Number(editPurchaseQuantity),
            buyingPrice: Number(editPurchasePrice),
            totalCost: Number(editPurchaseQuantity) * Number(editPurchasePrice),
            updatedAt: new Date().toISOString()
        };

        try {
            await updateLocal('purchases', updatedPurchase);
            setIsEditPurchaseDialogOpen(false);
            setEditingPurchase(null);
            toast.success("Purchase record updated and stock adjusted");
        } catch (err) {
            console.error('Purchase edit failed:', err);
            toast.error("Failed to update purchase");
        } finally {
            setIsProcessingPurchaseEdit(false);
        }
    };

    const handleDeletePurchase = (id: string) => {
        // Now id refers to the expense ID or purchase ID
        const purchase = sortedPurchases.find(p => p && p.id === id);
        setDeleteSalesHistoryChecked(true); // default to true
        setDeleteConfig({
            id,
            type: 'purchase',
            title: "Void Purchase Record?",
            description: (
                <div className="space-y-2">
                    <p>Are you sure you want to void this procurement record for <span className="font-bold">"{purchase?.title || (purchase as any)?.name || 'this item'}"</span>?</p>
                    <p className="text-destructive font-bold text-xs uppercase">This will also delete the linked expense entry from the finances tab.</p>
                </div>
            )
        });
        setShowDeleteConfirm(true);
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
                                                    <Button
                                                        variant="ghost" size="sm"
                                                        className="text-amber-600 h-8"
                                                        onClick={() => handleRestockItem(item)}
                                                    >
                                                        <ShoppingCart className="w-4 h-4 mr-1" /> Buy
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleEditItem(item)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {isAdmin && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    {item.quantity <= 0 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-xs font-bold"
                                                            onClick={() => handleArchiveItem(item.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1" /> Delete
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold">Usage History</h2>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2 rounded-xl border border-gray-100 shadow-inner">
                                <div className="flex items-center gap-2 px-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">From</Label>
                                    <Input 
                                        type="date" 
                                        className="h-9 w-[140px] border-none bg-white shadow-sm px-2 text-xs font-bold rounded-lg focus-visible:ring-1 ring-primary/20" 
                                        value={salesStartDate}
                                        onChange={(e) => setSalesStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="hidden sm:block h-5 w-[1px] bg-muted-foreground/20 mx-1" />
                                <div className="flex items-center gap-2 px-2">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">To</Label>
                                    <Input 
                                        type="date" 
                                        className="h-9 w-[140px] border-none bg-white shadow-sm px-2 text-xs font-bold rounded-lg focus-visible:ring-1 ring-primary/20" 
                                        value={salesEndDate}
                                        onChange={(e) => setSalesEndDate(e.target.value)}
                                    />
                                </div>
                                {(salesStartDate || salesEndDate) && (
                                    <div className="flex items-center gap-1 ml-1 mr-1">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-7 px-2 text-[10px] font-black uppercase bg-primary text-white hover:bg-primary/90 rounded-lg" 
                                            onClick={() => { 
                                                const today = new Date().toISOString().split('T')[0];
                                                setSalesStartDate(today); 
                                                setSalesEndDate(today); 
                                            }}
                                        >
                                            Today
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            size="icon" 
                                            className="h-7 w-7 hover:text-destructive hover:bg-destructive/10 rounded-lg" 
                                            onClick={() => { setSalesStartDate(''); setSalesEndDate(''); }}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                )}
                                {!salesStartDate && !salesEndDate && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 px-2 text-[10px] font-black uppercase text-primary hover:bg-primary/10 rounded-lg ml-1" 
                                        onClick={() => { 
                                            const today = new Date().toISOString().split('T')[0];
                                            setSalesStartDate(today); 
                                            setSalesEndDate(today); 
                                        }}
                                    >
                                        Today
                                    </Button>
                                )}
                            </div>
                            <Button variant="outline" size="sm" onClick={handleExportSales} className="h-10 px-4 font-bold border-gray-200 rounded-xl shadow-sm hover:bg-primary hover:text-white transition-all">
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                        </div>
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
                                        <TableHead className="text-right font-bold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedSales.length === 0 ? (
                                        <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-10 opacity-30">No usage recorded</TableCell></TableRow>
                                    ) : (
                                        sortedSales.map((s) => (
                                            <TableRow key={s.id} className="group hover:bg-muted/5 transition-colors">
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
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleEditSale(s)}>
                                                            <Edit className="w-3 h-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSale(s.id)}>
                                                            <Trash2 className="w-3 h-3" />
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

                {/* Purchasing Records */}
                <TabsContent value="purchases" className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ShoppingCart className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Purchasing History</h2>
                                <p className="text-xs text-muted-foreground font-medium">Detailed procurement log of clinic supplies</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-2 rounded-xl border border-gray-100 shadow-inner">
                                <div className="flex items-center gap-2 px-2">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">From</span>
                                    <Input 
                                        type="date" 
                                        className="h-9 w-[140px] border-none bg-white shadow-sm px-2 text-xs font-bold rounded-lg focus-visible:ring-1 ring-primary/20" 
                                        value={purchaseStartDate}
                                        onChange={(e) => setPurchaseStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="hidden sm:block h-5 w-[1px] bg-muted-foreground/20 mx-1" />
                                <div className="flex items-center gap-2 px-2">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground whitespace-nowrap">To</span>
                                    <Input 
                                        type="date" 
                                        className="h-9 w-[140px] border-none bg-white shadow-sm px-2 text-xs font-bold rounded-lg focus-visible:ring-1 ring-primary/20" 
                                        value={purchaseEndDate}
                                        onChange={(e) => setPurchaseEndDate(e.target.value)}
                                    />
                                </div>
                                {(purchaseStartDate || purchaseEndDate) && (
                                    <div className="flex items-center gap-1 ml-1">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-8 px-2 text-[10px] font-black uppercase bg-primary text-white hover:bg-primary/90 rounded-lg" 
                                            onClick={() => { 
                                                const today = new Date().toISOString().split('T')[0];
                                                setPurchaseStartDate(today); 
                                                setPurchaseEndDate(today); 
                                            }}
                                        >
                                            Today
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-lg" 
                                            onClick={() => { setPurchaseStartDate(''); setPurchaseEndDate(''); }}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                                {!purchaseStartDate && !purchaseEndDate && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-8 px-2 text-[10px] font-black uppercase text-primary hover:bg-primary/10 rounded-lg ml-1" 
                                        onClick={() => { 
                                            const today = new Date().toISOString().split('T')[0];
                                            setPurchaseStartDate(today); 
                                            setPurchaseEndDate(today); 
                                        }}
                                    >
                                        Today
                                    </Button>
                                )}
                            </div>
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
                                                 <TableCell className="font-bold text-gray-900">{p.title?.replace('Stock Purchase: ', '') || (p as any).name || 'Stock Purchase'}</TableCell>
                                                 <TableCell className="text-center font-black">{p.units || p.quantity}</TableCell>
                                                 <TableCell className="text-right text-muted-foreground">{formatCurrency(p.unitPrice || p.buyingPrice)}</TableCell>
                                                 <TableCell className="text-right font-black text-primary">{formatCurrency(p.amount || p.totalCost || (Number(p.units || p.quantity) * Number(p.unitPrice || p.buyingPrice)))}</TableCell>
                                                 <TableCell className="text-right">
                                                     <div className="flex gap-1 justify-end">
                                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleEditPurchase(p)}>
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

            <Dialog open={isEditPurchaseDialogOpen} onOpenChange={setIsEditPurchaseDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Edit Purchase Record</DialogTitle>
                    </DialogHeader>
                    {editingPurchase && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted p-4 rounded-xl">
                                <span className="text-sm font-bold uppercase text-muted-foreground block mb-1">Item</span>
                                <span className="text-lg font-black">{editingPurchase.name}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Quantity Purchased</Label>
                                    <Input 
                                        type="number" 
                                        value={editPurchaseQuantity} 
                                        onChange={(e) => setEditPurchaseQuantity(parseInt(e.target.value) || 0)} 
                                        className="h-12 text-lg font-black" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Unit Cost (Rs.)</Label>
                                    <Input 
                                        type="number" 
                                        value={editPurchasePrice} 
                                        onChange={(e) => setEditPurchasePrice(parseFloat(e.target.value) || 0)} 
                                        className="h-12 text-lg font-black" 
                                    />
                                </div>
                            </div>

                             <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-baseline">
                                <span className="text-xs font-bold uppercase">Total Purchase Cost:</span>
                                <span className="text-2xl font-black text-primary">{formatCurrency(Number(editPurchaseQuantity || 0) * Number(editPurchasePrice || 0))}</span>
                            </div>


                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsEditPurchaseDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleConfirmPurchaseEdit} disabled={isProcessingPurchaseEdit} className="font-bold shadow-md shadow-primary/20">
                                    {isProcessingPurchaseEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditSaleDialogOpen} onOpenChange={setIsEditSaleDialogOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Edit Sale Record</DialogTitle>
                    </DialogHeader>
                    {editingSale && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted p-4 rounded-xl">
                                <span className="text-sm font-bold uppercase text-muted-foreground block mb-1">Item</span>
                                <span className="text-lg font-black">{editingSale.itemName}</span>
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Correct Quantity Sold</Label>
                                <Input 
                                    type="number" 
                                    value={editSaleQuantity} 
                                    onChange={(e) => setEditSaleQuantity(parseInt(e.target.value) || 0)} 
                                    className="h-12 text-lg font-black" 
                                />
                            </div>

                            <p className="text-xs text-muted-foreground italic">
                                * Adjusting this will automatically update the Item's Stock Status and Financial reports.
                            </p>

                            <DialogFooter className="gap-2">
                                <Button variant="ghost" onClick={() => setIsEditSaleDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleConfirmEditSale} disabled={isProcessingSale} className="font-bold shadow-md shadow-emerald-500/20">
                                    {isProcessingSale ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <DeleteConfirmationModal
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title={deleteConfig?.title || "Are you sure?"}
                description={
                    <div className="space-y-4 text-left">
                        {deleteConfig?.description || "This action cannot be undone."}
                        {deleteConfig?.type === 'purchase' && (
                            <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="delete-sales"
                                    checked={deleteSalesHistoryChecked}
                                    onChange={(e) => setDeleteSalesHistoryChecked(e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                                />
                                <label htmlFor="delete-sales" className="text-sm font-medium text-red-800 cursor-pointer select-none">
                                    Also delete all Sales History records for this item
                                </label>
                            </div>
                        )}
                    </div>
                }
                isDeleting={isDeleting}
            />
            <RestockModal 
                isOpen={isRestockDialogOpen}
                onClose={() => setIsRestockDialogOpen(false)}
                item={restockItem}
                onRestock={handleProcessRestock}
            />
        </div>
    );
}
