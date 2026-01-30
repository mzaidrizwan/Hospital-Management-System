'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertTriangle, Package, Edit, Trash2, X, Save, TrendingDown, Receipt, RefreshCw, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Firebase
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query
} from 'firebase/firestore';

// IndexedDB Utilities
import { saveToLocal, getFromLocal, deleteFromLocal, openDB } from '@/services/indexedDbUtils';

const syncToFirebase = async (collectionName: string, item: any) => {
  try {
    await setDoc(doc(db, collectionName, item.id), item);
    console.log(`Synced ${item.id} to Firebase ${collectionName}`);
    return true;
  } catch (err) {
    console.error(`Firebase sync failed for ${collectionName}:`, err);
    throw err;
  }
};

const loadFromFirebase = async (collectionName: string): Promise<any[]> => {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error(`Firebase load failed for ${collectionName}:`, err);
    return [];
  }
};

const categories = ['Materials', 'Supplies', 'Anesthetics', 'Instruments', 'Equipment', 'Medications'];

export default function AdminInventory() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedItemForSale, setSelectedItemForSale] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleNotes, setSaleNotes] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    quantity: 0,
    min: 0,
    category: 'Supplies',
    expiry: '',
    price: 0
  });

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Syncing latest data...",
      });
      // Auto-sync when back online
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Offline",
        description: "Changes will be saved locally and synced when online.",
        variant: "default"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic auto-sync (every 5 minutes when online)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && !isSyncing) {
        console.log('Periodic auto-sync...');
        handleSync();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOnline, isSyncing]);

  // Initialize DB and load data - SWR approach
  useEffect(() => {
    async function initializeAndLoad() {
      // Step 1: Initialize IndexedDB
      await openDB();

      // Step 2: STALE - Load everything from local IndexedDB first (Milliseconds)
      try {
        const [localInventory, localSales] = await Promise.all([
          getFromLocal('inventory'),
          getFromLocal('sales')
        ]);

        if (localInventory?.length > 0 || localSales?.length > 0) {
          setInventory(localInventory || []);
          setSales(localSales || []);
          setLowStockItems((localInventory || []).filter(item => item.quantity < item.min));
          // Switch off loading immediately if we have local data
          setIsLoading(false);
        }

        // Step 3: REVALIDATE - Always trigger background sync if online
        if (navigator.onLine) {
          handleSync(localInventory?.length === 0); // Pass true if we should show sync toast
        } else {
          setIsLoading(false); // Make sure to turn off loader if offline
        }

      } catch (err) {
        console.error('Initial load failed:', err);
        setIsLoading(false);
      }
    }

    initializeAndLoad();
  }, []);

  // Manual/Background Sync (pull from Firebase)
  const handleSync = async (showToast = true) => {
    if (!navigator.onLine) return;

    if (showToast) {
      toast({
        title: "Syncing...",
        description: "Fetching latest data from Firebase",
      });
    }

    setIsSyncing(true);

    try {
      const [remoteInventory, remoteSales] = await Promise.all([
        loadFromFirebase('inventory'),
        loadFromFirebase('sales')
      ]);

      // Save to local storage in parallel
      await Promise.all([
        ...remoteInventory.map(item => saveToLocal('inventory', item)),
        ...remoteSales.map(item => saveToLocal('sales', item))
      ]);

      // Update state
      setInventory(remoteInventory);
      setSales(remoteSales);
      setLowStockItems(remoteInventory.filter(item => item.quantity < item.min));
      setLastSyncTime(new Date().toLocaleTimeString());
      setIsLoading(false); // Just in case it was still loading

      if (showToast) {
        toast({
          title: "Synced",
          description: `Loaded ${remoteInventory.length} items from cloud.`,
        });
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setIsLoading(false);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter inventory based on search and category
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate total sales value
  const totalSalesValue = sales.reduce((total, sale) => total + (sale.price * sale.quantity), 0);

  // CRUD Operations for Inventory - Local-first writes
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.sku) {
      toast({
        title: "Validation Error",
        description: "Name and SKU are required fields.",
        variant: "destructive"
      });
      return;
    }

    const newItemWithId = {
      ...newItem,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      quantity: parseInt(newItem.quantity.toString()) || 0,
      min: parseInt(newItem.min.toString()) || 0,
      price: parseFloat(newItem.price.toString()) || 0,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save to IndexedDB first (immediate local update)
      await saveToLocal('inventory', newItemWithId);

      // 2. Update local state immediately
      setInventory(prev => [...prev, newItemWithId]);

      // 3. Check low stock
      if (newItemWithId.quantity < newItemWithId.min) {
        setLowStockItems(prev => [...prev, newItemWithId]);
      }

      // 4. Reset form and close modal
      setNewItem({ name: '', sku: '', quantity: 0, min: 0, category: 'Supplies', expiry: '', price: 0 });
      setIsAddDialogOpen(false);

      // 5. Background sync to Firebase (async, don't wait)
      if (isOnline) {
        try {
          await syncToFirebase('inventory', newItemWithId);
          toast({
            title: "Success",
            description: "Item added and synced to Firebase!",
          });
        } catch (error) {
          toast({
            title: "Warning",
            description: "Item added locally but failed to sync to Firebase. Will retry later.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Offline",
          description: "Item added locally. Will sync to Firebase when online.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Failed to add item:', error);

      if (error.message?.includes('does not exist')) {
        toast({
          title: "Error",
          description: "Database storage issue. Please refresh page or click 'Reset Database'",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add item to local storage.",
          variant: "destructive"
        });
      }
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem({ ...item });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem?.name || !editingItem?.sku) {
      toast({
        title: "Validation Error",
        description: "Name and SKU are required fields.",
        variant: "destructive"
      });
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
      // 1. Save to IndexedDB first (immediate local update)
      await saveToLocal('inventory', updatedItem);

      // 2. Update local state immediately
      setInventory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));

      // 3. Update low stock
      setLowStockItems(prev => {
        const filtered = prev.filter(item => item.id !== updatedItem.id);
        if (updatedItem.quantity < updatedItem.min) {
          return [...filtered, updatedItem];
        }
        return filtered;
      });

      // 4. Close modal
      setIsEditDialogOpen(false);
      setEditingItem(null);

      // 5. Background sync to Firebase (async, don't wait)
      if (isOnline) {
        try {
          await syncToFirebase('inventory', updatedItem);
          toast({
            title: "Success",
            description: "Item updated and synced to Firebase!",
          });
        } catch (error) {
          toast({
            title: "Warning",
            description: "Item updated locally but failed to sync to Firebase. Will retry later.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Offline",
          description: "Item updated locally. Will sync to Firebase when online.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Failed to update item:', error);
      toast({
        title: "Error",
        description: "Failed to update item in local storage.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      // 1. Delete from IndexedDB first
      await deleteFromLocal('inventory', id);

      // 2. Update local state
      setInventory(prev => prev.filter(item => item.id !== id));

      // 3. Update low stock
      setLowStockItems(prev => prev.filter(item => item.id !== id));

      // 4. Background delete from Firebase
      if (isOnline) {
        try {
          await deleteDoc(doc(db, 'inventory', id));
          toast({
            title: "Deleted",
            description: "Item removed from inventory and Firebase.",
          });
        } catch (error) {
          toast({
            title: "Warning",
            description: "Item deleted locally but failed to remove from Firebase. Will retry later.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Offline",
          description: "Item deleted locally. Will sync with Firebase when online.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete item from local storage.",
        variant: "destructive"
      });
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
      toast({
        title: quantityToSell <= 0 ? "Invalid Quantity" : "Insufficient Stock",
        description: quantityToSell <= 0 ? "Please enter a valid quantity greater than 0." : `Only ${selectedItemForSale.quantity} units available.`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessingSale(true);

    try {
      // Create sale record
      const saleRecord = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      // Update inventory quantity
      const updatedItem = {
        ...selectedItemForSale,
        quantity: selectedItemForSale.quantity - quantityToSell
      };

      // 1. Save to IndexedDB first (both sale and updated inventory)
      await Promise.all([
        saveToLocal('sales', saleRecord),
        saveToLocal('inventory', updatedItem)
      ]);

      // 2. Update local state immediately
      setSales(prev => [saleRecord, ...prev]);
      setInventory(prev => prev.map(item =>
        item.id === selectedItemForSale.id ? updatedItem : item
      ));

      // 3. Update low stock if needed
      setLowStockItems(prev => {
        const filtered = prev.filter(item => item.id !== selectedItemForSale.id);
        if (updatedItem.quantity < updatedItem.min) {
          return [...filtered, updatedItem];
        }
        return filtered;
      });

      // 4. Close dialog
      setIsSellDialogOpen(false);
      setSelectedItemForSale(null);
      setSaleQuantity(1);
      setSaleNotes('');

      // 5. Background sync to Firebase (async, don't wait)
      if (isOnline) {
        try {
          await Promise.all([
            syncToFirebase('sales', saleRecord),
            syncToFirebase('inventory', updatedItem)
          ]);
          toast({
            title: "Success",
            description: `${quantityToSell} unit(s) of ${selectedItemForSale.name} sold and synced to Firebase!`,
          });
        } catch (error) {
          toast({
            title: "Warning",
            description: "Sale recorded locally but failed to sync to Firebase. Will retry later.",
            variant: "default"
          });
        }
      } else {
        toast({
          title: "Offline",
          description: "Sale recorded locally. Will sync to Firebase when online.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Sale failed:', error);
      toast({
        title: "Error",
        description: "Failed to process sale. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  // Emergency database reset
  const handleResetDatabase = async () => {
    if (window.confirm('This will reset the entire local database. Continue?')) {
      setIsLoading(true);
      try {
        const success = await dbManager.resetDatabase();
        if (success) {
          toast({
            title: "Success",
            description: "Database reset successful. Refreshing...",
          });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast({
            title: "Error",
            description: "Failed to reset database",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Reset failed:', error);
        toast({
          title: "Error",
          description: "Database reset failed",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingItem((prev: any) => ({ ...prev, [name]: value }));
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Track and manage clinic supplies</p>
          {lowStockItems.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm text-destructive">
                {lowStockItems.length} item(s) below minimum stock
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
            <div className="flex items-center gap-1 text-xs">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <span className="text-green-600">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Offline</span>
                </>
              )}
            </div>
            {lastSyncTime && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : `Last sync: ${lastSyncTime}`}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleResetDatabase}
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              disabled={isSyncing}
            >
              Reset DB
            </Button>
            <Button
              onClick={handleSync}
              variant="outline"
              disabled={isSyncing || !isOnline}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-auto grid-cols-2">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales History</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                }}
              >
                <X className="w-4 h-4" />
                Clear
              </Button>
            </div>
          </div>

          {/* Inventory Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-center">Price</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <div className="text-muted-foreground">No inventory items found</div>
                          <Button
                            variant="outline"
                            className="mt-2"
                            onClick={() => setIsAddDialogOpen(true)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Item
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((item) => {
                        const isLow = item.quantity < item.min;
                        const isOutOfStock = item.quantity === 0;
                        return (
                          <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Package className="w-4 h-4 text-primary" />
                                </div>
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{item.sku}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={isLow ? 'text-destructive font-semibold' : isOutOfStock ? 'text-muted-foreground' : ''}>
                                {item.quantity}
                              </span>
                              <span className="text-muted-foreground text-xs"> / {item.min}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              ${item.price.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isOutOfStock ? (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Out of Stock
                                </Badge>
                              ) : isLow ? (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Low Stock
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                  In Stock
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.expiry || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => handleSellItem(item)}
                                  disabled={item.quantity === 0}
                                >
                                  <TrendingDown className="w-3 h-3" />
                                  Sell
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditItem(item)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
          {/* Sales Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-sm text-blue-600">Total Sales</div>
                  <div className="text-2xl font-bold text-blue-700">${totalSalesValue.toFixed(2)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="text-sm text-green-600">Items Sold</div>
                  <div className="text-2xl font-bold text-green-700">
                    {sales.reduce((total, sale) => total + sale.quantity, 0)}
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="text-sm text-purple-600">Total Transactions</div>
                  <div className="text-2xl font-bold text-purple-700">{sales.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Sold By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <div className="text-muted-foreground">No sales records found</div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {new Date(sale.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">{sale.itemName}</TableCell>
                          <TableCell>{sale.sku}</TableCell>
                          <TableCell className="text-center">{sale.quantity}</TableCell>
                          <TableCell className="text-right">${sale.price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ${sale.total.toFixed(2)}
                          </TableCell>
                          <TableCell>{sale.soldBy}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {sale.notes || '-'}
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

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
            <DialogDescription>
              {!isOnline && (
                <div className="flex items-center gap-2 text-amber-600 mt-1">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-sm">Offline - Item will be saved locally</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                name="name"
                value={newItem.name}
                onChange={handleInputChange}
                placeholder="Enter item name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                name="sku"
                value={newItem.sku}
                onChange={handleInputChange}
                placeholder="Enter SKU"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Current Quantity</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  value={newItem.quantity}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min">Minimum Stock</Label>
                <Input
                  id="min"
                  name="min"
                  type="number"
                  value={newItem.min}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  value={newItem.price}
                  onChange={handleInputChange}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>
              <Save className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={editingItem.name}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input
                  id="edit-sku"
                  name="sku"
                  value={editingItem.sku}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Current Quantity</Label>
                  <Input
                    id="edit-quantity"
                    name="quantity"
                    type="number"
                    value={editingItem.quantity}
                    onChange={handleEditInputChange}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-min">Minimum Stock</Label>
                  <Input
                    id="edit-min"
                    name="min"
                    type="number"
                    value={editingItem.min}
                    onChange={handleEditInputChange}
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price ($)</Label>
                  <Input
                    id="edit-price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={editingItem.price}
                    onChange={handleEditInputChange}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={editingItem.category}
                    onValueChange={(value) => setEditingItem(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Item Dialog */}
      <Dialog open={isSellDialogOpen} onOpenChange={setIsSellDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sell Item</DialogTitle>
            <DialogDescription>
              Record a sale for {selectedItemForSale?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItemForSale && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Available Stock:</span>
                  <span className={`font-semibold ${selectedItemForSale.quantity < selectedItemForSale.min ? 'text-destructive' : ''}`}>
                    {selectedItemForSale.quantity} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Price per unit:</span>
                  <span className="font-semibold">${selectedItemForSale.price.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale-quantity">Quantity to Sell *</Label>
                <Input
                  id="sale-quantity"
                  type="number"
                  value={saleQuantity}
                  onChange={(e) => setSaleQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  max={selectedItemForSale.quantity}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum available: {selectedItemForSale.quantity} units
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale-notes">Notes (Optional)</Label>
                <Input
                  id="sale-notes"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Add any notes about this sale"
                />
              </div>

              <div className="bg-primary/5 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span className="text-xl font-bold text-primary">
                    ${(selectedItemForSale.price * (parseInt(saleQuantity.toString()) || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Remaining stock after sale:</span>
                  <span>
                    {selectedItemForSale.quantity - (parseInt(saleQuantity.toString()) || 0)} units
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSellDialogOpen(false)} disabled={isProcessingSale}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSale} disabled={isProcessingSale}>
              {isProcessingSale ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Confirm Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}