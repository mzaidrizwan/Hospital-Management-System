import { getFromLocal, saveToLocal } from '@/services/indexedDbUtils';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const LICENSE_STORE = 'settings';
const LICENSE_DOC_ID = 'clinic_license';

/**
 * Standardized License Validation Logic
 * Generates a key based on Clinic Name, Current Month, Current Year, and a Hidden Salt.
 */
export async function validateLicense(inputKey: string, clinicName: string): Promise<boolean> {
    const SECRET_SALT = "import{useData}from'@/context/DataContext';";
    const date = new Date();
    // Month is 0-indexed, so we add 1
    const dataString = `${clinicName.toLowerCase().trim()}-${date.getFullYear()}-${date.getMonth() + 1}-${SECRET_SALT}`;

    // Generate SHA-256
    const msgBuffer = new TextEncoder().encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Take first 8 characters as the key
    const validKey = fullHash.substring(0, 8).toUpperCase();
    return inputKey.toUpperCase() === validKey;
}

/**
 * Legacy wrapper or helper for backward compatibility if needed
 */
export const validateLicenseKey = async (inputKey: string, clinicName: string): Promise<boolean> => {
    return await validateLicense(inputKey, clinicName);
};

export const applyLicense = async (key: string, clinicName: string): Promise<{ success: boolean; message: string }> => {
    try {
        if (!clinicName) {
            return { success: false, message: 'Clinic name is required for validation.' };
        }

        const isValid = await validateLicense(key, clinicName);

        if (!isValid) {
            return { success: false, message: 'Invalid license key for this clinic and month.' };
        }

        return { success: true, message: 'License key validated successfully.' };

    } catch (error: any) {
        console.error('Apply license error:', error);
        return { success: false, message: error.message || 'Failed to apply license.' };
    }
};
