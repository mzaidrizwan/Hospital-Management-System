// src/services/billingService.ts
import { db } from '@/lib/firebase';
import { Bill } from '@/types';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const BILLS_COLLECTION = 'bills';

// Add new bill
export const addBill = async (billData: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const billsRef = collection(db, BILLS_COLLECTION);

    const newBill = {
      ...billData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(billsRef, newBill);

    // Optional: Sync patient after bill is added (if needed)
    if (billData.patientId) {
      setTimeout(() => {
        // syncPatientAfterTreatment(billData.patientId).catch(console.error);
      }, 1000);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};

// Get all bills for a patient using patientId (document ID)
export const getPatientBills = async (patientId: string): Promise<Bill[]> => {
  try {
    const billsRef = collection(db, BILLS_COLLECTION);
    const q = query(
      billsRef,
      where('patientId', '==', patientId),
      orderBy('createdDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();

      // Convert Firestore Timestamps to ISO strings
      const convertTimestamp = (timestamp: any) => {
        if (timestamp?.toDate) {
          return timestamp.toDate().toISOString();
        }
        return timestamp || null;
      };

      return {
        id: doc.id,
        patientId: data.patientId,
        patientNumber: data.patientNumber,
        patientName: data.patientName,
        queueItemId: data.queueItemId || data.queueId,
        treatment: data.treatment,
        fee: data.fee || 0,
        amountPaid: data.amountPaid || 0,
        discount: data.discount || 0,
        tax: data.tax || 0,
        totalAmount: data.totalAmount || 0,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
        createdDate: convertTimestamp(data.createdDate),
        billNumber: data.billNumber,
        items: data.items || [],
      } as Bill;
    });
  } catch (error) {
    console.error('Error fetching patient bills:', error);
    throw error;
  }
};

// Update bill payment status
export const updateBillPayment = async (billId: string, updateData: Partial<Bill>) => {
  try {
    const billRef = doc(db, BILLS_COLLECTION, billId);

    await updateDoc(billRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating bill:', error);
    throw error;
  }
};

// (Optional) Get bills by patientNumber (if you ever need it)
export const getBillsByPatientNumber = async (patientNumber: string): Promise<Bill[]> => {
  try {
    const q = query(
      collection(db, BILLS_COLLECTION),
      where('patientNumber', '==', patientNumber), // ← yahan patientNumber use kar rahe hain
      orderBy('createdDate', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Bill[];
  } catch (error) {
    console.error('Error fetching bills by patient number:', error);
    throw error;
  }
};