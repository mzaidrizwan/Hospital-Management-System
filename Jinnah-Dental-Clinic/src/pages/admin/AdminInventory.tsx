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
  History
} from 'lucide-react';
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

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

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
  const { inventory: contextInventory, sales: contextSales, loading: dataLoading, isOnline } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    quantity: 0,
    min: 0,
    category: 'Supplies',
    expiry: '',
    price: 0
  });

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

  // CRUD Operations for Inventory - Local-first writes
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.sku) {
      toast.error("Name and SKU are required fields.");
      return;
    }

    const newItemWithId = {
      ...newItem,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      quantity: parseInt(newItem.quantity.toString()) || 0,
      min: parseInt(newItem.min.toString()) || 0,
      price: parseFloat(newItem.price.toString()) || 0,
      createdAt: new Date().toISOString()
    };

    try {
      await smartSync('inventory', newItemWithId);
      toast.success("Item added successfully!");
      setNewItem({ name: '', sku: '', quantity: 0, min: 0, category: 'Supplies', expiry: '', price: 0 });
      setIsAddDialogOpen(false);
    } catch (err) {
      console.error('Failed to add item:', err);
      toast.error("Failed to add item.");
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem({ ...item });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem?.name || !editingItem?.sku) {
      toast.error("Name and SKU are required fields.");
      return;
    }

    const updatedItem = {
      ...editingItem,
      quantity: parseInt(editingItem.quantity.toString()) || 0,
      min: parseInt(editingItem.min.toString()) || 0,
      price: parseFloat(editingItem.price.toString()) || 0,
      updatedAt: new Date().toISOString()
    };

    try {
      await smartSync('inventory', updatedItem);
      toast.success("Item updated successfully!");
      setIsEditDialogOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to update item:', err);
      toast.error("Failed to update item.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await smartDelete('inventory', id);
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

  const handleConfirmSale = async () => {
    if (!selectedItemForSale) return;

    const quantityToSell = parseInt(saleQuantity.toString()) || 1;

    if (quantityToSell <= 0 || quantityToSell > selectedItemForSale.quantity) {
      toast.error(quantityToSell <= 0 ? "Please enter a valid quantity." : `Only ${selectedItemForSale.quantity} units available.`);
      return;
    }

    setIsProcessingSale(true);

    try {
      const saleRecord = {
        id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemId: selectedItemForSale.id,
        itemName: selectedItemForSale.name,
        sku: selectedItemForSale.sku,
        quantity: quantityToSell,
        price: selectedItemForSale.price,
        total: selectedItemForSale.price * quantityToSell,
        date: new Date().toISOString(),
        notes: saleNotes,
        soldBy: "Admin"
      };

      const updatedItem = {
        ...selectedItemForSale,
        quantity: selectedItemForSale.quantity - quantityToSell
      };

      await Promise.all([
        smartSync('sales', saleRecord),
        smartSync('inventory', updatedItem)
      ]);

      toast.success(`${quantityToSell} unit(s) of ${selectedItemForSale.name} sold!`);
      setIsSellDialogOpen(false);
      setSelectedItemForSale(null);
    } catch (error) {
      console.error('Sale failed:', error);
      toast.error("Failed to process sale.");
    } finally {
      setIsProcessingSale(false);
    }
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-xs font-medium mr-2">
            {isOnline ? (
              <><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> <span className="text-green-700">Online</span></>
            ) : (
              <><div className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-amber-700">Offline</span></>
            )}
          </div>
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="gap-2 shadow-sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add New Item
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="inventory" className="gap-2 rounded-lg px-6">
            <LayoutGrid className="w-4 h-4" />
            Inventory List
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 rounded-lg px-6">
            <History className="w-4 h-4" />
            Sales History
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
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
                <SelectContent>
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
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="text-center font-bold">Stock</TableHead>
                      <TableHead className="text-center font-bold">Price</TableHead>
                      <TableHead className="text-center font-bold">Status</TableHead>
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
                            <TableCell>
                              <Badge variant="secondary" className="font-medium bg-secondary/30 text-secondary-foreground">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className={`text-sm font-bold ${isLow ? 'text-destructive' : 'text-gray-900'}`}>
                                  {item.quantity}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Min: {item.min}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {formatCurrency(item.price)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isOutOfStock ? (
                                <Badge variant="outline" className="text-muted-foreground bg-muted font-bold">Out of Stock</Badge>
                              ) : isLow ? (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-bold">Low Stock</Badge>
                              ) : (
                                <Badge className="bg-green-50 text-green-700 border-green-100 font-bold">In Stock</Badge>
                              )}
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
                      <TableHead className="font-bold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20">
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
                          <TableCell className="text-right font-black text-green-600">
                            {formatCurrency(sale.total)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {sale.notes || '--'}
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

      {/* Dialogs - Consistent Style */}

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Add New Inventory Item</DialogTitle>
            {!isOnline && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2">
                <WifiOff className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Offline Mode: Syncing queued</span>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">Item Name *</Label>
              <Input
                id="name"
                name="name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Alginate Powder"
                className="h-10 font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sku" className="text-xs font-bold uppercase text-muted-foreground">SKU / Code *</Label>
              <Input
                id="sku"
                name="sku"
                value={newItem.sku}
                onChange={(e) => setNewItem(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="Ex: MAT-001"
                className="h-10 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-bold uppercase text-muted-foreground">Initial Stock</Label>
                <Input id="quantity" type="number" value={newItem.quantity} onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min" className="text-xs font-bold uppercase text-muted-foreground">Low Stock Limit</Label>
                <Input id="min" type="number" value={newItem.min} onChange={(e) => setNewItem(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs font-bold uppercase text-muted-foreground">Price (PKR)</Label>
                <Input id="price" type="number" value={newItem.price} onChange={(e) => setNewItem(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
                <Select value={newItem.category} onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="font-bold">Cancel</Button>
            <Button onClick={handleAddItem} className="font-bold px-8 bg-primary hover:bg-primary/90 shadow-md">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Edit Inventory Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-bold uppercase text-muted-foreground">Item Name *</Label>
                <Input id="edit-name" value={editingItem.name} onChange={(e) => setEditingItem((p: any) => ({ ...p, name: e.target.value }))} className="h-10 font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-sku" className="text-xs font-bold uppercase text-muted-foreground">SKU / Code *</Label>
                <Input id="edit-sku" value={editingItem.sku} onChange={(e) => setEditingItem((p: any) => ({ ...p, sku: e.target.value }))} className="h-10 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-quantity" className="text-xs font-bold uppercase text-muted-foreground">Current Stock</Label>
                  <Input id="edit-quantity" type="number" value={editingItem.quantity} onChange={(e) => setEditingItem((p: any) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-min" className="text-xs font-bold uppercase text-muted-foreground">Low Stock Limit</Label>
                  <Input id="edit-min" type="number" value={editingItem.min} onChange={(e) => setEditingItem((p: any) => ({ ...p, min: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price" className="text-xs font-bold uppercase text-muted-foreground">Price (PKR)</Label>
                  <Input id="edit-price" type="number" value={editingItem.price} onChange={(e) => setEditingItem((p: any) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-category" className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
                  <Select value={editingItem.category} onValueChange={(v) => setEditingItem((p: any) => ({ ...p, category: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="font-bold">Cancel</Button>
            <Button onClick={handleSaveEdit} className="font-bold px-8">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}