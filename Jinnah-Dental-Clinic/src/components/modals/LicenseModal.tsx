'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, ShieldCheck, AlertCircle } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

interface LicenseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LicenseModal({ open, onOpenChange }: LicenseModalProps) {
    const { activateLicense } = useData();
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!licenseKey.trim()) {
            toast.error("Please enter a license key");
            return;
        }

        setIsLoading(true);

        try {
            const success = await activateLicense(licenseKey);

            if (success) {
                onOpenChange(false);
                setLicenseKey('');
            }
        } catch (error) {
            console.error('License application failed:', error);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2">
                        <Key className="w-8 h-8 text-primary" />
                    </div>
                    <DialogTitle className="text-xl font-black text-center">Activate Product License</DialogTitle>
                    <DialogDescription className="text-center">
                        Enter your valid license key to activate the full version of the Hospital Management System.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="licenseKey" className="text-xs font-bold uppercase text-muted-foreground">License Key</Label>
                        <Input
                            id="licenseKey"
                            value={licenseKey}
                            onChange={(e) => setLicenseKey(e.target.value)}
                            placeholder="Paste your license key here..."
                            className="h-12 font-mono text-sm"
                            autoComplete="off"
                        />
                    </div>

                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            Validating this key will verify your clinic ID and subscription period. Internet connection recommended.
                        </p>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-11 font-bold shadow-md"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Verifying...' : 'Activate License'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
