import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, ShieldCheck, ShieldAlert, Calendar, Info, RefreshCw, Copy, Check } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function LicenseSection() {
    const {
        licenseStatus,
        licenseDaysLeft,
        licenseKey,
        licenseExpiryDate,
        activateLicense,
        clinicSettings
    } = useData();

    const [inputKey, setInputKey] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleActivate = async () => {
        if (!inputKey.trim()) {
            toast.error("Please enter a license key");
            return;
        }

        setIsActivating(true);
        const success = await activateLicense(inputKey);
        setIsActivating(false);
        if (success) {
            setInputKey('');
        }
    };

    const copyHardwareId = () => {
        const hardwareId = clinicSettings?.id || 'JINNAH-DENTAL-CLINIC-MAIN';
        navigator.clipboard.writeText(hardwareId);
        setCopied(true);
        toast.success("Hardware ID copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    License Management
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-5 bg-muted/40 rounded-2xl border flex items-center gap-4 transition-all hover:shadow-md">
                        <div className={cn(
                            "p-3 rounded-2xl shadow-sm",
                            licenseStatus === 'valid' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                        )}>
                            {licenseStatus === 'valid' ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Status</p>
                            <p className="text-xl font-bold leading-none capitalize">
                                {licenseStatus === 'valid' ? 'Active' : 'Expired'}
                            </p>
                        </div>
                    </div>

                    <div className="p-5 bg-muted/40 rounded-2xl border flex items-center gap-4 transition-all hover:shadow-md">
                        <div className="p-3 rounded-2xl shadow-sm bg-blue-100 text-blue-600">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">App Intelligence</p>
                            <p className="text-xl font-bold leading-none">v1.4.0 Elite</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-left">
                            <Label className="text-xs font-black uppercase tracking-widest text-primary">Expiration Date</Label>
                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                <Calendar className="w-5 h-5 text-primary/60" />
                                <span className="text-lg font-bold">
                                    {licenseExpiryDate
                                        ? new Date(licenseExpiryDate).toLocaleDateString()
                                        : 'Initializing...'}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-inner border w-full md:w-auto text-center">
                            <p className={cn(
                                "text-4xl font-black leading-none mb-1",
                                licenseDaysLeft <= 7 ? "text-red-500" : "text-primary"
                            )}>
                                {licenseDaysLeft}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Days Remaining</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Current Active Key</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyHardwareId}
                                className="h-7 text-[10px] font-bold uppercase gap-1"
                            >
                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                Copy Hardware ID
                            </Button>
                        </div>
                        <div className="relative group">
                            <Input
                                value={licenseKey || 'NO_KEY_REGISTERED'}
                                readOnly
                                className="h-12 bg-muted/10 font-mono text-base pr-12 border-2 border-dashed group-hover:border-primary/40 transition-all rounded-xl"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-primary ml-1">Enter Renewal Key</Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value)}
                                placeholder="Paste your 30-day renewal key here..."
                                className="h-12 font-mono"
                            />
                            <Button
                                onClick={handleActivate}
                                disabled={isActivating}
                                className="h-12 px-8 rounded-xl font-bold shadow-lg gap-2"
                            >
                                <RefreshCw className={cn("w-5 h-5", isActivating && "animate-spin")} />
                                {isActivating ? 'Activating...' : 'Activate License'}
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
