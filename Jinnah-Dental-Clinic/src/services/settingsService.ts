import { db } from '@/lib/firebase';
import { Treatment, ClinicSettings } from '@/types';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

const TREATMENTS_COLLECTION = 'treatments';
const CLINIC_SETTINGS_COLLECTION = 'clinic_settings';
const BACKUP_HISTORY_COLLECTION = 'backup_history';

// Treatment CRUD Operations
export const getAllTreatments = async (): Promise<Treatment[]> => {
  try {
    const treatmentsRef = collection(db, TREATMENTS_COLLECTION);
    const q = query(treatmentsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      fee: doc.data().fee,
      category: doc.data().category,
      duration: doc.data().duration,
      description: doc.data().description || '',
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
    })) as Treatment[];
  } catch (error) {
    console.error('Error fetching treatments:', error);
    throw error;
  }
};

export const addTreatment = async (treatmentData: Omit<Treatment, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const treatmentsRef = collection(db, TREATMENTS_COLLECTION);
    
    const newTreatment = {
      ...treatmentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(treatmentsRef, newTreatment);
    return docRef.id;
  } catch (error) {
    console.error('Error adding treatment:', error);
    throw error;
  }
};

export const updateTreatment = async (id: string, updateData: Partial<Treatment>): Promise<void> => {
  try {
    const treatmentRef = doc(db, TREATMENTS_COLLECTION, id);
    
    await updateDoc(treatmentRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating treatment:', error);
    throw error;
  }
};

export const deleteTreatment = async (id: string): Promise<void> => {
  try {
    const treatmentRef = doc(db, TREATMENTS_COLLECTION, id);
    await deleteDoc(treatmentRef);
  } catch (error) {
    console.error('Error deleting treatment:', error);
    throw error;
  }
};

// Clinic Settings Operations
export const getClinicSettings = async (): Promise<ClinicSettings | null> => {
  try {
    const settingsRef = collection(db, CLINIC_SETTINGS_COLLECTION);
    const snapshot = await getDocs(settingsRef);
    
    if (snapshot.empty) {
      // Create default settings if none exist
      const defaultSettings: ClinicSettings = {
        clinicName: 'City Dental Clinic',
        address: '123 Main Street, New York, NY 10001',
        phone: '+1 (555) 987-6543',
        email: 'info@citydental.com',
        taxRate: 5,
        currency: 'USD',
        businessHours: '9:00 AM - 6:00 PM',
        createdAt: new Date().toISOString()
      };
      
      await saveClinicSettings(defaultSettings);
      return defaultSettings;
    }
    
    const docData = snapshot.docs[0].data();
    return {
      id: snapshot.docs[0].id,
      clinicName: docData.clinicName,
      address: docData.address,
      phone: docData.phone,
      email: docData.email,
      taxRate: docData.taxRate,
      currency: docData.currency,
      businessHours: docData.businessHours,
      createdAt: docData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: docData.updatedAt?.toDate().toISOString()
    } as ClinicSettings;
  } catch (error) {
    console.error('Error fetching clinic settings:', error);
    throw error;
  }
};

export const saveClinicSettings = async (settings: Omit<ClinicSettings, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const settingsRef = collection(db, CLINIC_SETTINGS_COLLECTION);
    const snapshot = await getDocs(settingsRef);
    
    if (snapshot.empty) {
      // Create new settings
      const newSettings = {
        ...settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(settingsRef, newSettings);
      return docRef.id;
    } else {
      // Update existing settings
      const docId = snapshot.docs[0].id;
      const settingsRef = doc(db, CLINIC_SETTINGS_COLLECTION, docId);
      
      await updateDoc(settingsRef, {
        ...settings,
        updatedAt: serverTimestamp()
      });
      
      return docId;
    }
  } catch (error) {
    console.error('Error saving clinic settings:', error);
    throw error;
  }
};

// Backup History Operations
export const addBackupRecord = async (backupData: {
  type: 'full' | 'partial';
  size: string;
  items: string[];
  status: 'success' | 'failed';
}): Promise<string> => {
  try {
    const backupRef = collection(db, BACKUP_HISTORY_COLLECTION);
    
    const newBackup = {
      ...backupData,
      date: serverTimestamp(),
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(backupRef, newBackup);
    return docRef.id;
  } catch (error) {
    console.error('Error adding backup record:', error);
    throw error;
  }
};

export const getBackupHistory = async (): Promise<any[]> => {
  try {
    const backupRef = collection(db, BACKUP_HISTORY_COLLECTION);
    const q = query(backupRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate().toLocaleDateString() || new Date().toLocaleDateString(),
        type: data.type,
        size: data.size,
        items: data.items || [],
        status: data.status
      };
    });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    return [];
  }
};

// Data Export Functions
export const exportCollectionData = async (collectionName: string): Promise<any[]> => {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error exporting ${collectionName}:`, error);
    throw error;
  }
};

// Bulk Export for Backup
export const exportAllData = async (collections: string[]): Promise<Record<string, any[]>> => {
  try {
    const exportData: Record<string, any[]> = {};
    
    for (const collectionName of collections) {
      exportData[collectionName] = await exportCollectionData(collectionName);
    }
    
    return exportData;
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
};