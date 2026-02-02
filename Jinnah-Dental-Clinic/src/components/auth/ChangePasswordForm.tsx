'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { updateUserPassword } from '@/services/authService';

interface ChangePasswordFormProps {
    userId: string;
    onSuccess?: () => void;
}

export function ChangePasswordForm({ userId, onSuccess }: ChangePasswordFormProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'local_success' | 'full_success'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setStatus('loading');

        try {
            // The service handles local save and then Firebase sync.
            // Since IndexedDB is nearly instant, we'll consider local success 
            // once the service call finishes without erroring on validation/local save.

            const isOnline = navigator.onLine;
            const success = await updateUserPassword(userId, currentPassword, newPassword);

            if (success) {
                setStatus(isOnline ? 'full_success' : 'local_success');
                toast.success(isOnline ? 'Password updated and synced!' : 'Password updated locally (Offline)');

                // Clear form
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');

                if (onSuccess) onSuccess();

                // Reset status after a delay
                setTimeout(() => setStatus('idle'), 5000);
            }
        } catch (err: any) {
            console.error('Change password form error:', err);
            toast.error(err.message || 'Failed to change password');
            setStatus('idle');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                    <Input
                        id="currentPassword"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="pr-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(!showPasswords)}
                    >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                    id="newPassword"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                    id="confirmPassword"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />
            </div>

            <div className="pt-2 flex flex-col gap-3">
                <Button
                    type="submit"
                    className="w-full"
                    disabled={status === 'loading'}
                >
                    {status === 'loading' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Lock className="mr-2 h-4 w-4" />
                    )}
                    Change Password
                </Button>

                {status !== 'idle' && status !== 'loading' && (
                    <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Password updated locally</span>
                        </div>
                        {status === 'full_success' ? (
                            <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                                <Cloud className="h-4 w-4" />
                                <span>Synced with Cloud</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                                <Cloud className="h-4 w-4 opacity-50" />
                                <span>Sync pending (Offline)</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </form>
    );
}
