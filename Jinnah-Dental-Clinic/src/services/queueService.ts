import { db } from '@/lib/firebase';
import { QueueItem, Bill } from '@/types';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { syncPatientAfterTreatment } from './syncService';   // ← Added import

const QUEUE_COLLECTION = 'queue';

// Helper: Convert Firestore Timestamp → ISO string
const convertTimestamp = (timestamp: any): string | null => {
  if (!timestamp) return null;
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date(timestamp).toISOString();
};

// ────────────────────────────────────────────────────────────────
// 1. Add new queue item (Write-Through)
// ────────────────────────────────────────────────────────────────
export const addQueueItem = async (
  queueData: Omit<QueueItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const { smartSync } = await import('./syncService');
    const id = await smartSync(QUEUE_COLLECTION, queueData);
    return id as string;
  } catch (error) {
    console.error('Error adding queue item:', error);
    throw error;
  }
};

// ... Read operations ...
// ────────────────────────────────────────────────────────────────
// 2. Get ALL queue items (usually for admin/reception dashboard)
// ────────────────────────────────────────────────────────────────
export const getAllQueueItems = async (): Promise<QueueItem[]> => {
  try {
    const queueRef = collection(db, QUEUE_COLLECTION);
    const q = query(queueRef, orderBy('checkInTime', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        patientId: data.patientId || '',
        patientNumber: data.patientNumber || '',
        patientName: data.patientName || '',
        patientPhone: data.patientPhone || data.phone || '',
        tokenNumber: data.tokenNumber || 0,
        status: data.status || 'waiting',
        checkInTime: convertTimestamp(data.checkInTime) || new Date().toISOString(),
        treatmentStartTime: convertTimestamp(data.treatmentStartTime),
        treatmentEndTime: convertTimestamp(data.treatmentEndTime),
        treatment: data.treatment || '',
        doctor: data.doctor || '',
        priority: data.priority || 'normal',
        notes: data.notes || '',
        fee: data.fee || 0,
        paymentStatus: data.paymentStatus || 'pending',
        amountPaid: data.amountPaid || 0,
        previousPending: data.previousPending || 0,
        discount: data.discount || 0,
        cancelledAt: convertTimestamp(data.cancelledAt),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as QueueItem;
    });
  } catch (error) {
    console.error('Error fetching all queue items:', error);
    throw error;
  }
};

// ────────────────────────────────────────────────────────────────
// 3. Get queue history by patientNumber (most flexible)
// ────────────────────────────────────────────────────────────────
export const getQueueItemsByPatientNumber = async (patientNumber: string): Promise<QueueItem[]> => {
  try {
    const queueRef = collection(db, QUEUE_COLLECTION);

    const queries = [
      query(
        queueRef,
        where('patientNumber', '==', patientNumber),
        orderBy('checkInTime', 'desc')
      ),
      query(
        queueRef,
        where('patientId', '==', patientNumber),
        orderBy('checkInTime', 'desc')
      )
    ];

    let allItems: QueueItem[] = [];

    for (const q of queries) {
      try {
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            patientId: data.patientId || '',
            patientNumber: data.patientNumber || patientNumber,
            patientName: data.patientName || '',
            patientPhone: data.patientPhone || data.phone || '',
            tokenNumber: data.tokenNumber || 0,
            status: data.status || 'waiting',
            checkInTime: convertTimestamp(data.checkInTime) || new Date().toISOString(),
            treatmentStartTime: convertTimestamp(data.treatmentStartTime),
            treatmentEndTime: convertTimestamp(data.treatmentEndTime),
            treatment: data.treatment || '',
            doctor: data.doctor || '',
            priority: data.priority || 'normal',
            notes: data.notes || '',
            fee: data.fee || 0,
            paymentStatus: data.paymentStatus || 'pending',
            amountPaid: data.amountPaid || 0,
            previousPending: data.previousPending || 0,
            discount: data.discount || 0,
            cancelledAt: convertTimestamp(data.cancelledAt),
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt)
          } as QueueItem;
        });
        allItems = [...allItems, ...items];
      } catch (err) {
        console.warn('Query failed:', err);
        continue;
      }
    }

    // Remove duplicates + sort (just in case)
    const unique = Array.from(
      new Map(allItems.map(item => [item.id, item])).values()
    ).sort((a, b) => {
      return new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime();
    });

    return unique;
  } catch (error) {
    console.error('Error fetching queue items by patient number:', error);
    return [];
  }
};

