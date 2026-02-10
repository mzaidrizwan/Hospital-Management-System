'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

interface LicenseModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LicenseModal({ open, onOpenChange }: LicenseModalProps) {
    const { activateLicense, licenseStatus, clinicSettings } = useData();
    const [licenseKey, setLicenseKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Use clinic name for license generation as it matches DataContext validation logic
    const systemId = (clinicSettings?.name || 'Jinnah Dental Clinic').trim();

    const handleCopySystemId = async () => {
        try {
            await navigator.clipboard.writeText(systemId);
            setCopied(true);
            toast.success("Clinic Name copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast.error("Failed to copy Clinic Name");
        }
    };

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

    const isMissing = licenseStatus === 'missing';
    const title = isMissing ? "License Required" : "License Expired";
    const description = isMissing
        ? "No valid license key found. Please enter a license key to activate the Hospital Management System."
        : "Your license has expired. Please enter a new license key to continue using the Hospital Management System.";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2">
                        <Key className="w-8 h-8 text-primary" />
                    </div>
                    <DialogTitle className="text-xl font-black text-center">{title}</DialogTitle>
                    <DialogDescription className="text-center">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    {/* System ID Display */}
                    <div className="flex flex-col space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest leading-none">Your Clinic Name</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCopySystemId}
                                className="h-7 text-[10px] font-bold uppercase gap-1 hover:bg-transparent"
                            >
                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                Copy ID
                            </Button>
                        </div>
                        <Input
                            value={systemId}
                            readOnly
                            className="h-12 font-mono text-sm bg-muted/30 border-2 border-dashed rounded-xl"
                        />
                        <p className="text-xs text-muted-foreground">
                            Copy this ID and provide it to your administrator to generate a license key.
                        </p>
                    </div>

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
        </Dialog >
    );
}
