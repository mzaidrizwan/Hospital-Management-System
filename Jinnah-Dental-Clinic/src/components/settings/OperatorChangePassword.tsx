'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFromLocal } from '@/services/indexedDbUtils';
import { updateUserPasswordLocally } from '@/services/authService';

interface OperatorChangePasswordProps {
    userId: string;
}

export default function OperatorChangePassword({ userId }: OperatorChangePasswordProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Validation Logic
        if (newPassword !== confirmPassword) {
            return toast.error('Passwords do not match');
        }

        if (newPassword.length < 6) {
            return toast.error('Minimum 6 characters required');
        }

        setIsSubmitting(true);

        try {
            // 2. Local-First Verification
            const userRecord = await getFromLocal('users', userId) as any;
            if (!userRecord || userRecord.password !== currentPassword) {
                toast.error('Verification Failed: Incorrect current password');
                setIsSubmitting(false);
                return;
            }

            // 3. Local Write + Background Sync
            // App <-> IndexedDB <-> Firebase
            await updateUserPasswordLocally(userId, newPassword);

            // 4. Instant UI Response
            toast.success('Password updated successfully');

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Operator password update error:', error);
            toast.error('System error: Could not update password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
                <Label htmlFor="opCurrentPassword">Current Password</Label>
                <div className="relative">
                    <Input
                        id="opCurrentPassword"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="opNewPassword">New Password</Label>
                    <Input
                        id="opNewPassword"
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="opConfirmPassword">Confirm Password</Label>
                    <Input
                        id="opConfirmPassword"
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Change My Password
            </Button>
        </form>
    );
}