// ────────────────────────────────────────────────────────────────
// 4. Get queue items by Firebase patient ID (more strict)
// ────────────────────────────────────────────────────────────────
export const getQueueItemsByPatientId = async (patientId: string): Promise<QueueItem[]> => {
  try {
    const queueRef = collection(db, QUEUE_COLLECTION);
    const q = query(
      queueRef,
      where('patientId', '==', patientId),
      orderBy('checkInTime', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        patientId: data.patientId || '',
        patientNumber: data.patientNumber || '',
        patientName: data.patientName || '',
        patientPhone: data.patientPhone || data.phone || '',
        tokenNumber: data.tokenNumber || 0,
        status: data.status || 'waiting',
        checkInTime: convertTimestamp(data.checkInTime) || new Date().toISOString(),
        treatmentStartTime: convertTimestamp(data.treatmentStartTime),
        treatmentEndTime: convertTimestamp(data.treatmentEndTime),
        treatment: data.treatment || '',
        doctor: data.doctor || '',
        priority: data.priority || 'normal',
        notes: data.notes || '',
        fee: data.fee || 0,
        paymentStatus: data.paymentStatus || 'pending',
        amountPaid: data.amountPaid || 0,
        previousPending: data.previousPending || 0,
        discount: data.discount || 0,
        cancelledAt: convertTimestamp(data.cancelledAt),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      } as QueueItem;
    });
  } catch (error) {
    console.error('Error fetching queue items by patient ID:', error);
    return [];
  }
};

// ────────────────────────────────────────────────────────────────
// 5. Update queue item + AUTO SYNC PATIENT (Write-Through)
// ────────────────────────────────────────────────────────────────
export const updateQueueItem = async (
  id: string,
  updateData: Partial<QueueItem>
): Promise<{ success: boolean; id: string }> => {
  try {
    const { smartSync, syncPatientAfterTreatment } = await import('./syncService');

    // Get current data from local (or fallback to firebase if needed, but local-first is better)
    const { getFromLocal } = await import('./indexedDbUtils');
    const currentData = await getFromLocal(QUEUE_COLLECTION, id) as any;

    await smartSync(QUEUE_COLLECTION, { ...currentData, ...updateData, id });

    // Auto-sync patient stats when treatment is marked completed
    if (
      updateData.status === 'completed' &&
      currentData?.status !== 'completed'
    ) {
      const patientNumber = currentData?.patientNumber || updateData.patientNumber;
      if (patientNumber) {
        setTimeout(() => {
          syncPatientAfterTreatment(patientNumber)
            .catch(err => console.error('Patient sync failed after completion:', err));
        }, 1200);
      }
    }

    return { success: true, id };
  } catch (error) {
    console.error('Error updating queue item:', error);
    throw error;
  }
};

// ────────────────────────────────────────────────────────────────
// 6. Delete queue item (Write-Through)
// ────────────────────────────────────────────────────────────────
export const deleteQueueItem = async (id: string): Promise<void> => {
  try {
    const { smartDelete } = await import('./syncService');
    await smartDelete(QUEUE_COLLECTION, id);
  } catch (error) {
    console.error('Error deleting queue item:', error);
    throw error;
  }
};

