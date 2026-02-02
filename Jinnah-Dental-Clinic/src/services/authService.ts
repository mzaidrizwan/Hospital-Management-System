import { saveToLocal, getFromLocal } from '@/services/indexedDbUtils';
import { smartSync } from '@/services/syncService';

/**
 * updateUserPassword
 * Securely updates a user's password following the {App <-> IndexedDB <-> Firebase} pattern.
 * 
 * @param userId - The unique identifier for the user (role-based in current simplified auth)
 * @param currentPassword - Current password for verification
 * @param newPassword - The new password to set
 */
export const updateUserPassword = async (userId: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
        // 1. Fetch current user data from IndexedDB
        const storedUser = await getFromLocal('users', userId);

        if (!storedUser) {
            throw new Error('User record not found in local storage.');
        }

        // 2. Verify current password matches local records
        if (storedUser.password !== currentPassword) {
            throw new Error('Verification failed: Current password does not match.');
        }

        // 3. Update the record locally first
        const updatedUser = {
            ...storedUser,
            password: newPassword,
            lastUpdated: Date.now(),
            updatedAt: new Date().toISOString()
        };

        // 4. Use smartSync to handle local write + background Firebase sync + syncQueue
        // Collection 'users' must be consistent with the Firebase collection name
        const docId = await smartSync('users', updatedUser);

        // Update successful
        console.log(`Password for user [${userId}] updated successfully via smartSync.`);

        // Also update the convenience 'currentUser' item in localStorage for session consistency
        localStorage.setItem('currentUser', JSON.stringify({
            role: updatedUser.role,
            name: updatedUser.name,
            password: updatedUser.password
        }));

        return true;
    } catch (error: any) {
        console.error('updateUserPassword service error:', error);
        throw error;
    }
};
