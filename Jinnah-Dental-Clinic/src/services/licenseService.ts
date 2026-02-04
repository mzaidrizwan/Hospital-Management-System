import { getFromLocal, saveToLocal } from '@/services/indexedDbUtils';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const LICENSE_STORE = 'settings';
const LICENSE_DOC_ID = 'clinic_license';

// Private salt for hash generation - DO NOT EXPOSE CLIENT-SIDE IN A REAL APP if possible,
// but for a standalone local-first app, this provides basic tampering protection.
const SECRET_SALT = 'jinnah-dental-secure-salt-v1-x9y8z7';

/**
 * Validates a license key using SHA-256 hashing.
 * Key Format: YEAR-MONTH-HASH (e.g., "2025-12-a1b2c3d4e5")
 */
export const validateLicenseKey = async (inputKey: string, clinicId: string): Promise<boolean> => {
    // TEMPORARY BYPASS: Always return true for development
    return true;
    /*
    try {
        const parts = inputKey.split('-');
        if (parts.length !== 3) return false;

        const [yearStr, monthStr, providedHash] = parts;
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        // 1. Basic Date Validation
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return false;
        }

        // 2. Check Expiry
        // Set to the last second of the specified month
        // new Date(year, month, 0) gives the last day of the *previous* month if not careful.
        // Month in Date constructor is 0-indexed (0=Jan, 11=Dec).
        // if input month is 12 (Dec), we want next year's 0th month (Jan) day 0.
        const expiryDate = new Date(year, month, 0);
        expiryDate.setHours(23, 59, 59, 999);

        if (expiryDate < new Date()) {
            console.warn('License key is for a past date');
            return false;
        }

        // 3. Verify Hash
        // Payload: "clinicId:YEAR:MONTH:SALT"
        // Ensure month is 2 digits for consistency (e.g. '01' not '1')
        const normalizedMonth = month.toString().padStart(2, '0');
        const payload = `${clinicId}:${year}:${normalizedMonth}:${SECRET_SALT}`;

        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Compare first 10 characters
        const expectedHash = hashHex.substring(0, 10);

        return providedHash === expectedHash;
    } catch (error) {
        console.error('License validation check failed:', error);
        return false;
    }
    */
};

/**
 * Applies a license key to the current installation.
 */
export const applyLicense = async (key: string): Promise<{ success: boolean; message: string }> => {
    try {
        // 1. Get current Clinic ID
        const settings = await getFromLocal('clinicSettings', 'clinic-settings');
        const clinicId = settings?.id || 'clinic-settings';

        // 2. Validate (Async)
        const isValid = await validateLicenseKey(key, clinicId);

        if (!isValid) {
            return { success: false, message: 'Invalid or expired license key.' };
        }

        // 3. Extract Expiry for storage
        const [year, month] = key.split('-');
        // Calculate end of month date for storage
        const expiryDate = new Date(parseInt(year), parseInt(month), 0);
        expiryDate.setHours(23, 59, 59, 999);

        const licenseData = {
            id: LICENSE_DOC_ID,
            key: key,
            clinicId: clinicId,
            expiryDate: expiryDate.toISOString(),
            status: 'active',
            updatedAt: new Date().toISOString()
        };

        // 4. Save to Local IndexedDB
        await saveToLocal(LICENSE_STORE, licenseData);

        // 5. Sync to Firebase
        try {
            const clinicRef = doc(db, 'clinics', clinicId);
            await setDoc(clinicRef, {
                licenseKey: key,
                licenseExpiry: expiryDate.toISOString(),
                licenseStatus: 'active',
                lastLicenseUpdate: new Date().toISOString()
            }, { merge: true });
        } catch (syncError) {
            console.error('Firebase sync for license failed:', syncError);
        }

        return { success: true, message: 'License applied successfully.' };

    } catch (error: any) {
        console.error('Apply license error:', error);
        return { success: false, message: error.message || 'Failed to apply license.' };
    }
};