// ────────────────────────────────────────────────────────────────
// 7. Today's token count
// ────────────────────────────────────────────────────────────────
export const getTodayTokenCount = async (): Promise<number> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queueRef = collection(db, QUEUE_COLLECTION);
    const snapshot = await getDocs(queueRef);

    let count = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const checkIn = convertTimestamp(data.checkInTime);
      if (checkIn) {
        const d = new Date(checkIn);
        if (d >= today && d < tomorrow) count++;
      }
    });

    return count;
  } catch (error) {
    console.error('Error getting today token count:', error);
    return 0;
  }
};

// ────────────────────────────────────────────────────────────────
// 8. Next token number for today
// ────────────────────────────────────────────────────────────────
export const getNextTokenNumber = async (): Promise<number> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const queueRef = collection(db, QUEUE_COLLECTION);
    const snapshot = await getDocs(queueRef);

    let max = 0;
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const checkIn = convertTimestamp(data.checkInTime);
      if (checkIn) {
        const d = new Date(checkIn);
        if (d >= today && d < tomorrow) {
          const token = Number(data.tokenNumber) || 0;
          if (token > max) max = token;
        }
      }
    });

    return max + 1;
  } catch (error) {
    console.error('Error getting next token number:', error);
    return 1;
  }
};

// ────────────────────────────────────────────────────────────────
// 9. Get single queue item by ID
// ────────────────────────────────────────────────────────────────
export const getQueueItemById = async (id: string): Promise<QueueItem | null> => {
  try {
    const queueRef = doc(db, QUEUE_COLLECTION, id);
    const docSnap = await getDoc(queueRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      patientId: data.patientId || '',
      patientNumber: data.patientNumber || '',
      patientName: data.patientName || '',
      patientPhone: data.patientPhone || data.phone || '',
      tokenNumber: data.tokenNumber || 0,
      status: data.status || 'waiting',
      checkInTime: convertTimestamp(data.checkInTime) || new Date().toISOString(),
      treatmentStartTime: convertTimestamp(data.treatmentStartTime),
      treatmentEndTime: convertTimestamp(data.treatmentEndTime),
      treatment: data.treatment || '',
      doctor: data.doctor || '',
      priority: data.priority || 'normal',
      notes: data.notes || '',
      fee: data.fee || 0,
      paymentStatus: data.paymentStatus || 'pending',
      amountPaid: data.amountPaid || 0,
      previousPending: data.previousPending || 0,
      discount: data.discount || 0,
      cancelledAt: convertTimestamp(data.cancelledAt),
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt)
    } as QueueItem;
  } catch (error) {
    console.error('Error getting queue item by ID:', error);
    return null;
  }
};

// ────────────────────────────────────────────────────────────────
// 10. Quick queue statistics
// ────────────────────────────────────────────────────────────────
export const getQueueStats = async () => {
  try {
    const items = await getAllQueueItems();

    const waiting = items.filter(i => i.status === 'waiting').length;
    const inTreatment = items.filter(i => i.status === 'in_treatment').length;
    const completed = items.filter(i => i.status === 'completed').length;
    const cancelled = items.filter(i => i.status === 'cancelled').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = items.filter(i => {
      if (!i.checkInTime) return false;
      const d = new Date(i.checkInTime);
      return d >= today && d < tomorrow;
    }).length;

    return {
      total: items.length,
      waiting,
      inTreatment,
      completed,
      cancelled,
      today: todayCount
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    throw error;
  }
};


// ────────────────────────────────────────────────────────────────
// 11. Add new bill (for payment receipts)
// ────────────────────────────────────────────────────────────────
export const addBill = async (billData: Omit<Bill, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const { smartSync, syncPatientAfterTreatment } = await import('./syncService');
    const id = await smartSync('bills', billData);

    if (billData.patientId || billData.patientNumber) {
      const patientNumber = billData.patientNumber || billData.patientId;
      setTimeout(() => {
        syncPatientAfterTreatment(patientNumber)
          .catch(err => console.error('Patient sync after bill failed:', err));
      }, 800);
    }

    return id as string;
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
};