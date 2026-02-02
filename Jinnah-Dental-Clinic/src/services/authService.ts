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
/**
 * updateUserPasswordLocally
 * Direct local password update with background sync and session preservation.
 */
export const updateUserPasswordLocally = async (userId: string, newPassword: string): Promise<boolean> => {
    try {
        // 1. Update password in the 'users' store within IndexedDB immediately
        const storedUser = await getFromLocal('users', userId);
        if (!storedUser) throw new Error('User record not found in local storage.');

        const updatedUser = {
            ...storedUser,
            password: newPassword,
            lastUpdated: Date.now(),
            updatedAt: new Date().toISOString()
        };

        await saveToLocal('users', updatedUser);

        // 2. Add a 'passwordUpdate' task to the 'syncQueue' for Firebase
        // smartSync handles naming and queueing if offline. We trigger it in background.
        smartSync('users', updatedUser).catch(err => {
            console.error('Background password sync failed:', err);
        });

        // 3. Update the current user session in localStorage so they don't get logged out
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
            const currentUser = JSON.parse(currentUserStr);
            // Check if this updated user is the one currently logged in
            if (currentUser.role === userId || currentUser.id === userId) {
                localStorage.setItem('currentUser', JSON.stringify({
                    ...currentUser,
                    password: newPassword
                }));
            }
        }

        return true;
    } catch (error: any) {
        console.error('updateUserPasswordLocally error:', error);
        throw error;
    }
};
