'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Package,
  Edit,
  Trash2,
  X,
  Save,
  TrendingDown,
  Receipt,
  RefreshCw,
  CheckCircle,
  Wifi,
  WifiOff,
  LayoutGrid,
  History,
  Loader2,
  Download,
  Info,
  ShoppingCart
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from "sonner";
import { Skeleton } from '@/components/ui/skeleton';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { InventoryFormModal } from '@/components/modals/InventoryFormModal';

// IndexedDB Utilities
import { saveToLocal, getFromLocal, deleteFromLocal, openDB } from '@/services/indexedDbUtils';
import { smartSync, smartDelete } from '@/services/syncService';

const categories = ['Materials', 'Supplies', 'Anesthetics', 'Instruments', 'Equipment', 'Medications'];

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return 'PKR 0';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function AdminInventory() {
  const {
    inventory: contextInventory,
    sales: contextSales,
    expenses,
    loading: dataLoading,
    isOnline,
    setInventory,
    setSales,
    updateLocal,
    exportSalesHistoryToCSV
  } = useData();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);
  const [activeView, setActiveView] = useState('stock'); // 'stock' | 'sales' | 'purchases'
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Edit sale states
  const [isEditSaleDialogOpen, setIsEditSaleDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editSaleQuantity, setEditSaleQuantity] = useState(1);
  const [editSaleNotes, setEditSaleNotes] = useState('');

  // Filtered inventory based on search and category
  const filteredInventory = useMemo(() => {
    return (contextInventory || []).filter(item => {
      if (!item) return false;
      const matchesSearch = (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [contextInventory, searchTerm, selectedCategory]);

  const sortedSales = useMemo(() => {
    return [...(contextSales || [])].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [contextSales]);

  // Calculate total sales value
  const totalSalesValue = useMemo(() => {
    return (contextSales || []).reduce((total, sale) => total + (Number(sale.price || 0) * Number(sale.quantity || 0)), 0);
  }, [contextSales]);

  const totalItemsSold = useMemo(() => {
    return (contextSales || []).reduce((total, sale) => total + Number(sale.quantity || 0), 0);
  }, [contextSales]);

  const lowStockItems = useMemo(() => {
    return (contextInventory || []).filter(item => item && Number(item.quantity || 0) < Number(item.min || 0));
  }, [contextInventory]);

  // Inventory Purchases logic
  const inventoryPurchases = useMemo(() => {
    return (expenses || [])
      .filter(exp => exp.category === 'inventory')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

  // CRUD Operations for Inventory - Local-first writes
  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      // 1. Delete from IndexedDB immediately
      await deleteFromLocal('inventory', id);

      // 2. Manually update context state for instant UI update
      setInventory(prev => prev.filter(i => i.id !== id));

      // 3. Background Sync (No await)
      smartDelete('inventory', id).catch(err => {
        console.error('Background delete sync failed:', err);
      });

      toast.success("Item removed from inventory.");
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error("Failed to delete item.");
    }
  };

  // Sales Operations - Local-first writes
  const handleSellItem = (item: any) => {
    setSelectedItemForSale(item);
    setSaleQuantity(1);
    setSaleNotes('');
    setIsSellDialogOpen(true);
  };

  const handleConfirmSale = () => {
    if (!selectedItemForSale) return;

    const quantityToSell = parseInt(saleQuantity.toString()) || 1;
    const currentItem = { ...selectedItemForSale };

    if (quantityToSell <= 0 || quantityToSell > currentItem.quantity) {
      toast.error(quantityToSell <= 0 ? "Please enter a valid quantity." : `Only ${currentItem.quantity} units available.`);
      return;
    }

    // 1. Capture details for sync
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

    // 2. OPTIMISTIC UPDATE: Immediate UI cleanup
    setIsSellDialogOpen(false);
    setSelectedItemForSale(null);
    setSaleQuantity(1);

    // 3. Update local React states directly for instant feedback
    setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    setSales(prev => [saleRecord, ...(prev || [])]);

    // 4. Show success toast immediately
    toast.success(`${quantityToSell} unit(s) of ${itemName} sold!`);

    // 5. Background Synchronization (Non-blocking)
    const performSync = async () => {
      try {
        await Promise.all([
          smartSync('sales', saleRecord),
          smartSync('inventory', updatedItem)
        ]);
        // Also update IndexedDB via updateLocal for persistence
        await updateLocal('inventory', updatedItem);
        await updateLocal('sales', saleRecord);
      } catch (error) {
        console.error('Background sale sync failed:', error);
      }
    };

    performSync();
  };

  // Delete sale record and restore inventory
  const handleDeleteSale = async (sale: any) => {
    if (!window.confirm(`Delete this sale of ${sale.quantity} unit(s) of ${sale.itemName}?`)) return;

    try {
      // 1. Find and update the inventory item (restore quantity)
      const inventoryItem = contextInventory.find(item => item.id === sale.itemId);
      if (inventoryItem) {
        const updatedItem = {
          ...inventoryItem,
          quantity: inventoryItem.quantity + sale.quantity
        };
        await updateLocal('inventory', updatedItem);
        setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      }

      // 2. Delete the sale record
      await deleteFromLocal('sales', sale.id);
      setSales(prev => prev.filter(s => s.id !== sale.id));

      // 3. Background sync
      smartDelete('sales', sale.id).catch(err => console.error('Background delete failed:', err));

      toast.success(`Sale deleted and ${sale.quantity} unit(s) restored to inventory`);
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    }
  };

  // Delete purchase record (expense)
  const handleDeletePurchase = async (purchase: any) => {
    if (!window.confirm(`Delete this purchase record for ${purchase.title}?`)) return;

    try {
      // Delete the expense record
      await deleteFromLocal('expenses', purchase.id);

      // Background sync
      smartDelete('expenses', purchase.id).catch(err => console.error('Background delete failed:', err));

      toast.success('Purchase record deleted');

      // Refresh to update the list
      window.location.reload();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error('Failed to delete purchase record');
    }
  };

  // Open edit sale dialog
  const handleEditSale = (sale: any) => {
    setEditingSale(sale);
    setEditSaleQuantity(sale.quantity);
    setEditSaleNotes(sale.notes || '');
    setIsEditSaleDialogOpen(true);
  };

  // Save edited sale
  const handleSaveEditedSale = async () => {
    if (!editingSale) return;

    const newQuantity = parseInt(editSaleQuantity.toString()) || 1;
    const oldQuantity = editingSale.quantity;
    const quantityDifference = newQuantity - oldQuantity;

    if (newQuantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    try {
      // 1. Find and update inventory item
      const inventoryItem = contextInventory.find(item => item.id === editingSale.itemId);
      if (inventoryItem) {
        // If quantity increased, reduce inventory; if decreased, restore inventory
        const updatedItem = {
          ...inventoryItem,
          quantity: inventoryItem.quantity - quantityDifference
        };

        if (updatedItem.quantity < 0) {
          toast.error(`Not enough stock. Only ${inventoryItem.quantity} units available.`);
          return;
        }

        await updateLocal('inventory', updatedItem);
        setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      }

      // 2. Update the sale record
      const updatedSale = {
        ...editingSale,
        quantity: newQuantity,
        total: editingSale.price * newQuantity,
        notes: editSaleNotes,
        updatedAt: new Date().toISOString()
      };

      await updateLocal('sales', updatedSale);
      setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));

      // 3. Close dialog
      setIsEditSaleDialogOpen(false);
      setEditingSale(null);

      toast.success('Sale updated successfully');
    } catch (error) {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    }
  };

  const handleExportSales = () => {
    if (!contextSales || contextSales.length === 0) {
      toast.error('No sales data to export');
      return;
    }

    const reportData = (contextSales || []).map(sale => ({
      "Date": sale.date ? new Date(sale.date).toLocaleDateString() : 'N/A',
      "Product": sale.itemName || 'N/A',
      "Quantity": sale.quantity || 0,
      "Total Price": sale.total || 0,
    }));

    exportToCSV(reportData, `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success("Sales report exported successfully");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (dataLoading) {
    return <LoadingSpinner message="Accessing inventory records..." />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          </div>
          <p className="text-muted-foreground font-medium">Track and manage clinic supplies & equipment</p>
          {lowStockItems.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-destructive font-semibold text-sm bg-destructive/5 p-2 rounded-md border border-destructive/10 w-fit">
              <AlertTriangle className="w-4 h-4" />
              <span>{lowStockItems.length} item(s) below minimum stock</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button className="gap-2 shadow-sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add New Item
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="stock" className="gap-2 rounded-lg px-6">
            <LayoutGrid className="w-4 h-4" />
            Stock Inventory
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 rounded-lg px-6">
            <History className="w-4 h-4" />
            Sales History
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2 rounded-lg px-6">
            <ShoppingCart className="w-4 h-4" />
            Purchasing History
          </TabsTrigger>
        </TabsList>

        {/* Stock Inventory Tab */}
        <TabsContent value="stock" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                className="pl-10 h-10 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px] h-10 shadow-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto">
                  <SelectItem value="All">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || selectedCategory !== 'All') && (
                <Button
                  variant="ghost"
                  className="h-10 px-3"
                  onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold">Item Details</TableHead>
                      <TableHead className="text-center font-bold">Category</TableHead>
                      <TableHead className="text-center font-bold">Stock Status</TableHead>
                      {isAdmin && <TableHead className="text-center font-bold text-amber-600">Buying Price</TableHead>}
                      <TableHead className="text-center font-bold">Selling Price</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <Package className="w-16 h-16 mx-auto mb-4 opacity-10" />
                          <div className="text-lg font-medium text-muted-foreground">No inventory items matching your filters</div>
                          <Button variant="link" onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}>Clear all filters</Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((item) => {
                        const isLow = Number(item.quantity || 0) < Number(item.min || 1);
                        const isOutOfStock = Number(item.quantity || 0) === 0;
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/10 transition-colors group">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900">{item.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-medium bg-secondary/30 text-secondary-foreground">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-sm font-bold ${isLow ? 'text-destructive' : 'text-gray-900'}`}>
                                    {item.quantity} units
                                  </span>
                                </div>
                                {isOutOfStock ? (
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Out of Stock</span>
                                ) : isLow ? (
                                  <span className="text-[10px] font-bold text-destructive uppercase">Low Stock (Min: {item.min})</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-green-600 uppercase">In Stock</span>
                                )}
                              </div>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center font-medium text-amber-700 bg-amber-50/30">
                                {formatCurrency(item.buyingPrice || 0)}
                              </TableCell>
                            )}
                            <TableCell className="text-center font-bold text-primary">
                              {formatCurrency(item.sellingPrice || item.price || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary"
                                  onClick={() => handleSellItem(item)}
                                  disabled={isOutOfStock}
                                >
                                  <TrendingDown className="w-3.5 h-3.5 mr-1" />
                                  Sell
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteItem(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <History className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sales History</h2>
                <p className="text-xs text-muted-foreground font-medium">Detailed log of all inventory transactions</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2 font-bold border-primary/20 hover:border-primary/50 text-primary transition-all hover:bg-primary/5"
              onClick={handleExportSales}
            >
              <Download className="w-4 h-4" />
              Export Sales Report
            </Button>
          </div>



          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-blue-50/50 border border-blue-100">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Total Sales Revenue</div>
                <div className="text-3xl font-black text-blue-900">{formatCurrency(totalSalesValue)}</div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-green-50/50 border border-green-100">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="text-sm font-bold text-green-600 uppercase tracking-widest mb-1">Total Units Sold</div>
                <div className="text-3xl font-black text-green-900">{totalItemsSold}</div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-purple-50/50 border border-purple-100">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="text-sm font-bold text-purple-600 uppercase tracking-widest mb-1">Total Transactions</div>
                <div className="text-3xl font-black text-purple-900">{sortedSales.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold">Timestamp</TableHead>
                      <TableHead className="font-bold">Product</TableHead>
                      <TableHead className="text-center font-bold">Qty</TableHead>
                      <TableHead className="text-right font-bold">Unit Price</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                      {isAdmin && <TableHead className="text-right font-bold text-emerald-600">Profit</TableHead>}
                      <TableHead className="font-bold">Notes</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-20">
                          <Receipt className="w-16 h-16 mx-auto mb-4 opacity-10" />
                          <div className="text-lg font-medium text-muted-foreground">No sales recorded yet</div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedSales.map((sale) => (
                        <TableRow key={sale.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {new Date(sale.date).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{sale.itemName}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{sale.sku}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold">{sale.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(sale.price)}</TableCell>
                          <TableCell className="text-right font-black text-gray-900">
                            {formatCurrency(sale.total)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right font-bold text-emerald-600">
                              {formatCurrency((Number(sale.sellingPrice || sale.price || 0) - Number(sale.buyingPrice || 0)) * Number(sale.quantity || 0))}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {sale.notes || '--'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => handleEditSale(sale)}
                                title="Edit Sale"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteSale(sale)}
                                title="Delete Sale"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchasing History Tab */}
        <TabsContent value="purchases" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Purchasing History</h2>
                <p className="text-xs text-muted-foreground font-medium">Auto-generated log of stock acquisitions</p>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold">Date of Purchase</TableHead>
                      <TableHead className="font-bold">Item Name</TableHead>
                      <TableHead className="text-center font-bold">Quantity Added</TableHead>
                      <TableHead className="text-right font-bold">Buying Price (Each)</TableHead>
                      <TableHead className="text-right font-bold">Total Cost</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
                          <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-10" />
                          <div className="text-lg font-medium text-muted-foreground">No purchase records found</div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      inventoryPurchases.map((p: any) => (
                        <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {format(new Date(p.date), 'MMM dd, yyyy • hh:mm a')}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-gray-900">{p.title.replace('Stock Purchase: ', '')}</span>
                          </TableCell>
                          <TableCell className="text-center font-bold">{p.units || '--'}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(p.unitPrice || 0)}
                          </TableCell>
                          <TableCell className="text-right font-black text-primary">
                            {formatCurrency(p.amount || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDeletePurchase(p)}
                              title="Delete Purchase"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InventoryFormModal
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      <InventoryFormModal
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        editingItem={editingItem}
      />

      {/* Sell Item Dialog */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Register Sale</DialogTitle>
            <DialogDescription className="font-medium">Update stock and record revenue for {selectedItemForSale?.name}</DialogDescription>
          </DialogHeader>
          {selectedItemForSale && (
            <div className="space-y-5 py-4">
              <div className="bg-muted/30 p-4 rounded-xl space-y-3 border border-muted-foreground/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Available Units:</span>
                  <Badge variant={selectedItemForSale.quantity < selectedItemForSale.min ? "destructive" : "default"} className="font-black">
                    {selectedItemForSale.quantity}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Unit Price:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(selectedItemForSale.price)}</span>
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
                    {formatCurrency(selectedItemForSale.price * (parseInt(saleQuantity.toString()) || 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSellDialogOpen(false)} disabled={isProcessingSale} className="font-bold">Cancel</Button>
            <Button onClick={handleConfirmSale} disabled={isProcessingSale} className="font-bold px-8 shadow-lg shadow-primary/20">
              {isProcessingSale ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm & Register Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={isEditSaleDialogOpen} onOpenChange={setIsEditSaleDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Edit className="w-6 h-6 text-amber-600" />
              Edit Sale Record
            </DialogTitle>
            <DialogDescription className="text-sm">
              Modify the sale details. Inventory will be adjusted automatically.
            </DialogDescription>
          </DialogHeader>
          {editingSale && (
            <div className="space-y-6 py-4">
              <div className="bg-gray-50 p-4 rounded-xl border">
                <div className="text-sm font-bold text-gray-600 mb-1">Product</div>
                <div className="text-lg font-black text-gray-900">{editingSale.itemName}</div>
                <div className="text-xs font-mono text-gray-500">{editingSale.sku}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="text-xs font-bold text-blue-600 uppercase mb-1">Original Qty</div>
                  <div className="text-xl font-black text-blue-900">{editingSale.quantity}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <div className="text-xs font-bold text-green-600 uppercase mb-1">Unit Price</div>
                  <div className="text-xl font-black text-green-900">{formatCurrency(editingSale.price)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSaleQuantity" className="text-sm font-bold">
                  New Quantity <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="editSaleQuantity"
                  type="number"
                  min="1"
                  value={editSaleQuantity}
                  onChange={(e) => setEditSaleQuantity(parseInt(e.target.value) || 1)}
                  className="h-12 text-lg font-bold text-center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editSaleNotes" className="text-sm font-bold">Notes (Optional)</Label>
                <Input
                  id="editSaleNotes"
                  value={editSaleNotes}
                  onChange={(e) => setEditSaleNotes(e.target.value)}
                  placeholder="Add any notes..."
                  className="h-10"
                />
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase text-primary/70">New Total:</span>
                  <span className="text-2xl font-black text-primary">
                    {formatCurrency(editingSale.price * (parseInt(editSaleQuantity.toString()) || 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditSaleDialogOpen(false)} className="font-bold">Cancel</Button>
            <Button onClick={handleSaveEditedSale} className="font-bold px-8 bg-amber-600 hover:bg-amber-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}