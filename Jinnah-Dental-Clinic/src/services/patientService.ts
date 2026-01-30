import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types";

const patientsRef = collection(db, "patients");

// Get patient by patientNumber (4-digit ID)
export const getPatientByNumber = async (patientNumber: string): Promise<Patient | null> => {
  try {
    const q = query(patientsRef, where("patientNumber", "==", patientNumber));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    
    return {
      id: docSnap.id,
      patientNumber: data.patientNumber || patientNumber,
      name: data.name || '',
      phone: data.phone || '',
      age: data.age || 0,
      gender: data.gender || 'other',
      address: data.address || '',
      openingBalance: data.openingBalance || 0,
      email: data.email || '',
      emergencyContact: data.emergencyContact || '',
      bloodGroup: data.bloodGroup || '',
      allergies: data.allergies || '',
      medicalHistory: data.medicalHistory || '',
      notes: data.notes || '',
      registrationDate: data.registrationDate || '',
      lastVisit: data.lastVisit || '',
      totalVisits: data.totalVisits || 0,
      totalPaid: data.totalPaid || 0,
      pendingBalance: data.pendingBalance || 0,
      totalTreatmentFees: data.totalTreatmentFees || 0, // optional field
      isActive: data.isActive !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
    } as Patient;
  } catch (error) {
    console.error("Error getting patient by number:", error);
    return null;
  }
};

export const getAllPatients = async (): Promise<Patient[]> => {
  try {
    const q = query(patientsRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        patientNumber: data.patientNumber || '',
        name: data.name || '',
        phone: data.phone || '',
        age: data.age || 0,
        gender: data.gender || 'other',
        address: data.address || '',
        openingBalance: data.openingBalance || 0,
        email: data.email || '',
        emergencyContact: data.emergencyContact || '',
        bloodGroup: data.bloodGroup || '',
        allergies: data.allergies || '',
        medicalHistory: data.medicalHistory || '',
        notes: data.notes || '',
        registrationDate: data.registrationDate || '',
        lastVisit: data.lastVisit || '',
        totalVisits: data.totalVisits || 0,
        totalPaid: data.totalPaid || 0,
        pendingBalance: data.pendingBalance || 0,
        totalTreatmentFees: data.totalTreatmentFees || 0,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      } as Patient;
    });
  } catch (error) {
    console.error("Error getting patients:", error);
    return [];
  }
};

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
  try {
    const patientRef = doc(db, 'patients', patientId);
    const snapshot = await getDoc(patientRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      patientNumber: data.patientNumber || '',
      name: data.name || '',
      phone: data.phone || '',
      age: data.age || 0,
      gender: data.gender || 'other',
      address: data.address || '',
      openingBalance: data.openingBalance || 0,
      email: data.email || '',
      emergencyContact: data.emergencyContact || '',
      bloodGroup: data.bloodGroup || '',
      allergies: data.allergies || '',
      medicalHistory: data.medicalHistory || '',
      notes: data.notes || '',
      registrationDate: data.registrationDate || '',
      lastVisit: data.lastVisit || '',
      totalVisits: data.totalVisits || 0,
      totalPaid: data.totalPaid || 0,
      pendingBalance: data.pendingBalance || 0,
      totalTreatmentFees: data.totalTreatmentFees || 0,
      isActive: data.isActive !== false,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
    } as Patient;
  } catch (error) {
    console.error("Error getting patient by ID:", error);
    return null;
  }
};

export const addPatient = async (data: Omit<Patient, "id">): Promise<{ id: string; patientNumber: string }> => {
  try {
    const patientData = {
      patientNumber: data.patientNumber,
      name: data.name || '',
      phone: data.phone || '',
      age: data.age || 0,
      gender: data.gender || 'other',
      address: data.address || '',
      openingBalance: data.openingBalance || 0,
      email: data.email || '',
      emergencyContact: data.emergencyContact || '',
      bloodGroup: data.bloodGroup || '',
      allergies: data.allergies || '',
      medicalHistory: data.medicalHistory || '',
      notes: data.notes || '',
      registrationDate: new Date().toISOString(),
      totalVisits: 0,
      totalPaid: 0,
      pendingBalance: data.openingBalance || 0,
      totalTreatmentFees: 0,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(patientsRef, patientData);
    return { id: docRef.id, patientNumber: data.patientNumber };
  } catch (error) {
    console.error("Error adding patient:", error);
    throw error;
  }
};

export const updatePatient = async (id: string, data: Partial<Patient>) => {
  try {
    const patientRef = doc(db, "patients", id);
    
    const sanitizeValue = (value: any): any => {
      if (value === undefined || value === null) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string' && value.includes('T') && value.includes('Z')) return value;
      return value;
    };
    
    const firestoreData: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      const sanitized = sanitizeValue(value);
      if (sanitized !== undefined) {
        firestoreData[key] = sanitized;
      }
    }
    
    firestoreData.updatedAt = serverTimestamp();
    
    await updateDoc(patientRef, firestoreData);
  } catch (error) {
    console.error("Error updating patient:", error);
    throw error;
  }
};

