'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getFromLocal } from '@/services/indexedDbUtils';
import { updateUserPasswordLocally } from '@/services/authService';

interface AdminChangePasswordProps {
    userId: string;
}

export default function AdminChangePassword({ userId }: AdminChangePasswordProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Password Match Validation
        if (newPassword !== confirmPassword) {
            return toast.error('New passwords do not match');
        }

        if (newPassword.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        setIsSubmitting(true);

        try {
            // 2. Verify Current Password against IndexedDB
            const storedUser = await getFromLocal('users', userId) as any;
            if (!storedUser || storedUser.password !== currentPassword) {
                toast.error('Current password is incorrect');
                setIsSubmitting(false);
                return;
            }

            // 3. Update Locally + Background Sync
            await updateUserPasswordLocally(userId, newPassword);

            // 4. Instant Success UI
            toast.success('Password updated successfully');

            // Clear fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Password update failed:', error);
            toast.error('Failed to update password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
                <Label htmlFor="adminCurrentPassword">Current Password</Label>
                <div className="relative">
                    <Input
                        id="adminCurrentPassword"
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
                    <Label htmlFor="adminNewPassword">New Password</Label>
                    <Input
                        id="adminNewPassword"
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="adminConfirmPassword">Confirm Password</Label>
                    <Input
                        id="adminConfirmPassword"
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Update Admin Password
            </Button>
        </form>
    );
}
