'use client';

import React, { useState, useMemo } from 'react';
import {
    ShoppingCart,
    Search,
    Calendar as CalendarIcon,
    Download,
    Filter,
    Package,
    ArrowRightLeft,
    DollarSign,
    Info
} from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function AdminPurchasing() {
    const { expenses, loading, exportToCSV } = useData();
    const [searchTerm, setSearchTerm] = useState('');

    // Filter expenses to show only inventory purchases
    const purchases = useMemo(() => {
        return (expenses || [])
            .filter(exp => exp.category === 'inventory')
            .filter(exp =>
                exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                exp.description?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, searchTerm]);

    const totalSpent = useMemo(() => {
        return purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }, [purchases]);

    const formatCurrency = (amount: number) => {
        return 'Rs. ' + new Intl.NumberFormat('en-PK', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handleExport = () => {
        const dataToExport = purchases.map(p => {
            const purchase = p as any;
            return {
                Date: format(new Date(purchase.date), 'yyyy-MM-dd'),
                Item: purchase.title.replace('Stock Purchase: ', ''),
                Quantity: purchase.units || '--',
                "Unit Price": purchase.unitPrice || '--',
                "Total Cost": purchase.amount,
                Status: purchase.status
            };
        });
        exportToCSV(dataToExport, `Purchasing_History_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    };

    if (loading) return <LoadingSpinner message="Loading purchasing history..." />;

    return (
        <div className="space-y-6 p-4 md:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-bold">Purchasing History</h1>
                    </div>
                    <p className="text-muted-foreground font-medium">Tracking all inventory stock acquisitions</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={handleExport}>
                    <Download className="w-4 h-4" />
                    Export Report
                </Button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-primary/5 border border-primary/10">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-primary/70 uppercase tracking-widest mb-1">Total Procurement</p>
                            <h3 className="text-3xl font-black text-primary">{formatCurrency(totalSpent)}</h3>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-blue-50/50 border border-blue-100">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Items Procured</p>
                            <h3 className="text-3xl font-black text-blue-900">{purchases.length}</h3>
                        </div>
                        <div className="p-3 bg-blue-100/50 rounded-2xl">
                            <Package className="w-6 h-6 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-emerald-50/50 border border-emerald-100">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Latest Order</p>
                            <h3 className="text-lg font-bold text-emerald-900">
                                {purchases.length > 0 ? format(new Date(purchases[0].date), 'MMM dd, yyyy') : '--'}
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-100/50 rounded-2xl">
                            <CalendarIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Card className="border-none shadow-md overflow-hidden bg-white">
                <CardHeader className="border-b bg-muted/20 pb-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <CardTitle className="text-lg font-bold">Transaction Ledger</CardTitle>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by item name..."
                                className="pl-10 h-10 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="w-[180px] font-bold">Purchase Date</TableHead>
                                    <TableHead className="font-bold">Inventory Item</TableHead>
                                    <TableHead className="text-center font-bold">Quantity</TableHead>
                                    <TableHead className="text-right font-bold">Unit Cost</TableHead>
                                    <TableHead className="text-right font-bold text-primary">Total Cost</TableHead>
                                    <TableHead className="text-center font-bold">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {purchases.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-20">
                                            <div className="flex flex-col items-center opacity-20">
                                                <ArrowRightLeft className="w-16 h-16 mb-4" />
                                                <p className="text-xl font-bold">No purchase records found</p>
                                                <p className="text-sm">Items added with Buying Price will appear here</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    purchases.map((p) => {
                                        const purchase = p as any;
                                        return (
                                            <TableRow key={purchase.id} className="hover:bg-primary/5 transition-colors group">
                                                <TableCell className="font-medium text-muted-foreground">
                                                    {format(new Date(purchase.date), 'MMM dd, yyyy • hh:mm a')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                            <Package className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <span className="font-bold text-gray-900">
                                                            {purchase.title.replace('Stock Purchase: ', '')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="font-black bg-muted/50">
                                                        {purchase.units || '--'} units
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-muted-foreground">
                                                    {purchase.unitPrice ? formatCurrency(purchase.unitPrice) : '--'}
                                                </TableCell>
                                                <TableCell className="text-right font-black text-primary">
                                                    {formatCurrency(purchase.amount)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
                                                        {purchase.status.toUpperCase()}
                                                    </Badge>
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

            {/* Info Box */}
            <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex gap-3 text-sm text-primary/80">
                <Info className="w-5 h-5 shrink-0" />
                <p>
                    These records are automatically generated when an item is added to the <strong>Inventory</strong> with a specified <strong>Buying Price</strong>.
                    Deleting an expense record here will not affect the inventory quantity, but it will affect financial reporting.
                </p>
            </div>
        </div>
    );
}