export const deletePatient = async (id: string) => {
  try {
    await deleteDoc(doc(db, "patients", id));
  } catch (error) {
    console.error("Error deleting patient:", error);
    throw error;
  }
};

/**
 * AUTHORITATIVE patient stats calculation
 * - Uses BILLS as source of truth for fees & payments
 * - Opening balance comes directly from patient record
 */
export const getPatientStats = async (patientNumber: string) => {
  const { getQueueItemsByPatientNumber } = await import('./queueService');
  const { getBillsByPatientNumber } = await import('./billingService');

  const patient = await getPatientByNumber(patientNumber);
  if (!patient) throw new Error('Patient not found');

  const [queueItems, bills] = await Promise.all([
    getQueueItemsByPatientNumber(patientNumber),
    getBillsByPatientNumber(patientNumber)
  ]);

  const openingBalance = patient.openingBalance || 0;

  const completedTreatments = queueItems.filter(
    q => q.status === 'completed'
  );

  const totalVisits = completedTreatments.length;

  // ✅ Bills are the source of truth
  const totalTreatmentFees = bills.reduce(
    (sum, bill) => sum + (bill.totalAmount || 0),
    0
  );

  const totalPaid = bills.reduce(
    (sum, bill) => sum + (bill.amountPaid || 0),
    0
  );

  const pendingBalance = openingBalance + totalTreatmentFees - totalPaid;

  const lastVisit = completedTreatments.length
    ? completedTreatments
        .sort(
          (a, b) =>
            new Date(b.treatmentEndTime || b.checkInTime || 0).getTime() -
            new Date(a.treatmentEndTime || a.checkInTime || 0).getTime()
        )[0].treatmentEndTime
    : undefined;

  return {
    totalVisits,
    totalTreatmentFees,
    totalPaid,
    pendingBalance,
    openingBalance,
    lastVisit
  };
};

export const updatePatientWithStats = async (patientId: string) => {
  try {
    const patient = await getPatientById(patientId);
    if (!patient) return null;
    
    const stats = await getPatientStats(patient.patientNumber);
    
    const updateData = {
      totalVisits: stats.totalVisits,
      totalPaid: stats.totalPaid,
      pendingBalance: stats.pendingBalance,
      totalTreatmentFees: stats.totalTreatmentFees, // optional but good to store
      ...(stats.lastVisit && { lastVisit: stats.lastVisit }),
      updatedAt: serverTimestamp()
    };
    
    await updatePatient(patientId, updateData);
    
    return {
      ...patient,
      ...updateData,
      openingBalance: stats.openingBalance
    };
  } catch (error) {
    console.error('Error updating patient with stats:', error);
    throw error;
  }
};

export const syncAllPatientsStats = async () => {
  try {
    const patients = await getAllPatients();
    const results = [];
    
    for (const patient of patients) {
      try {
        const updated = await updatePatientWithStats(patient.id);
        results.push({
          patientNumber: patient.patientNumber,
          name: patient.name,
          success: true,
          data: updated
        });
      } catch (error: any) {
        results.push({
          patientNumber: patient.patientNumber,
          name: patient.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error syncing all patients:', error);
    throw error;
  }
};

/**
 * UI/Display only - fallback pending balance calculation
 * Prefer using stats from getPatientStats() when available
 */
export const calculatePatientPendingBalance = (patient: Patient, stats?: any) => {
  const openingBalance = patient.openingBalance || 0;
  
  // Preferred: use real stats if available
  if (stats?.pendingBalance !== undefined) {
    return stats.pendingBalance;
  }

  // Fallback / approximate (should be removed in future once all data is bill-based)
  // WARNING: This is NOT accurate - only for display when real stats unavailable
  const totalTreatmentFeesApprox = patient.totalVisits ? patient.totalVisits * 100 : 0;
  const totalPaid = patient.totalPaid || 0;
  
  return Math.max(0, openingBalance + totalTreatmentFeesApprox - totalPaid);
};